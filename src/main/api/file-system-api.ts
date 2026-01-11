import { Dirent, existsSync, ObjectEncodingOptions, Stats } from 'fs';
import { readdir, lstat, readFile, rm, writeFile, opendir, stat } from 'fs/promises';
import path, { basename, dirname, extname, normalize } from 'path';
import { watch } from 'chokidar';
import { app, shell } from 'electron';
import log from 'electron-log/main';
import Store from 'electron-store';
import StreamZip from 'node-stream-zip';
// This IS built-in to Node.js
import {
  BundleMetaFile,
  FileFormatsToFileTypes,
  FileType,
  MainIpcCallbacks,
  MainIpcGetter,
  MetaFileExtension,
  StoreSchema,
  supportedTypes,
  zipDelimiter,
} from '../../shared/constants';
import {
  FilePath,
  TypedEventEmitter,
  foreachAsync,
  getProjectDir,
  getZipParentFs,
  ignoredFilesMatch,
  supportedFilesMatch,
} from '../util';

export type Events = {
  'file-changed': [path: FilePath];
  'file-added': [path: FilePath];
  'file-removed': [path: FilePath];
};

export const fileEvents = new TypedEventEmitter<Events>();

export async function isPartOfArchive(filePath: FilePath, includeZip?: boolean, fileStats?: Stats) {
  if (!fileStats && !existsSync(filePath.absolute)) {
    const zipArchive = getZipParentFs(filePath);
    return zipArchive;
  }

  if (includeZip === false) {
    return false;
  }

  const stats = fileStats ?? (await pathStat(filePath));
  if (stats.isFile() && (await isArchive(filePath, false))) {
    return true;
  }

  return false;
}

export async function isArchive(filePath: FilePath, isDirectory?: boolean) {
  if (!isDirectory && !existsSync(filePath.absolute)) {
    return false;
  }
  const finalIsDirectory = isDirectory ?? (await pathStat(filePath)).isDirectory();
  if (finalIsDirectory) {
    return false;
  }

  return filePath.path.toLocaleLowerCase().endsWith(zipDelimiter);
}

export function pathExistsSync(filePath: FilePath) {
  return existsSync(path.join(filePath.projectDir, filePath.path));
}

export function pathReaddir(
  filePath: FilePath,
  options: ObjectEncodingOptions & {
    withFileTypes: true;
  },
): Promise<Dirent[]> {
  return readdir(path.join(filePath.projectDir, filePath.path), options);
}

export function pathLstat(filePath: FilePath) {
  return lstat(filePath.absolute);
}

export async function pathStat(filePath: FilePath) {
  try {
    return await stat(path.join(filePath.projectDir, filePath.path));
  } catch (e: any) {
    throw new Error(e.message);
  }
}

