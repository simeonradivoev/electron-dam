import { lstat, stat } from 'fs/promises';
import path from 'path';
import log from 'electron-log/main';
import Store from 'electron-store';
import Loki from 'lokijs';
import { addTask } from 'main/managers/task-manager';
import { satisfies } from 'semver';
import { memoryStorage, Umzug } from 'umzug';
import { MainIpcCallbacks, MainIpcGetter, StoreSchema } from '../../shared/constants';
import migrations, { MigrationContext } from '../migrations/migrations';
import {
  appVersion,
  getProjectDir,
  registerMainCallbacks,
  registerMainHandlers,
  unregisterMainHandlers,
} from '../util';
import InitializeBundlesApi from './bundles-api';
import InitializeThumbnailCache from './cache/thumbnail-cache';
import { InitializeDatabaseCallbacks } from './callbacks';
import InitializeFileInfoApi from './file-info-api';
import InitializeFileSystemApi from './file-system-api';
import { projectEvents } from './project-api';
import { InitializeSearchApi } from './search/serach-api';

export function LoadDatabaseExact(store: Store<StoreSchema>, directory: string): Promise<Loki> {
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
      const apiCallback = {} as MainIpcCallbacks;
      registerMainCallbacks(apiCallback);
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
      let fileSystemApi: ReturnType<typeof InitializeFileSystemApi>;
      const reIndexTask = () =>
        addTask(
          'Indexing Assets',
          (abort, progress) => fileSystemApi.fileIndexRegistry.index(abort, progress),
          { blocking: false, icon: 'search-text' },
        );

      await addTask(
        'Initializing',
        async () => {
          fileSystemApi = InitializeFileSystemApi(api, apiCallback, store, database);
          InitializeThumbnailCache(api, store);
          InitializeFileInfoApi(api, store, database);
          InitializeBundlesApi(api, store, database);
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
          });
        },
        { blocking: true },
      );

      reIndexTask();
      resolve(database);
    });
  });
}

export async function LoadDatabase(store: Store<StoreSchema>): Promise<Loki | undefined> {
  const projectDir = getProjectDir(store);
  if (projectDir) {
    if (!!(await stat(projectDir).catch(() => false))) {
      return LoadDatabaseExact(store, projectDir);
    } else {
      log.error(`Project at ${projectDir} did not exist`);
    }
  }
  return undefined;
}
