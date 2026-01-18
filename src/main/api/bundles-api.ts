/* eslint-disable no-await-in-loop */
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { writeFile, readFile, mkdir, rename, stat, rm } from 'fs/promises';
import path, { normalize } from 'path';
import { dialog, BrowserWindow, shell, Notification, session } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
import JSZip from 'jszip';
import Loki from 'lokijs';
import StreamZip from 'node-stream-zip';
import sharp from 'sharp';
import z from 'zod/v3';
import {
  BundleMetaFile,
  StoreSchema,
  MainIpcGetter,
  previewTypes,
  LoginProvider,
  zipDelimiter,
  AnyMetadataChanges,
} from '../../shared/constants';
import { addTask } from '../managers/task-manager';
import { FilePath, getProjectDir, getRandom, ignoredFilesMatch } from '../util';
import {
  findBundlePath,
  forAllAssetsInProject,
  getAllAssetsIn,
  getMetadata,
  isArchive,
  operateOnMetadata,
  pathExistsSync,
  pathReaddir,
  pathStat,
  resolveAssetPath,
} from './file-system-api';

interface MetadataIssues {
  missingDescription: boolean;
  canGenerateEmbeddings: boolean;
  missingEmbeddings: boolean;
  hasBundle: boolean;
}

export async function checkMetadataIssues(projectDir: string, node: FileTreeNode) {
  const metadata = await getMetadata(new FilePath(projectDir, node.path));
  return {
    missingDescription: !metadata?.description,
    canGenerateEmbeddings: !!metadata?.description,
    missingEmbeddings: !metadata?.embeddings,
    hasBundle: !!node.bundlePath,
  } satisfies MetadataIssues as MetadataIssues;
}

async function searchParents<T>(
  searchPath: FilePath,
  filter: (parentPath: FilePath) => Promise<T | undefined>,
): Promise<T | undefined> {
  const parentChain = searchPath.path.split(path.sep);
  const promises = parentChain.map((parentPath, index) =>
    filter(new FilePath(searchPath.projectDir, path.join(...parentChain.slice(0, index + 1)))),
  );
  const results = await Promise.all(promises);
  return results.find((result) => result !== undefined) ?? undefined;
}

export async function loadDirectoryBundle(
  bundleDirectory: FilePath,
): Promise<BundleInfo | undefined> {
  const bundlePath = bundleDirectory.join(BundleMetaFile);
  const bundleStat = await pathStat(bundlePath).catch(() => null);
  if (bundleStat) {
    const fileData = await readFile(path.join(bundlePath.projectDir, bundlePath.path), 'utf8');
    const entry: BundleInfo = {
      id: bundleDirectory.path,
      bundle: JSON.parse(fileData),
      isVirtual: false,
      name: path.basename(bundleDirectory.path),
      date: bundleStat.birthtime,
    };
    return entry;
  }
  return undefined;
}

export async function loadZipBundle(bundleDirectory: FilePath): Promise<BundleInfo | undefined> {
  const bundleAbsPath = `${path.join(bundleDirectory.projectDir, bundleDirectory.path)}.${BundleMetaFile}`;
  const bundleStat = await stat(bundleAbsPath).catch(() => null);
  if (bundleStat) {
    const fileData = await readFile(bundleAbsPath, 'utf8');
    const entry: BundleInfo = {
      id: bundleDirectory.path,
      bundle: JSON.parse(fileData),
      isVirtual: false,
      name: path.basename(bundleDirectory.path),
      date: bundleStat.birthtime,
    };
    return entry;
  }
  return undefined;
}

export async function searchParentBundle(
  searchPath: FilePath,
): Promise<{ bundle: BundleInfo; name: string; directory: string } | undefined> {
  return searchParents(searchPath, async (parentPath: FilePath) => {
    const bundle = await loadDirectoryBundle(parentPath);
    if (bundle) {
      return { bundle, name: path.basename(parentPath.path), directory: parentPath.path };
    }
    return undefined;
  });
}

