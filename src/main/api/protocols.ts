import { createReadStream, createWriteStream, existsSync, Stats, statSync } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { PassThrough, Readable } from 'stream';
import { nativeImage, protocol } from 'electron';
import log from 'electron-log/main';
import Store from 'electron-store';
import StreamZip, { ZipEntry } from 'node-stream-zip';
import sharp from 'sharp';
import { zipDelimiter, StoreSchema } from '../../shared/constants';
import AsyncQueue from '../managers/AsyncQueue';
import { imageMediaFormatsMatch, mkdirs } from '../util';
import { findBundleInfoForFile, findFolderPreview, findZipPreviewReadable } from './bundles-api';
import { thumbCache } from './cache/thumbnail-cache';
import { pathExistsSync } from './file-system-api';

export function RegisterProtocols() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: false,
        stream: true,
      },
    },
    {
      scheme: 'thumb',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: false,
        stream: true,
      },
    },
  ]);
}

const activeFileOperations = new Map<string, Promise<any>>();
const thumbQueue = new AsyncQueue(4);

export function GetThumbnailPath(filePath: FilePath, statInfo: Stats | ZipEntry): FilePath {
  if (statInfo instanceof Stats) {
    return {
      projectDir: filePath.projectDir,
      path: path.join(
        '.cache',
        'thumbnails',
        `${filePath.path.replaceAll(path.sep, '-')}-${statInfo.ino}-${statInfo.mtimeMs}.webp`,
      ),
    };
  }

  return {
    projectDir: filePath.projectDir,
    path: path.join(
      '.cache',
      'thumbnails',
      `${filePath.path.replaceAll(path.sep, '-')}-${statInfo.version}.webp`,
    ),
  };
}

export async function GetAbsoluteThumbnailPathForFile(filePath: FilePath, statInfoParam?: Stats) {
  return GetThumbnailPath(
    filePath,
    statInfoParam ?? (await stat(path.join(filePath.projectDir, filePath.path))),
  );
}

