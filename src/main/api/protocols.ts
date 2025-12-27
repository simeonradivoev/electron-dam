import { createReadStream, createWriteStream, existsSync, Stats } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { PassThrough, Readable } from 'stream';
import { nativeImage, protocol } from 'electron';
import Store from 'electron-store';
import StreamZip from 'node-stream-zip';
import sharp from 'sharp';
import { zipDelimiter, StoreSchema } from '../../shared/constants';
import { mkdirs } from '../util';
import { findBundleInfoForFile, findFolderPreview, findZipPreviewReadable } from './bundles-api';

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
      const range = request.headers['Range'] || request.headers['range'];

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
      console.error(error);
      callback({ statusCode: 400 });
    }
  });

  protocol.registerStreamProtocol('thumb', async (request, callback) => {
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
      let statInfo: Stats | undefined;
      try {
        statInfo = await stat(absoluteFilePath);
      } catch {
        callback({
          statusCode: 404,
          data: Readable.from([]),
        });
        return;
      }

      const absoluteCachePreviewPath = path.join(
        projectDir,
        '.cache',
        'thumbnails',
        `${fileLocalPath.replaceAll(path.sep, '-')}-${statInfo.ino}-${statInfo.mtimeMs}.webp`,
      );

      if (existsSync(absoluteCachePreviewPath)) {
        const stream = createReadStream(absoluteCachePreviewPath);
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
        .catch((e) => {});

      if (!thumbnail) {
        if (absoluteFilePath.endsWith('.webp')) {
          const tee = new PassThrough();
          const writeStream = createWriteStream(absoluteCachePreviewPath);
          tee.pipe(writeStream);
          createReadStream(absoluteFilePath).pipe(sharp().resize(maxSize).webp()).pipe(tee);
          callback({
            mimeType: 'image/webp',
            data: tee,
          });
          return;
        }

        const bunlde = await findBundleInfoForFile({
          projectDir,
          path: fileLocalPath,
        });
        if (bunlde?.previewUrl) {
          const bundlePreviewReader = createReadStream(path.join(projectDir, bunlde?.previewUrl));
          callback({
            statusCode: 200,
            mimeType: 'image/webp',
            data: bundlePreviewReader.pipe(
              sharp().resize({ width: maxSize, withoutEnlargement: true }).webp(),
            ),
          });
          return;
        }
        callback({
          statusCode: 204,
          data: Readable.from([]),
        });
        return;
      }

      const tee = new PassThrough();
      const writeStream = createWriteStream(absoluteCachePreviewPath);
      tee.pipe(writeStream);
      sharp(thumbnail?.toPNG()).webp().pipe(tee);

      callback({
        mimeType: 'image/webp',
        data: tee,
      });
    } catch (error) {
      console.error(error);
      callback({
        statusCode: 404,
        mimeType: 'image/png',
        data: Readable.from([]),
      });
    }
  });
}
