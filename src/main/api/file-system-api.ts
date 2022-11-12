import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  IpcMainInvokeEvent,
  nativeImage,
  shell,
} from 'electron';
import { readdir, lstat } from 'fs/promises';
import path, { extname } from 'path';
import Loki from 'lokijs';
import Store from 'electron-store';
import {
  Channels,
  FileFormatsToFileTypes,
  FileType,
  ingoredFiles,
  previewTypes,
  supportedTypes,
} from '../../shared/constants';
import InitializeFileInfoApi from './file-info-api';

let database: Loki;

function InitializeFileSystemApi(store: Store<StoreSchema>, db: Loki) {
  function beforeQuit() {
    db.save((saveError) => {
      if (saveError) {
        console.error(saveError);
      }
    });
  }

  let files = db.getCollection<FileMetadata>('files');
  if (files === null) {
    files = db.addCollection<FileMetadata>('files', {
      indices: 'path',
      unique: ['path'],
    });
  }

  function getAllTags(event: IpcMainInvokeEvent, arg: any): string[] {
    const tagsSet = new Set<string>();
    files
      .find({ tags: { $size: { $gt: 0 } } })
      .forEach((file) => file.tags.forEach((tag) => tagsSet.add(tag)));
    return Array.from(tagsSet);
  }

  function updateTags(
    event: IpcMainInvokeEvent,
    filePath: string,
    tags: string[]
  ): string[] {
    const existing = files.findOne({ path: filePath });

    if (existing) {
      existing.tags = tags;
      files.update(existing);
    } else {
      files.insert({ path: filePath, tags });
    }

    return tags;
  }

  function getTags(event: IpcMainInvokeEvent, filePath: string): string[] {
    return files.findOne({ path: filePath })?.tags ?? [];
  }

  function getParentTags(
    event: IpcMainInvokeEvent,
    filePath: string
  ): string[] {
    const parentTags: Set<string> = new Set<string>();
    const parentStack = filePath.split(path.sep);
    while (parentStack.length > 0) {
      parentStack.pop();
      const parentPath = parentStack.join(path.sep);
      const tags = files.findOne({ path: parentPath })?.tags;
      tags?.forEach((tag) => parentTags.add(tag));
    }
    return Array.from(parentTags);
  }

  function filterPredicate(node: FileTreeNode, filter: string | undefined) {
    return (
      !filter ||
      node.name.toLowerCase().includes(filter) ||
      node.tags.some((t) => t.toLowerCase().includes(filter))
    );
  }

  async function findChildrenRec(
    tagSet: Set<string>,
    typeSet: Set<string>,
    filter: string | undefined,
    parent: FileTreeNode,
    parentFitsFilter: boolean
  ): Promise<void> {
    if (!parent.isDirectory) {
      return;
    }

    const dirs = await readdir(parent.path, { withFileTypes: true });

    await Promise.all(
      dirs.map(async (dir) => {
        const childPath = path.join(parent.path, dir.name);
        const isDirectory = dir.isDirectory();
        const childExt = extname(childPath);
        const fileStates = await lstat(childPath);

        const child: FileTreeNode = {
          isDirectory,
          name: dir.name,
          path: childPath,
          children: [],
          tags: files.findOne({ path: childPath })?.tags ?? [],
          fileType: FileFormatsToFileTypes.get(childExt),
          size: fileStates.size,
        };

        let fitsFilter = parentFitsFilter;
        if (filter) {
          fitsFilter ||= filterPredicate(child, filter);
        }

        if (isDirectory) {
          for (let index = 0; index < previewTypes.length; index += 1) {
            const previewType = previewTypes[index];
            const previewPath = path.join(childPath, `Preview${previewType}`);
            if (await lstat(previewPath).catch((e) => false)) {
              child.previewPath = previewPath;
              break;
            }
          }

          const bundlePath = path.join(childPath, 'bundle.json');
          if (await lstat(bundlePath).catch((e) => false)) {
            child.bundlePath = bundlePath;
          }

          const mdPath = path.join(childPath, 'Readme.md');
          if (await lstat(mdPath).catch((e) => false)) {
            child.readmePath = mdPath;
          }
        }

        if (dir.isDirectory()) {
          await findChildrenRec(tagSet, typeSet, filter, child, fitsFilter);
          if (child.children.length <= 0) {
            return;
          }
        } else if (
          !supportedTypes.has(childExt) ||
          ingoredFiles.has(child.name) ||
          !fitsFilter
        ) {
          return;
        } else {
          if (
            child.fileType &&
            typeSet.size > 0 &&
            !typeSet.has(child.fileType)
          ) {
            return;
          }

          if (
            tagSet.size > 0 &&
            (child.tags.length <= 0 ||
              !child.tags.some((tag) => tagSet.has(tag)))
          ) {
            return;
          }
        }

        parent.children.push(child);
      })
    );

    parent.children.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
  }

  async function buildFileTree(
    event: IpcMainInvokeEvent,
    tagFilter: string[],
    typeFilter: FileType[],
    filter: string | undefined
  ): Promise<FileTreeNode[]> {
    const projectDir = (store.get('projectDirectory') as string) ?? '';
    const tagSet = new Set<string>(tagFilter);
    const typeSet = new Set<string>(typeFilter);

    const parent: FileTreeNode = {
      isDirectory: true,
      name: '',
      path: projectDir,
      children: [],
      tags: [],
      size: 0,
    };

    await findChildrenRec(
      tagSet,
      typeSet,
      filter?.toLowerCase(),
      parent,
      filterPredicate(parent, filter)
    );

    return parent.children.filter((n): n is FileTreeNode => {
      return n !== null;
    });
  }

  app.on('before-quit', beforeQuit);
  ipcMain.handle(Channels.UpdateTags, updateTags);
  ipcMain.handle(Channels.GetTags, getTags);
  ipcMain.handle(Channels.GetParentTags, getParentTags);
  ipcMain.handle(Channels.FileTree, buildFileTree);
  ipcMain.handle(Channels.GetGlobalTags, getAllTags);

  db.addListener('close', () => {
    app.removeListener('before-quit', beforeQuit);
    ipcMain.removeHandler(Channels.UpdateTags);
    ipcMain.removeHandler(Channels.GetTags);
    ipcMain.removeHandler(Channels.GetParentTags);
    ipcMain.removeHandler(Channels.FileTree);
    ipcMain.removeHandler(Channels.GetGlobalTags);
  });
}

