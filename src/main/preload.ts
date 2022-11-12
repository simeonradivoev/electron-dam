import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Channels, FileType } from 'shared/constants';

export const API = {
  getProjectDirectory(): Promise<string | null> {
    return ipcRenderer.invoke(Channels.GetProjectDirectory);
  },
  getGlobalTags(): Promise<string[]> {
    return ipcRenderer.invoke(Channels.GetGlobalTags);
  },
  getFiles(
    tagFilter: string[],
    typeFilter: FileType[],
    filter: string | undefined
  ): Promise<FileTreeNode[]> {
    return ipcRenderer.invoke(Channels.FileTree, tagFilter, typeFilter, filter);
  },
  updateTags(path: string, tags: string[]): Promise<string[]> {
    return ipcRenderer.invoke(Channels.UpdateTags, path, tags);
  },
  getTags(path: string): Promise<string[]> {
    return ipcRenderer.invoke(Channels.GetTags, path);
  },
  getParentTags(path: string): Promise<string[]> {
    return ipcRenderer.invoke(Channels.GetParentTags, path);
  },
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke(channel, args);
  },
  sendMessage(channel: string, ...args: unknown[]) {
    ipcRenderer.send(channel, args);
  },
  onFileDetails(callback: (fileInfo: FileInfo) => void): () => void {
    const wrappedCallback = (
      _event: Electron.IpcRendererEvent,
      arg: FileInfo
    ) => {
      callback(arg);
    };
    ipcRenderer.on(Channels.FileDetails, wrappedCallback);
    return () =>
      ipcRenderer.removeListener(Channels.FileDetails, wrappedCallback);
  },
  getFileDetails(path: string): Promise<FileInfo | null> {
    return ipcRenderer.invoke(Channels.GetFileDetails, path);
  },
  on(channel: string, func: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      func(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  once(channel: string, func: (...args: unknown[]) => void) {
    ipcRenderer.once(channel, (_event, ...args) => func(...args));
  },
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel);
  },
  selectProjectDirectory(): Promise<string> {
    return ipcRenderer.invoke(Channels.SelectProjectDirectory);
  },
  onProjectDirectoryUpdate(callback: (directory: string | null) => void) {
    const subscription = (
      _e: Electron.IpcRendererEvent,
      dir: string | null
    ) => {
      callback(dir);
    };
    ipcRenderer.on(Channels.ProjectDirectorySelected, subscription);
    return () => {
      ipcRenderer.removeListener(
        Channels.ProjectDirectorySelected,
        subscription
      );
    };
  },
  getPreview(filePath: string, maxSize: number): Promise<string | undefined> {
    return ipcRenderer.invoke(Channels.GetPreview, filePath, maxSize);
  },
  createBundle(directory: string): Promise<boolean> {
    return ipcRenderer.invoke(Channels.CreateBundle, directory);
  },
  updateBundle(path: string, bundle: Bundle): Promise<Bundle | undefined> {
    return ipcRenderer.invoke(Channels.UpdateBundle, path, bundle);
  },
  deleteBundle(path: string): Promise<void> {
    return ipcRenderer.invoke(Channels.DeleteBundle, path);
  },
  importBundleMetadata(url: string): Promise<BundleMetadata> {
    return ipcRenderer.invoke(Channels.ImportBundleMetadata, url);
  },
  minimizeWindow() {
    ipcRenderer.send(Channels.MinimizeWindow);
  },
  maximizeWindow() {
    ipcRenderer.send(Channels.MaximizeWindow);
  },
  openPath(path: string) {
    ipcRenderer.send(Channels.OpenPath, path);
  },
};

contextBridge.exposeInMainWorld('api', API);

export default API;
