import { describe, expect, it } from 'vitest';
import { normalizeSettings } from './types';

describe('normalizeSettings', () => {
  it('adds default feature settings for older settings files', () => {
    expect(normalizeSettings({ colorMode: 'dark' })).toEqual({
      colorMode: 'dark',
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
      features: {
        labels: false,
        mermaid: true,
      },
      git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
    });

    expect(normalizeSettings({ features: { mermaid: false } })).toEqual({
      colorMode: 'auto',
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
      features: {
        labels: true,
        mermaid: true,
      },
      git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
      windowBounds: { width: 900, height: 700, x: 10 },
    });
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
  });
});
