import Loki from 'lokijs';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { lstat, writeFile, unlink, readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import Store from 'electron-store';
import { Channels, previewTypes } from '../../shared/constants';
import { getRandom } from '../util';

async function createBundle(directory: string): Promise<boolean> {
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory()) {
    return false;
  }
  const bundle: Bundle = {};
  return writeFile(path.join(directory, 'bundle.json'), JSON.stringify(bundle))
    .catch((err) => {
      console.error(err);
      return false;
    })
    .then(() => true);
}

export function InitializeBundlesApiGlobal() {
  ipcMain.handle(
    'create-bundle',
    async (_event: IpcMainInvokeEvent, directory: string): Promise<boolean> =>
      createBundle(directory)
  );
}

export default function InitializeBundlesApi(
  store: Store<StoreSchema>,
  db: Loki,
  removeAllTags: (id: string) => void
) {
  let virtualBundles = db.getCollection<VirtualBundle>('bundles');
  if (virtualBundles === null) {
    virtualBundles = db.addCollection<VirtualBundle>('bundles', {
      indices: 'id',
      unique: ['id'],
    });
  }

  async function tryGetBundleEntryFromFile(
    filePath: string
  ): Promise<BundleInfo | undefined> {
    const bundlePath = path.join(filePath, 'bundle.json');

    const bundleStat = await lstat(bundlePath).catch((e) => null);
    if (bundleStat) {
      const bundleRaw = await readFile(bundlePath, 'utf8');
      const bundle = JSON.parse(bundleRaw);
      const bundleEntry: BundleInfo = {
        id: filePath,
        bundle,
        name: path.basename(filePath),
        isVirtual: false,
        date: bundleStat.birthtime,
      };

      for (let index = 0; index < previewTypes.length; index += 1) {
        const type = previewTypes[index];
        const previewPath = path.join(filePath, `Preview${type}`);
        if (await lstat(previewPath).catch((e) => false)) {
          bundleEntry.previewUrl = previewPath;
          break;
        }
      }

      return bundleEntry;
    }

    return undefined;
  }

  async function findChildrenBundles(
    parent: string,
    bundles: BundleInfo[]
  ): Promise<void> {
    const dirs = await readdir(parent, { withFileTypes: true });

    await Promise.all(
      dirs.map(async (dir) => {
        const childPath = path.join(parent, dir.name);
        const bundlePath = path.join(childPath, 'bundle.json');

        if (dir.isDirectory()) {
          const bundle = await tryGetBundleEntryFromFile(childPath);

          if (bundle) {
            bundles.push(bundle);
          } else {
            await findChildrenBundles(childPath, bundles);
          }
        }
      })
    );
  }

  async function getBundles(): Promise<BundleInfo[]> {
    const bundles: BundleInfo[] = [];
    const projectDir = store.get('projectDirectory') as string | undefined;
    if (projectDir) {
      const root = await lstat(projectDir);
      await findChildrenBundles(projectDir, bundles);
    }

    const allBundles = virtualBundles.find();
    allBundles.forEach((b) =>
      bundles.push({
        id: b.id,
        name: b.name,
        previewUrl: b.previewUrl,
        bundle: b,
        isVirtual: true,
        date: b.date,
      })
    );

    return bundles.sort((a, b) => b.date?.getTime() - a.date?.getTime());
  }

  async function getHomeBundles(): Promise<HomePageBundles | undefined> {
    const bundles = await getBundles();

    const randomIndices: Array<number> = [];
    for (let i = 0; i < 3; i += 1) {
      let randomIndex = Math.floor(Math.random() * bundles.length);
      while (randomIndices.includes(randomIndex)) {
        randomIndex = Math.floor(Math.random() * bundles.length);
      }
      randomIndices.push(randomIndex);
    }
    const seed = new Date(Date.now()).setHours(0, 0, 0, 0);

    const projectDir = store.get('projectDirectory') as string | undefined;

    return {
      random: getRandom(bundles, 3, seed.toString()),
      recent: bundles
        .sort((a, b) => b.date?.getTime() - a.date?.getTime())
        .slice(0, Math.min(5, bundles.length)),
      stats: {
        bundleCount: bundles.length,
        virtualBundleCount: bundles.filter((b) => b.isVirtual).length
      },
    };
  }

  async function getBundle(id: string): Promise<BundleInfo | undefined> {
    const virtualBundle = virtualBundles.findOne({ id });
    if (virtualBundle) {
      return {
        id,
        isVirtual: true,
        bundle: virtualBundle as Bundle,
        previewUrl: virtualBundle.previewUrl,
        name: virtualBundle.name,
      } as BundleInfo;
    }
    return tryGetBundleEntryFromFile(id);
  }

  async function deleteBundle(bundleId: string): Promise<void> {
    const virtualBundle = virtualBundles.findOne({ id: bundleId });
    if (virtualBundle) {
      virtualBundles.findAndRemove({ id: bundleId });
      return;
    }
    const bundlePath = path.join(bundleId, 'bundle.json');
    if (await lstat(bundlePath).catch((e) => false)) {
      unlink(bundlePath);
    }
    await removeAllTags(bundleId);
  }

  async function createVirtualBundle(bundle: VirtualBundle) {
    return virtualBundles.insertOne(bundle);
  }

  async function updateBundle(
    bundleId: string,
    bundle: Bundle
  ): Promise<Bundle | undefined> {
    const finalBundle: Bundle | null = bundle;
    const virtualBundle = virtualBundles.findOne({ id: bundleId });
    if (virtualBundle) {
      virtualBundles.update(finalBundle as VirtualBundle);
      return finalBundle;
    }
    return writeFile(
      path.join(bundleId, 'bundle.json'),
      JSON.stringify(bundle)
    ).then(() => finalBundle);
  }

  ipcMain.handle(
    Channels.UpdateBundle,
    async (
      _event: IpcMainInvokeEvent,
      bundlePath: string,
      bundle: Bundle
    ): Promise<Bundle | undefined> => updateBundle(bundlePath, bundle)
  );
  ipcMain.handle(Channels.GetBundles, async () => getBundles());
  ipcMain.handle(Channels.GetHomeBundle, async () => getHomeBundles());
  ipcMain.handle(
    Channels.CreateVirtualBundle,
    async (_event: IpcMainInvokeEvent, bundle: VirtualBundle) =>
      createVirtualBundle(bundle)
  );
  ipcMain.handle(
    Channels.GetBundle,
    async (_event: IpcMainInvokeEvent, id: string) => getBundle(id)
  );
  ipcMain.handle(
    Channels.DeleteBundle,
    async (_event: IpcMainInvokeEvent, bundlePath: string): Promise<void> =>
      deleteBundle(bundlePath)
  );
}

export function CleanupBundlesApi() {
  ipcMain.removeHandler(Channels.UpdateBundle);
  ipcMain.removeHandler(Channels.GetBundles);
  ipcMain.removeHandler(Channels.GetHomeBundle);
  ipcMain.removeHandler(Channels.CreateVirtualBundle);
  ipcMain.removeHandler(Channels.GetBundle);
  ipcMain.removeHandler(Channels.DeleteBundle);
}
