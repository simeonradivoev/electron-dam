/* eslint-disable max-classes-per-file */
/* eslint import/prefer-default-export: off */
import { promises } from 'dns';
import EventEmitter from 'events';
import { existsSync, mkdirSync } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { URL } from 'url';
import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log/main';
import ElectronStore from 'electron-store';
import picomatch from 'picomatch';
import Rand from 'rand-seed';
import {
  AudioFileFormat,
  BundleMetaFile,
  channelsSchema,
  MetaFileExtension,
  previewTypes,
  supportedTypesFlat,
  ImageFormat,
  StoreSchema,
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

export const appVersion = process.env.APP_VERSION || app.getVersion();

export const supportedFilesMatch = picomatch([...supportedTypesFlat.map((e) => `**/*${e}`)], {
  nocase: true,
  windows: true,
});

export const audioMediaFormatsMatch = picomatch(
  [...Object.values(AudioFileFormat).map((e) => `**/*${e}`)],
  { nocase: true, windows: true },
);

export const imageMediaFormatsMatch = picomatch(
  [...Object.values(ImageFormat).map((e) => `**/*${e}`)],
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

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL');
  }

  const base64 = matches[2];
  return Buffer.from(base64, 'base64');
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

export async function compressStringToBase64(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  // TS-safe: copy to strict ArrayBuffer-backed Uint8Array
  const safeBytes = new Uint8Array(bytes);

  // Compress with gzip
  const cs = new CompressionStream('gzip');
  const compressedStream = new Blob([safeBytes]).stream().pipeThrough(cs);
  const compressedBuffer = await new Response(compressedStream).arrayBuffer();
  const compressedBytes = new Uint8Array(compressedBuffer);

  // Convert compressed bytes to base64 string
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < compressedBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...compressedBytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

export async function decompressBase64ToString(b64: string): Promise<string> {
  // Convert base64 to bytes
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const cs = new DecompressionStream('gzip');
  const decompressedStream = new Blob([bytes]).stream().pipeThrough(cs);
  const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
  return new TextDecoder().decode(decompressedBuffer);
}

export async function mapAsync<T, V>(values: T[], mapper: (value: T) => Promise<V>): Promise<V[]> {
  const results = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    try {
      results[i] = await mapper(values[i]);
    } catch (error) {
      log.error(error);
    }
  }
  return results;
}

export async function foreachAsync<T>(
  values: T[],
  mapper: (value: T, index: number) => Promise<any>,
  abort?: AbortSignal,
  progress?: (p: number) => void,
) {
  for (let i = 0; i < values.length; i += 1) {
    try {
      await mapper(values[i], i);
      if (abort?.aborted) {
        break;
      }
      if (progress) {
        progress((1.0 / values.length) * i);
      }
    } catch (error) {
      log.error(error);
    }
  }
}

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../../../assets');

export const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

export class FilePath {
  public readonly path: string;

  public readonly projectDir: string;

  public readonly absolute: string;

  constructor(projectDir: string, filePath: string) {
    this.path = filePath;
    this.projectDir = projectDir;
    this.absolute = path.join(projectDir, filePath);
  }

  public with(filePath: string) {
    return new FilePath(this.projectDir, filePath);
  }

  public join(...paths: string[]) {
    return new FilePath(this.projectDir, path.join(this.path, ...paths));
  }

  static fromStore(store: ElectronStore<StoreSchema>, filePath: string) {
    return new FilePath(store.get('projectDirectory'), filePath);
  }

  static fromObject(obj: { path: string; projectDir: string }) {
    return new FilePath(obj.projectDir, obj.path);
  }
}

export async function getZipParentFs(p: FilePath): Promise<FilePath | undefined> {
  let current = p.path;

  while (true) {
    const parent = path.dirname(current);
    if (parent === current) break;

    try {
      // eslint-disable-next-line no-await-in-loop
      const fileStat = await stat(path.join(p.projectDir, parent));
      if (fileStat.isFile() && parent.toLowerCase().endsWith('.zip')) {
        return p.with(parent);
      }
    } catch {
      // ignore missing paths
    }

    current = parent;
  }

  return undefined;
}
