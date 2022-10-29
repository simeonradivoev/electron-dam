import { BrowserWindow, ipcMain } from 'electron';
import { Channels } from '../../shared/constants';

export default function InitializeWindowApi() {
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
