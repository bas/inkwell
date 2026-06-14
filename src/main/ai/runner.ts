import type { PermissionHandler } from '@github/copilot-sdk';
import { getCopilotClient } from './copilotClient';

/** Hard ceiling for a single generation turn, after which we give up. */
const GENERATION_TIMEOUT_MS = 60_000;

/**
 * Reject every tool permission request. Inkwell uses Copilot purely to generate
 * text from note content; it must never read the filesystem, run shell commands,
 * or take any agent action. Combined with an empty `availableTools` list this
 * keeps each session to plain text-in/text-out.
 */
const denyAllTools: PermissionHandler = () => ({
  kind: 'reject',
  feedback: 'Inkwell uses Copilot for read-only text generation; tools are disabled.',
});

export interface GenerationRequest {
  prompt: string;
  /** Called for each streamed text chunk as the model responds. */
  onDelta?: (delta: string) => void;
  /**
   * Called once the session is live with a `cancel` function that aborts the
   * in-flight turn. Lets callers wire up user-initiated cancellation.
   */
  onStart?: (cancel: () => void) => void;
}

/** Outcome of a generation turn. Model/runtime errors are returned, not thrown. */
export type GenerationOutcome =
  | { ok: true; content: string }
  | { ok: false; canceled?: boolean; errorType?: string; message: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Sentinel resolved by the timeout race when the model takes too long. */
const TIMED_OUT = Symbol('timed-out');

/**
 * Run a single, tool-free generation turn against the shared Copilot client and
 * return the assistant's text. Streams deltas via `onDelta` and always tears the
 * session down afterwards. Never throws for model/runtime failures — those are
 * reported as `{ ok: false }` so callers can map them to typed UI error states.
 */
export async function runGeneration({
  prompt,
  onDelta,
  onStart,
}: GenerationRequest): Promise<GenerationOutcome> {
  // E2E test seam: when INKWELL_FAKE_AI is set, stream its value back as the
  // generated text instead of contacting the Copilot runtime. Lets Playwright
  // exercise the full summarize/insert flow deterministically and offline.
  const faked = process.env.INKWELL_FAKE_AI;
  if (faked) {
    onStart?.(() => {});
    for (const chunk of faked.match(/.{1,8}/g) ?? [faked]) onDelta?.(chunk);
    return { ok: true, content: faked };
  }

  const client = await getCopilotClient();
  const session = await client.createSession({
    model: 'auto',
    streaming: true,
    availableTools: [],
    onPermissionRequest: denyAllTools,
  });

  let streamed = '';
  let errorMessage: string | undefined;
  let errorType: string | undefined;
  let canceled = false;
  let disconnected = false;

  const disconnect = async (): Promise<void> => {
    if (disconnected) return;
    disconnected = true;
    await session.disconnect();
  };

  const offDelta = session.on('assistant.message_delta', (event) => {
    streamed += event.data.deltaContent;
    onDelta?.(event.data.deltaContent);
  });
  const offError = session.on('session.error', (event) => {
    errorMessage = event.data.message;
    errorType = event.data.errorType;
  });

  // Expose cancellation: disconnecting the session aborts the pending turn.
  onStart?.(() => {
    canceled = true;
    void disconnect();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    let final;
    try {
      final = await Promise.race([
        session.sendAndWait({ prompt }),
        new Promise<typeof TIMED_OUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMED_OUT), GENERATION_TIMEOUT_MS);
        }),
      ]);
    } catch (err) {
      if (canceled) return { ok: false, canceled: true, message: 'Summary canceled.' };
      return { ok: false, errorType, message: errorMessage ?? errorText(err) };
    }

    if (canceled) return { ok: false, canceled: true, message: 'Summary canceled.' };
    if (final === TIMED_OUT) {
      return {
        ok: false,
        errorType: 'timeout',
        message: `Copilot timed out after ${GENERATION_TIMEOUT_MS / 1000}s.`,
      };
    }

    const content = (final?.data.content || streamed).trim();
    if (!content) {
      return {
        ok: false,
        errorType,
        message: errorMessage ?? 'Copilot returned an empty response.',
      };
    }
    return { ok: true, content };
  } finally {
    if (timer) clearTimeout(timer);
    offDelta();
    offError();
    await disconnect();
  }
}
