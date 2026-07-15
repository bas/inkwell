/**
 * Types shared across the main, preload, and renderer processes.
 * This module must not import any Node or Electron runtime APIs.
 */

/** The persisted color-mode preference. `auto` follows the macOS system appearance. */
export type ColorModePreference = 'light' | 'dark' | 'auto';

/** Persisted window position and size, used to restore the window on launch. */
export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/** Feature flags that can be toggled to enable or disable optional app capabilities. */
export interface AppFeatures {
  /** When false, all label-related UI (label picker, label chips, group-by-label) is hidden. */
  labels: boolean;
}

/** Application-level settings persisted by the main process. */
export interface AppSettings {
  colorMode: ColorModePreference;
  windowBounds?: WindowBounds;
  features: AppFeatures;
}

export const DEFAULT_FEATURES: AppFeatures = {
  labels: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
  colorMode: 'auto',
  features: DEFAULT_FEATURES,
};
