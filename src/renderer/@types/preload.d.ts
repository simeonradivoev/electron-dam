import { RendererIpcCallbacks, RendererIpcGetters } from 'shared/constants';

declare global {
  interface Window {
    api: RendererIpcGetters;
    apiCallbacks: RendererIpcCallbacks;
  }
}

export type ContextMenuBuilder = (
  path: string,
  bundlePath: string | undefined,
  isDirectory: boolean,
) => JSX.Element;
