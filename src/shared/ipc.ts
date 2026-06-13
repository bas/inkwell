import type { AppSettings, ColorModePreference } from './types';

/** IPC channel names. Keep in sync between main handlers and the preload bridge. */
export const IpcChannels = {
  getSettings: 'settings:get',
  setColorMode: 'settings:setColorMode',
  /** Main → renderer: the effective system color scheme changed. */
  systemColorSchemeChanged: 'system:colorSchemeChanged',
} as const;

/**
 * The typed API exposed to the renderer via `contextBridge` as `window.api`.
 * The renderer must only ever talk to main through this surface.
 */
export interface InkwellApi {
  getSettings(): Promise<AppSettings>;
  setColorMode(mode: ColorModePreference): Promise<AppSettings>;
  /** Subscribe to system color-scheme changes. Returns an unsubscribe function. */
  onSystemColorSchemeChanged(listener: (isDark: boolean) => void): () => void;
}
