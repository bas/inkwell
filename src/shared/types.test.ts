import { describe, expect, it } from 'vitest';
import { normalizeSettings } from './types';

describe('normalizeSettings', () => {
  it('adds default feature settings for older settings files', () => {
    expect(normalizeSettings({ colorMode: 'dark' })).toEqual({
      colorMode: 'dark',
      features: {
        labels: true,
      },
    });
  });

  it('deep-merges partial feature settings', () => {
    expect(normalizeSettings({ features: { labels: false } })).toEqual({
      colorMode: 'auto',
      features: {
        labels: false,
      },
    });
  });

  it('drops invalid persisted values', () => {
    expect(
      normalizeSettings({
        colorMode: 'sepia',
        features: { labels: 'no', copilot: false },
        windowBounds: { width: 900, height: 700, x: 10, y: Number.NaN },
      }),
    ).toEqual({
      colorMode: 'auto',
      features: {
        labels: true,
      },
      windowBounds: { width: 900, height: 700, x: 10 },
    });
  });
});
