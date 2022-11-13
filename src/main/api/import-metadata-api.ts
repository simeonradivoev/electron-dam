import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as fs from 'fs';
import path from 'path';
import { Channels } from '../../shared/constants';

export default function InitializeMetadataApi() {
  ipcMain.handle(
    Channels.ImportBundleMetadata,
    async (event: IpcMainInvokeEvent, url: string): Promise<BundleMetadata> => {
      const requestPromise = new Promise<BundleMetadata>((resolve, reject) => {
        try {
          https
            .get(url, { headers: { 'User-Agent': 'Electron Dam' } }, (res) => {
              try {
                res.setEncoding('utf8');
                console.log('statusCode:', res.statusCode);
                console.log('headers:', res.headers);
                let body: string;
                res.on('data', (d) => {
                  body += d;
                });
                res.on('end', () => {
                  const $ = cheerio.load(body);

                  return resolve({
                    description:
                      $('meta[name="description"]')?.attr('content') ??
                      $('meta[property="og:description"]')?.attr('content'),
                    keywords: $('meta[name="keywords"]')
                      ?.attr('content')
                      ?.split(','),
                    title:
                      $('title')?.text() ??
                      $('meta[property="og:title"]')?.attr('content'),
                    preview: $('meta[property="og:image"]')?.attr('content'),
                  });
                });
              } catch (error) {
                reject(error);
              }
            })
            .on('error', (e) => {
              return reject(e);
            });
        } catch (error) {
          reject(error);
        }
      });

      return requestPromise;
    }
  );

  ipcMain.handle(
    Channels.DownloadPreview,
    async (
      event: IpcMainInvokeEvent,
      bundlePath: string,
      url: string
    ): Promise<void> => {
      const imageInfoPromise = new Promise<string | undefined>(
        (resolve, reject) => {
          https
            .get(url, (res) => {
              console.log('statusCode:', res.statusCode);
              console.log('headers:', res.headers);

              res.on('data', (d) => {
                const $ = cheerio.load(d);

                return resolve($('meta[property="og:image"]').attr('content'));
              });
            })
            .on('error', (e) => {
              return reject(e);
            });
        }
      );

      const imageUrl = await imageInfoPromise;
      if (imageUrl) {
        const downloadPromise = new Promise<string>((resolve, reject) => {
          https.get(imageUrl, (res) => {
            if (res.statusCode === 200) {
              res
                .pipe(
                  fs.createWriteStream(path.join(bundlePath, 'Preview.png'))
                )
                .on('error', reject)
                .once('close', () => resolve(imageUrl));
            } else {
              // Consume response data to free up memory
              res.resume();
              reject(
                new Error(
                  `Request Failed With a Status Code: ${res.statusCode}`
                )
              );
            }
          });
        });

        await downloadPromise;
      }
    }
  );
}
