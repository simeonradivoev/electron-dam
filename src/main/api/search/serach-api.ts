import { createHash } from 'crypto';
import { stat } from 'fs/promises';
import path, { basename } from 'path';
import '@orama/plugin-qps';
import log from 'electron-log/main';
import Store from 'electron-store';
import Loki from 'lokijs';
import { FilePath, foreachAsync } from 'main/util';
import { stringSimilarity } from 'string-similarity-js';
import {
  StoreSchema,
  FileFormatsToFileTypes,
  FileType,
  MainIpcGetter,
} from '../../../shared/constants';
import { addTask } from '../../managers/task-manager';
import {
  findBundleInfoForFile,
  getBundles,
  getVirtualBundles,
  tryGetBundleEntryFromFolderPath,
} from '../bundles-api';
import {
  fileEvents,
  forAllAssetsIn,
  forAllAssetsInProject,
  getAllAssetsIn,
  getMetadata,
  operateOnMetadata,
  pathStat,
} from '../file-system-api';
import { getSetting } from '../settings';
import { generate, model } from './EmbeddingsService';
import { clearDatabase, search, initialize as initializeOrama, remove, index } from './orama';

export async function removeIndex(filePath: FilePath) {
  await remove(filePath);
}

/**
 * Updates a file in the Orama index from a given file path.
 * If the file is part of a bundle, the bundle information is also updated.
 * @param {string} filePath - The path to the file to update.
 */
export async function updateFileFromPath(projectDir: string, id: string, bundle?: BundleInfo) {
  const ext = path.extname(id).toLowerCase();
  const meta = bundle?.isVirtual ? undefined : await getMetadata(new FilePath(projectDir, id));

  const entry: SearchEntrySchema = {
    id,
    filename: bundle?.isVirtual ? bundle.name : basename(id),
    description: meta?.description ?? '',
    path: id,
    fileType: FileFormatsToFileTypes.get(ext),
    tags: meta?.tags,
    bundleId: bundle?.id || '',
    embeddings: meta?.embeddings?.data,
    isArchived: false,
    isVirtual: bundle?.isVirtual ?? false,
    virtualPreview: bundle?.previewUrl,
  };

  if (bundle) {
    if (bundle.bundle.description && !entry.description) {
      entry.description = bundle.bundle.description ?? '';
    }

    if (!entry.tags && bundle.bundle.tags) {
      entry.tags = bundle.bundle.tags;
    }

    if (id === bundle.id) {
      entry.fileType = FileType.Bundle;
    }
  }
  await index(entry);
}

export async function InitializeGlobalSearchApi() {
  await initializeOrama();
}

export function embeddingsOutOfDate(metadata: AnyMetadata) {
  if (metadata.embeddings) {
    if (metadata.description) {
      const hash = createHash('md5').update(metadata.description).digest('hex');
      return hash !== metadata.embeddings.hash || model !== metadata.embeddings.model;
    }

    return true;
  }

  return false;
}

/** Update embeddings only if they are outdated or missing */
export async function updateFileEmbeddings(filePath: FilePath) {
  const metadata = await getMetadata(filePath);
  if (metadata !== null) {
    if (metadata.embeddings) {
      if (embeddingsOutOfDate(metadata)) {
        if (metadata.description) {
          await generateFileEmbeddings(filePath);
          log.log(`Updated Out Of Date Embeddings on ${filePath.path}`);
        } else {
          await operateOnMetadata(filePath, async (meta) => {
            meta.embeddings = undefined;
            return true;
          });
          log.log(`Removed Embeddings on ${filePath.path}`);
        }
      }
    } else if (metadata.description) {
      await generateFileEmbeddings(filePath);
      log.log(`Generated Missing Embeddings on ${filePath.path}`);
    }
  }
}

/** Force generate the embeddings */
export async function generateFileEmbeddings(filePath: FilePath) {
  return operateOnMetadata(filePath, async (meta) => {
    if (meta.description) {
      const embeddings = await generate(meta.description);
      meta.embeddings = {
        hash: createHash('md5').update(meta.description).digest('hex'),
        data: embeddings,
        model,
      };
      return true;
    }
    return false;
  });
}

export function InitializeSearchApi(
  api: MainIpcGetter,
  store: Store<StoreSchema>,
  db: Loki,
  registry: FileLoaderRegistry,
) {
  async function generateEmbeddings(filePath: FilePath, abort: AbortSignal, fireEvents: boolean) {
    const destinationStat = await stat(filePath.absolute);
    if (destinationStat.isDirectory()) {
      forAllAssetsIn(
        filePath,
        async (asset) => {
          await generateEmbeddings(filePath.with(asset.path), abort, fireEvents);
        },
        true,
        abort,
      );

      return null;
    }

    return generateFileEmbeddings(filePath);
  }

  function generateMissingEmbeddings() {
    const projectDir = store.get('projectDirectory');
    return addTask('Generating Missing Embeddings', async (a) => {
      await forAllAssetsInProject(
        store,
        async (file) => {
          const meta = await getMetadata(new FilePath(projectDir, file.path));
          if (meta && meta.description && !meta.embeddings) {
            await generateEmbeddings(new FilePath(projectDir, file.path), a, true);
          }
        },
        true,
      );
    });
  }

  async function registerEmeddingGeneration({
    projectDir,
  }: FileIndexerParams): ReturnType<FileIndexingHandler> {
    return async (node) => {
      await updateFileEmbeddings(new FilePath(projectDir, node.path));
    };
  }

  async function registerVectorIndexing({
    abort,
  }: FileIndexerParams): ReturnType<FileIndexingHandler> {
    await clearDatabase();
    const virtualBundles = db.getCollection<VirtualBundle>('bundles');
    const projectDir = (store.get('projectDirectory') as string) ?? '';

    // eslint-disable-next-line no-restricted-syntax
    for await (const bundle of await getVirtualBundles(virtualBundles)) {
      await updateFileFromPath(projectDir, bundle.id, bundle);
      if (abort.aborted) {
        break;
      }
    }

    return async (node) => {
      if (node.isArchived) {
        return;
      }
      let bundle: BundleInfo | undefined;
      if (node.bundlePath) {
        bundle =
          (await tryGetBundleEntryFromFolderPath(new FilePath(projectDir, node.bundlePath))) ??
          undefined;
      }
      await updateFileFromPath(projectDir, node.path, bundle);
    };
  }

  // Index files for searching
  registry.register(registerEmeddingGeneration);
  registry.register(registerVectorIndexing);

  // Orama IPC Handlers
  api.generateEmbeddings = (asset) =>
    addTask(`Generating Embeddings ${asset}`, (a, p) =>
      generateEmbeddings(FilePath.fromStore(store, asset), a, true),
    );
  api.generateMissingEmbeddings = () => generateMissingEmbeddings();
  api.canGenerateEmbeddings = async (assetPath) => {
    const metadata = await getMetadata(FilePath.fromStore(store, assetPath));
    return !!metadata?.description;
  };

  api.search = async (query: string, typeFilter: FileType[], page: number) => {
    const results = await search(store, query, typeFilter, page);
    return {
      nodes: await Promise.all(
        results.hits.map(async (h) => {
          const entry = {
            ...h.document,
            tags:
              h.document.tags
                ?.map((t) => ({ tag: t, score: stringSimilarity(t, query) }))
                .sort((a, b) => b.score - a.score)
                .map((t) => t.tag) ?? [],
            score: h.score,
          } satisfies SearchEntryResult as SearchEntryResult;

          return entry;
        }),
      ),
      count: results.count,
      pageSize: getSetting(store, 'searchResultsPerPage'),
    };
  };
}
