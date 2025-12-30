import { ElectronApplication } from '@playwright/test';
import { ipcMainInvokeHandler } from 'electron-playwright-helpers';
import { ChannelsSchema } from '../../shared/constants';

type ChannelType = keyof ChannelsSchema['get'];

export default function ipcMainApiInvokeHandler(
  electronApp: ElectronApplication,
  message: ChannelType,
  ...args: any[]
): Promise<unknown> {
  return ipcMainInvokeHandler(electronApp, message, ...args);
}
