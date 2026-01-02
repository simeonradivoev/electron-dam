import { lstat } from 'fs/promises';
import path from 'path';
import { app, dialog } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
import Loki from 'lokijs';
import { addTask } from 'main/managers/task-manager';
import { satisfies } from 'semver';
import { JSONStorage, memoryStorage, Umzug } from 'umzug';
import { MainIpcCallbacks, MainIpcGetter, StoreSchema } from '../../shared/constants';
import migrations, { MigrationContext } from '../migrations/migrations';
import {
  appVersion,
  registerMainCallbacks,
  registerMainHandlers,
  unregisterMainHandlers,
} from '../util';
import InitializeBundlesApi from './bundles-api';
import InitializeFileInfoApi from './file-info-api';
import InitializeFileSystemApi from './file-system-api';
import { projectEvents } from './project-api';
import { InitializeSearchApi, LoadVectorDatabase } from './serach-api';

export function LoadDatabaseExact(store: Store<StoreSchema>, directory: string): Promise<Loki> {
  const database: Loki = new Loki(path.join(directory, 'dam-database.db'), {
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
      let migrationsToRun = migrations
        .filter((m) => m.since && appVersion && satisfies(database.name ?? '0.0.0', m.since))
        .map((m) => m.name);
      if (migrationsToRun.length > 0) {
        await addTask(
          `Migration From ${database.name ?? '0.0.0'} to ${appVersion}`,
          async (abort, progress) => {
            // Migration
            const umzug = new Umzug<MigrationContext>({
              migrations,
              context: { db: database, store, dryRun: true, progress },
              logger: console,
              storage: memoryStorage(),
            });

            migrationsToRun = [];
            let progressAmount = 0;
            const migrationsSub = umzug.on('migrated', () => {
              progress((progressAmount += 1 / migrationsToRun.length));
            });
            await umzug.up({ migrations: migrationsToRun });
            migrationsSub();
          },
          { blocking: true, icon: 'git-merge' },
        );

        database.name = appVersion;
        database.saveDatabase();
      }

      database.name = appVersion;

      await addTask(
        'Initializing',
        async () => {
          const fileSystemApi = InitializeFileSystemApi(api, apiCallback, store, database);
          InitializeFileInfoApi(api, store);
          InitializeBundlesApi(api, store, database, fileSystemApi.removeAllTags);
          InitializeSearchApi(api, store, database);
          registerMainHandlers(api);

          database.on('close', () => {
            fileSystemApi.cleanup();
            unregisterMainHandlers(api);
          });
        },
        { blocking: true },
      );

      addTask(
        'Indexing Assets',
        (abort, progress) => LoadVectorDatabase(store, database, abort, progress),
        { blocking: false, icon: 'search-text' },
      );

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
