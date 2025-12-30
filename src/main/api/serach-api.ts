import { createHash } from 'crypto';
import { stat } from 'fs/promises';
import path from 'path';
import Store from 'electron-store';
import Loki from 'lokijs';
import {
  StoreSchema,
  FileFormatsToFileTypes,
  FileType,
  MainIpcGetter,
} from '../../shared/constants';
import { addTask, cancelTasks } from '../managers/task-manager';
import { getBundles } from './bundles-api';
import { getAllAssets, getMetadata, operateOnMetadata } from './file-system-api';
import { embeddingsService } from './search/EmbeddingsService';
import {
  clearDatabase,
  IndexSchema,
  search,
  initialize as initializeOrama,
  removeFile,
  indexFile,
} from './search/Orama';
import { getSetting } from './settings';

export async function generateEmbeddings(filePath: FilePath) {
  const metadata = await operateOnMetadata<FileMetadata>(filePath, async (meta) => {
    if (meta.description) {
      const embeddings = await embeddingsService.generate(meta.description);
      meta.embeddings = {
        hash: createHash('md5').update(meta.description).digest('hex'),
        data: embeddings,
        model: embeddingsService.model,
      };
      return true;
    }
    return false;
  });
  return metadata;
}

export function generateMissingEmbeddings(store: Store<StoreSchema>) {
  const projectDir = store.get('projectDirectory');
  return addTask('Generating Missing Embeddings', async (a, p) => {
    const allFiles = await getAllAssets(store);
    for (const file of allFiles) {
      a.throwIfAborted();

      const meta = await getMetadata<FileMetadata>({ projectDir, path: file.path });
      if (meta && meta.description && !meta.embeddings) {
        await generateEmbeddings({ projectDir, path: file.path });
      }
    }
  });
}

export async function removeIndex(filePath: FilePath) {
  await removeFile(filePath);
}

/**
 * Updates a file in the Orama index from a given file path.
 * If the file is part of a bundle, the bundle information is also updated.
 * @param {string} filePath - The path to the file to update.
 */
export async function updateFileFromPath(filePath: FilePath, bundle?: BundleInfo) {
  const ext = path.extname(filePath.path).toLowerCase();
  const meta = await getMetadata<IndexSchema>(filePath);

  const info: FileInfo = {
    size: 0,
    path: filePath.path,
    name: path.basename(filePath.path),
    fileExt: ext,
    fileType: FileFormatsToFileTypes.get(ext),
    directory: path.dirname(filePath.path),
    hasMaterialLibrary: false,
    isDirectory: false,
    hasThumbnail: false,
  };
  if (bundle) {
    info.bundle = {
      name: bundle.name,
      bundle,
      isParentBundle: false,
    };
    if (filePath.path === bundle.id) {
      info.fileType = FileType.Bundle;
    }
  }
  await indexFile(info, meta);
}

/**
 * Loads all valid files from the given store and virtual bundles into the Orama index.
 * The function will abort if the abort signal is set to true.
 * The function will also call the report function with the progress of the indexing process.
 * @param {Store<StoreSchema>} store - The store to load the files and virtual bundles from.
 * @param {Loki} db - The LOKI database to load the virtual bundles from.
 * @param {AbortSignal} [abort] - The abort signal to check for.
 * @param {(p: number) => void} [report] - The report function to call with the progress of the indexing process.
 * @returns {Promise<void>} - A promise that resolves when the indexing process is finished.
 */
export async function LoadVectorDatabase(
  store: Store<StoreSchema>,
  db: Loki,
  abort?: AbortSignal,
  report?: (p: number) => void,
): Promise<void> {
  clearDatabase();

  const files: FileTreeNode[] = await getAllAssets(store);

  const virtualBundles = db.getCollection<VirtualBundle>('bundles');
  const allBundles = await getBundles(store, virtualBundles);
  const bundlesMap: Map<string, BundleInfo> = new Map();
  allBundles.forEach((b) => bundlesMap.set(path.join(b.id, 'bundle.json'), b));
  const validFiles = files;
  let progress = 0;
  const maxProgress = validFiles.length + allBundles.length;

  const projectDirectory = (store.get('projectDirectory') as string) ?? '';

  for await (const fileNode of files.filter((f) => !f.isArchived)) {
    const bundle = fileNode.bundlePath ? bundlesMap.get(fileNode.bundlePath) : undefined;
    await updateFileFromPath({ projectDir: projectDirectory, path: fileNode.path }, bundle);
    if (abort?.aborted) {
      return;
    }
    progress += 1;
    if (report) {
      report(progress / maxProgress);
    }
  }

  for await (const bundle of allBundles.filter((b) => !b.isVirtual)) {
    await updateFileFromPath({ projectDir: projectDirectory, path: bundle.id }, bundle);
  }

  console.log(`Finished indexing ${validFiles.length} assets`);
  //await oramaManager.persistIndex(store.get('projectDirectory'));
}

export async function InitializeGlobalSearchApi(api: MainIpcGetter) {
  await initializeOrama();
}

export function InitializeSearchApi(api: MainIpcGetter, store: Store<StoreSchema>, db: Loki) {
  // Orama IPC Handlers
  api.reIndexDatabaseSearch = async () => {
    await initializeOrama();
    cancelTasks((t) => t.label == 'Indexing Files');
    addTask('Indexing Files', (a, p) => LoadVectorDatabase(store, db, a, p));
  };
  api.generateEmbeddings = (p) =>
    generateEmbeddings({ projectDir: store.get('projectDirectory'), path: p });
  api.generateMissingEmbeddings = () => generateMissingEmbeddings(store);
  api.search = async (query: string, typeFilter: FileType[], page: number) => {
    const results = await search(store, query, typeFilter, page);
    const projectDir = store.get('projectDirectory');
    return {
      nodes: await Promise.all(
        results.hits.map(async (h) => {
          const stats = await stat(path.join(projectDir, h.id));
          const entry: SearchTreeNode = {
            name: h.document.filename,
            path: h.document.path,
            bundlePath: h.document.bundleId,
            fileType: h.document.fileType,
            isDirectory: false,
            children: [],
            tags: h.document.tags ?? [],
            size: stats?.size ?? 0,
            score: h.score,
            isEmpty: false,
            isArchived: false,
          };
          return entry;
        }),
      ),
      count: results.count,
      pageSize: getSetting(store, 'searchResultsPerPage'),
    };
  };
}
