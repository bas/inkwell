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
  AUTO_AI_MODEL,
  DEFAULT_SETTINGS,
  type AppSettings,
  type AiModelPreference,
  type ColorModePreference,
  type FeatureKey,
  type WindowBounds,
  normalizeAiModelPreference,
  normalizeSettings,
  normalizeVaultPath,
} from '../shared/types';
import type { GitSettings } from '../shared/git';
import { randomUUID } from 'node:crypto';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

let cachedSettings: AppSettings | undefined;

function cloneGit(git: GitSettings): GitSettings {
  return {
    ...git,
    remote: git.remote ? { ...git.remote } : undefined,
  };
}

function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    features: { ...settings.features },
    windowBounds: settings.windowBounds ? { ...settings.windowBounds } : undefined,
    git: cloneGit(settings.git),
  };
}

export function readSettings(): AppSettings {
  if (cachedSettings) {
    return cloneSettings(cachedSettings);
  }

  try {
    const raw = readFileSync(settingsPath(), 'utf8');
    cachedSettings = normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    // Missing or unreadable settings fall back to defaults.
    cachedSettings = normalizeSettings(DEFAULT_SETTINGS);
  }

  return cloneSettings(cachedSettings);
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
  cachedSettings = cloneSettings(settings);
}

/** Persist the chosen notes vault path. */
export function setVaultPath(path: string): AppSettings {
  const normalized = normalizeVaultPath(path);
  if (!normalized) {
    throw new Error('Vault path must be a non-empty absolute path.');
  }
  const next: AppSettings = { ...readSettings(), vaultPath: normalized };
  writeSettings(next);
  return next;
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

export function setAiModelPreference(model: AiModelPreference): AppSettings {
  const normalized = normalizeAiModelPreference(model);
  if (normalized === AUTO_AI_MODEL && model.trim() !== AUTO_AI_MODEL) {
    throw new Error('Invalid AI model preference');
  }
  const next: AppSettings = { ...readSettings(), aiModel: normalized };
  writeSettings(next);
  return next;
}

export function setWindowBounds(bounds: WindowBounds): void {
  writeSettings({ ...readSettings(), windowBounds: bounds });
}

/** Replace the persisted `git` backup settings block. */
export function setGitSettings(git: GitSettings): AppSettings {
  const next: AppSettings = { ...readSettings(), git: cloneGit(git) };
  writeSettings(next);
  return next;
}
