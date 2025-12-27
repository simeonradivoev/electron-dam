import { Dirent, existsSync, ObjectEncodingOptions } from 'fs';
import { readdir, lstat, readFile, rm, writeFile, opendir } from 'fs/promises';
import path, { dirname, extname, normalize } from 'path';
import { watch } from 'chokidar';
import { app, nativeImage, shell } from 'electron';
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
  MetaFileExtensionWithDot,
  StoreSchema,
  supportedTypes,
} from '../../shared/constants';
import { TypedEventEmitter, ignoredFilesMatch, supportedFilesMatch } from '../util';

export type Events = {
  'metadata-updated': [path: FilePath];
  'file-changed': [path: FilePath];
  'file-added': [path: FilePath];
  'file-removed': [path: FilePath];
};

export const fileEvents = new TypedEventEmitter<Events>();

export function pathExistsSync(filePath: FilePath) {
  return existsSync(path.join(filePath.projectDir, filePath.path));
}

export function pathJoin(filePath: FilePath, otherLocal: string): FilePath {
  return { projectDir: filePath.projectDir, path: path.join(filePath.path, otherLocal) };
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
  return lstat(path.join(filePath.projectDir, filePath.path));
}

export async function findBundlePath(filePath: FilePath): Promise<FilePath | undefined> {
  let currentPath = dirname(filePath.path);
  const { root } = path.parse(currentPath);

  while (currentPath !== root) {
    let bundlePath: string;
    const stat = await lstat(path.join(filePath.projectDir, currentPath));

    if (stat.isFile()) {
      bundlePath = `${currentPath}.${BundleMetaFile}`;
    } else {
      bundlePath = path.join(currentPath, BundleMetaFile);
    }

    if (existsSync(path.join(filePath.projectDir, bundlePath))) {
      return { projectDir: filePath.projectDir, path: bundlePath };
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  const rootStat = await lstat(path.join(filePath.projectDir, root));
  let rootBundlePath: string;
  // Check root
  if (rootStat.isFile()) {
    rootBundlePath = `${root}.${BundleMetaFile}`;
  } else {
    rootBundlePath = path.join(root, BundleMetaFile);
  }

  if (existsSync(path.join(filePath.projectDir, rootBundlePath))) {
    return { projectDir: filePath.projectDir, path: rootBundlePath };
  }
  return undefined;
}

async function onOpenPath(pathToOpen: FilePath) {
  const absolutePath = path.join(pathToOpen.projectDir, pathToOpen.path);
  const info = await lstat(absolutePath);
  if (info) {
    if (info.isDirectory()) {
      shell.openPath(absolutePath);
    } else {
      shell.showItemInFolder(absolutePath);
    }
  }
}

export function getMetaId(filePath: string): string {
  if (filePath.endsWith(BundleMetaFile)) {
    return filePath;
  }
  if (filePath.endsWith('.zip')) {
    return `${filePath}.${BundleMetaFile}`;
  }
  return `${filePath}.${MetaFileExtension}`;
}

export async function getMetadata<T>(filePath: FilePath): Promise<T | null> {
  let existingMeta: T | undefined;
  const metaPath = getMetaId(filePath.path);
  const metaAbsolutePath = path.join(filePath.projectDir, metaPath);
  if (existsSync(metaAbsolutePath)) {
    try {
      const metaBuffer = await readFile(metaAbsolutePath, 'utf8');
      existingMeta = JSON.parse(metaBuffer.toString());
    } catch {}
  }

  return existingMeta ?? null;
}

export async function operateOnMetadata<T>(
  filePath: FilePath,
  op: (meta: T) => Promise<boolean>,
): Promise<T> {
  const existingMeta = (await getMetadata<T>(filePath)) ?? ({} as T);

  if (await op(existingMeta)) {
    const metaPath = getMetaId(filePath.path);
    await writeFile(path.join(filePath.projectDir, metaPath), JSON.stringify(existingMeta));
    fileEvents.emit('metadata-updated', { projectDir: filePath.projectDir, path: filePath.path });
  }

  return existingMeta;
}

export async function getTags(filePath: FilePath): Promise<string[]> {
  let metaPath = filePath;
  const bundlePath = pathJoin(filePath, BundleMetaFile);
  if (pathExistsSync(bundlePath)) {
    metaPath = bundlePath;
  }
  const meta = await getMetadata<Tags>(metaPath);
  return meta?.tags ?? [];
}

export async function getDescription(filePath: FilePath): Promise<string | undefined> {
  const meta = await getMetadata<Description>(filePath);
  return meta?.description;
}

async function allFilesRec(parentPath: FilePath, process: (path: FilePath) => void): Promise<void> {
  const parentDir = await pathLstat(parentPath);
  if (!parentDir.isDirectory()) {
    return;
  }

  const dirs = await pathReaddir(parentPath, {
    withFileTypes: true,
  });

  await Promise.all(
    dirs.map(async (dir) => {
      const childPath = pathJoin(parentPath, dir.name);
      const childExt = extname(childPath.path);
      const fitsFilter = true;

      // Directory
      if (dir.isDirectory()) {
        await allFilesRec(childPath, process);
      }
      // Non Directory
      else if (!supportedTypes.has(childExt) || ignoredFilesMatch(dir.name) || !fitsFilter) {
        return;
      } else {
        process(childPath);
      }
    }),
  );
}

function getFileNodeFromZipEntry(
  zipPath: FilePath,
  entryPath: string,
  entry: StreamZip.ZipEntry,
): FileTreeNode {
  return {
    name: entry.name,
    path: path.join(zipPath.path, entryPath),
    isDirectory: entry.isDirectory,
    isArchived: true,
    size: entry.size,
    isEmpty: false,
  } satisfies FileTreeNode;
}

function getZipEntries(zipPath: FilePath) {
  const zip = new StreamZip.async({ file: path.join(zipPath.projectDir, zipPath.path) });
  return zip.entries();
}

async function findAllFilesRec(
  projectDir: string,
  parent: FileTreeNode,
  files: FileTreeNode[],
  recursive: boolean,
): Promise<void> {
  if (!parent.isDirectory) {
    return;
  }

  const dirs = await readdir(path.join(projectDir, parent.path), { withFileTypes: true });

  await Promise.all(
    dirs.map(async (dir) => {
      const childPath = path.join(parent.path, dir.name);
      const childPathAbsolute = path.join(projectDir, childPath);
      const isDirectory = dir.isDirectory();
      const childExt = extname(childPath).toLowerCase();
      const fileStates = await lstat(childPathAbsolute);

      // Skip meta files
      if (ignoredFilesMatch(childPath)) {
        return;
      }

      const child: FileTreeNode = {
        isDirectory,
        name: dir.name,
        path: childPath,
        children: [],
        fileType: FileFormatsToFileTypes.get(childExt),
        size: fileStates.size,
        bundlePath: parent.bundlePath,
        isEmpty: false,
        isArchived: false,
      };

      const fitsFilter = true;

      if (isDirectory) {
        const bundleMetaPath = path.join(childPath, BundleMetaFile);
        if (existsSync(path.join(projectDir, bundleMetaPath))) {
          child.bundlePath = bundleMetaPath;
          child.fileType = FileType.Bundle;
        }
      }

      // Directory
      if (dir.isDirectory()) {
        if (recursive) {
          await findAllFilesRec(projectDir, child, files, true);
        } else {
          files.push(child);
          const dirIter = await opendir(childPathAbsolute);
          const { value, done } = await dirIter[Symbol.asyncIterator]().next();
          if (!done) await dirIter.close();
          child.isEmpty = !value;
        }
      }
      // Non Directory
      else if (!supportedFilesMatch(childPath.replaceAll('\\', '/')) || !fitsFilter) {
        return;
      } else if (childExt === '.zip') {
        if (recursive) {
          const zipEntries = await getZipEntries({ projectDir, path: childPath });
          Object.keys(zipEntries)
            .filter((p) => !ignoredFilesMatch(p))
            .forEach((p) => {
              const entry = zipEntries[p];
              files.push(getFileNodeFromZipEntry({ projectDir, path: childPath }, p, entry));
            });
        } else {
          child.isArchived = true;
          child.isDirectory = true;
          const bundleMetaPath = `${childPath}.${BundleMetaFile}`;
          if (existsSync(path.join(projectDir, bundleMetaPath))) {
            child.bundlePath = bundleMetaPath;
            child.fileType = FileType.Bundle;
          }
          files.push(child);
        }
      } else {
        files.push(child);
      }
    }),
  );
}

export async function getAllAssetsIn(folder: FilePath): Promise<FileTreeNode[]> {
  const allFiles: FileTreeNode[] = [];

  const bundleFilePath = getMetaId(folder.path);
  if (folder.path.endsWith('.zip')) {
    const entries = await getZipEntries(folder);
    Object.keys(entries).forEach((p) => {
      const entry = entries[p];
      const node = getFileNodeFromZipEntry(folder, p, entry);
      node.bundlePath = existsSync(path.join(folder.projectDir, bundleFilePath))
        ? bundleFilePath
        : undefined;
      allFiles.push(node);
    });
  } else {
    const bundleFile = pathJoin(folder, BundleMetaFile);
    const parent: FileTreeNode = {
      isDirectory: true,
      bundlePath: pathExistsSync(bundleFile) ? bundleFile.path : undefined,
      name: '',
      path: folder.path,
      size: 0,
      isEmpty: false,
      isArchived: false,
    };

    if (!pathExistsSync(folder)) {
      return [];
    }
    const dirIter = await opendir(path.join(folder.projectDir, folder.path), {});
    const { value, done } = await dirIter[Symbol.asyncIterator]().next();
    if (!done) await dirIter.close();
    parent.isEmpty = !value;

    await findAllFilesRec(folder.projectDir, parent, allFiles, true);
  }

  return allFiles.sort((a, b) => a.name?.localeCompare(b.name));
}

export async function getAllAssets(store: Store<StoreSchema>): Promise<FileTreeNode[]> {
  const projectDir = (store.get('projectDirectory') as string) ?? '';
  return getAllAssetsIn({ projectDir, path: '' });
}

async function setTags(filePath: FilePath, tags: string[]): Promise<string[] | null> {
  const bundlePath = pathJoin(filePath, BundleMetaFile);
  if (pathExistsSync(bundlePath)) {
    const bundle = await operateOnMetadata<Bundle>(bundlePath, async (b) => {
      b.tags = tags;
      return true;
    });
    return bundle.tags ?? null;
  }
  const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
    m.tags = tags;
    return true;
  });
  return meta?.tags ?? null;
}

