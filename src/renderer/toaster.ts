import { OverlayToaster, Position } from '@blueprintjs/core';

/**
 * Singleton toaster instance for the application.
 * Use this to show toast notifications from anywhere in the renderer process.
 */
export const AppToaster = OverlayToaster.create({
  className: 'recipe-toaster',
  position: Position.BOTTOM_RIGHT,
});
