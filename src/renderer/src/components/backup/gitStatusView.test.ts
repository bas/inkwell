import { describe, expect, it } from 'vitest';
import { describeSyncState } from './gitStatusView';

describe('describeSyncState', () => {
  it('describes the disabled state', () => {
    const view = describeSyncState('disabled', false);
    expect(view.tone).toBe('neutral');
    expect(view.label).toBe('Off');
  });

  it('distinguishes clean-with-remote from clean-without-remote', () => {
    expect(describeSyncState('clean', true).label).toBe('Backed up');
    expect(describeSyncState('clean', false).label).toBe('History on');
    expect(describeSyncState('clean', true).tone).toBe('success');
  });

  it('flags auth and git-unavailable as danger', () => {
    expect(describeSyncState('auth-required', true).tone).toBe('danger');
    expect(describeSyncState('no-git', false).tone).toBe('danger');
    expect(describeSyncState('push-failed', true).tone).toBe('danger');
  });

  it('marks pending backup work as attention', () => {
    expect(describeSyncState('committed-not-pushed', true).tone).toBe('attention');
    expect(describeSyncState('remote-diverged', true).tone).toBe('attention');
  });

  it('treats offline as recoverable (neutral), not an error', () => {
    expect(describeSyncState('offline', true).tone).toBe('neutral');
  });
});
