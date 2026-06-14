import type { AiAvailability } from '../../shared/ai';
import { getCopilotClient } from './copilotClient';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Probe the Copilot runtime and report whether AI requests can be attempted.
 *
 * Never throws: every failure is mapped to a typed `ready: false` result so the
 * renderer can render a first-class error state instead of an unhandled error.
 */
export async function getAiAvailability(): Promise<AiAvailability> {
  try {
    const client = await getCopilotClient();
    const auth = await client.getAuthStatus();
    if (!auth.isAuthenticated) {
      return {
        ready: false,
        reason: 'not-authenticated',
        message: auth.statusMessage ?? 'Sign in with `copilot login` to use AI features.',
      };
    }
    return { ready: true, authType: auth.authType, login: auth.login };
  } catch (err) {
    return { ready: false, reason: 'runtime-error', message: errorMessage(err) };
  }
}
