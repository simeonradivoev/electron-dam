import { API } from 'main/preload';

declare global {
  interface Window {
    api: typeof API;
  }
}
