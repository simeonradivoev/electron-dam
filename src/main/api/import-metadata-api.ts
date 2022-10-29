import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as cheerio from 'cheerio';
import * as https from 'https';
import { Channels } from '../../shared/constants';

export default function InitializeMetadataApi() {
  ipcMain.handle(
    Channels.ImportBundleMetadata,
    async (event: IpcMainInvokeEvent, url: string): Promise<BundleMetadata> => {
      const requestPromise = new Promise<BundleMetadata>((resolve, reject) => {
        https
          .get(url, (res) => {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);

            res.on('data', (d) => {
              const $ = cheerio.load(d);

              return resolve({
                description:
                  $('meta[name="description"]').attr('content') ??
                  $('meta[property="og:description"]').attr('content'),
                keywords: $('meta[name="keywords"]')
                  .attr('content')
                  ?.split(','),
              });
            });
          })
          .on('error', (e) => {
            return reject(e);
          });
      });

      return requestPromise;
    }
  );
}