export async function findBundlePath(filePath: FilePath): Promise<FilePath | undefined> {
  if (await isArchive(filePath)) {
    const rootBundleMetaFile = path.join(filePath.projectDir, `${filePath.path}.${BundleMetaFile}`);
    if (existsSync(rootBundleMetaFile)) {
      return filePath;
    }
  }

  const rootBundleMetaFile = path.join(filePath.projectDir, filePath.path, BundleMetaFile);
  if (existsSync(rootBundleMetaFile)) {
    return filePath;
  }

  let currentPath = dirname(filePath.path);
  const { root } = path.parse(currentPath);

  while (currentPath !== root) {
    let bundleMetaPath: string;
    // eslint-disable-next-line no-await-in-loop
    const fileStat = await stat(filePath.with(currentPath).absolute);

    if (fileStat.isFile()) {
      bundleMetaPath = `${currentPath}.${BundleMetaFile}`;
    } else {
      bundleMetaPath = path.join(currentPath, BundleMetaFile);
    }

    if (existsSync(path.join(filePath.projectDir, bundleMetaPath))) {
      return filePath.with(currentPath);
    }

    // Reached the top level
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  const rootStat = await lstat(path.join(filePath.projectDir, root));
  let rootBundleMetaPath: string;
  // Check root
  if (rootStat.isFile()) {
    rootBundleMetaPath = `${root}.${BundleMetaFile}`;
  } else {
    rootBundleMetaPath = path.join(root, BundleMetaFile);
  }

  if (existsSync(path.join(filePath.projectDir, rootBundleMetaPath))) {
    return filePath.with(root);
  }
  return undefined;
}

async function onOpenPath(pathToOpen: FilePath) {
  if (!existsSync(pathToOpen.absolute)) {
    const zipArchive = await getZipParentFs(pathToOpen);
    if (zipArchive) {
      shell.showItemInFolder(zipArchive.absolute);
    }
  }
  const info = await lstat(pathToOpen.absolute);
  if (info) {
    if (info.isDirectory()) {
      shell.openPath(pathToOpen.absolute);
    } else {
      shell.showItemInFolder(pathToOpen.absolute);
    }
  }
}

export async function getMetaId(filePath: FilePath, fileStats?: Stats) {
  if (filePath.path.endsWith(BundleMetaFile) || filePath.path.endsWith(MetaFileExtension)) {
    return filePath;
  }

  const stats = fileStats ?? (await pathStat(filePath));

  if (stats.isDirectory()) {
    return filePath.join(BundleMetaFile);
  }

  if (await isArchive(filePath, stats.isDirectory())) {
    return filePath.with(`${filePath.path}.${BundleMetaFile}`);
  }
  return filePath.with(`${filePath.path}.${MetaFileExtension}`);
}

export async function getMetadata(
  filePath: FilePath,
  fileStat?: Stats,
): Promise<AnyMetadata | null> {
  let existingMeta: AnyMetadata | undefined;
  let stats = fileStat;
  try {
    stats = await pathStat(filePath);
  } catch {
    return null;
  }
  const metaPath = await getMetaId(filePath, stats);
  if (existsSync(metaPath.absolute)) {
    try {
      const metaBuffer = await readFile(metaPath.absolute, 'utf8');
      existingMeta = JSON.parse(metaBuffer.toString());
    } catch {
      /* empty */
    }
  }

  return existingMeta ?? null;
}

export async function operateOnMetadata(
  filePath: FilePath,
  op: (meta: AnyMetadata) => Promise<boolean>,
): Promise<AnyMetadata> {
  let fileStat: Stats;
  try {
    fileStat = await pathStat(filePath);
  } catch {
    return {};
  }
  let existingMeta = await getMetadata(filePath);
  const hadExisting = !!existingMeta;

  existingMeta ??= {};
  if (await op(existingMeta)) {
    if (!hadExisting && fileStat.isDirectory()) {
      throw new Error('Cannot create metadata for bundle');
    }
    const metaPath = await getMetaId(filePath, fileStat);
    await writeFile(metaPath.absolute, JSON.stringify(existingMeta));
  }

  return existingMeta;
}

export async function getTags(filePath: FilePath): Promise<string[]> {
  const meta = await getMetadata(filePath);
  return meta?.tags ?? [];
}

export async function getDescription(filePath: FilePath): Promise<string | undefined> {
  const meta = await getMetadata(filePath);
  return meta?.description;
}

async function allFilesRec(
  parentPath: FilePath,
  process: (path: FilePath) => void,
  includeBundles: boolean = false,
): Promise<void> {
  const parentDir = await pathStat(parentPath);
  if (!parentDir.isDirectory()) {
    return;
  }

  const dirs = await pathReaddir(parentPath, {
    withFileTypes: true,
  });

  await Promise.all(
    dirs.map(async (dir) => {
      const childPath = parentPath.join(dir.name);
      const childExt = extname(childPath.path);

      // Directory
      if (dir.isDirectory()) {
        if (includeBundles) {
          if (pathExistsSync(childPath.join(BundleMetaFile))) {
            process(childPath);
          }
        }
        await allFilesRec(childPath, process);
      }
      // Non Directory
      else if (!supportedTypes.has(childExt) || ignoredFilesMatch(dir.name)) {
        /* empty */
      } else {
        process(childPath);
      }
    }),
  );
}

function getFileNodeFromZipEntry(
  zipPath: FilePath,
  zipStats: Stats,
  entryPath: string,
  entry: StreamZip.ZipEntry,
): FileTreeNode {
  return {
    name: entry.name,
    path: path.join(zipPath.path, entryPath),
    isDirectory: entry.isDirectory,
    isArchived: true,
    stats: {
      size: entry.size,
      ino: zipStats.ino,
      mtimeMs: entry.time,
    },
    isEmpty: false,
  } satisfies FileTreeNode;
}

function getZipEntries(zipPath: FilePath) {
  // eslint-disable-next-line new-cap
  const zip = new StreamZip.async({ file: zipPath.absolute });
  return zip.entries();
}

/**
 * The recursive file iteration.
 * @param recursive If set to false it will return 1 deep files only if child is a folder.
 * @param parallel Should all files in a folder be processed in parallel rather then iteratively.
 * @param includeBundles If set to true, even bundles will be return. Otherwise returns files only unless recursive is set to false then it will return folders.
 */
async function forAllFilesRec(
  projectDir: string,
  parent: FileTreeNode,
  handler: (node: FileTreeNode) => Promise<any>,
  recursive: boolean,
  parallel: boolean,
  abort?: AbortSignal,
  includeBundles?: boolean,
) {
  if (!parent.isDirectory) {
    return;
  }

  const dirs = await readdir(path.join(projectDir, parent.path), { withFileTypes: true });
  async function handleDir(dir: Dirent) {
    const childPath = path.join(parent.path, dir.name);
    const isDirectory = dir.isDirectory();
    const childExt = extname(childPath).toLowerCase();
    const fileStates = await pathStat(new FilePath(projectDir, childPath));

    // Skip meta files
    if (ignoredFilesMatch(childPath)) {
      return;
    }

    const child: FileTreeNode = {
      isDirectory,
      name: dir.name,
      path: childPath,
      fileType: FileFormatsToFileTypes.get(childExt),
      stats: fileStates,
      bundlePath: parent.bundlePath,
      isEmpty: false,
      isArchived: false,
    };

    if (isDirectory) {
      const bundleMetaPath = path.join(childPath, BundleMetaFile);
      if (existsSync(path.join(projectDir, bundleMetaPath))) {
        child.bundlePath = childPath;
        child.fileType = FileType.Bundle;
      }
    }

    // Directory
    if (isDirectory) {
      if (recursive) {
        if (abort?.aborted) {
          return;
        }
        if (includeBundles === true && child.fileType === FileType.Bundle) {
          await handler(child);
        }
        await forAllFilesRec(projectDir, child, handler, true, parallel, abort, includeBundles);
      } else {
        await handler(child);
        const dirIter = await opendir(path.join(projectDir, childPath));
        const { value, done } = await dirIter[Symbol.asyncIterator]().next();
        if (!done) await dirIter.close();
        child.isEmpty = !value;
      }
    }
    // Non Directory
    else if (!supportedFilesMatch(childPath)) {
      /* empty */
    } else if (childExt === '.zip') {
      if (recursive) {
        const zipEntries = await getZipEntries(new FilePath(projectDir, childPath));
        await foreachAsync(
          Object.keys(zipEntries).filter((p) => !ignoredFilesMatch(p)),
          (p) => {
            const entry = zipEntries[p];
            return handler(
              getFileNodeFromZipEntry(new FilePath(projectDir, childPath), fileStates, p, entry),
            );
          },
          abort,
        );
      } else {
        child.isArchived = true;
        child.isDirectory = true;
        const bundleMetaPath = `${childPath}.${BundleMetaFile}`;
        if (existsSync(path.join(projectDir, bundleMetaPath))) {
          child.bundlePath = childPath;
          child.fileType = FileType.Bundle;
        }
        await handler(child);
      }
    } else {
      await handler(child);
    }
  }

  if (parallel) {
    await Promise.all(dirs.map(handleDir));
  } else {
    await foreachAsync(dirs, handleDir, abort);
  }
}

/**
 * Returns the file at the destiation or all children paths in the given folder or zip file
 * @param destinationPath Could be either a file path or a folder.
 * @param parallel Should all files in a folder be processed in parallel instead of iteratively.
 * @param includeBundles will return not just files but also bundles.
 */
export async function forAllAssetsIn(
  destinationPath: FilePath,
  handler: (node: FileTreeNode) => Promise<void>,
  parallel: boolean,
  abort?: AbortSignal,
  includeBundles?: boolean,
) {
  const folderStat = await pathStat(destinationPath);
  const bundle = await findBundlePath(destinationPath);

  if (await isArchive(destinationPath, folderStat.isDirectory())) {
    // Handle Zip files
    const entries = await getZipEntries(destinationPath);
    await foreachAsync(
      Object.keys(entries),
      (p) => {
        const entry = entries[p];
        const node = getFileNodeFromZipEntry(destinationPath, folderStat, p, entry);
        node.bundlePath = bundle?.path;
        return handler(node);
      },
      abort,
    );
  } else if (folderStat.isDirectory()) {
    // Handle directories
    const parent: FileTreeNode = {
      isDirectory: true,
      bundlePath: bundle?.path,
      name: basename(destinationPath.path),
      path: destinationPath.path,
      stats: folderStat,
      isEmpty: false,
      isArchived: false,
    };

    if (!pathExistsSync(destinationPath)) {
      return;
    }

    if (ignoredFilesMatch(destinationPath.path)) {
      return;
    }

    const dirIter = await opendir(destinationPath.absolute, {});
    const { value, done } = await dirIter[Symbol.asyncIterator]().next();
    if (!done) await dirIter.close();
    parent.isEmpty = !value;

    if (bundle?.path === destinationPath.path && includeBundles === true) {
      await handler(parent);
    }

    await forAllFilesRec(
      destinationPath.projectDir,
      parent,
      handler,
      true,
      parallel,
      abort,
      includeBundles,
    );
  } else if (folderStat.isFile()) {
    // Just return the file straight up
    const name = basename(destinationPath.path);
    const dir = dirname(destinationPath.path);
    const fileNode = await getFile(name, destinationPath.with(dir), bundle?.path);
    if (fileNode) {
      await handler(fileNode);
    }
  }
}

export async function getAllAssetsIn(
  folder: FilePath,
  abort?: AbortSignal,
  includeBundles?: boolean,
): Promise<FileTreeNode[]> {
  const allFiles: FileTreeNode[] = [];
  await forAllAssetsIn(
    folder,
    async (node) => {
      allFiles.push(node);
    },
    true,
    abort,
    includeBundles,
  );

  return allFiles.sort((a, b) => a.name?.localeCompare(b.name));
}

export function forAllAssetsInProject(
  store: Store<StoreSchema>,
  handler: (node: FileTreeNode) => Promise<void>,
  parallel: boolean,
  abort?: AbortSignal,
  includeBundles?: boolean,
) {
  const projectDir = getProjectDir(store) ?? '';
  return forAllAssetsIn(new FilePath(projectDir, ''), handler, parallel, abort, includeBundles);
}

async function setTags(filePath: FilePath, tags: string[]): Promise<string[] | null> {
  const bundlePath = filePath.join(BundleMetaFile);
  if (pathExistsSync(bundlePath)) {
    const bundle = await operateOnMetadata(bundlePath, async (b) => {
      b.tags = tags;
      return true;
    });
    return bundle.tags ?? null;
  }
  const meta = await operateOnMetadata(filePath, async (m) => {
    m.tags = tags;
    return true;
  });
  return meta?.tags ?? null;
}

/** Get the file tree node. This does not expand recursively down to get all other files if a directory or a zip */
async function getFile(
  name: string,
  dirPath: FilePath,
  bundlePath?: string,
): Promise<FileTreeNode | null> {
  const childPath = path.join(dirPath.path, name);
  const childAbsolutePath = dirPath.join(name).absolute;
  const childExt = extname(childPath).toLowerCase();
  const fileStats = await lstat(childAbsolutePath);

  const child: FileTreeNode = {
    isDirectory: fileStats.isDirectory() || childExt === zipDelimiter,
    name,
    path: childPath,
    fileType: FileFormatsToFileTypes.get(childExt),
    stats: fileStats,
    bundlePath,
    isEmpty: true,
    isArchived: childExt === zipDelimiter,
  };

  if (ignoredFilesMatch(child.name)) {
    return null;
  }

  if (fileStats.isFile()) {
    if (!supportedTypes.has(childExt)) {
      return null;
    }

    if (childExt === zipDelimiter) {
      const entries = getZipEntries(dirPath.with(childPath));
      child.isEmpty = Object.keys(entries).length <= 0;
    }
  } else if (fileStats.isDirectory()) {
    const dirIter = await opendir(childAbsolutePath);
    const { value, done } = await dirIter[Symbol.asyncIterator]().next();
    if (!done) await dirIter.close();
    child.isEmpty = !value;
  }

  return child;
}

/** Get Format the asset path to be absolute */
export function resolveAssetPath(store: Store<StoreSchema>, p: string) {
  let filePath: string;
  const projectDir = getProjectDir(store);
  if (!projectDir) {
    throw new Error('Project Directory Not Set');
  }

  if (path.isAbsolute(p)) {
    if (!p.startsWith(projectDir)) {
      throw new Error(`Path ${p} is not withing project ${projectDir}`);
    }
    filePath = p;
  } else {
    filePath = path.join(projectDir, p);
  }

  return filePath;
}

/**
 * Similar to {@link getFile} but it automatically fetches the bundle the file is at.
 * It does an upwards search to check if a parent folder is a bundle.
 */
async function getFileFromPath(filePath: FilePath) {
  if (!pathExistsSync(filePath)) {
    // file doesn't exist so start checking alternatives
    const zipPath = await getZipParentFs(filePath);
    if (zipPath) {
      const zipStats = await pathStat(zipPath);
      const entries = await getZipEntries(zipPath);
      const entryLocalPath = filePath.path.substring(zipPath.path.length + 1);
      return getFileNodeFromZipEntry(zipPath, zipStats, entryLocalPath, entries[entryLocalPath]);
    }

    return null;
  }

  const bundlePath = await findBundlePath(filePath);
  return getFile(
    path.basename(filePath.path),
    filePath.with(path.dirname(filePath.path)),
    bundlePath?.path,
  );
}

/**
 * Gets the direct decedents of the file if a folder. Non recursive.
 * @returns Empty array if a file.
 */
async function getChildrenPaths(filePath: FilePath): Promise<string[]> {
  const fileStat = await pathStat(filePath);
  if (fileStat.isDirectory()) {
    const dirs = await pathReaddir(filePath, { withFileTypes: true });

    return dirs
      .filter((d) => {
        const childExt = extname(d.name).toLowerCase();
        if (d.isFile() && (!supportedTypes.has(childExt) || ignoredFilesMatch(d.name))) {
          return false;
        }
        return true;
      })
      .map((d) => path.join(filePath.path, d.name));
  }

  if (filePath.path.endsWith('.zip')) {
    const zipEntries = await getZipEntries(filePath);
    return Object.keys(zipEntries);
  }

  return [];
}

/**
 * Same as {@link getChildrenPaths} but builds descendants as nodes. Non recursive.
 */
async function getChildren(p: FilePath): Promise<FileTreeNode[]> {
  const filePath = p;

  const fileStat = await lstat(filePath.absolute);
  if (fileStat.isDirectory()) {
    const allFiles: FileTreeNode[] = [];
    await forAllFilesRec(
      filePath.projectDir,
      { path: filePath.path, isDirectory: true } as FileTreeNode,
      async (n) => {
        allFiles.push(n);
      },
      false,
      true,
    );
    return allFiles;
  }

  if (filePath.path.endsWith('.zip')) {
    const zipEntries = await getZipEntries(filePath);
    return Object.keys(zipEntries)
      .filter((e) => !ignoredFilesMatch(e) && supportedFilesMatch(e))
      .map((e) => getFileNodeFromZipEntry(filePath, fileStat, e, zipEntries[e]));
  }

  return [];
}

function setupFileWatch(api: MainIpcCallbacks, projectDir: string) {
  log.log('Started Watching ', projectDir);
  const watcher = watch(projectDir, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: true,
  });

  watcher
    .on('add', (p) => {
      const filePath = p.substring(projectDir.length + 1);
      fileEvents.emit('file-added', new FilePath(projectDir, filePath));
      if (!ignoredFilesMatch(p) && supportedFilesMatch(p)) {
        api.fileAdded(filePath);
      }
    })
    .on('addDir', (p) => {
      if (!ignoredFilesMatch(p) && supportedFilesMatch(p)) {
        api.folderAdded(p.substring(projectDir.length + 1));
      }
    })
    .on('unlinkDir', (p) => {
      if (!ignoredFilesMatch(p) && supportedFilesMatch(p)) {
        api.folderUnlinked(p.substring(projectDir.length + 1));
      }
    })
    .on('unlink', (p) => {
      const filePath = p.substring(projectDir.length + 1);
      fileEvents.emit('file-removed', new FilePath(projectDir, filePath));
      if (!ignoredFilesMatch(p) && supportedFilesMatch(p)) {
        api.fileUnlinked(p.substring(projectDir.length + 1));
      }
    })
    .on('change', (p) => {
      const filePath = p.substring(projectDir.length + 1);
      fileEvents.emit('file-changed', new FilePath(projectDir, filePath));
      if (!ignoredFilesMatch(p) && supportedFilesMatch(p)) {
        api.fileChanged(filePath);
      }
    });

  return () => {
    watcher
      .close()
      .then(() => log.log('Stopped Watching ', projectDir))
      .catch((e) => log.error(e));
  };
}