async function getFile(
  name: string,
  dirPath: FilePath,
  bundlePath?: string,
): Promise<FileTreeNode | null> {
  const childPath = path.join(dirPath.path, name);
  const childAbsolutePath = path.join(dirPath.projectDir, dirPath.path, name);
  const childExt = extname(childPath).toLowerCase();
  const fileStates = await lstat(childAbsolutePath);

  const child: FileTreeNode = {
    isDirectory: fileStates.isDirectory() || childExt === '.zip',
    name,
    path: childPath,
    children: [],
    fileType: FileFormatsToFileTypes.get(childExt),
    size: fileStates.size,
    bundlePath,
    isEmpty: true,
    isArchived: childExt === '.zip',
  };

  if (fileStates.isFile() && (!supportedTypes.has(childExt) || ignoredFilesMatch(child.name))) {
    return null;
  }

  if (fileStates.isDirectory()) {
    const dirIter = await opendir(childAbsolutePath);
    const { value, done } = await dirIter[Symbol.asyncIterator]().next();
    if (!done) await dirIter.close();
    child.isEmpty = !value;
  }

  if (childExt === '.zip') {
    const entries = getZipEntries({ path: childPath, projectDir: dirPath.projectDir });
    child.isEmpty = Object.keys(entries).length <= 0;
  }

  return child;
}

