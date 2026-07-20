import type { AiAvailability } from '../../shared/ai';
import { getCopilotClient } from './copilotClient';

const AVAILABILITY_TTL_MS = 30_000;
let cachedAvailability: AiAvailability | undefined;
let cachedAtMs = 0;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function invalidateAiAvailabilityCache(): void {
  cachedAvailability = undefined;
  cachedAtMs = 0;
}

function readCachedAvailability(nowMs: number): AiAvailability | undefined {
  if (!cachedAvailability) return undefined;
  if (nowMs - cachedAtMs > AVAILABILITY_TTL_MS) {
    invalidateAiAvailabilityCache();
    return undefined;
  }
  return cachedAvailability;
}

function cacheAvailability(value: AiAvailability, nowMs: number): void {
  // Cache only positive readiness; auth/login state can change immediately.
  if (value.ready) {
    cachedAvailability = value;
    cachedAtMs = nowMs;
  }
}

/**
 * Probe the Copilot runtime and report whether AI requests can be attempted.
 *
 * Never throws: every failure is mapped to a typed `ready: false` result so the
 * renderer can render a first-class error state instead of an unhandled error.
 */
export async function getAiAvailability(): Promise<AiAvailability> {
  const nowMs = Date.now();
  const cached = readCachedAvailability(nowMs);
  if (cached) return cached;
  // E2E test seam: pretend the runtime is ready so Playwright can drive the AI
  // flow without a live Copilot login. Paired with the seam in `runner.ts`.
  if (process.env.INKWELL_FAKE_AI) {
    return { ready: true, authType: 'fake', login: 'e2e' };
  }
  try {
    const client = await getCopilotClient();
    const auth = await client.getAuthStatus();
    if (!auth.isAuthenticated) {
      const unavailable: AiAvailability = {
        ready: false,
        reason: 'not-authenticated',
        message: auth.statusMessage ?? 'Sign in with `copilot login` to use AI features.',
      };
      cacheAvailability(unavailable, nowMs);
      return unavailable;
    }
    const available: AiAvailability = { ready: true, authType: auth.authType, login: auth.login };
    cacheAvailability(available, nowMs);
    return available;
  } catch (err) {
    return { ready: false, reason: 'runtime-error', message: errorMessage(err) };
  }
}
