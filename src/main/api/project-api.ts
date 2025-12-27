import EventEmitter from 'events';
import { lstat } from 'fs/promises';
import { ipcMain, BrowserWindow, dialog } from 'electron';
import Store from 'electron-store';
import { StoreSchema, MainIpcGetter } from '../../shared/constants';
import { addTask } from '../managers/task-manager';
import { TypedEventEmitter } from '../util';

type Events = {
  projectChange: [path: string];
};

export const projectEvents = new TypedEventEmitter<Events>();

export async function SelectProjectDirectory(
  store: Store<StoreSchema>,
  window: BrowserWindow | undefined,
): Promise<string | null> {
  if (!window) {
    return null;
  }

  const directory = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
  });

  if (!directory.canceled && directory.filePaths.length > 0) {
    const directoryPath = directory.filePaths[0];
    store.set('projectDirectory', directoryPath);
    projectEvents.emit('projectChange', directoryPath);
    return directoryPath;
  }

  return null;
}

export default function InstallProjectDirectoryApi(api: MainIpcGetter, store: Store<StoreSchema>) {
  const getProjectDir = async () => {
    if (process.env.DAM_PROJECT_DIR) {
      return process.env.DAM_PROJECT_DIR;
    }
    if (!store.has('projectDirectory')) return null;
    const dir = store.get('projectDirectory') as string;
    return (await lstat(dir).catch((e) => false)) ? dir : null;
  };
  const selectProjectDirectory = async () => {
    return SelectProjectDirectory(store, BrowserWindow.getAllWindows()[0]);
  };

  api.getProjectDirectory = getProjectDir;
  api.selectProjectDirectory = selectProjectDirectory;
}
