import ElectronStore from 'electron-store';
import { MainIpcGetter, StoreSchema } from 'shared/constants';
import InstallHumbleImporter from './bundles/humble-importer';

export default function InitializeAccounts(
  store: ElectronStore<StoreSchema>,
  database: Loki,
  api: MainIpcGetter,
) {
  const importers = {
    humble: InstallHumbleImporter(store, database),
  };

  api.checkLogin = async (provider) => importers[provider].isLoggedIn();
  api.logout = async (provider) => {};
  api.login = async (provider) => importers[provider].login();

  return importers;
}
