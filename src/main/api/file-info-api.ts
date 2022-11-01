import fs from 'fs/promises';
import path from 'path';
import Store from 'electron-store';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Blob } from 'buffer';
import { Channels, previewTypes } from '../../shared/constants';

const assimpjs = require('assimpjs')();

async function searchParents<T>(
  searchPath: string,
  filter: (parentPath: string) => Promise<T | undefined>
): Promise<T | undefined> {
  const parentChain = searchPath.split(path.sep);
  while (parentChain.length > 0) {
    parentChain.pop();
    const parentPath = parentChain.join(path.sep);
    const value = await filter(parentPath);
    if (value) {
      return value;
    }
  }
  return undefined;
}

async function loadDirectoryBundle(
  bundleDirectory: string
): Promise<Bundle | undefined> {
  const bundlePath = path.join(bundleDirectory, 'bundle.json');
  const bundleStat = await fs.lstat(bundlePath).catch((e) => null);
  if (bundleStat) {
    const fileData = await fs.readFile(bundlePath, 'utf8');
    return JSON.parse(fileData);
  }
  return undefined;
}

async function searchParentBundle(
  searchPath: string
): Promise<{ bundle: Bundle; name: string; directory: string } | undefined> {
  return searchParents(searchPath, async (parentPath: string) => {
    const bundle = await loadDirectoryBundle(parentPath);
    if (bundle) {
      return { bundle, name: path.basename(parentPath), directory: parentPath };
    }
    return undefined;
  });
}

async function buildFileInfo(
  store: Store<StoreSchema>,
  filePath: string
): Promise<FileInfo> {
  const fileStat = await fs.lstat(filePath);
  const projectDirectory = (store.get('projectDirectory') as string) ?? '';
  const materialPath = filePath.replace('.obj', '.mtl');
  const matExists = !!(await fs.lstat(materialPath).catch((e) => false));
  const info: FileInfo = {
    size: fileStat.size,
    path: filePath,
    relativePathStart: projectDirectory.length,
    name: path.basename(filePath),
    fileExt: path.extname(filePath).toLowerCase(),
    directory: path.dirname(filePath),
    hasMaterialLibrary: matExists,
    isDirectory: fileStat.isDirectory(),
  };

  if (info.isDirectory) {
    const readmePath = path.join(filePath, 'Readme.md');
    const readmeStat = await fs.lstat(readmePath).catch((e) => null);
    if (readmeStat) {
      const fileData = await fs.readFile(readmePath, 'utf-8');
      info.readme = fileData;
    }

    for (let index = 0; index < previewTypes.length; index++) {
      const type = previewTypes[index];
      const previewPath = path.join(filePath, `Preview${type}`);
      if (await fs.lstat(previewPath).catch((e) => false)) {
        info.previewPath = previewPath;
        break;
      }
    }

    const bundle = await loadDirectoryBundle(filePath);
    if (bundle) {
      info.bundle = {
        name: path.basename(filePath),
        isParentBundle: false,
        bundle,
      };
    }
  } else if (
    filePath.endsWith('.obj') ||
    filePath.endsWith('.glb') ||
    filePath.endsWith('.fbx') ||
    filePath.endsWith('.stl')
  ) {
    const objContents = await fs.readFile(filePath);
    const materialContents = matExists
      ? await fs.readFile(materialPath)
      : undefined;

    info.modelData = await assimpjs
      .then((ajs: any) => {
        // create new file list object
        const fileList = new ajs.FileList();

        // add model files
        fileList.AddFile(info.path, objContents);
        if (materialContents) {
          fileList.AddFile(materialPath, materialContents);
        }

        // convert file list to assimp json
        const result = ajs.ConvertFileList(fileList, 'glb2');

        // check if the conversion succeeded
        if (!result.IsSuccess() || result.FileCount() == 0) {
          console.error(result.GetErrorCode());
          return;
        }

        // get the result file, and convert to string
        const resultFile = result.GetFile(0);
        const jsonContent = new TextDecoder().decode(resultFile.GetContent());

        // fs.writeFile(info.path.concat('.gltf2'), jsonContent);
        return resultFile.GetContent();
      })
      .catch((e: any) => e);
  }

  if (!info.bundle) {
    const parentBundle = await searchParentBundle(filePath);
    if (parentBundle) {
      info.bundle = {
        name: parentBundle?.name,
        isParentBundle: true,
        bundle: parentBundle?.bundle,
      };
      info.relativePathStart = parentBundle.directory.length;
    }
  }

  return info;
}

export default function InitializeFileInfoApi(
  store: Store<StoreSchema>,
  db: Loki
) {
  async function fileDetails(
    event: Electron.IpcMainEvent,
    detailsPath: string
  ) {
    const info: FileInfo = await buildFileInfo(store, detailsPath);
    event.reply('file-details', info);
  }

  async function getFileDetails(
    event: IpcMainInvokeEvent,
    detailsPath: string
  ) {
    return buildFileInfo(store, detailsPath);
  }

  ipcMain.on(Channels.FileDetails, fileDetails);
  ipcMain.handle(Channels.GetFileDetails, getFileDetails);

  db.addListener('close', () => {
    ipcMain.removeListener(Channels.FileDetails, fileDetails);
    ipcMain.removeHandler(Channels.GetFileDetails);
  });
}
