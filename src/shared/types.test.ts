import { describe, expect, it } from 'vitest';
import {
  AUTO_AI_MODEL,
  normalizeAiModelPreference,
  normalizeSettings,
  normalizeVaultPath,
} from './types';

describe('normalizeSettings', () => {
  it('adds default feature settings for older settings files', () => {
    expect(normalizeSettings({ colorMode: 'dark' })).toEqual({
      colorMode: 'dark',
      aiModel: 'auto',
      features: {
        labels: true,
        mermaid: true,
      },
      git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
    });
  });

  it('deep-merges partial feature settings', () => {
    expect(normalizeSettings({ features: { labels: false } })).toEqual({
      colorMode: 'auto',
      aiModel: 'auto',
      features: {
        labels: false,
        mermaid: true,
      },
      git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
    });

    expect(normalizeSettings({ features: { mermaid: false } })).toEqual({
      colorMode: 'auto',
      aiModel: 'auto',
      features: {
        labels: true,
        mermaid: false,
      },
      git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
    });
  });

  it('drops invalid persisted values', () => {
    expect(
      normalizeSettings({
        colorMode: 'sepia',
        features: { labels: 'no', mermaid: 'off', copilot: false },
        windowBounds: { width: 900, height: 700, x: 10, y: Number.NaN },
      }),
    ).toEqual({
      colorMode: 'auto',
      aiModel: 'auto',
      features: {
        labels: true,
        mermaid: true,
      },
      git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
      windowBounds: { width: 900, height: 700, x: 10 },
    });
  });

  it('keeps a valid persisted AI model and drops invalid ones to auto', () => {
    expect(normalizeSettings({ aiModel: 'gpt-5.4' }).aiModel).toBe('gpt-5.4');
    expect(normalizeSettings({ aiModel: '  claude-sonnet-5 ' }).aiModel).toBe('claude-sonnet-5');
    expect(normalizeSettings({ aiModel: '' }).aiModel).toBe(AUTO_AI_MODEL);
    expect(normalizeSettings({ aiModel: 'gpt 5' }).aiModel).toBe(AUTO_AI_MODEL);
    expect(normalizeSettings({ aiModel: 42 }).aiModel).toBe(AUTO_AI_MODEL);
  });

  it('trims a persisted remote URL and drops one containing whitespace', () => {
    const base = {
      git: {
        enabled: true,
        autoCommit: 'onSave',
        intervalMinutes: 5,
        remote: {
          mode: 'url',
          host: '',
          owner: '',
          repo: '',
          visibility: 'unknown',
          autoPush: false,
        },
      },
    };

    const trimmed = normalizeSettings({
      ...base,
      git: {
        ...base.git,
        remote: { ...base.git.remote, remoteUrl: '  https://github.com/o/r.git  ' },
      },
    });
    expect(trimmed.git.remote?.remoteUrl).toBe('https://github.com/o/r.git');

    const dropped = normalizeSettings({
      ...base,
      git: {
        ...base.git,
        remote: { ...base.git.remote, remoteUrl: 'https://github.com/o r.git' },
      },
    });
    expect(dropped.git.remote).toBeUndefined();

    const invalidShape = normalizeSettings({
      ...base,
      git: {
        ...base.git,
        remote: { ...base.git.remote, remoteUrl: 'ssh://-oProxyCommand=calc/repo.git' },
      },
    });
    expect(invalidShape.git.remote).toBeUndefined();
  });

  it('keeps a valid absolute vaultPath and drops invalid ones', () => {
    expect(normalizeSettings({ vaultPath: '/Users/test/Inkwell' }).vaultPath).toBe(
      '/Users/test/Inkwell',
    );
    expect(normalizeSettings({ vaultPath: '  /Users/test/Notes  ' }).vaultPath).toBe(
      '/Users/test/Notes',
    );
    expect(normalizeSettings({ vaultPath: 'relative/path' }).vaultPath).toBeUndefined();
    expect(normalizeSettings({ vaultPath: '' }).vaultPath).toBeUndefined();
    expect(normalizeSettings({ vaultPath: 42 }).vaultPath).toBeUndefined();
  });
});

describe('normalizeVaultPath', () => {
  it('trims and keeps absolute POSIX paths', () => {
    expect(normalizeVaultPath('/Users/test/Inkwell')).toBe('/Users/test/Inkwell');
    expect(normalizeVaultPath('  /Users/test/Notes  ')).toBe('/Users/test/Notes');
  });

  describe('normalizeAiModelPreference', () => {
    it('accepts auto and trimmed model ids without spaces', () => {
      expect(normalizeAiModelPreference('auto')).toBe('auto');
      expect(normalizeAiModelPreference(' gpt-5.6-sol ')).toBe('gpt-5.6-sol');
    });

    it('falls back to auto for invalid values', () => {
      expect(normalizeAiModelPreference('')).toBe('auto');
      expect(normalizeAiModelPreference('model with spaces')).toBe('auto');
      expect(normalizeAiModelPreference(undefined)).toBe('auto');
    });
  });

  it('rejects blank, relative, and non-string values', () => {
    expect(normalizeVaultPath('')).toBeUndefined();
    expect(normalizeVaultPath('   ')).toBeUndefined();
    expect(normalizeVaultPath('relative/path')).toBeUndefined();
    expect(normalizeVaultPath(42)).toBeUndefined();
    expect(normalizeVaultPath(undefined)).toBeUndefined();
  });
});
