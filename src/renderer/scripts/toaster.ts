import { OverlayToaster, Position, ToastProps } from '@blueprintjs/core';
import log from 'electron-log/renderer';

/**
 * Singleton toaster instance for the application.
 * Use this to show toast notifications from anywhere in the renderer process.
 */
export const AppToaster = OverlayToaster.create({
  className: 'recipe-toaster',
  position: Position.BOTTOM_RIGHT,
});

export function ShowAppToaster(props: ToastProps, key?: string) {
  AppToaster.then((t) => t.show(props, key)).catch((e) => log.log(e));
}
