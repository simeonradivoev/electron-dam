import { Position, Toaster } from '@blueprintjs/core';

/**
 * Singleton toaster instance for the application.
 * Use this to show toast notifications from anywhere in the renderer process.
 */
export const AppToaster = Toaster.create({
  className: 'recipe-toaster',
  position: Position.TOP,
});
