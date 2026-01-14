import { autoUpdater, UpdateCheckResult } from 'electron-updater';
import { addTask } from 'main/managers/task-manager';
import { MainIpcCallbacks, MainIpcGetter } from 'shared/constants';

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
if (isDebug) {
  autoUpdater.forceDevUpdateConfig = true;
}
autoUpdater.fullChangelog = true;

export default function InstallUpdateChecks(api: MainIpcGetter, apiCallbacks: MainIpcCallbacks) {
  let updateCheckResult: UpdateCheckResult | null | Error = null;
  addTask('Checking For Updates', () => autoUpdater.checkForUpdates(), {
    blocking: false,
    icon: 'automatic-updates',
  })
    .then((result) => {
      updateCheckResult = result;
      if (result) {
        apiCallbacks.onUpdateNotification({
          isUpdateAvailable: result.isUpdateAvailable,
          info: result.updateInfo,
        });
      }

      return result;
    })
    .catch((error: Error) => {
      updateCheckResult = error;
    });

  api.getHasUpdate = async () => {
    if (updateCheckResult instanceof Error) {
      throw updateCheckResult;
    }
    if (updateCheckResult) {
      return {
        isChecking: updateCheckResult === undefined,
        isUpdateAvailable: updateCheckResult.isUpdateAvailable,
        info: updateCheckResult.updateInfo,
      };
    }
    return null;
  };
  api.updateAndRestart = async () => {
    autoUpdater.quitAndInstall(true, true);
  };
}
