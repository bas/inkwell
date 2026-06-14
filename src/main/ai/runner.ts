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
}

/** Outcome of a generation turn. Model/runtime errors are returned, not thrown. */
export type GenerationOutcome =
  | { ok: true; content: string }
  | { ok: false; errorType?: string; message: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run a single, tool-free generation turn against the shared Copilot client and
 * return the assistant's text. Streams deltas via `onDelta` and always tears the
 * session down afterwards. Never throws for model/runtime failures — those are
 * reported as `{ ok: false }` so callers can map them to typed UI error states.
 */
export async function runGeneration({
  prompt,
  onDelta,
}: GenerationRequest): Promise<GenerationOutcome> {
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

  const offDelta = session.on('assistant.message_delta', (event) => {
    streamed += event.data.deltaContent;
    onDelta?.(event.data.deltaContent);
  });
  const offError = session.on('session.error', (event) => {
    errorMessage = event.data.message;
    errorType = event.data.errorType;
  });

  try {
    let final;
    try {
      final = await session.sendAndWait({ prompt }, GENERATION_TIMEOUT_MS);
    } catch (err) {
      return { ok: false, errorType, message: errorMessage ?? errorText(err) };
    }

    const content = (final?.data.content ?? streamed).trim();
    if (!content) {
      return {
        ok: false,
        errorType,
        message: errorMessage ?? 'Copilot returned an empty response.',
      };
    }
    return { ok: true, content };
  } finally {
    offDelta();
    offError();
    await session.disconnect();
  }
}
