import { afterEach, describe, expect, it, vi } from 'vitest';

const { createSession, readSettings, listAvailableAiModels } = vi.hoisted(() => ({
  createSession: vi.fn(),
  readSettings: vi.fn(() => ({ aiModel: 'auto' })),
  listAvailableAiModels: vi.fn(
    async () =>
      ({ models: [] as Array<{ id: string; label: string }> }) satisfies {
        models: Array<{ id: string; label: string }>;
      },
  ),
}));

vi.mock('./copilotClient', () => ({
  getCopilotClient: async () => ({ createSession }),
}));
vi.mock('../settings', () => ({
  readSettings,
}));
vi.mock('./availability', () => ({
  listAvailableAiModels,
}));

import { runGeneration } from './runner';

type Handler = (event: { data: unknown }) => void;

interface FakeSession {
  on: (event: string, cb: Handler) => () => void;
  emit: (event: string, data: unknown) => void;
  sendAndWait: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeSession(): FakeSession {
  const handlers = new Map<string, Handler[]>();
  return {
    on(event, cb) {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
      return () => {
        handlers.set(
          event,
          (handlers.get(event) ?? []).filter((h) => h !== cb),
        );
      };
    },
    emit(event, data) {
      for (const cb of handlers.get(event) ?? []) cb({ data });
    },
    sendAndWait: vi.fn(),
    disconnect: vi.fn(async () => {}),
  };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  readSettings.mockReturnValue({ aiModel: 'auto' });
  listAvailableAiModels.mockResolvedValue({ models: [] as Array<{ id: string; label: string }> });
});

describe('runGeneration', () => {
  it('streams deltas and returns the final message content', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(async () => {
      session.emit('assistant.message_delta', { deltaContent: 'Hello ' });
      session.emit('assistant.message_delta', { deltaContent: 'world' });
      return { data: { content: 'Hello world' } };
    });

    const deltas: string[] = [];
    const outcome = await runGeneration({
      prompt: 'p',
      onDelta: (d) => deltas.push(d),
    });

    expect(outcome).toMatchObject({ ok: true, content: 'Hello world' });
    expect(outcome.telemetry.totalMs).toBeGreaterThanOrEqual(0);
    expect(deltas).toEqual(['Hello ', 'world']);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'auto',
      }),
    );
    expect(session.disconnect).toHaveBeenCalledTimes(1);
  });

  it('uses a configured explicit model when it is currently available', async () => {
    readSettings.mockReturnValue({ aiModel: 'gpt-5.4' });
    listAvailableAiModels.mockResolvedValue({ models: [{ id: 'gpt-5.4', label: 'GPT-5.4' }] });
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockResolvedValue({ data: { content: 'ok' } });

    await runGeneration({ prompt: 'p' });

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4',
      }),
    );
  });

  it('falls back to auto when configured model is unavailable', async () => {
    readSettings.mockReturnValue({ aiModel: 'gpt-5.4' });
    listAvailableAiModels.mockResolvedValue({
      models: [{ id: 'claude-sonnet-5', label: 'Claude' }],
    });
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockResolvedValue({ data: { content: 'ok' } });

    await runGeneration({ prompt: 'p' });

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'auto',
      }),
    );
  });

  it('falls back to streamed text when the final message has no content', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(async () => {
      session.emit('assistant.message_delta', { deltaContent: 'Streamed only' });
      return { data: { content: '' } };
    });

    const outcome = await runGeneration({ prompt: 'p' });

    expect(outcome).toMatchObject({ ok: true, content: 'Streamed only' });
    expect(outcome.telemetry.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('captures request usage and maps shutdown nano-AIU to AI Credits', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(async () => {
      session.emit('assistant.usage', {
        model: 'gpt-5',
        inputTokens: 120,
        outputTokens: 45,
        cacheReadTokens: 20,
        reasoningTokens: 12,
        duration: 320,
      });
      session.emit('session.usage_info', {
        currentTokens: 640,
        tokenLimit: 4096,
        messagesLength: 7,
      });
      return { data: { content: 'Usage-aware response' } };
    });
    session.disconnect.mockImplementation(async () => {
      session.emit('session.shutdown', {
        modelMetrics: {},
        sessionStartTime: Date.now(),
        shutdownType: 'normal',
        codeChanges: { filesModified: [], linesAdded: 0, linesRemoved: 0 },
        totalApiDurationMs: 320,
        totalNanoAiu: 2_500_000_000,
      });
    });

    const outcome = await runGeneration({ prompt: 'p' });

    expect(outcome).toMatchObject({
      ok: true,
      content: 'Usage-aware response',
      usage: {
        creditsSource: 'exact',
        aiCredits: 2.5,
        model: 'gpt-5',
        inputTokens: 120,
        outputTokens: 45,
        cacheReadTokens: 20,
        reasoningTokens: 12,
        durationMs: 320,
        contextTokens: 640,
        contextTokenLimit: 4096,
        contextMessageCount: 7,
      },
    });
    expect(outcome.telemetry.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('reports the session error type and message on failure', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(async () => {
      session.emit('session.error', { message: 'No license', errorType: 'quota' });
      throw new Error('request failed');
    });

    const outcome = await runGeneration({ prompt: 'p' });

    expect(outcome).toMatchObject({ ok: false, errorType: 'quota', message: 'No license' });
    expect(outcome.telemetry.totalMs).toBeGreaterThanOrEqual(0);
    expect(session.disconnect).toHaveBeenCalledTimes(1);
  });

  it('returns a canceled outcome when cancellation disconnects the session', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    let rejectSend: ((reason: Error) => void) | undefined;
    session.sendAndWait.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSend = reject;
        }),
    );
    session.disconnect.mockImplementation(async () => {
      rejectSend?.(new Error('disconnected'));
    });

    let cancel: (() => void) | undefined;
    const promise = runGeneration({ prompt: 'p', onStart: (c) => (cancel = c) });

    await tick();
    expect(cancel).toBeTypeOf('function');
    cancel?.();

    await expect(promise).resolves.toMatchObject({
      ok: false,
      canceled: true,
      message: 'Summary canceled.',
    });
  });

  it('returns a timeout outcome when the model never responds', async () => {
    vi.useFakeTimers();
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(() => new Promise(() => {}));

    const promise = runGeneration({ prompt: 'p' });
    await vi.advanceTimersByTimeAsync(60_000);
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errorType).toBe('timeout');
      expect(outcome.message).toContain('timed out');
    }
    expect(session.disconnect).toHaveBeenCalledTimes(1);
  });
});
