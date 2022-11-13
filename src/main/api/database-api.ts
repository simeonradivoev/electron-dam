import { BrowserWindow, dialog } from 'electron';
import Store from 'electron-store';
import { lstat } from 'fs/promises';
import path from 'path';
import Loki from 'lokijs';
import InitializeBundlesApi from './bundles-api';
import InitializeFileInfoApi from './file-info-api';
import InitializeFileSystemApi from './file-system-api';

let database: Loki;

export function LoadDatabaseExact(
  store: Store<StoreSchema>,
  directory: string
) {
  database?.close();

  database = new Loki(path.join(directory, 'dam-database.db'), {
    autosave: true,
    serializationMethod: 'pretty',
    persistenceMethod: 'fs',
    autosaveInterval: 4000,
    autosaveCallback: () => {
      console.log('autosaved db');
    },
  });

  database.loadDatabase(undefined, (error) => {
    if (error) {
      console.error(error);
      return;
    }

    const { removeAllTags } = InitializeFileSystemApi(store, database);
    InitializeFileInfoApi(store, database);
    InitializeBundlesApi(store, database, removeAllTags);
  });
}

export async function LoadDatabase(store: Store<StoreSchema>) {
  const projectDir = store.get('projectDirectory') as string;
  if (projectDir && !!(await lstat(projectDir).catch((e) => false))) {
    LoadDatabaseExact(store, projectDir);
  }
}
