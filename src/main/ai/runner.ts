import type { PermissionHandler } from '@github/copilot-sdk';
import { performance } from 'node:perf_hooks';
import type { AiUsage } from '../../shared/ai';
import { AUTO_AI_MODEL } from '../../shared/types';
import { readSettings } from '../settings';
import { listAvailableAiModels } from './availability';
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

async function resolveSessionModel(): Promise<string> {
  const preference = readSettings().aiModel;
  if (preference === AUTO_AI_MODEL) return AUTO_AI_MODEL;
  const listed = await listAvailableAiModels();
  if (!listed.models.some((model) => model.id === preference)) return AUTO_AI_MODEL;
  return preference;
}

export interface GenerationTelemetry {
  sessionCreateMs?: number;
  firstDeltaMs?: number;
  generationMs?: number;
  disconnectMs?: number;
  totalMs: number;
}

/** Outcome of a generation turn. Model/runtime errors are returned, not thrown. */
export type GenerationOutcome =
  | { ok: true; content: string; usage?: AiUsage; telemetry: GenerationTelemetry }
  | {
      ok: false;
      canceled?: boolean;
      errorType?: string;
      message: string;
      usage?: AiUsage;
      telemetry: GenerationTelemetry;
    };
type GenerationOutcomeBase =
  | { ok: true; content: string }
  | { ok: false; canceled?: boolean; errorType?: string; message: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Sentinel resolved by the timeout race when the model takes too long. */
const TIMED_OUT = Symbol('timed-out');
const NANO_AI_UNITS_PER_CREDIT = 1_000_000_000;

function addMetric(current: number | undefined, next: number | undefined): number | undefined {
  if (typeof next !== 'number' || !Number.isFinite(next)) return current;
  return (current ?? 0) + next;
}

function toAiCredits(nanoAiu: number): number {
  // Runtime costs are reported as nano-AI units; AI Credits are the user-facing unit.
  return Math.round((nanoAiu / NANO_AI_UNITS_PER_CREDIT) * 10_000) / 10_000;
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
  onStart,
}: GenerationRequest): Promise<GenerationOutcome> {
  const startedAt = performance.now();
  // E2E test seam: when INKWELL_FAKE_AI is set, stream its value back as the
  // generated text instead of contacting the Copilot runtime. Lets Playwright
  // exercise the full summarize/insert flow deterministically and offline.
  const faked = process.env.INKWELL_FAKE_AI;
  if (faked) {
    onStart?.(() => {});
    for (const chunk of faked.match(/.{1,8}/g) ?? [faked]) onDelta?.(chunk);
    return {
      ok: true,
      content: faked,
      usage: { creditsSource: 'unavailable' },
      telemetry: { totalMs: performance.now() - startedAt },
    };
  }

  let sessionCreateMs: number | undefined;
  let session: Awaited<ReturnType<Awaited<ReturnType<typeof getCopilotClient>>['createSession']>>;
  try {
    const createStartedAt = performance.now();
    const client = await getCopilotClient();
    const model = await resolveSessionModel();
    session = await client.createSession({
      model,
      streaming: true,
      availableTools: [],
      onPermissionRequest: denyAllTools,
    });
    sessionCreateMs = performance.now() - createStartedAt;
  } catch (err) {
    return {
      ok: false,
      errorType: 'runtime',
      message: errorText(err),
      telemetry: {
        sessionCreateMs,
        totalMs: performance.now() - startedAt,
      },
    };
  }

  let streamed = '';
  let errorMessage: string | undefined;
  let errorType: string | undefined;
  let canceled = false;
  let disconnected = false;
  let sawUsageSignal = false;
  let shutdownNanoAiu: number | undefined;
  let sendStartedAt: number | undefined;
  let firstDeltaMs: number | undefined;
  let generationMs: number | undefined;
  let disconnectMs: number | undefined;
  const usage: AiUsage = { creditsSource: 'unavailable' };

  const finalizeUsage = (): AiUsage | undefined => {
    if (!sawUsageSignal && shutdownNanoAiu === undefined) return undefined;
    if (shutdownNanoAiu !== undefined) {
      usage.creditsSource = 'exact';
      usage.aiCredits = toAiCredits(shutdownNanoAiu);
    }
    return usage;
  };

  const disconnect = async (): Promise<void> => {
    if (disconnected) return;
    disconnected = true;
    const disconnectStartedAt = performance.now();
    try {
      await session.disconnect();
    } catch {
      // Ignore disconnect errors; teardown should not override the generation outcome.
    } finally {
      disconnectMs = performance.now() - disconnectStartedAt;
    }
  };

  const offDelta = session.on('assistant.message_delta', (event) => {
    if (sendStartedAt !== undefined && firstDeltaMs === undefined) {
      firstDeltaMs = performance.now() - sendStartedAt;
    }
    streamed += event.data.deltaContent;
    onDelta?.(event.data.deltaContent);
  });
  const offError = session.on('session.error', (event) => {
    errorMessage = event.data.message;
    errorType = event.data.errorType;
  });
  const offUsage = session.on('assistant.usage', (event) => {
    sawUsageSignal = true;
    usage.model = event.data.model || usage.model;
    const inputTokens = addMetric(usage.inputTokens, event.data.inputTokens);
    if (inputTokens !== undefined) usage.inputTokens = inputTokens;
    const outputTokens = addMetric(usage.outputTokens, event.data.outputTokens);
    if (outputTokens !== undefined) usage.outputTokens = outputTokens;
    const cacheReadTokens = addMetric(usage.cacheReadTokens, event.data.cacheReadTokens);
    if (cacheReadTokens !== undefined) usage.cacheReadTokens = cacheReadTokens;
    const cacheWriteTokens = addMetric(usage.cacheWriteTokens, event.data.cacheWriteTokens);
    if (cacheWriteTokens !== undefined) usage.cacheWriteTokens = cacheWriteTokens;
    const reasoningTokens = addMetric(usage.reasoningTokens, event.data.reasoningTokens);
    if (reasoningTokens !== undefined) usage.reasoningTokens = reasoningTokens;
    const durationMs = addMetric(usage.durationMs, event.data.duration);
    if (durationMs !== undefined) usage.durationMs = durationMs;
  });
  const offUsageInfo = session.on('session.usage_info', (event) => {
    sawUsageSignal = true;
    usage.contextTokens = event.data.currentTokens;
    usage.contextTokenLimit = event.data.tokenLimit;
    usage.contextMessageCount = event.data.messagesLength;
  });
  const offShutdown = session.on('session.shutdown', (event) => {
    sawUsageSignal = true;
    if (typeof event.data.totalNanoAiu === 'number' && Number.isFinite(event.data.totalNanoAiu)) {
      shutdownNanoAiu = event.data.totalNanoAiu;
      return;
    }

    let sum = 0;
    let found = false;
    for (const metrics of Object.values(event.data.modelMetrics)) {
      const nano = metrics?.totalNanoAiu;
      if (typeof nano !== 'number' || !Number.isFinite(nano)) continue;
      found = true;
      sum += nano;
    }
    if (found) shutdownNanoAiu = sum;
  });

  // Expose cancellation: disconnecting the session aborts the pending turn.
  onStart?.(() => {
    canceled = true;
    void disconnect();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let outcome: GenerationOutcomeBase = {
    ok: false,
    message: 'Copilot could not summarize this note. Please try again.',
  };
  try {
    let final: { data?: { content?: string } } | typeof TIMED_OUT | undefined = TIMED_OUT;
    let sendError: unknown;
    try {
      sendStartedAt = performance.now();
      final = await Promise.race([
        session.sendAndWait({ prompt }),
        new Promise<typeof TIMED_OUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMED_OUT), GENERATION_TIMEOUT_MS);
        }),
      ]);
      generationMs = performance.now() - sendStartedAt;
    } catch (err) {
      if (sendStartedAt !== undefined) generationMs = performance.now() - sendStartedAt;
      sendError = err;
    }

    if (sendError !== undefined) {
      outcome = canceled
        ? { ok: false, canceled: true, message: 'Summary canceled.' }
        : { ok: false, errorType, message: errorMessage ?? errorText(sendError) };
    } else if (canceled) outcome = { ok: false, canceled: true, message: 'Summary canceled.' };
    else if (final === TIMED_OUT) {
      outcome = {
        ok: false,
        errorType: 'timeout',
        message: `Copilot timed out after ${GENERATION_TIMEOUT_MS / 1000}s.`,
      };
    } else {
      const content = (final?.data?.content || streamed).trim();
      outcome = content
        ? { ok: true, content }
        : {
            ok: false,
            errorType,
            message: errorMessage ?? 'Copilot returned an empty response.',
          };
    }
  } finally {
    if (timer) clearTimeout(timer);
    await disconnect();
    offDelta();
    offError();
    offUsage();
    offUsageInfo();
    offShutdown();
  }

  const finalizedUsage = finalizeUsage();
  const telemetry: GenerationTelemetry = {
    sessionCreateMs,
    firstDeltaMs,
    generationMs,
    disconnectMs,
    totalMs: performance.now() - startedAt,
  };
  if (finalizedUsage) return { ...outcome, usage: finalizedUsage, telemetry };
  return { ...outcome, telemetry };
}
