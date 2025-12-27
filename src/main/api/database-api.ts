import { lstat } from 'fs/promises';
import path from 'path';
import Store from 'electron-store';
import Loki from 'lokijs';
import { MainIpcCallbacks, MainIpcGetter, StoreSchema } from '../../shared/constants';
import { registerMainCallbacks, registerMainHandlers, unregisterMainHandlers } from '../util';
import InitializeBundlesApi from './bundles-api';
import InitializeFileInfoApi from './file-info-api';
import InitializeFileSystemApi from './file-system-api';
import { projectEvents } from './project-api';
import { InitializeSearchApi } from './serach-api';

export function LoadDatabaseExact(store: Store<StoreSchema>, directory: string): Promise<Loki> {
  const database = new Loki(path.join(directory, 'dam-database.db'), {
    autosave: true,
    serializationMethod: 'pretty',
    persistenceMethod: 'fs',
    autosaveInterval: 4000,
    autosaveCallback: () => {
      console.log('autosaved db');
    },
  });

  projectEvents.once('projectChange', (_) => {
    database.close();
  });

  return new Promise((resolve, reject) => {
    database.loadDatabase(undefined, async (error) => {
      if (error) {
        reject(error);
        return;
      }

      const api = {} as MainIpcGetter;
      const apiCallback = {} as MainIpcCallbacks;
      registerMainCallbacks(apiCallback);

      const fileSystemApi = InitializeFileSystemApi(api, apiCallback, store, database);
      InitializeFileInfoApi(api, store);
      InitializeBundlesApi(api, store, database, fileSystemApi.removeAllTags);
      InitializeSearchApi(api, store, database);
      registerMainHandlers(api);

      database.on('close', () => {
        fileSystemApi.cleanup();
        unregisterMainHandlers(api);
      });

      resolve(database);
    });
  });
}

export async function LoadDatabase(store: Store<StoreSchema>): Promise<Loki | undefined> {
  const projectDir = store.get('projectDirectory') as string;
  if (projectDir && !!(await lstat(projectDir).catch((e) => false))) {
    return LoadDatabaseExact(store, projectDir);
  }
  return undefined;
}
