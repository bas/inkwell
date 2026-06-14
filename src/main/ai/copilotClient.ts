import { CopilotClient } from '@github/copilot-sdk';

/**
 * Token environment variables that, when present, take precedence over the
 * user's stored `copilot login` (Keychain) credential. We strip them from the
 * runtime's environment so it always authenticates as the logged-in user,
 * regardless of the shell that launched the app (e.g. `npm run dev` inheriting
 * `GH_TOKEN`). A packaged app launched from Finder would not inherit these, but
 * stripping them keeps dev and production on the same OAuth path.
 */
const MASKING_TOKEN_VARS = ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'] as const;

function runtimeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const name of MASKING_TOKEN_VARS) delete env[name];
  return env;
}

let startPromise: Promise<CopilotClient> | undefined;
let started: CopilotClient | undefined;

/**
 * Lazily start and return the shared Copilot runtime client. The client is
 * created once and reused for the app's lifetime; a failed start is not cached,
 * so a later call can retry (e.g. after a transient runtime error).
 */
export async function getCopilotClient(): Promise<CopilotClient> {
  if (!startPromise) {
    startPromise = (async () => {
      const client = new CopilotClient({
        useLoggedInUser: true,
        env: runtimeEnv(),
        logLevel: 'error',
      });
      await client.start();
      started = client;
      return client;
    })();
    // Drop a rejected start so the next caller can retry. The original promise
    // returned to the current caller still rejects with the underlying error.
    startPromise.catch(() => {
      startPromise = undefined;
    });
  }
  return startPromise;
}

/** Stop the shared client if it was started. Safe to call when never started. */
export async function disposeCopilotClient(): Promise<void> {
  const client = started;
  started = undefined;
  startPromise = undefined;
  if (client) await client.stop();
}
