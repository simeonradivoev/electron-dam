import { ipcMain, BrowserWindow } from 'electron';
import { lstat } from 'fs/promises';
import Store from 'electron-store';
import { Channels } from '../../shared/constants';
import { SelectProjectDirectory } from './file-system-api';

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
