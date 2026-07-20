import { afterEach, describe, expect, it, vi } from 'vitest';

const listModels = vi.fn();

vi.mock('./copilotClient', () => ({
  getCopilotClient: vi.fn(async () => ({ listModels, getAuthStatus: vi.fn() })),
}));

import { clearAiModelListCache, listAvailableAiModels } from './availability';

afterEach(() => {
  vi.clearAllMocks();
  clearAiModelListCache();
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

  it('serves fake models in INKWELL_FAKE_AI mode', async () => {
    process.env.INKWELL_FAKE_AI = '1';

    const result = await listAvailableAiModels();

    expect(result).toEqual({
      models: [{ id: 'gpt-5.4', label: 'GPT-5.4 (fake)' }],
    });
    expect(listModels).not.toHaveBeenCalled();
  });
});