export function resolveAssetPath(store: Store<StoreSchema>, p: string) {
  let filePath: string;
  const projectDir = store.get('projectDirectory') as string;
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

async function getFileFromPath(filePath: FilePath) {
  const bundlePath = await findBundlePath(filePath);
  return getFile(
    path.basename(filePath.path),
    { projectDir: filePath.projectDir, path: path.dirname(filePath.path) },
    bundlePath?.path,
  );
}

async function getChildrenPaths(filePath: FilePath): Promise<string[]> {
  const stat = await pathLstat(filePath);
  if (stat.isDirectory()) {
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

async function getChildren(p: FilePath): Promise<FileTreeNode[]> {
  const filePath = p;

  const stat = await lstat(path.join(filePath.projectDir, filePath.path));
  if (stat.isDirectory()) {
    const allFiles: FileTreeNode[] = [];
    await findAllFilesRec(
      filePath.projectDir,
      { path: filePath.path, isDirectory: true } as FileTreeNode,
      allFiles,
      false,
    );
    return allFiles;
  }

  if (filePath.path.endsWith('.zip')) {
    const zipEntries = await getZipEntries(filePath);
    return Object.keys(zipEntries)
      .filter((e) => !ignoredFilesMatch(e) && supportedFilesMatch(e))
      .map((e) => getFileNodeFromZipEntry(filePath, e, zipEntries[e]));
  }

  return [];
}

function setupFileWatch(api: MainIpcCallbacks, projectDir: string) {
  const watcher = watch(projectDir, {
    persistent: true,
    ignored: (pattern) => ignoredFilesMatch(pattern) || !supportedFilesMatch(pattern),
    ignoreInitial: true,
  });

  watcher
    .on('add', (p) => {
      const filePath = p.substring(projectDir.length + 1);
      api.fileAdded(filePath);
      fileEvents.emit('file-added', {
        projectDir,
        path: filePath,
      });
    })
    .on('addDir', (p) => {
      api.folderAdded(p.substring(projectDir.length + 1));
    })
    .on('unlinkDir', (p) => {
      api.folderUnlinked(p.substring(projectDir.length + 1));
    })
    .on('unlink', (p) => {
      const filePath = p.substring(projectDir.length + 1);
      api.fileUnlinked(p.substring(projectDir.length + 1));
      fileEvents.emit('file-removed', {
        projectDir,
        path: filePath,
      });
    })
    .on('change', (p) => {
      const filePath = p.substring(projectDir.length + 1);
      api.fileChanged(filePath);
      fileEvents.emit('file-changed', {
        projectDir,
        path: filePath,
      });
    });

  return () => {};
}

async function addTags(filePath: FilePath, tags: string[]): Promise<string[] | null> {
  const bundlePath = {
    projectDir: filePath.projectDir,
    path: path.join(filePath.path, BundleMetaFile),
  };
  if (existsSync(path.join(bundlePath.projectDir, bundlePath.path))) {
    const meta = await operateOnMetadata<Bundle>(bundlePath, async (m) => {
      m.tags?.push(...tags);
      return true;
    });
    return meta?.tags ?? null;
  }

  const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
    m.tags ??= [];
    m.tags.push(...tags);
    return true;
  });
  return meta?.tags ?? null;
}

async function removeTag(filePath: FilePath, tag: string): Promise<string[] | null> {
  const bundlePath = {
    projectDir: filePath.path,
    path: path.join(filePath.path, 'bundle.json'),
  } satisfies FilePath;
  if (existsSync(path.join(bundlePath.projectDir, bundlePath.path))) {
    const meta = await operateOnMetadata<Bundle>(bundlePath, async (m) => {
      const tagIndex = m.tags?.indexOf(tag);
      if (tagIndex !== undefined && tagIndex >= 0) {
        m.tags?.splice(tagIndex, 1);
        return true;
      }
      return false;
    });
    return meta?.tags ?? null;
  }

  const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
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
    const tags = await getTags({ projectDir: filePath.projectDir, path: parentPath });
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
): { removeAllTags: (id: string) => Promise<void>; cleanup: () => void } {
  function beforeQuit() {
    db.save((saveError: any) => {
      if (saveError) {
        console.error(saveError);
      }
    });
  }

  async function getAllTags(limit?: number): Promise<GlobalTagEntry[]> {
    const tagsSet = new Map<string, number>();
    const projectDir = (store.get('projectDirectory') as string) ?? '';
    await allFilesRec({ projectDir, path: '' }, async (filePath) => {
      const tags = await getTags(filePath);
      tags?.forEach((t) => {
        const tag = t.toString();
        if (tagsSet.has(tag)) {
          tagsSet.set(tag, tagsSet.get(tag)! + 1);
        } else {
          tagsSet.set(tag, 1);
        }
      });
    });
    const tags = Array.from(tagsSet.entries()).sort((a, b) => b[1] - a[1]);
    return tags
      .slice(0, limit ? Math.min(tags.length - 1, limit) : tags.length)
      .map((e) => ({ tag: e[0], count: e[1] }) as GlobalTagEntry);
  }

  async function removeAllTags(id: string): Promise<void> {
    try {
      await rm(`${path.join(store.get('projectDirectory'), id)}.${MetaFileExtension}`);
    } catch {
      /* empty */
    }
  }

  const projectDir = store.get('projectDirectory') as string;
  let fileWatchDispose: (() => void) | undefined;
  if (projectDir) {
    fileWatchDispose = setupFileWatch(apiCallbacks, projectDir);
  }

  app.on('before-quit', beforeQuit);
  api.getTags = (p) => getTags({ projectDir, path: normalize(p) });
  api.addTags = (p, t) => addTags({ projectDir, path: normalize(p) }, t);
  api.removeTag = (p, t) => removeTag({ projectDir, path: normalize(p) }, t);
  api.getParentTags = (p) => getParentTags({ projectDir, path: normalize(p) });
  api.getMetadata = (p) => getMetadata<FileMetadata>({ projectDir, path: normalize(p) });
  api.getAllFiles = (p) => getAllAssetsIn({ projectDir, path: normalize(p) });
  api.getGlobalTags = getAllTags;
  api.setTags = (p, t) => setTags({ projectDir, path: normalize(p) }, t);
  api.getFile = (p) => getFileFromPath({ projectDir, path: normalize(p) });
  api.getFileChildrenPaths = (p) => getChildrenPaths({ projectDir, path: normalize(p) });
  api.getFileChildren = (p) => getChildren({ projectDir, path: normalize(p) });
  api.openPath = (p) => onOpenPath({ projectDir, path: normalize(p) });

  const cleanup = () => {
    app.removeListener('before-quit', beforeQuit);
    if (fileWatchDispose) {
      fileWatchDispose();
    }
  };

  return { removeAllTags, cleanup };
}