export default function InitializeProtocols(store: Store<StoreSchema>) {
  protocol.registerStreamProtocol('app', async (request, callback) => {
    const projectDir = store.get('projectDirectory');
    const localRequestPath = decodeURIComponent(request.url.substring('app://'.length));
    const absoluteFilePath = path.join(projectDir, localRequestPath);
    const lastZipIndex = localRequestPath.lastIndexOf(zipDelimiter);
    if (lastZipIndex >= 0) {
      const zipPath = localRequestPath.substring(0, lastZipIndex + zipDelimiter.length);
      const zip = new StreamZip.async({ file: path.join(projectDir, zipPath) });
      const entryPath = localRequestPath.substring(
        Math.min(zipPath.length + 1, localRequestPath.length),
      );
      const zipStream = await zip.stream(entryPath);
      return callback({ statusCode: 200, data: zipStream });
    }
    try {
      const fileStat = await stat(absoluteFilePath);
      const ext = path.extname(absoluteFilePath).toLocaleLowerCase();
      const fileSize = fileStat.size;
      const range = request.headers.Range || request.headers.range;

      if (range) {
        const parts = range.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          return callback({
            statusCode: 416, // Range Not Satisfiable
            headers: {
              'Content-Range': `bytes */${fileSize}`,
            },
            data: Readable.from([]),
          });
        }

        const chunkSize = end - start + 1;
        const fileReadable = createReadStream(absoluteFilePath, { start, end });
        return callback({
          statusCode: 206, // Partial Content
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': chunkSize.toString(),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
          },
          data: fileReadable,
        });
      }

      const fileReadable = createReadStream(absoluteFilePath);
      return callback({
        statusCode: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
        },
        data: fileReadable,
      });
    } catch (error) {
      // Handle the error as needed
      log.error(error);
      callback({ statusCode: 400 });
    }
  });

  protocol.registerStreamProtocol('thumb', async (request, callback) => {
    thumbQueue.run(async () => {
      try {
        const url = new URL(request.url);

        const projectDir = store.get('projectDirectory');

        let maxSize = 128;
        if (url.searchParams.has('maxSize')) {
          maxSize = Number.parseInt(url.searchParams.get('maxSize')!, 10);
        }

        const fileLocalPath = path.join(
          decodeURIComponent(url.host),
          decodeURIComponent(url.pathname.substring(1)),
        );

        const absoluteFilePath = path.join(projectDir, fileLocalPath);
        let statInfo: Stats | ZipEntry | undefined;
        try {
          statInfo = await stat(absoluteFilePath);
        } catch {
          if (imageMediaFormatsMatch(fileLocalPath)) {
            // Zip entry inside a zip file
            // TODO: cache to file system
            const lastZipIndex = fileLocalPath.lastIndexOf(zipDelimiter);
            if (lastZipIndex >= 0) {
              const zipPath = fileLocalPath.substring(0, lastZipIndex + zipDelimiter.length);
              const zip = new StreamZip.async({ file: path.join(projectDir, zipPath) });
              const entryPath = fileLocalPath.substring(
                Math.min(zipPath.length + 1, fileLocalPath.length),
              );
              statInfo = await zip.entry(entryPath);
              if (statInfo) {
                const zipCachePreviewPath = await GetThumbnailPath(
                  { projectDir, path: fileLocalPath },
                  statInfo,
                );

                if (pathExistsSync(zipCachePreviewPath)) {
                  thumbCache?.get(zipCachePreviewPath.path);
                  const stream = createReadStream(
                    path.join(zipCachePreviewPath.projectDir, zipCachePreviewPath.path),
                  );
                  callback({
                    statusCode: 200,
                    mimeType: 'image/webp',
                    data: stream,
                  });
                  return;
                }

                mkdirs({ projectDir, path: path.join('.cache', 'thumbnails') });

                const zipStream = await zip.stream(entryPath);
                const previewStats = await zipStream
                  .pipe(sharp().resize(maxSize).webp())
                  .toFile(path.join(zipCachePreviewPath.projectDir, zipCachePreviewPath.path));
                thumbCache?.set(zipCachePreviewPath.path, previewStats.size);
                callback({
                  mimeType: 'image/webp',
                  data: createReadStream(
                    path.join(zipCachePreviewPath.projectDir, zipCachePreviewPath.path),
                  ),
                });
                return;
              }
            }
          }

          callback({
            statusCode: 404,
            data: Readable.from([]),
          });
          return;
        }

        let cachePreviewPath = await GetThumbnailPath(
          {
            projectDir,
            path: fileLocalPath,
          },
          statInfo,
        );
        if (pathExistsSync(cachePreviewPath)) {
          thumbCache?.get(cachePreviewPath.path);
          const stream = createReadStream(
            path.join(cachePreviewPath.projectDir, cachePreviewPath.path),
          );
          callback({
            statusCode: 200,
            mimeType: 'image/webp',
            data: stream,
          });
          return;
        }

        if (statInfo.isDirectory()) {
          const preview = findFolderPreview({ projectDir, path: fileLocalPath });
          if (preview) {
            const previewReadable = createReadStream(path.join(projectDir, preview));
            callback({
              statusCode: 200,
              mimeType: 'image/webp',
              data: previewReadable.pipe(sharp().resize(maxSize).webp()),
            });
            return;
          }
        } else if (fileLocalPath.endsWith('.zip')) {
          const zipPreview = await findZipPreviewReadable({ projectDir, path: fileLocalPath });
          if (zipPreview) {
            callback({
              statusCode: 200,
              mimeType: 'image/webp',
              data: zipPreview.pipe(sharp().resize(maxSize).webp()),
            });
            return;
          }
        }

        mkdirs({ projectDir, path: path.join('.cache', 'thumbnails') });

        const thumbnail = await nativeImage
          .createThumbnailFromPath(absoluteFilePath, {
            width: maxSize,
            height: maxSize,
          })
          .catch((e) => undefined);

        if (!thumbnail) {
          // Generate preview straight from the image
          if (imageMediaFormatsMatch(absoluteFilePath)) {
            const fileStat = await sharp(absoluteFilePath)
              .resize(maxSize)
              .webp()
              .toFile(path.join(cachePreviewPath.projectDir, cachePreviewPath.path));
            thumbCache?.set(cachePreviewPath.path, fileStat.size);
            callback({
              mimeType: 'image/webp',
              data: createReadStream(path.join(cachePreviewPath.projectDir, cachePreviewPath.path)),
            });
            return;
          }

          const bunlde = await findBundleInfoForFile({
            projectDir,
            path: fileLocalPath,
          });

          if (bunlde?.previewUrl) {
            const bundlePreviewAbsolutePath = path.join(projectDir, bunlde?.previewUrl);

            // just show the bundle preview if it exists
            if (existsSync(bundlePreviewAbsolutePath)) {
              const bundlePreviewStat = await stat(bundlePreviewAbsolutePath);

              cachePreviewPath = await GetThumbnailPath(
                { projectDir, path: bunlde.previewUrl },
                bundlePreviewStat,
              );

              // we might be creating the bundle preview for other files
              if (activeFileOperations.has(cachePreviewPath.path)) {
                await activeFileOperations.get('absoluteCachePreviewPath');
              }

              // thumbnail for the bundle preview exists, get it back
              if (pathExistsSync(cachePreviewPath)) {
                callback({
                  statusCode: 200,
                  mimeType: 'image/webp',
                  data: createReadStream(
                    path.join(cachePreviewPath.projectDir, cachePreviewPath.path),
                  ),
                });
                return;
              }

              // bundle preview was not made yet, create it
              const readStream = createReadStream(bundlePreviewAbsolutePath);
              const writePromise = readStream
                .pipe(sharp().resize(maxSize).webp())
                .toFile(path.join(cachePreviewPath.projectDir, cachePreviewPath.path))
                .then((s) => {
                  activeFileOperations.delete(bundlePreviewAbsolutePath);
                  return s;
                });
              activeFileOperations.set(bundlePreviewAbsolutePath, writePromise);
              const previewStats = await writePromise;
              thumbCache?.set(cachePreviewPath.path, previewStats.size);
              callback({
                statusCode: 200,
                mimeType: 'image/webp',
                data: createReadStream(
                  path.join(cachePreviewPath.projectDir, cachePreviewPath.path),
                ),
              });
              return;
            }
          } else {
            callback({
              statusCode: 204,
              data: Readable.from([]),
            });
            return;
          }
        }

        const previewStat = await sharp(thumbnail?.toPNG())
          .webp()
          .toFile(path.join(cachePreviewPath.projectDir, cachePreviewPath.path));
        thumbCache?.set(cachePreviewPath.path, previewStat.size);

        callback({
          statusCode: 200,
          mimeType: 'image/webp',
          data: createReadStream(path.join(cachePreviewPath.projectDir, cachePreviewPath.path)),
        });
      } catch (error) {
        log.error(error);
        callback({
          statusCode: 404,
          mimeType: 'image/png',
          data: Readable.from([]),
        });
      }
    });
  });
}
