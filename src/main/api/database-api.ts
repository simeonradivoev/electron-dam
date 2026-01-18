import { existsSync } from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import Store from 'electron-store';
import Loki from 'lokijs';
import { addTask } from 'main/managers/task-manager';
import { satisfies } from 'semver';
import { memoryStorage, Umzug } from 'umzug';
import { MainIpcCallbacks, MainIpcGetter, StoreSchema } from '../../shared/constants';
import migrations, { MigrationContext } from '../migrations/migrations';
import { appVersion, getProjectDir, registerMainHandlers, unregisterMainHandlers } from '../util';
import InitializeAccounts from './accounts';
import InitializeBundlesApi from './bundles-api';
import InitializeThumbnailCache from './cache/thumbnail-cache';
import { InitializeDatabaseCallbacks } from './callbacks';
import InitializeFileInfoApi from './file-info-api';
import InitializeFileSystemApi from './file-system-api';
import { projectEvents } from './project-api';
import { InitializeSearchApi } from './search/serach-api';

export function LoadDatabaseExact(
  apiCallbacks: MainIpcCallbacks,
  store: Store<StoreSchema>,
  directory: string,
): Promise<Loki> {
  const database: Loki = new Loki(path.join(directory, 'dam-database.db'), {
    autosave: true,
    serializationMethod: 'pretty',
    persistenceMethod: 'fs',
    autosaveInterval: 4000,
    autosaveCallback: () => {
      log.log('autosaved db');
    },
  });

  projectEvents.once('projectChange', () => {
    database.close();
  });

  return new Promise((resolve, reject) => {
    database.loadDatabase(undefined, async (error) => {
      if (error) {
        reject(error);
        return;
      }

      const api = {} as MainIpcGetter;
      let migrationsToRun = migrations
        .filter((m: any) => m.since && appVersion && satisfies(database.name ?? '0.0.0', m.since))
        .map((m: any) => m.name);
      if (migrationsToRun.length > 0) {
        await addTask(
          `Migration From ${database.name ?? '0.0.0'} to ${appVersion}`,
          async (abort, progress) => {
            // Migration
            const umzug = new Umzug<MigrationContext>({
              migrations,
              context: { db: database, store, dryRun: true, progress },
              logger: log,
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
      const databaseAbortController = new AbortController();
      let fileSystemApi: ReturnType<typeof InitializeFileSystemApi>;
      const reIndexTask = () =>
        addTask(
          'Indexing Assets',
          (manualAbort, progress) =>
            fileSystemApi.fileIndexRegistry.index(databaseAbortController.signal, progress),
          { blocking: false, icon: 'search-text', signal: databaseAbortController.signal },
        );

      await addTask(
        'Initializing',
        async () => {
          fileSystemApi = InitializeFileSystemApi(api, apiCallbacks, store, database);
          InitializeThumbnailCache(api, store);
          InitializeFileInfoApi(api, store, database);
          const importers = InitializeAccounts(store, database, api);
          InitializeBundlesApi(importers, api, store, database);
          const searchApi = InitializeSearchApi(
            api,
            store,
            database,
            fileSystemApi.fileIndexRegistry,
          );

          InitializeDatabaseCallbacks(store, database);
          api.reIndexFiles = reIndexTask;
          registerMainHandlers(api);

          database.on('close', () => {
            fileSystemApi.cleanup();
            searchApi.cleanup();
            unregisterMainHandlers(api);
            databaseAbortController.abort('Database Closed');
          });
        },
        { blocking: true, silent: true, signal: databaseAbortController.signal },
      );

      reIndexTask();
      resolve(database);
    });
  });
}

export async function LoadDatabase(
  apiCallbacks: MainIpcCallbacks,
  store: Store<StoreSchema>,
): Promise<Loki | undefined> {
  const projectDir = getProjectDir(store);
  if (projectDir) {
    if (existsSync(projectDir)) {
      return LoadDatabaseExact(apiCallbacks, store, projectDir);
    }

    log.error(`Project at ${projectDir} did not exist`);
  }
  return undefined;
}
