import { RendererIpcCallbacks, RendererIpcGetters } from 'shared/constants';

declare global {
  interface Window {
    api: RendererIpcGetters;
    apiCallbacks: RendererIpcCallbacks;
  }
}

export type ShowContextMenuParams = { id: string; rect: DOMRect };
