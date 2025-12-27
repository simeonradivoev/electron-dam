import { BrowserWindow, ipcMain } from 'electron';
import { Channels, MainIpcGetter } from '../../shared/constants';

export default function InitializeWindowApi(api: MainIpcGetter) {
  ipcMain.on(Channels.MinimizeWindow, (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    window?.minimize();
  });

  ipcMain.on(Channels.MaximizeWindow, (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    if (window?.isMaximized()) {
      window?.unmaximize();
    } else {
      window?.maximize();
    }
  });
}
