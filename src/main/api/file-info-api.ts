import { existsSync } from 'fs';
import fs, { lstat } from 'fs/promises';
import path, { normalize } from 'path';
import assimpjs from 'assimpjs';
import Store from 'electron-store';
import * as mm from 'music-metadata';
import StreamZip from 'node-stream-zip';
import picomatch from 'picomatch';
import { StoreSchema, MainIpcGetter, previewTypes, zipDelimiter } from '../../shared/constants';
import { mediaFormatsMatch, mkdirs } from '../util';
import { loadDirectoryBundle, loadZipBundle, searchParentBundle } from './bundles-api';
import { findBundlePath, pathExistsSync, pathJoin, pathLstat } from './file-system-api';

const modelsToCovertMatch = picomatch(['**/*.obj', '**/*.glb', '**/*.stl', '**/*.fbx'], {
  nocase: true,
});

async function buildFileInfo(store: Store<StoreSchema>, filePath: FilePath): Promise<FileInfo> {
  const projectDir = (store.get('projectDirectory') as string) ?? '';
  let info: FileInfo;

  const lastZipIndex = filePath.path.lastIndexOf(zipDelimiter);
  if (lastZipIndex >= 0) {
    const zipPath = filePath.path.substring(0, lastZipIndex + zipDelimiter.length);
    const zip = new StreamZip.async({ file: path.join(projectDir, zipPath) });
    const localPath = filePath.path.substring(Math.min(zipPath.length + 1, filePath.path.length));

    if (localPath) {
      const zipEntry = await zip.entry(localPath);

      if (!zipEntry) {
        throw new Error(`No Compressed File at ${zipPath} with local path ${localPath}`);
      }

      // Sub zip file entry
      info = {
        size: zipEntry.size,
        path: filePath.path,
        name: zipEntry.name,
        fileExt: path.extname(filePath.path).toLowerCase(),
        directory: path.dirname(filePath.path),
        hasMaterialLibrary: false,
        isDirectory: zipEntry.isDirectory,
        isZip: true,
      };

      const tmpExtractionFolder = path.join('.cache', 'zipExtracts');
      const tmpExtractionPath = path.join(
        tmpExtractionFolder,
        filePath.path.replaceAll(path.sep, '-'),
      );
      if (existsSync(path.join(projectDir, tmpExtractionPath))) {
      } else {
        mkdirs({ projectDir, path: tmpExtractionFolder });
        await zip.extract(localPath, path.join(projectDir, tmpExtractionPath));
      }

      info.previewPath = tmpExtractionPath;
    } else {
      // this is the zip bundle file itself
      const stat = await lstat(path.join(projectDir, zipPath));
      info = {
        size: stat.size,
        path: zipPath,
        name: path.basename(zipPath),
        fileExt: path.extname(zipPath).toLowerCase(),
        directory: path.dirname(zipPath),
        hasMaterialLibrary: false,
        isDirectory: true,
        isZip: true,
      };

      const bundle = await loadZipBundle({ projectDir, path: zipPath });
      if (bundle) {
        bundle.previewUrl = info.previewPath;
        info.bundle = {
          name: zipPath,
          isParentBundle: false,
          bundle,
        };
      }
    }

    info.bundlePath = (await findBundlePath(filePath))?.path;
  } else {
    const fileStat = await pathLstat(filePath);
    const materialPath = filePath.path.replace('.obj', '.mtl');
    const matExists = !!(await fs.lstat(path.join(projectDir, materialPath)).catch((e) => false));
    info = {
      size: fileStat.size,
      path: filePath.path,
      name: path.basename(filePath.path),
      fileExt: path.extname(filePath.path).toLowerCase(),
      directory: path.dirname(filePath.path),
      hasMaterialLibrary: matExists,
      isDirectory: fileStat.isDirectory(),
      bundlePath: (await findBundlePath(filePath))?.path,
    };

    if (info.isDirectory) {
      const readmePath = pathJoin(filePath, 'Readme.md');
      const readmeStat = await pathLstat(readmePath).catch((e) => null);
      if (readmeStat) {
        const fileData = await fs.readFile(
          path.join(readmePath.projectDir, readmePath.path),
          'utf-8',
        );
        info.readme = fileData.toString();
        info.readme = fileData.toString();
      }

      for (let index = 0; index < previewTypes.length; index++) {
        const type = previewTypes[index];
        const previewPath = pathJoin(filePath, `Preview${type}`);
        if (pathExistsSync(previewPath)) {
          info.previewPath = previewPath.path;
          break;
        }
      }

      const bundle = await loadDirectoryBundle(filePath);
      if (bundle) {
        bundle.previewUrl = info.previewPath;
        info.bundle = {
          name: path.basename(filePath.path),
          isParentBundle: false,
          bundle,
        };
      }
    } else if (modelsToCovertMatch(filePath.path)) {
      const objContents = await fs.readFile(path.join(filePath.projectDir, filePath.path));
      const absoluteMaterialPath = path.join(projectDir, materialPath);
      const materialContents = matExists ? await fs.readFile(absoluteMaterialPath) : undefined;

      info.modelData = await assimpjs()
        .then((ajs: any) => {
          // create new file list object
          const fileList = new ajs.FileList();

          // add model files
          fileList.AddFile(info.path, objContents);
          if (materialContents) {
            fileList.AddFile(absoluteMaterialPath, materialContents);
          }

          // convert file list to assimp json
          const result = ajs.ConvertFileList(fileList, 'glb2');

          // check if the conversion succeeded
          if (!result.IsSuccess() || result.FileCount() === 0) {
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
    } else if (mediaFormatsMatch(filePath.path)) {
      const metadata = await mm.parseFile(path.join(filePath.projectDir, filePath.path));
      info.duration = metadata.format.duration;
    }
  }

  if (!info.bundle) {
    const parentBundle = await searchParentBundle(filePath);
    if (parentBundle) {
      info.bundle = {
        name: parentBundle?.name,
        isParentBundle: true,
        bundle: parentBundle?.bundle,
      };
    }
  }

  return info;
}

export default function InitializeFileInfoApi(api: MainIpcGetter, store: Store<StoreSchema>): {} {
  api.getFileDetails = (p) =>
    buildFileInfo(store, { projectDir: store.get('projectDirectory'), path: normalize(p) });

  return {};
}
