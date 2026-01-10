import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { channelsSchema } from 'shared/constants';

export function createRendererGetters() {
  const channels = {} as any;

  Object.keys(channelsSchema.get).forEach((channel) => {
    channels[channel] = (...args: any[]) => ipcRenderer.invoke(channel, ...args);
  });

  return channels;
}

export function createRendererCallbacks() {
  const channels = {} as any;

  Object.keys(channelsSchema.on).forEach((channel) => {
    channels[channel] = (func: (...eventArg: any[]) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.off(channel, subscription);
      };
    };
  });

  return channels;
}

export const APIGetters = createRendererGetters();
export const APICallbacks = createRendererCallbacks();

contextBridge.exposeInMainWorld('api', APIGetters);
contextBridge.exposeInMainWorld('apiCallbacks', APICallbacks);

ipcRenderer.on('app:ready', () => {
  window.dispatchEvent(new CustomEvent('app:ready'));
});
