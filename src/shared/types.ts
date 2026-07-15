/**
 * Types shared across the main, preload, and renderer processes.
 * This module must not import any Node or Electron runtime APIs.
 */

/** The persisted color-mode preference. `auto` follows the macOS system appearance. */
export type ColorModePreference = 'light' | 'dark' | 'auto';

/** Feature toggles persisted as application-level user preferences. */
export interface FeatureSettings {
  labels: boolean;
}

export type FeatureKey = keyof FeatureSettings;

/** Persisted window position and size, used to restore the window on launch. */
export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/** Application-level settings persisted by the main process. */
export interface AppSettings {
  colorMode: ColorModePreference;
  features: FeatureSettings;
  windowBounds?: WindowBounds;
}

export const DEFAULT_SETTINGS: AppSettings = {
  colorMode: 'auto',
  features: {
    labels: true,
  },
};

const FEATURE_KEYS = Object.keys(DEFAULT_SETTINGS.features) as FeatureKey[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && FEATURE_KEYS.some((key) => key === value);
}

function normalizeColorMode(value: unknown): ColorModePreference {
  return value === 'light' || value === 'dark' || value === 'auto'
    ? value
    : DEFAULT_SETTINGS.colorMode;
}

function normalizeWindowBounds(value: unknown): WindowBounds | undefined {
  if (!isRecord(value)) return undefined;
  const width = value['width'];
  const height = value['height'];
  if (typeof width !== 'number' || !Number.isFinite(width)) return undefined;
  if (typeof height !== 'number' || !Number.isFinite(height)) return undefined;
  const bounds: WindowBounds = { width, height };
  const x = value['x'];
  const y = value['y'];
  if (typeof x === 'number' && Number.isFinite(x)) bounds.x = x;
  if (typeof y === 'number' && Number.isFinite(y)) bounds.y = y;
  return bounds;
}

function normalizeFeatures(value: unknown): FeatureSettings {
  const defaults = DEFAULT_SETTINGS.features;
  if (!isRecord(value)) return { ...defaults };
  return {
    labels: typeof value['labels'] === 'boolean' ? value['labels'] : defaults.labels,
  };
}

/** Normalize persisted JSON into a complete, validated settings object. */
export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS, features: { ...DEFAULT_SETTINGS.features } };
  const settings: AppSettings = {
    colorMode: normalizeColorMode(value['colorMode']),
    features: normalizeFeatures(value['features']),
  };
  const windowBounds = normalizeWindowBounds(value['windowBounds']);
  if (windowBounds) settings.windowBounds = windowBounds;
  return settings;
}
