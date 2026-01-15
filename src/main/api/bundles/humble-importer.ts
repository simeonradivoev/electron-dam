/* eslint-disable no-await-in-loop */
import { uuid } from '@tanstack/react-form';
import { BrowserWindow } from 'electron';
import ElectronStore from 'electron-store';
import { foreachAsync } from 'main/util';
import { HUMBLE_PARTITION, StoreSchema } from 'shared/constants';
import { getBundles } from '../bundles-api';

export default function InstallHumbleImporter(store: ElectronStore<StoreSchema>, db: Loki) {
  const virtualBundles = db.getCollection<VirtualBundle>('bundles');
  return {
    import: async (abort, progress) => {
      const mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: false,
        webPreferences: {
          javascript: true,
          contextIsolation: true,
          partition: HUMBLE_PARTITION,
        },
      });

      // Block external JS files
      mainWindow.webContents.session.webRequest.onBeforeRequest(
        { urls: ['*://*/*.js'] }, // valid URL pattern
        (details, callback) => {
          callback({ cancel: true });
        },
      );
      await mainWindow.loadURL('https://www.humblebundle.com/home/library');
      const gameKeys: [] & boolean = await mainWindow.webContents.executeJavaScript(
        `
          (() => {
            const el = document.querySelector('#user-home-json-data');
            if (!el) return false;

            try {
              const data = JSON.parse(el.textContent);
              return data.gamekeys;
            } catch {
              return false;
            }
          })();
        `,
      );

      if (!gameKeys) {
        return;
      }

      const allBundles = await getBundles(store);

      const perPage = 5;
      for (let i = 0; i < gameKeys.length; i += perPage) {
        const batch = gameKeys.slice(i, i + perPage);
        const params = batch.map((k) => `gamekeys=${encodeURIComponent(k)}`).join('&');
        if (abort?.aborted) {
          break;
        }

        await mainWindow.loadURL(
          `https://www.humblebundle.com/api/v1/orders?all_tpkds=true&${params}`,
        );
        const data = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const pre = document.querySelector('pre');
          if (!pre) throw new Error('No JSON found');
          return pre.innerText;
        })()
      `);

        const jsonData: Record<
          string,
          {
            subproducts?: {
              human_name: string;
              url?: string;
              downloads: { platform: 'ebook' | 'windows' | 'other' | 'audio' | 'image' }[];
              icon?: string;
            }[];
            gamekey: string;
            created: Date;
            product: { category: 'bundle' | 'subscriptionplan' | 'subscriptioncontent' };
          }
        > = JSON.parse(data);
        await foreachAsync(
          Object.keys(jsonData),
          async (key) => {
            const order = jsonData[key];
            if (order.product.category !== 'bundle' || !order.subproducts) {
              return;
            }

            await foreachAsync(
              order.subproducts.filter((p) =>
                p.downloads.some(
                  (d) =>
                    d.platform === 'audio' ||
                    d.platform === 'other' ||
                    d.platform === 'windows' ||
                    d.platform === 'image',
                ),
              ),
              async (product) => {
                const existingLocalBundle = allBundles.find(
                  (b) => b.name === product.human_name || b.bundle.sourceUrl === product.url,
                );

                if (existingLocalBundle) {
                  return;
                }

                const existingBundle = virtualBundles.findOne({
                  $or: [{ name: product.human_name }, { sourceUrl: product.url }],
                });

                if (existingBundle) {
                  existingBundle.sourceId = order.gamekey;
                  existingBundle.previewUrl ??= product.icon;
                  existingBundle.sourceType = 'humble';
                  existingBundle.sourceUrl = product.url;
                  virtualBundles.update(existingBundle);
                } else {
                  const newBundle: VirtualBundle = {
                    sourceUrl: product.url,
                    name: product.human_name,
                    id: uuid(),
                    date: order.created,
                    sourceId: order.gamekey,
                    previewUrl: product.icon,
                    sourceType: 'humble',
                  };
                  virtualBundles.insertOne(newBundle);
                }
              },
              abort,
            );
          },
          abort,
        );

        progress?.(i / gameKeys.length);
      }

      mainWindow.close();
    },
    isLoggedIn: async () => {
      const mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: false,
        webPreferences: {
          javascript: true,
          contextIsolation: true,
          partition: HUMBLE_PARTITION,
        },
      });

      // Block external JS files
      mainWindow.webContents.session.webRequest.onBeforeRequest(
        { urls: ['*://*/*.js'] }, // valid URL pattern
        (details, callback) => {
          callback({ cancel: true });
        },
      );
      await mainWindow.loadURL('https://www.humblebundle.com/home/library');
      const gameKeys: [] & boolean = await mainWindow.webContents.executeJavaScript(
        `
                (() => {
                  const el = document.querySelector('#user-home-json-data');
                  if (!el) return false;

                  try {
                    const data = JSON.parse(el.textContent);
                    return data.gamekeys;
                  } catch {
                    return false;
                  }
                })();
              `,
      );

      if (!gameKeys) {
        return false;
      }
      return true;
    },
    login: async () => {
      const loginWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
          contextIsolation: true,
          partition: HUMBLE_PARTITION,
        },
      });

      await loginWindow.loadURL('https://www.humblebundle.com/login?goto=%2Fhome%2Flibrary');

      await new Promise((resolve, reject) => {
        let completed = false;

        // User manually closed window
        loginWindow.on('closed', () => {
          if (!completed) {
            reject(new Error('Cancel'));
          }
        });

        loginWindow.webContents.on('did-navigate', (_, url) => {
          if (url.includes('/home/library')) {
            // Logged in
            completed = true;
            loginWindow.close();
            resolve(true);
          }
        });
      });
    },
  } satisfies BundleImporter;
}