async function createBundle(bundlePath: FilePath): Promise<boolean> {
  const directoryStat = await pathStat(bundlePath);
  if (directoryStat.isDirectory()) {
    const bundle: Bundle = {};
    return writeFile(
      path.join(bundlePath.projectDir, bundlePath.path, BundleMetaFile),
      JSON.stringify(bundle),
    )
      .catch((err) => {
        log.error(err);
        return false;
      })
      .then(() => true);
  }

  if (bundlePath.path.endsWith('.zip')) {
    const bundle: Bundle = {};
    return writeFile(
      path.join(bundlePath.projectDir, `${bundlePath.path}.${BundleMetaFile}`),
      JSON.stringify(bundle),
    )
      .catch((err) => {
        log.error(err);
        return false;
      })
      .then(() => true);
  }

  return false;
}

export async function findZipPreviewReadable(zipPath: FilePath) {
  const zip = new StreamZip.async({ file: path.join(zipPath.projectDir, zipPath.path) });
  for (const previewExt of previewTypes) {
    const previewEntry = await zip.entry(`Preview${previewExt}`);
    if (previewEntry) {
      return zip.stream(previewEntry);
    }
  }

  return undefined;
}

export function findFolderPreview(folder: FilePath) {
  for (let index = 0; index < previewTypes.length; index += 1) {
    const type = previewTypes[index];
    const previewPath = folder.join(`Preview${type}`);
    if (pathExistsSync(previewPath)) {
      return previewPath.path;
    }
  }

  return undefined;
}

export async function tryGetBundleEntryFromFolderPath(
  directoryPath: FilePath,
): Promise<BundleInfo | null> {
  const bundleStat = await pathStat(directoryPath).catch(() => null);
  if (bundleStat) {
    const bundle = await getMetadata(directoryPath, bundleStat);
    if (!bundle) {
      return null;
    }
    const bundleEntry: BundleInfo = {
      id: directoryPath.path,
      bundle,
      name: path.basename(directoryPath.path),
      isVirtual: false,
      date: bundleStat.birthtime,
    };

    if (bundleStat.isDirectory()) {
      const bundlePreview = findFolderPreview(directoryPath);
      bundleEntry.previewUrl = bundlePreview;
    }

    return bundleEntry;
  }

  return null;
}

async function findChildrenBundles(parent: FilePath, bundles: BundleInfo[]): Promise<void> {
  const dirs = await pathReaddir(parent, { withFileTypes: true });

  await Promise.all(
    dirs
      .filter((d) => !ignoredFilesMatch(parent.join(d.name).absolute))
      .map(async (dir) => {
        const childPath = parent.join(dir.name);
        const isZip = await isArchive(childPath, dir.isDirectory());

        if (dir.isDirectory() || isZip) {
          const bundle = await tryGetBundleEntryFromFolderPath(childPath);

          if (bundle) {
            bundles.push(bundle);
          } else if (!isZip) {
            await findChildrenBundles(childPath, bundles);
          }
        }
      }),
  );
}

export async function getVirtualBundles(
  virtualBundles: Collection<VirtualBundle>,
): Promise<BundleInfo[]> {
  return virtualBundles.find().map(
    (b) =>
      ({
        id: b.id,
        name: b.name,
        previewUrl: b.previewUrl,
        bundle: b,
        isVirtual: true,
        date: new Date(b.date),
      }) satisfies BundleInfo as BundleInfo,
  );
}

export async function getBundles(
  store: Store<StoreSchema>,
  virtualBundles?: Collection<VirtualBundle>,
): Promise<BundleInfo[]> {
  const bundles: BundleInfo[] = [];
  const projectDir = getProjectDir(store);
  if (projectDir) {
    await findChildrenBundles(new FilePath(projectDir, ''), bundles);
  }

  if (virtualBundles) {
    bundles.push(...(await getVirtualBundles(virtualBundles)));
  }

  return bundles.sort((a, b) => b.date?.getTime() - a.date?.getTime());
}

export async function findBundleInfoForFile(filePath: FilePath): Promise<BundleInfo | null> {
  const bundlePath = await findBundlePath(filePath);
  if (bundlePath) {
    return tryGetBundleEntryFromFolderPath(bundlePath);
  }
  return null;
}

