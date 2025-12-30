import { BrowserWindow, ipcMain } from 'electron';
import { MainIpcGetter } from '../../shared/constants';

export default function InitializeWindowApi(api: MainIpcGetter) {
  api.minimizeWindow = async () => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.minimize();
  };

  api.maximizeWindow = async () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window?.isMaximized()) {
      window?.unmaximize();
    } else {
      window?.maximize();
    }
  };
}
