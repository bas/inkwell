import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthStatus = vi.fn();

vi.mock('./copilotClient', () => ({
  getCopilotClient: async () => ({ getAuthStatus }),
}));

import { getAiAvailability, invalidateAiAvailabilityCache } from './availability';

describe('getAiAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    invalidateAiAvailabilityCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    invalidateAiAvailabilityCache();
  });

  it('caches ready availability within the TTL', async () => {
    getAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      authType: 'user',
      login: 'octocat',
    });

    const first = await getAiAvailability();
    const second = await getAiAvailability();

    expect(first).toEqual({ ready: true, authType: 'user', login: 'octocat' });
    expect(second).toEqual(first);
    expect(getAuthStatus).toHaveBeenCalledTimes(1);
  });

  it('caches not-authenticated availability within the TTL', async () => {
    getAuthStatus.mockResolvedValue({
      isAuthenticated: false,
      statusMessage: 'Please sign in.',
    });

    await getAiAvailability();
    await getAiAvailability();

    expect(getAuthStatus).toHaveBeenCalledTimes(1);
  });

  it('expires the cache after the TTL', async () => {
    getAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      authType: 'user',
      login: 'octocat',
    });

    await getAiAvailability();
    vi.advanceTimersByTime(30_001);
    await getAiAvailability();

    expect(getAuthStatus).toHaveBeenCalledTimes(2);
  });

  it('does not cache runtime errors', async () => {
    getAuthStatus.mockRejectedValue(new Error('network down'));

    const first = await getAiAvailability();
    const second = await getAiAvailability();

    expect(first).toEqual({ ready: false, reason: 'runtime-error', message: 'network down' });
    expect(second).toEqual(first);
    expect(getAuthStatus).toHaveBeenCalledTimes(2);
  });

  it('supports manual cache invalidation', async () => {
    getAuthStatus
      .mockResolvedValueOnce({
        isAuthenticated: true,
        authType: 'user',
        login: 'octocat',
      })
      .mockResolvedValueOnce({
        isAuthenticated: true,
        authType: 'user',
        login: 'hubot',
      });

    const first = await getAiAvailability();
    invalidateAiAvailabilityCache();
    const second = await getAiAvailability();

    expect(first).toEqual({ ready: true, authType: 'user', login: 'octocat' });
    expect(second).toEqual({ ready: true, authType: 'user', login: 'hubot' });
    expect(getAuthStatus).toHaveBeenCalledTimes(2);
  });
});
