import Store from 'electron-store';
import { MetaFileExtension, StoreSchema } from '../../shared/constants';
import { addTask } from '../managers/task-manager';
import { findBundleInfoForFile } from './bundles-api';
import { LoadDatabaseExact } from './database-api';
import { fileEvents } from './file-system-api';
import { projectEvents } from './project-api';
import { LoadVectorDatabase, removeIndex, updateFileFromPath } from './serach-api';

/**
 * Used for global callbacks that don't fit anywhere.
 * Like updating search indexes on change, etc
 */
export default function InitializeCallbacks(store: Store<StoreSchema>) {
  projectEvents.on('projectChange', async (directoryPath) => {
    await LoadDatabaseExact(store, directoryPath);
  });

  fileEvents.on('metadata-updated', async (filePath) => {
    updateFileFromPath(filePath, (await findBundleInfoForFile(filePath)) ?? undefined);
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
      updateFileFromPath(filePath, (await findBundleInfoForFile(filePath)) ?? undefined);
    }
  });

  fileEvents.on('file-removed', async (filePath) => {
    if (filePath.path.endsWith(`.${MetaFileExtension}`)) {
      removeIndex({
        projectDir: filePath.projectDir,
        path: filePath.path.substring(0, filePath.path.length - MetaFileExtension.length - 1),
      });
    }
  });

  fileEvents.on('file-changed', async (filePath) => {
    if (filePath.path.endsWith(`.${MetaFileExtension}`)) {
      updateFileFromPath(
        {
          projectDir: filePath.projectDir,
          path: filePath.path.substring(0, filePath.path.length - MetaFileExtension.length - 1),
        },
        (await findBundleInfoForFile(filePath)) ?? undefined,
      );
    }
  });
}
