import { existsSync } from 'fs';
import fs, { lstat } from 'fs/promises';
import path, { basename, dirname, extname, normalize } from 'path';
import assimpjs from 'assimpjs';
import log from 'electron-log/main';
import Store from 'electron-store';
import { parseFile as parseMusicFile } from 'music-metadata';
import StreamZip from 'node-stream-zip';
import picomatch from 'picomatch';
import { StoreSchema, MainIpcGetter, previewTypes } from '../../shared/constants';
import {
  audioMediaFormatsMatch,
  decompressBase64ToString,
  FilePath,
  getZipParentFs,
} from '../util';
import { loadDirectoryBundle, loadZipBundle, searchParentBundle } from './bundles-api';
import {
  findBundlePath,
  getMetadata,
  isArchive,
  pathExistsSync,
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
    let info: FileInfo;

    // Most likely a guid, so look for virtual bundles
    if (filePath.path.length === 36) {
      const virtualBundle = virtualBundles.findOne({ id: filePath.path });
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

    const zipPath = await getZipParentFs(filePath);
    if (zipPath) {
      const zip = new StreamZip.async({ file: zipPath.absolute });
      const localPath = filePath.path.substring(
        Math.min(zipPath.path.length + 1, filePath.path.length),
      );

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

      info.previewPath = zipPath.path;

      info.bundlePath = (await findBundlePath(filePath))?.path;
    } else if (await isArchive(filePath)) {
      // this is the zip bundle file itself
      const stat = await lstat(filePath.absolute);
      info = {
        size: stat.size,
        path: filePath.path,
        name: basename(filePath.path),
        fileExt: extname(filePath.path).toLowerCase(),
        directory: dirname(filePath.path),
        hasMaterialLibrary: false,
        isDirectory: true,
        isZip: true,
        hasThumbnail: false,
      };

      const bundle = await loadZipBundle(filePath);
      if (bundle) {
        bundle.previewUrl = info.previewPath;
        info.bundle = {
          name: basename(filePath.path),
          isParentBundle: false,
          bundle,
        };
      }
      info.bundlePath = (await findBundlePath(filePath))?.path;
    } else {
      const fileStat = await pathStat(filePath);
      const materialPath = filePath.with(filePath.path.replace('.obj', '.mtl'));
      const matExists = existsSync(materialPath.absolute);
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
        const readmePath = filePath.join('Readme.md');
        const readmeStat = await pathStat(readmePath).catch(() => null);
        if (readmeStat) {
          const fileData = await fs.readFile(
            path.join(readmePath.projectDir, readmePath.path),
            'utf-8',
          );
          info.readme = fileData.toString();
          info.readme = fileData.toString();
        }

        for (let index = 0; index < previewTypes.length; index += 1) {
          const type = previewTypes[index];
          const previewPath = filePath.join(`Preview${type}`);
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
          info.bundlePath = filePath.path;
        }
      } else if (modelsToCovertMatch(filePath.path)) {
        const objContents = await fs.readFile(filePath.absolute);
        const materialContents = matExists ? await fs.readFile(materialPath.absolute) : undefined;

        info.modelData = await assimpjs().then((ajs: any) => {
          // create new file list object
          const fileList = new ajs.FileList();

          // add model files
          fileList.AddFile(filePath.absolute, objContents);
          if (materialContents) {
            fileList.AddFile(materialPath.absolute, materialContents);
          }

          // convert file list to assimp json
          const result = ajs.ConvertFileList(fileList, 'glb2');

          // check if the conversion succeeded
          if (!result.IsSuccess() || result.FileCount() === 0) {
            throw new Error(result.GetErrorCode());
          }

          // get the result file, and convert to string
          const resultFile = result.GetFile(0);

          // fs.writeFile(info.path.concat('.gltf2'), jsonContent);
          return resultFile.GetContent();
        });
      } else if (audioMediaFormatsMatch(filePath.path)) {
        // Load audio metadata
        const metadata = await parseMusicFile(filePath.absolute);
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

  api.getFileDetails = (p) => buildFileInfo(FilePath.fromStore(store, normalize(p)));

  return {};
}
