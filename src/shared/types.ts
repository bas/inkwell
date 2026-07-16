/**
 * Types shared across the main, preload, and renderer processes.
 * This module must not import any Node or Electron runtime APIs.
 */

import {
  DEFAULT_GIT_SETTINGS,
  type GitAutoCommitMode,
  type GitRemoteConfig,
  type GitSettings,
  type GitVisibility,
} from './git';

/** The persisted color-mode preference. `auto` follows the macOS system appearance. */
export type ColorModePreference = 'light' | 'dark' | 'auto';

/** Feature toggles persisted as application-level user preferences. */
export interface FeatureSettings {
  labels: boolean;
  mermaid: boolean;
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
  git: GitSettings;
  windowBounds?: WindowBounds;
}

export const DEFAULT_SETTINGS: AppSettings = {
  colorMode: 'auto',
  features: {
    labels: true,
    mermaid: true,
  },
  git: { ...DEFAULT_GIT_SETTINGS },
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
    mermaid: typeof value['mermaid'] === 'boolean' ? value['mermaid'] : defaults.mermaid,
  };
}

function normalizeAutoCommit(value: unknown): GitAutoCommitMode {
  return value === 'onSave' || value === 'interval' || value === 'manual'
    ? value
    : DEFAULT_GIT_SETTINGS.autoCommit;
}

function normalizeVisibility(value: unknown): GitVisibility | 'unknown' {
  return value === 'private' || value === 'public' || value === 'internal' || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizeRemote(value: unknown): GitRemoteConfig | undefined {
  if (!isRecord(value)) return undefined;
  const remoteUrl = value['remoteUrl'];
  if (typeof remoteUrl !== 'string' || remoteUrl.length === 0) return undefined;
  const mode = value['mode'] === 'url' ? 'url' : 'gh';
  return {
    mode,
    host: typeof value['host'] === 'string' ? value['host'] : '',
    owner: typeof value['owner'] === 'string' ? value['owner'] : '',
    repo: typeof value['repo'] === 'string' ? value['repo'] : '',
    visibility: normalizeVisibility(value['visibility']),
    remoteUrl,
    autoPush: value['autoPush'] === true,
  };
}

function normalizeGit(value: unknown): GitSettings {
  const defaults = DEFAULT_GIT_SETTINGS;
  if (!isRecord(value)) return { ...defaults };
  const intervalRaw = value['intervalMinutes'];
  const intervalMinutes =
    typeof intervalRaw === 'number' && Number.isFinite(intervalRaw) && intervalRaw > 0
      ? Math.min(Math.round(intervalRaw), 720)
      : defaults.intervalMinutes;
  const settings: GitSettings = {
    enabled: value['enabled'] === true,
    autoCommit: normalizeAutoCommit(value['autoCommit']),
    intervalMinutes,
  };
  const remote = normalizeRemote(value['remote']);
  if (remote) settings.remote = remote;
  const lastPushAt = value['lastPushAt'];
  if (typeof lastPushAt === 'string') settings.lastPushAt = lastPushAt;
  return settings;
}

/** Normalize persisted JSON into a complete, validated settings object. */
export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features },
      git: { ...DEFAULT_GIT_SETTINGS },
    };
  }
  const settings: AppSettings = {
    colorMode: normalizeColorMode(value['colorMode']),
    features: normalizeFeatures(value['features']),
    git: normalizeGit(value['git']),
  };
  const windowBounds = normalizeWindowBounds(value['windowBounds']);
  if (windowBounds) settings.windowBounds = windowBounds;
  return settings;
}
