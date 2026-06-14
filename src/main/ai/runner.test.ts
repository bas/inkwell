import { afterEach, describe, expect, it, vi } from 'vitest';

const createSession = vi.fn();

vi.mock('./copilotClient', () => ({
  getCopilotClient: async () => ({ createSession }),
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

    expect(outcome).toEqual({ ok: true, content: 'Hello world' });
    expect(deltas).toEqual(['Hello ', 'world']);
    expect(session.disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to streamed text when the final message has no content', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(async () => {
      session.emit('assistant.message_delta', { deltaContent: 'Streamed only' });
      return { data: { content: '' } };
    });

    const outcome = await runGeneration({ prompt: 'p' });

    expect(outcome).toEqual({ ok: true, content: 'Streamed only' });
  });

  it('reports the session error type and message on failure', async () => {
    const session = makeSession();
    createSession.mockResolvedValue(session);
    session.sendAndWait.mockImplementation(async () => {
      session.emit('session.error', { message: 'No license', errorType: 'quota' });
      throw new Error('request failed');
    });

    const outcome = await runGeneration({ prompt: 'p' });

    expect(outcome).toEqual({ ok: false, errorType: 'quota', message: 'No license' });
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

    await expect(promise).resolves.toEqual({
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
