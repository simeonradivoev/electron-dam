/* eslint import/prefer-default-export: off */
import EventEmitter from 'events';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { URL } from 'url';
import { BrowserWindow, ipcMain } from 'electron';
import picomatch from 'picomatch';
import Rand from 'rand-seed';
import {
  AudioFileFormat,
  BundleMetaFile,
  channelsSchema,
  MetaFileExtension,
  previewTypes,
  supportedTypesFlat,
} from '../shared/constants';

export const ignoredFilesMatch = picomatch(
  [
    '**/Readme.md',
    '.cache',
    `**/*.${MetaFileExtension}`,
    `**/*.${BundleMetaFile}`,
    ...previewTypes.map((t) => `**/Preview${t}`),
  ],
  { nocase: true, windows: true },
);

export const supportedFilesMatch = picomatch([...supportedTypesFlat.map((e) => `**/*${e}`)], {
  nocase: true,
  windows: true,
});

export const mediaFormatsMatch = picomatch(
  [...Object.values(AudioFileFormat).map((e) => `**/*${e}`)],
  { nocase: true, windows: true },
);

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || process.env.WEBPACK_DEV_SERVER_PORT || 4343;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export function mkdirs(p: FilePath) {
  const dirs = p.path.split(path.sep);
  let prevDir = dirs.splice(0, 1)[0];
  while (dirs.length > 0) {
    const curDir = path.join(prevDir, ...dirs.splice(0, 1));
    if (!existsSync(path.join(p.projectDir, curDir))) {
      mkdirSync(path.join(p.projectDir, curDir));
    }
    prevDir = curDir;
  }
}

export function getRandom<T>(arr: Array<T>, n: number, seed: string): Array<T> {
  const rand = new Rand(seed);
  const result = new Array<T>();
  let len = arr.length;
  const taken = arr.slice();
  for (let i = 0; i < Math.min(n, len); i += 1) {
    const x = Math.floor(rand.next() * len);
    result.push(taken[x]);
    // move last element to taken position and pop (no copy of array)
    taken[x] = taken[len - 1];
    len--;
    taken.pop();
  }
  return result;
}

export function registerMainHandlers(api: any) {
  Object.keys(api).forEach((channel) =>
    ipcMain.handle(channel, (e, ...args) => api[channel](...args)),
  );
}

export function registerMainCallbacks(api: any) {
  Object.keys(channelsSchema.on).forEach((channel) => {
    api[channel] = (...args: any[]) =>
      BrowserWindow.getAllWindows()[0].webContents.send(channel, ...args);
  });
}

export function unregisterMainHandlers(api: any) {
  Object.keys(api)
    .filter((k) => !!api[k])
    .forEach((channel) => ipcMain.removeHandler(channel));
}

export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private emitter = new EventEmitter();

  emit<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    ...eventArg: TEvents[TEventName]
  ) {
    this.emitter.emit(eventName, ...(eventArg as []));
  }

  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void,
  ) {
    this.emitter.on(eventName, handler as any);
  }

  once<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void,
  ) {
    this.emitter.once(eventName, handler as any);
  }

  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void,
  ) {
    this.emitter.off(eventName, handler as any);
  }
}
