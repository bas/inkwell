/**
 * Types shared across the main, preload, and renderer processes.
 * This module must not import any Node or Electron runtime APIs.
 */

/** The persisted color-mode preference. `auto` follows the macOS system appearance. */
export type ColorModePreference = 'light' | 'dark' | 'auto';

/** Application-level settings persisted by the main process. */
export interface AppSettings {
  colorMode: ColorModePreference;
}

export const DEFAULT_SETTINGS: AppSettings = {
  colorMode: 'auto',
};