export async function convertBundleToLocal(
  store: Store<StoreSchema>,
  db: Loki,
  id: string,
): Promise<boolean> {
  const virtualBundles = db.getCollection<VirtualBundle>('bundles');
  const virtualBundle = virtualBundles.findOne({ id });
  if (!virtualBundle) {
    return false;
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Zip Files', extensions: ['zip'] }],
  });

  if (canceled || filePaths.length === 0) {
    return false;
  }

  const zipPath = filePaths[0];
  const projectDir = getProjectDir(store);

  if (!projectDir) {
    return false;
  }

  const sanitizedBundleName = virtualBundle.name.replace(/[<>:"/\\|?*]/g, '_');
  const destinationPath = path.join(projectDir, sanitizedBundleName);

  return addTask(`Convert ${virtualBundle.name}`, async (signal) => {
    try {
      await mkdir(destinationPath, { recursive: true });

      // Use PowerShell to expand archive
      const command = `Expand-Archive -Path "${zipPath}" -DestinationPath "${destinationPath}" -Force`;
      const child = spawn('powershell.exe', [command]);

      const cleanup = () => {
        try {
          child.kill();
        } catch (e) {
          log.error('Failed to kill process', e);
        }
      };

      signal.addEventListener('abort', cleanup);

      await new Promise<void>((resolve, reject) => {
        child.on('exit', (code) => {
          signal.removeEventListener('abort', cleanup);
          if (code === 0) {
            resolve();
          }
          // If aborted, we might get a non-zero code or just killed.
          else if (signal.aborted) {
            reject(new Error('Aborted'));
          } else {
            reject(new Error(`PowerShell exited with code ${code}`));
          }
        });
        child.on('error', (err) => {
          signal.removeEventListener('abort', cleanup);
          reject(err);
        });
      });

      if (signal.aborted) {
        throw new Error('Aborted');
      }

      // Create bundle.json
      const bundle: Bundle = {
        ...virtualBundle,
      };
      await writeFile(path.join(destinationPath, BundleMetaFile), JSON.stringify(bundle));

      // Remove virtual bundle
      virtualBundles.findAndRemove({ id });

      return true;
    } catch (error) {
      log.error('Failed to convert bundle:', error);
      // Cleanup if possible (e.g. delete destinationPath)
      // We might want to delete the folder if it was partially created
      throw error;
    }
  });
}

async function exportBundle(
  p: FilePath,
  abort: AbortSignal,
  progress: (p: number) => void,
): Promise<void> {
  const zipFile = await dialog.showSaveDialog({
    filters: [{ name: 'Zip', extensions: ['zip'] }],
  });

  if (!zipFile.canceled && zipFile.filePath) {
    const zipFilePath = zipFile.filePath;
    const bundleFiles = await getAllAssetsIn(p);
    const zip = new JSZip();
    bundleFiles.forEach((file, i) => {
      zip.file(file.path.substring(p.path.length + 1), readFile(file.path));
      abort.throwIfAborted();
      progress(i / bundleFiles.length);
    });

    zip
      .generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(createWriteStream(zipFilePath))
      .on('finish', () => {
        new Notification({
          title: 'Bundle Exported',
          body: `Bundle exported to ${zipFilePath}`,
        }).show();
        shell.showItemInFolder(zipFilePath);
      });
  }
}

async function getHumbleCookieHeader(): Promise<string> {
  const cookies = await session.defaultSession.cookies.get({
    domain: '.humblebundle.com',
  });

  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/* ----------------------------- Initialize API  ----------------------------- */

export default function InitializeBundlesApi(
  importers: Record<LoginProvider, BundleImporter>,
  api: MainIpcGetter,
  store: Store<StoreSchema>,
  db: Loki,
) {
  let virtualBundles = db.getCollection<VirtualBundle>('bundles');
  if (virtualBundles === null) {
    virtualBundles = db.addCollection<VirtualBundle>('bundles', {
      indices: 'id',
      unique: ['id'],
    });
  }

  async function getHomeBundles(): Promise<HomePageBundles | undefined> {
    const issues: MetadataIssues[] = [];
    let assetsSize = 0;
    const projectDir = getProjectDir(store);
    if (!projectDir) return undefined;
    await forAllAssetsInProject(
      store,
      async (node) => {
        issues.push(await checkMetadataIssues(projectDir, node));
        if (!node.isDirectory) {
          assetsSize += node.stats.size;
        }
      },
      true,
    );

    const missingBundlesCount = issues.filter((stats) => !stats.hasBundle).length;
    const missingMetadataCount = issues.filter(
      (stats) => stats.missingDescription && stats.hasBundle,
    ).length;
    const missingEmbeddingsCount = issues.filter(
      (stats) => stats.missingEmbeddings && stats.canGenerateEmbeddings,
    ).length;
    const assetCount = issues.length;

    const bundles = await getBundles(store, virtualBundles);

    const randomIndices: Array<number> = [];
    for (let i = 0; i < Math.min(3, bundles.length); i += 1) {
      let randomIndex = Math.floor(Math.random() * bundles.length);
      while (randomIndices.includes(randomIndex)) {
        randomIndex = Math.floor(Math.random() * bundles.length);
      }
      randomIndices.push(randomIndex);
    }
    const seed = new Date(Date.now()).setHours(0, 0, 0, 0);

    return {
      random: getRandom(bundles, 3, seed.toString()),
      recent: bundles
        .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
        .slice(0, Math.min(4, bundles.length)),
      stats: {
        bundleCount: bundles.length,
        virtualBundleCount: bundles.filter((b) => b.isVirtual).length,
        assetCount,
        assetsSize,
        missingMetadataCount,
        missingEmbeddingsCount,
        missingBundlesCount,
      },
    };
  }

  async function getBundle(id: string): Promise<BundleInfo | null> {
    const virtualBundle = virtualBundles.findOne({ id });
    if (virtualBundle) {
      return {
        id,
        isVirtual: true,
        bundle: virtualBundle as Bundle,
        previewUrl: virtualBundle.previewUrl,
        name: virtualBundle.name,
      } as BundleInfo;
    }
    return tryGetBundleEntryFromFolderPath(FilePath.fromStore(store, id));
  }

  async function deleteBundle(bundleId: string): Promise<void> {
    const virtualBundle = virtualBundles.findOne({ id: bundleId });
    if (virtualBundle) {
      virtualBundles.findAndRemove({ id: bundleId });
      return;
    }
    const bundlePath = normalize(path.join(getProjectDir(store) ?? '', bundleId, BundleMetaFile));
    if (await stat(bundlePath).catch(() => false)) {
      await rm(bundlePath);
    }
  }

  async function createVirtualBundle(bundle: VirtualBundle) {
    return virtualBundles.insertOne(bundle);
  }

  async function updateBundle(
    bundleId: string,
    changes: z.infer<typeof AnyMetadataChanges>,
  ): Promise<Bundle | null> {
    const validChanges = await AnyMetadataChanges.parseAsync(changes);

    const virtualBundle = virtualBundles.findOne({ id: bundleId });
    if (virtualBundle) {
      Object.assign(virtualBundle, validChanges);
      virtualBundles.update(virtualBundle);
      return virtualBundle;
    }
    return operateOnMetadata(FilePath.fromStore(store, bundleId), async (meta) => {
      Object.assign(meta, validChanges);
      return true;
    });
  }

  async function moveBundle(oldPath: string, newPath: string): Promise<boolean> {
    // 1. Verify newPath doesn't exist
    if (await stat(newPath).catch(() => false)) {
      throw new Error(`Destination already exists: ${newPath}`);
    }

    // 2. Move directory
    await rename(oldPath, newPath);

    // 4. Update virtual bundles if applicable (though move is usually for local)
    const virtualBundle = virtualBundles.findOne({ id: oldPath });
    if (virtualBundle) {
      virtualBundle.id = newPath;
      virtualBundle.name = path.basename(newPath);
      virtualBundles.update(virtualBundle);
    }

    return true;
  }

  async function downloadBundle(id: string, extract: boolean) {
    const virtualBundles = db.getCollection<VirtualBundle>('bundles');
    const virtualBundle = virtualBundles.findOne({ id });
    if (!virtualBundle) {
      throw new Error(`Could not find virtual bundle with ID ${id}`);
    }

    if (!virtualBundle.sourceType) {
      throw new Error('Could not find the source type of the bundle');
    }

    const projectDir = store.get('projectDirectory');
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['createDirectory', 'openDirectory'],
      defaultPath: projectDir,
    });

    if (canceled || filePaths.length <= 0) {
      throw new Error('Canceled Download');
    }

    return addTask(
      'Downloading Bundle',
      async (abort, progress) => {
        const downloadRaw = await importers[virtualBundle.sourceType!].getDownload(virtualBundle);
        const downloadURL = new URL(downloadRaw);
        if (!downloadURL.pathname.toLocaleLowerCase().endsWith(zipDelimiter)) {
          throw new Error(
            `Download ${downloadURL.href} format not supported. Only zip files supported`,
          );
        }

        progress(0.1);
        const response = await fetch(downloadURL, { signal: abort });
        const downloadAbsolutePath = path.join(projectDir, '.cache', `download${zipDelimiter}`);
        const fileStream = createWriteStream(downloadAbsolutePath);
        try {
          const arrayBuffer = await response.arrayBuffer();
          fileStream.write(Buffer.from(arrayBuffer));
        } finally {
          fileStream.close();
        }

        progress(0.5);
        const filePath = filePaths[0];
        if (!filePath.startsWith(normalize(projectDir))) {
          throw new Error('Path is not in project');
        }

        const localPath = filePath.substring(projectDir.length + 1);
        const destinationPath = new FilePath(projectDir, localPath);
        const existantBundle = await findBundlePath(destinationPath);
        const existantParentBundle = await searchParentBundle(destinationPath);

        if (existantBundle || existantParentBundle) {
          throw new Error('Bundle Already exists');
        }

        await mkdir(filePath, { recursive: true });
        progress(0.6);

        let bundlePath = destinationPath;

        if (extract) {
          const zip = new StreamZip.async({ file: downloadAbsolutePath });
          bundlePath = destinationPath.join(virtualBundle.name);
          await zip.extract(null, bundlePath.absolute);
          zip.close();
          await rm(downloadAbsolutePath);
          await createBundle(bundlePath);
        } else {
          bundlePath = destinationPath.join(`${virtualBundle.name}${zipDelimiter}`);
          await rename(downloadAbsolutePath, bundlePath.absolute);
          await createBundle(bundlePath);
        }

        progress(0.8);

        await operateOnMetadata(bundlePath, async (meta) => {
          meta.description = virtualBundle.description;
          meta.sourceUrl = virtualBundle.sourceUrl;
          meta.tags = virtualBundle.tags;
          if (virtualBundle.previewUrl && extract) {
            const res = await fetch(virtualBundle.previewUrl!, {
              signal: AbortSignal.any([AbortSignal.timeout(10000), abort]),
            });
            const data = await res.arrayBuffer();
            await sharp(data).webp().toFile(bundlePath.join('Preview.webp').absolute);
          }
          meta.sourceId = virtualBundle.sourceId;
          meta.sourceType = virtualBundle.sourceType;
          return true;
        });
        virtualBundles.remove(virtualBundle.$loki);
        progress(1);
      },
      { icon: 'download' },
    );
  }

  api.updateBundle = updateBundle;
  api.importBundles = async (type) => {
    const importer = importers[type];
    if (importer) {
      return addTask('Importing Bundles', async (abort, progress) =>
        importer.import(abort, progress),
      );
    }
    throw new Error(`No Importer of type ${type}`);
  };
  api.getBundles = () => getBundles(store, virtualBundles);
  api.getHomeBundles = getHomeBundles;
  api.createVirtualBundle = createVirtualBundle;
  api.getBundle = getBundle;
  api.deleteBundle = deleteBundle;
  api.convertBundleToLocal = (id) => convertBundleToLocal(store, db, id);
  api.downloadBundle = (id, extract) => downloadBundle(id, extract);
  api.moveBundle = (oldP, newP) =>
    moveBundle(resolveAssetPath(store, normalize(oldP)), resolveAssetPath(store, normalize(newP)));
  api.exportBundle = (p) =>
    addTask(`Exporting Bundle ${p}`, (a, progress) =>
      exportBundle(FilePath.fromStore(store, normalize(p)), a, progress),
    );
  api.createBundle = async (directory: string): Promise<boolean> =>
    createBundle(FilePath.fromStore(store, normalize(directory)));
}
