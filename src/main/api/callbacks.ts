import { existsSync } from 'fs';
import { dirname } from 'path';
import log from 'electron-log/main';
import Store from 'electron-store';
import { FilePath, getProjectDir } from 'main/util';
import {
  BundleMetaFile,
  MainIpcCallbacks,
  MetaFileExtension,
  StoreSchema,
} from '../../shared/constants';
import { findBundleInfoForFile } from './bundles-api';
import { LoadDatabaseExact } from './database-api';
import { fileEvents, pathExistsSync } from './file-system-api';
import { projectEvents } from './project-api';
import { removeIndex, updateFileEmbeddings, updateFileFromPath } from './search/serach-api';

/**
 * Used for global callbacks that don't fit anywhere.
 * Like updating search indexes on change, etc
 */
export default function InitializeCallbacks(store: Store<StoreSchema>, api: MainIpcCallbacks) {
  projectEvents.on('projectChange', async (directoryPath) => {
    await LoadDatabaseExact(store, directoryPath);
  });

  fileEvents.on('file-added', async (addedFilePath) => {
    if (addedFilePath.path.endsWith(`.${MetaFileExtension}`)) {
      const filePath = addedFilePath.with(
        addedFilePath.path.substring(0, addedFilePath.path.length - MetaFileExtension.length - 1),
      );
      await updateFileFromPath(
        filePath.projectDir,
        filePath.path,
        (await findBundleInfoForFile(filePath)) ?? undefined,
      );
      log.log(`Added file to index ${filePath.path}`);
    } else if (addedFilePath.path.endsWith(BundleMetaFile)) {
      // bundle js file was added
      const bundleDir = dirname(addedFilePath.path);
      const zipPath = addedFilePath.path.substring(
        0,
        addedFilePath.path.length - `.${BundleMetaFile}`.length,
      );

      if (existsSync(addedFilePath.with(zipPath).absolute)) {
        api.fileChanged(zipPath);
      } else if (existsSync(addedFilePath.with(bundleDir).absolute)) {
        // update search index even if metadata is empty
        await updateFileFromPath(
          addedFilePath.projectDir,
          bundleDir,
          (await findBundleInfoForFile(addedFilePath.with(bundleDir))) ?? undefined,
        );
        api.fileChanged(bundleDir);
        log.log(`Added bundle to index ${bundleDir}`);
      }
    }
  });

  fileEvents.on('file-removed', async (filePath) => {
    if (filePath.path.endsWith(`.${MetaFileExtension}`)) {
      const assetPath = filePath.with(
        filePath.path.substring(0, filePath.path.length - MetaFileExtension.length - 1),
      );
      await removeIndex(assetPath);
      log.log(`Removed file from index ${assetPath.path}`);
    } else if (filePath.path.endsWith(BundleMetaFile)) {
      // bundle js file was removed outside
      const bundleDir = dirname(filePath.path);
      const zipFilePath = filePath.path.substring(
        0,
        filePath.path.length - `.${BundleMetaFile}`.length,
      );

      if (pathExistsSync(filePath.with(zipFilePath))) {
        api.fileChanged(zipFilePath);
      } else if (pathExistsSync(filePath.with(bundleDir))) {
        await removeIndex(filePath.with(bundleDir));
        // file change is good enough for handling updates for UI
        api.fileChanged(bundleDir);
        log.log(`Removed bundle from index ${bundleDir}`);
      }
    }
  });

  fileEvents.on('file-changed', async (filePath) => {
    if (filePath.path.endsWith(`.${MetaFileExtension}`)) {
      const assetPath = new FilePath(
        filePath.projectDir,
        filePath.path.substring(0, filePath.path.length - MetaFileExtension.length - 1),
      );
      await updateFileEmbeddings(filePath);
      await updateFileFromPath(
        filePath.projectDir,
        assetPath.path,
        (await findBundleInfoForFile(assetPath)) ?? undefined,
      );
      log.log(`Updated Search Index for ${assetPath.path}`);
    } else if (filePath.path.endsWith(BundleMetaFile)) {
      const folderPath: FilePath = filePath.with(dirname(filePath.path));
      const zipFilePath: FilePath = filePath.with(
        filePath.path.substring(0, filePath.path.length - `.${BundleMetaFile}`.length),
      );

      if (pathExistsSync(zipFilePath)) {
        api.fileChanged(zipFilePath.path);
      } else if (pathExistsSync(folderPath)) {
        await updateFileEmbeddings(folderPath);
        await updateFileFromPath(
          filePath.projectDir,
          folderPath.path,
          (await findBundleInfoForFile(folderPath)) ?? undefined,
        );
        api.fileChanged(folderPath.path);
        log.log(`Updated Search Index for Bundle ${folderPath.path}`);
      }
    }
  });
}

export async function InitializeDatabaseCallbacks(store: Store<StoreSchema>, db: Loki) {
  const virtualBundles = db.getCollection<VirtualBundle>('bundles');
  virtualBundles.on('update', async (obj: VirtualBundle & LokiObj) => {
    await updateFileFromPath(getProjectDir(store) ?? '', obj.id, {
      id: obj.id,
      isVirtual: true,
      bundle: obj,
      name: obj.name,
      date: obj.date,
    });
    log.log(`Updated Search Index for ${obj.id}  (${obj.name})`);
  });
  virtualBundles.on('insert', async (obj: VirtualBundle & LokiObj) => {
    await updateFileFromPath(getProjectDir(store) ?? '', obj.id, {
      id: obj.id,
      isVirtual: true,
      bundle: obj,
      name: obj.name,
      date: obj.date,
    });
    log.log(`Updated Search Index for ${obj.id} (${obj.name})`);
  });
}