async function addTags(filePath: FilePath, tags: string[]): Promise<string[] | null> {
  const meta = await operateOnMetadata(filePath, async (m) => {
    if (m.tags) {
      m.tags.push(...tags);
    } else {
      m.tags = tags;
    }

    return true;
  });
  return meta?.tags ?? null;
}

async function removeTag(filePath: FilePath, tag: string): Promise<string[] | null> {
  const meta = await operateOnMetadata(filePath, async (m) => {
    const tagIndex = m.tags?.indexOf(tag);
    if (tagIndex !== undefined && tagIndex >= 0) {
      m.tags?.splice(tagIndex, 1);
      return true;
    }
    return false;
  });
  return meta?.tags ?? null;
}

async function getParentTags(filePath: FilePath): Promise<string[]> {
  const parentTags: Set<string> = new Set<string>();
  const parentStack = filePath.path.split(path.sep);
  while (parentStack.length > 0) {
    parentStack.pop();
    const parentPath = parentStack.join(path.sep);
    // eslint-disable-next-line no-await-in-loop
    const tags = await getTags(filePath.with(parentPath));
    tags?.forEach((tag: string) => parentTags.add(tag));
  }
  return Array.from(parentTags);
}

/* ----------------------------- Initialize API  ----------------------------- */
export default function InitializeFileSystemApi(
  api: MainIpcGetter,
  apiCallbacks: MainIpcCallbacks,
  store: Store<StoreSchema>,
  db: Loki,
) {
  function beforeQuit() {
    db.save((saveError: Error) => {
      if (saveError) {
        log.error(saveError);
      }
    });
  }

  async function getAllTags(limit?: number) {
    const tagsSet = new Map<string, number>();
    const projectDir = getProjectDir(store) ?? '';
    await allFilesRec(
      new FilePath(projectDir, ''),
      async (filePath) => {
        const tags = await getTags(filePath);
        tags?.forEach((t) => {
          const tag = t.toString();
          if (tagsSet.has(tag)) {
            tagsSet.set(tag, tagsSet.get(tag)! + 1);
          } else {
            tagsSet.set(tag, 1);
          }
        });
      },
      true,
    );
    const virtualBundles = db.getCollection<VirtualBundle>('bundles');
    virtualBundles.find().forEach((v) => {
      v.tags?.forEach((t) => tagsSet.set(t, (tagsSet.get(t) ?? 0) + 1));
    });
    const tags = Array.from(tagsSet.entries()).sort((a, b) => b[1] - a[1]);
    return {
      tags: tags
        .slice(0, limit ? Math.min(tags.length - 1, limit) : tags.length)
        .map((e) => ({ tag: e[0], count: e[1] }) as GlobalTagEntry),
      count: tags.length,
    };
  }

  async function removeAllTags(filePath: FilePath): Promise<void> {
    await forAllAssetsIn(
      filePath,
      async (node) => {
        await operateOnMetadata(filePath.with(node.path), async (meta) => {
          if (meta.tags) {
            meta.tags = [];
            return true;
          }

          return false;
        });
      },
      true,
    );
  }

  const projectDir = getProjectDir(store) ?? '';
  let fileWatchDispose: (() => void) | undefined;
  if (projectDir) {
    fileWatchDispose = setupFileWatch(apiCallbacks, projectDir);
  }

  const fileIndexers: FileIndexingHandler[] = [];
  const fileIndexersPre: FileIndexingHandler[] = [];

  // File index registry
  const fileIndexRegistry: FileLoaderRegistry = {
    register: (handler) => fileIndexers.push(handler),
    registerPre: (handler) => fileIndexersPre.push(handler),
    index: async (abort, progress) => {
      const preHandlers = (
        await Promise.all(
          fileIndexersPre.map((l) =>
            l({
              projectDir,
              abort,
            }),
          ),
        )
      ).filter((h) => !!h);

      let assetCount = 0;
      // Calculate assets counts. We need to know them in advance to show progress bar.
      await forAllAssetsInProject(
        store,
        async (node) => {
          await Promise.all(preHandlers.map((h) => h(node)));
          assetCount += 1;
        },
        true,
        abort,
        true,
      );

      const handlers = (
        await Promise.all(
          fileIndexers.map((l) =>
            l({
              projectDir,
              abort,
            }),
          ),
        )
      ).filter((h) => !!h);
      let progressValue = 0;
      // Go over all assets
      await forAllAssetsInProject(
        store,
        async (node) => {
          foreachAsync(handlers, (handler) => handler(node));
          if (abort.aborted) {
            return;
          }
          progressValue += 1 / assetCount;
          progress?.(progressValue);
        },
        false,
        abort,
        true,
      );
    },
  };

  app.on('before-quit', beforeQuit);
  api.getTags = (p) => getTags(new FilePath(projectDir, normalize(p)));
  api.addTags = (p, t) => addTags(new FilePath(projectDir, normalize(p)), t);
  api.removeTag = (p, t) => removeTag(new FilePath(projectDir, normalize(p)), t);
  api.removeAllTags = (p) => removeAllTags(new FilePath(projectDir, normalize(p)));
  api.getParentTags = (p) => getParentTags(new FilePath(projectDir, normalize(p)));
  api.getMetadata = (p) =>
    p ? getMetadata(new FilePath(projectDir, normalize(p))) : Promise.reject(p);
  api.getAllFiles = (p) => getAllAssetsIn(new FilePath(projectDir, normalize(p)));
  api.getGlobalTags = getAllTags;
  api.setTags = (p, t) => setTags(new FilePath(projectDir, normalize(p)), t);
  api.getFile = (p) => getFileFromPath(new FilePath(projectDir, normalize(p)));
  api.getFileChildrenPaths = (p) => getChildrenPaths(new FilePath(projectDir, normalize(p)));
  api.getFileChildren = (p) => getChildren(new FilePath(projectDir, normalize(p)));
  api.openPath = (p) => onOpenPath(new FilePath(projectDir, normalize(p)));

  const cleanup = async () => {
    app.removeListener('before-quit', beforeQuit);
    fileWatchDispose?.();
  };

  return { removeAllTags, cleanup, fileIndexRegistry };
}
