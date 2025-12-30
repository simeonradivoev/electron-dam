import { app } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
import z from 'zod/v3';
import { getOption, MainIpcGetter, Options, OptionType, StoreSchema } from '../../shared/constants';

export function getSetting<
  K extends keyof typeof Options,
  TReturn extends z.infer<(typeof Options)[K]['schema']>,
>(store: Store<StoreSchema>, key: K): TReturn {
  const { schema } = Options[key];
  const option = Options[key] as OptionType;
  const defaultValue = option.default ?? option.schema.safeParse(undefined).data;
  const storeValue = store.get(key as string);
  if (storeValue) {
    const parseResult = schema.safeParse(storeValue);
    if (parseResult.success) {
      return storeValue as TReturn;
    }
  }
  return defaultValue;
}

export default function InitializeSettingsApi(api: MainIpcGetter, store: Store<StoreSchema>) {
  api.setSetting = async (key: keyof typeof Options, value: any) => {
    const option = Options[key];
    if (!option) {
      return null;
    }
    const parseResult = await option.schema.safeParseAsync(value);
    if (parseResult.success) {
      store.set(key, parseResult.data);
      return value;
    } else {
      log.error(parseResult.error);
    }

    return null;
  };
  api.setSettings = async (settings) => {
    Object.entries(settings).forEach(([key, value]) =>
      api.setSetting(key as keyof typeof settings, value as any),
    );
  };
  api.getSettings = async (category) => {
    return Object.fromEntries(
      Object.keys(Options)
        .filter((key) => {
          const option = getOption(key);
          if (option.localType) {
            return false;
          }
          return option.category === category;
        })
        .map((key) => [key, getSetting(store, key as any)]),
    );
  };
  api.getSetting = async (key) => getSetting(store, key);
  api.getVersion = () => Promise.resolve({ version: app.getVersion() });
}
