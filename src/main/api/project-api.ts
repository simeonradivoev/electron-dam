import { ipcMain, BrowserWindow, dialog } from 'electron';
import { lstat } from 'fs/promises';
import Store from 'electron-store';
import { Channels } from '../../shared/constants';
import { LoadDatabaseExact } from './database-api';

export async function SelectProjectDirectory(
  store: Store<StoreSchema>,
  window: BrowserWindow | undefined
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
    LoadDatabaseExact(store, directoryPath);
    return directoryPath;
  }

  return null;
}

export default function InstallProjectDirectoryApi(store: Store<StoreSchema>) {
  ipcMain.handle(Channels.GetProjectDirectory, async () => {
    const dir = store.get('projectDirectory') as string;
    return (await lstat(dir).catch((e) => false)) ? dir : null;
  });

  ipcMain.handle(Channels.SelectProjectDirectory, async (event) => {
    const window = BrowserWindow.getAllWindows().find(
      (win) => win.webContents.id === event.sender.id
    );
    return SelectProjectDirectory(store, window);
  });
}
