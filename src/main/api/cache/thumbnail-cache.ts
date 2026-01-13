import { existsSync } from 'fs';
import { readdir, rm, stat } from 'fs/promises';
import path from 'path';
import ElectronStore from 'electron-store';
import { LRUCache } from 'lru-cache';
import { addTask } from 'main/managers/task-manager';
import { getProjectDir } from 'main/util';
import { MainIpcGetter, StoreSchema } from 'shared/constants';

export let thumbCache: LRUCache<string, number> | undefined;

export default function InitializeThumbnailCache(
  api: MainIpcGetter,
  store: ElectronStore<StoreSchema>,
) {
  const cacheProjectDir = path.join(getProjectDir(store) ?? '', '.cache', 'thumbnails');
  async function rebuildCache(abort: AbortSignal, progress: ProgressReporter) {
    const cache = new LRUCache<string, number>({
      maxSize: store.get('cachedStorageSize') * 1024 * 1024,

      // value = file size
      sizeCalculation: (size) => size,

      // called automatically when evicted
      dispose: async (value, key) => {
        await rm(path.join(cacheProjectDir, key)).catch(() => {});
      },
    });

    if (existsSync(cacheProjectDir)) {
      const files = await readdir(cacheProjectDir, { withFileTypes: true });

      let progressValue = 0;
      await Promise.all(
        files
          .filter((f) => f.isFile())
          .map(async (file, index) => {
            const fullPath = path.join(cacheProjectDir, file.name);
            const fileStat = await stat(fullPath);
            if (fileStat.size > 0) {
              cache.set(file.name, fileStat.size);
              progressValue += (1 / files.length) * index;
              progress(progressValue);
            }
          }),
      );
    }

    thumbCache = cache;
  }

  store.onDidChange('cachedStorageSize', () => addTask('Rebuilding Thumbnail Cache', rebuildCache));
  addTask('Rebuilding Thumbnail Cache', rebuildCache, { icon: 'media' });
  api.getCacheSize = async () => thumbCache?.calculatedSize ?? 0;
}
