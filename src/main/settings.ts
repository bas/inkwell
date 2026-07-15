import { app } from 'electron';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ColorModePreference,
  type FeatureKey,
  type WindowBounds,
  normalizeSettings,
} from '../shared/types';
import { randomUUID } from 'node:crypto';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function readSettings(): AppSettings {
  try {
    const raw = readFileSync(settingsPath(), 'utf8');
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    // Missing or unreadable settings fall back to defaults.
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

function writeSettings(settings: AppSettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  // Atomic write: temp file, fsync, then rename — crash-safe.
  const tmp = `${path}.tmp-${randomUUID()}`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, JSON.stringify(settings, null, 2));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}

export function setColorMode(mode: ColorModePreference): AppSettings {
  const next: AppSettings = { ...readSettings(), colorMode: mode };
  writeSettings(next);
  return next;
}

export function setFeatureEnabled(feature: FeatureKey, enabled: boolean): AppSettings {
  const current = readSettings();
  const next: AppSettings = {
    ...current,
    features: {
      ...current.features,
      [feature]: enabled,
    },
  };
  writeSettings(next);
  return next;
}

export function setWindowBounds(bounds: WindowBounds): void {
  writeSettings({ ...readSettings(), windowBounds: bounds });
}
