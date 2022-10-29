import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { lstat, writeFile, unlink } from 'fs/promises';
import path from 'path';

async function createBundle(directory: string): Promise<boolean> {
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory()) {
    return false;
  }
  const bundle: Bundle = {};
  return writeFile(path.join(directory, 'bundle.json'), JSON.stringify(bundle))
    .catch((err) => {
      console.error(err);
      return false;
    })
    .then(() => true);
}

async function updateBundle(
  bundlePath: string,
  bundle: Bundle
): Promise<Bundle | undefined> {
  const finalBundle: Bundle | null = bundle;
  await writeFile(
    path.join(bundlePath, 'bundle.json'),
    JSON.stringify(bundle)
  ).catch((err) => console.error(err));
  return finalBundle;
}

async function deleteBundle(bundlePath: string): Promise<void> {
  await unlink(path.join(bundlePath, 'bundle.json'));
}

export default function InitializeBundlesApi() {
  ipcMain.handle(
    'create-bundle',
    async (_event: IpcMainInvokeEvent, directory: string): Promise<boolean> =>
      createBundle(directory)
  );

  ipcMain.handle(
    'update-bundle',
    async (
      _event: IpcMainInvokeEvent,
      bundlePath: string,
      bundle: Bundle
    ): Promise<Bundle | undefined> => updateBundle(bundlePath, bundle)
  );

  ipcMain.handle(
    'delete-bundle',
    async (_event: IpcMainInvokeEvent, bundlePath: string): Promise<void> =>
      deleteBundle(bundlePath)
  );
}
