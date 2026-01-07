import { dirname } from 'path';
import log from 'electron-log/main';
import Store from 'electron-store';
import {
  BundleMetaFile,
  MainIpcCallbacks,
  MetaFileExtension,
  StoreSchema,
  zipDelimiter,
} from '../../shared/constants';
import { addTask } from '../managers/task-manager';
import { findBundleInfoForFile } from './bundles-api';
import { LoadDatabaseExact } from './database-api';
import { fileEvents } from './file-system-api';
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
      const filePath = {
        projectDir: addedFilePath.projectDir,
        path: addedFilePath.path.substring(
          0,
          addedFilePath.path.length - MetaFileExtension.length - 1,
        ),
      };
      await updateFileFromPath(
        filePath.projectDir,
        filePath.path,
        (await findBundleInfoForFile(filePath)) ?? undefined,
      );
      log.log(`Added file to index ${filePath.path}`);
    } else if (addedFilePath.path.endsWith(`${zipDelimiter}.${BundleMetaFile}`)) {
      // add when we can accept zip files in search
      const zipFilePath = addedFilePath.path.substring(
        0,
        addedFilePath.path.length - `.${BundleMetaFile}`.length,
      );
      api.fileChanged(zipFilePath);
    } else if (addedFilePath.path.endsWith(BundleMetaFile)) {
      // bundle js file was added
      const bundleDir = dirname(addedFilePath.path);
      // update search index even if metadata is empty
      await updateFileFromPath(
        addedFilePath.projectDir,
        bundleDir,
        (await findBundleInfoForFile({ projectDir: addedFilePath.projectDir, path: bundleDir })) ??
          undefined,
      );
      api.fileChanged(bundleDir);
    }
  });

  fileEvents.on('file-removed', async (filePath) => {
    if (filePath.path.endsWith(`.${MetaFileExtension}`)) {
      const assetPath = {
        projectDir: filePath.projectDir,
        path: filePath.path.substring(0, filePath.path.length - MetaFileExtension.length - 1),
      };
      await removeIndex(assetPath);
      log.log(`Removed file from index ${assetPath.path}`);
    } else if (filePath.path.endsWith(`${zipDelimiter}.${BundleMetaFile}`)) {
      // add when we can accept zip files in search
      const zipFilePath = filePath.path.substring(
        0,
        filePath.path.length - `.${BundleMetaFile}`.length,
      );
      api.fileChanged(zipFilePath);
    } else if (filePath.path.endsWith(BundleMetaFile)) {
      // bundle js file was removed outside
      const bundleDir = dirname(filePath.path);
      await removeIndex({
        projectDir: filePath.projectDir,
        path: bundleDir,
      });
      // file change is good enough for handling updates for UI
      api.fileChanged(bundleDir);
      log.log(`Removed bundle from index ${bundleDir}`);
    }
  });

  fileEvents.on('file-changed', async (filePath) => {
    if (filePath.path.endsWith(`.${MetaFileExtension}`)) {
      const assetPath: FilePath = {
        projectDir: filePath.projectDir,
        path: filePath.path.substring(0, filePath.path.length - MetaFileExtension.length - 1),
      };
      await updateFileEmbeddings(filePath);
      await updateFileFromPath(
        filePath.projectDir,
        assetPath.path,
        (await findBundleInfoForFile(assetPath)) ?? undefined,
      );
      log.log(`Updated Search Index for ${assetPath.path}`);
    } else if (filePath.path.endsWith(`${zipDelimiter}.${BundleMetaFile}`)) {
      // add when we can accept zip files in search
    } else if (filePath.path.endsWith(BundleMetaFile)) {
      const folderPath: FilePath = {
        projectDir: filePath.projectDir,
        path: dirname(filePath.path),
      };
      await updateFileEmbeddings(folderPath);
      await updateFileFromPath(
        filePath.projectDir,
        folderPath.path,
        (await findBundleInfoForFile(folderPath)) ?? undefined,
      );
      log.log(`Updated Search Index for Bundle ${folderPath.path}`);
    }
  });
}

export async function InitializeDatabaseCallbacks(store: Store<StoreSchema>, db: Loki) {
  const virtualBundles = db.getCollection<VirtualBundle>('bundles');
  virtualBundles.on('update', async (obj: VirtualBundle & LokiObj) => {
    await updateFileFromPath(store.get('projectDirectory'), obj.id, {
      id: obj.id,
      isVirtual: true,
      bundle: obj,
      name: obj.name,
      date: obj.date,
    });
    log.log(`Updated Search Index for ${obj.id}  (${obj.name})`);
  });
  virtualBundles.on('insert', async (obj: VirtualBundle & LokiObj) => {
    await updateFileFromPath(store.get('projectDirectory'), obj.id, {
      id: obj.id,
      isVirtual: true,
      bundle: obj,
      name: obj.name,
      date: obj.date,
    });
    log.log(`Updated Search Index for ${obj.id} (${obj.name})`);
  });
}