export async function handleGetPreview(
  event: Electron.IpcMainInvokeEvent,
  filePath: string,
  maxSize: number
): Promise<string | undefined> {
  const thumbnail = await nativeImage
    .createThumbnailFromPath(filePath, {
      width: maxSize,
      height: maxSize,
    })
    .catch(() => {
      return null;
    });
  return thumbnail?.toDataURL();
}

export function LoadDatabaseExact(
  store: Store<StoreSchema>,
  directory: string
) {
  database?.close();

  database = new Loki(path.join(directory, 'dam-database.db'), {
    autosave: true,
    serializationMethod: 'pretty',
    persistenceMethod: 'fs',
    autosaveInterval: 4000,
    autosaveCallback: () => {
      console.log('autosaved db');
    },
  });

  database.loadDatabase(undefined, (error) => {
    if (error) {
      console.error(error);
      return;
    }

    InitializeFileSystemApi(store, database);
    InitializeFileInfoApi(store, database);
  });
}

export async function SelectProjectDirectory(
  store: Store<StoreSchema>,
  window: BrowserWindow | undefined
): Promise<string | null> {
  if (!window) {
    return null;
  }

  const directory = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
  });

  if (!directory.canceled && directory.filePaths.length > 0) {
    const directoryPath = directory.filePaths[0];
    store.set('projectDirectory', directoryPath);
    LoadDatabaseExact(store, directoryPath);
    return directoryPath;
  }

  return null;
}

export async function LoadDatabase(store: Store<StoreSchema>) {
  const projectDir = store.get('projectDirectory') as string;
  if (projectDir && !!(await lstat(projectDir).catch((e) => false))) {
    LoadDatabaseExact(store, projectDir);
  }
}

async function onOpenPath(event: Electron.IpcMainEvent, pathToOpen: string) {
  const info = await lstat(pathToOpen);
  if (info) {
    if (info.isDirectory()) {
      shell.openPath(pathToOpen);
    } else {
      shell.showItemInFolder(pathToOpen);
    }
  }
}

ipcMain.handle(Channels.GetPreview, handleGetPreview);
ipcMain.on(Channels.OpenPath, onOpenPath);
