import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ColorModePreference,
  type WindowBounds,
} from '../shared/types';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function readSettings(): AppSettings {
  try {
    const raw = readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    // Missing or unreadable settings fall back to defaults.
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings: AppSettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  // Atomic write: temp file then rename, so a crash never corrupts settings.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
  renameSync(tmp, path);
}

export function setColorMode(mode: ColorModePreference): AppSettings {
  const next: AppSettings = { ...readSettings(), colorMode: mode };
  writeSettings(next);
  return next;
}

export function setWindowBounds(bounds: WindowBounds): void {
  writeSettings({ ...readSettings(), windowBounds: bounds });
}
