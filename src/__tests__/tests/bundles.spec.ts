import path from 'path';
import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';
import ipcMainApiInvokeHandler from './utils';

/**
 * For Getting started with Playwright, see here:
 * @see https://playwright.dev/docs/intro
 */

test.describe.serial(() => {
  let page: Page;
  let electronApp: ElectronApplication;
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..', '..', '..', 'release', 'app', 'dist', 'main', 'main.js')],
      env: {
        DAM_PROJECT_DIR: path.join(__dirname, '..', 'assets'),
      },
    });
    page = await electronApp.firstWindow();
    // Direct Electron console to Node terminal.
    page.on('console', console.log);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('Check Bundles Load', async () => {
    expect(await ipcMainApiInvokeHandler(electronApp, 'getBundles')).toHaveLength(2);
  });

  test('Check Create/Delete Virtual Bundle', async () => {
    const bundle: VirtualBundle = {
      id: '42069',
      name: 'Test',
      date: new Date(),
    };
    await ipcMainApiInvokeHandler(electronApp, 'createVirtualBundle', bundle);
    expect(
      ((await ipcMainApiInvokeHandler(electronApp, 'getBundles')) as VirtualBundle[]).filter(
        (b) => b.id == bundle.id,
      ),
    ).toHaveLength(1);
    await ipcMainApiInvokeHandler(electronApp, 'deleteBundle', bundle.id);
    expect(
      ((await ipcMainApiInvokeHandler(electronApp, 'getBundles')) as VirtualBundle[]).filter(
        (b) => b.id == bundle.id,
      ),
    ).toHaveLength(0);
  });
});
