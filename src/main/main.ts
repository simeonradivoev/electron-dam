/* eslint global-require: off, no-console: off, promise/always-return: off */
/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
// Initialize TaskManager
import path from 'path';
import { app, BrowserWindow, Menu, shell } from 'electron';
import { installExtension, REACT_DEVELOPER_TOOLS } from 'electron-extension-installer';
import log from 'electron-log';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { StoreSchema, MainIpcCallbacks, MainIpcGetter } from 'shared/constants';
import InitializeCallbacks from './api/callbacks';
import { LoadDatabase } from './api/database-api';
import InitializeGenerateMetadataApi from './api/generate-metadata-api';
import InitializeImportMetadataApi from './api/import-metadata-api';
import InstallProjectDirectoryApi from './api/project-api';
import InitializeProtocols, { RegisterProtocols } from './api/protocols';
import { InitializeGlobalSearchApi, LoadVectorDatabase } from './api/serach-api';
import InitializeSettingsApi from './api/settings';
import InitializeTransformersApi from './api/transformers-api';
import InitializeWindowApi from './api/window-api';
import { addTask, InitializeTasks, InitializeTasksApi } from './managers/task-manager';
import { registerMainCallbacks, registerMainHandlers, resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const createWindow = async (store: Store<StoreSchema>) => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const windowSize = store.get('windowSize', { width: 1024, height: 728 });
  const position = store.get('windowPosition', { x: undefined, y: undefined });
  log.log('Electron runtime versions:', process.versions);

  const window = new BrowserWindow({
    show: false,
    width: windowSize.width,
    height: windowSize.height,
    x: position.x,
    y: position.y,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      // sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      nodeIntegration: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
    // Remove the window frame from windows applications
    frame: false,
    // Hide the titlebar from MacOS applications while keeping the stop lights
    titleBarStyle: 'hidden',
  });

  window.loadURL(resolveHtmlPath('index.html'));
  window.on('moved', () => {
    const [x, y] = window!.getPosition();
    store.set('windowPosition', { x, y });
  });

  window.on('resized', () => {
    const size = window!.getSize();
    const [width, height] = size;
    store.set('windowSize', { width, height });
  });

  window.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(null);

  // Open urls in the user's browser
  window.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
  return window;
};

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

RegisterProtocols();

app
  .whenReady()
  .then(async () => {
    // Initialization
    const store = new Store<StoreSchema>();
    const apiGetters = {} as MainIpcGetter;
    const apiCallbacks = {} as MainIpcCallbacks;
    registerMainCallbacks(apiCallbacks);

    // API Registration
    InitializeWindowApi(apiGetters);
    InstallProjectDirectoryApi(apiGetters, store);
    InitializeImportMetadataApi(apiGetters, store);
    InitializeTasksApi(apiGetters, apiCallbacks);
    InitializeCallbacks(store);
    await InitializeGlobalSearchApi(apiGetters);
    InitializeTransformersApi();
    await InitializeGenerateMetadataApi(apiGetters, store);
    InitializeSettingsApi(apiGetters, store);
    InitializeProtocols(store);
    registerMainHandlers(apiGetters);
    return { store };
  })
  .then(async (context) => {
    if (isDebug) {
      await installExtension(REACT_DEVELOPER_TOOLS, {
        loadExtensionOptions: {
          allowFileAccess: true,
        },
      });
    }

    mainWindow = await createWindow(context.store);
    InitializeTasks(mainWindow);
    const database = await LoadDatabase(context.store);
    if (database) {
      addTask('Indexing Assets', (abort, progress) =>
        LoadVectorDatabase(context.store, database, abort, progress),
      );
    }

    app.on('activate', async () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) {
        mainWindow = await createWindow(context.store);
        InitializeTasks(mainWindow);
      }
    });
  })
  .catch(log.log);
