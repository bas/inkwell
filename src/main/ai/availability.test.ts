import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listModels = vi.fn();
const getAuthStatus = vi.fn();

vi.mock('./copilotClient', () => ({
  getCopilotClient: vi.fn(async () => ({ listModels, getAuthStatus })),
}));

import {
  clearAiModelListCache,
  getAiAvailability,
  invalidateAiAvailabilityCache,
  listAvailableAiModels,
} from './availability';

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  clearAiModelListCache();
  invalidateAiAvailabilityCache();
  delete process.env.INKWELL_FAKE_AI;
});

describe('listAvailableAiModels', () => {
  it('maps model metadata from the SDK response', async () => {
    listModels.mockResolvedValue([
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' },
      { id: 'invalid model id' },
    ]);

    const result = await listAvailableAiModels();

    expect(result).toEqual({
      models: [
        { id: 'gpt-5.4', label: 'GPT-5.4' },
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      ],
    });
  });

  it('returns a typed error and empty model list when discovery fails', async () => {
    listModels.mockRejectedValue(new Error('network down'));

    const result = await listAvailableAiModels();

    expect(result.models).toEqual([]);
    expect(result.error).toContain('network down');
  });

  it('caches failed discovery responses for the cache TTL', async () => {
    listModels.mockRejectedValue(new Error('network down'));

    const first = await listAvailableAiModels();
    const second = await listAvailableAiModels();

    expect(first).toEqual({ models: [], error: 'network down' });
    expect(second).toEqual({ models: [], error: 'network down' });
    expect(listModels).toHaveBeenCalledTimes(1);
  });

  it('serves fake models in INKWELL_FAKE_AI mode', async () => {
    process.env.INKWELL_FAKE_AI = '1';

    const result = await listAvailableAiModels();

    expect(result).toEqual({
      models: [{ id: 'gpt-5.4', label: 'GPT-5.4 (fake)' }],
    });
    expect(listModels).not.toHaveBeenCalled();
  });
});

describe('getAiAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
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

  it('does not cache not-authenticated availability', async () => {
    getAuthStatus.mockResolvedValue({
      isAuthenticated: false,
      statusMessage: 'Please sign in.',
    });

    await getAiAvailability();
    await getAiAvailability();

    expect(getAuthStatus).toHaveBeenCalledTimes(2);
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
