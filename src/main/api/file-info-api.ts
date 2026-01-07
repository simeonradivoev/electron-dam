import { existsSync } from 'fs';
import fs, { lstat } from 'fs/promises';
import path, { normalize } from 'path';
import assimpjs from 'assimpjs';
import log from 'electron-log/main';
import Store from 'electron-store';
import * as mm from 'music-metadata';
import StreamZip from 'node-stream-zip';
import picomatch from 'picomatch';
import { StoreSchema, MainIpcGetter, previewTypes, zipDelimiter } from '../../shared/constants';
import { audioMediaFormatsMatch, decompressBase64ToString, mkdirs } from '../util';
import { loadDirectoryBundle, loadZipBundle, searchParentBundle } from './bundles-api';
import {
  findBundlePath,
  getMetadata,
  pathExistsSync,
  pathJoin,
  pathLstat,
  pathStat,
} from './file-system-api';
import { GetThumbnailPath } from './protocols';

const modelsToCovertMatch = picomatch(['**/*.obj', '**/*.glb', '**/*.stl', '**/*.fbx'], {
  nocase: true,
});

export default function InitializeFileInfoApi(
  api: MainIpcGetter,
  store: Store<StoreSchema>,
  db: Loki,
): {} {
  const virtualBundles = db.getCollection<VirtualBundle>('bundles');
  async function buildFileInfo(filePath: FilePath): Promise<FileInfo> {
    const projectDir = (store.get('projectDirectory') as string) ?? '';
    let info: FileInfo;

    if (filePath.path.length === 36) {
      const virtualBundle = await virtualBundles.findOne({ id: { $eq: filePath.path } });
      if (virtualBundle) {
        return {
          isDirectory: false,
          name: virtualBundle.name,
          size: 0,

          bundle: {
            isParentBundle: false,
            name: virtualBundle.name,
            bundle: {
              id: virtualBundle.id,
              previewUrl: virtualBundle.previewUrl,
              bundle: virtualBundle,
              name: virtualBundle.name,
              isVirtual: true,
              date: virtualBundle.date,
            },
          },
          bundlePath: virtualBundle.id,
          directory: virtualBundle.id,
          path: virtualBundle.id,
          fileExt: '',
          hasMaterialLibrary: false,
          hasThumbnail: true,
        } satisfies FileInfo;
      }
    }

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
          hasThumbnail: false,
        };

        info.previewPath = zipPath;
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
          hasThumbnail: false,
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
      const fileStat = await pathStat(filePath);
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
        hasThumbnail: pathExistsSync(await GetThumbnailPath(filePath, fileStat)),
      };

      if (info.isDirectory) {
        const readmePath = pathJoin(filePath, 'Readme.md');
        const readmeStat = await pathStat(readmePath).catch((e) => null);
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
              log.error(result.GetErrorCode());
              return;
            }

            // get the result file, and convert to string
            const resultFile = result.GetFile(0);
            const jsonContent = new TextDecoder().decode(resultFile.GetContent());

            // fs.writeFile(info.path.concat('.gltf2'), jsonContent);
            return resultFile.GetContent();
          })
          .catch((e: any) => e);
      } else if (audioMediaFormatsMatch(filePath.path)) {
        // Load audio metadata
        const metadata = await mm.parseFile(path.join(filePath.projectDir, filePath.path));
        info.audioMetadata = metadata;
        const fileMetadata = await getMetadata(filePath);
        // Regenerate peaks if they are stale
        if (
          fileMetadata?.peaks &&
          fileMetadata.lastModified &&
          fileMetadata.lastModified >= fileStat.mtimeMs
        ) {
          info.audioMetadata.peaks = await decompressBase64ToString(fileMetadata.peaks);
        }
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

  api.getFileDetails = (p) =>
    buildFileInfo({ projectDir: store.get('projectDirectory'), path: normalize(p) });

  return {};
}
