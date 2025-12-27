import { app } from 'electron';
import Store from 'electron-store';
import { MainIpcGetter, StoreSchema } from '../../shared/constants';

export default function InitializeSettingsApi(api: MainIpcGetter, store: Store<StoreSchema>) {
  api.setSetting = (key: string, value: any) => {
    store.set(key, value);
    return value;
  };
  api.getSetting = (key: string) => store.get(key);
  api.getVersion = () => Promise.resolve({ version: app.getVersion() });
}
