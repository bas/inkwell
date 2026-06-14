import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const require_ = createRequire(import.meta.url);

/**
 * The Copilot CLI requires the `node:sqlite` builtin (Node ≥ 22.5). Electron's
 * bundled Node is older (20.x), so the CLI cannot run under `process.execPath`.
 * We therefore locate an external Node that provides `node:sqlite` and run the
 * bundled CLI through it (see {@link buildCliShim}).
 */
function nodeSupportsSqlite(bin: string): boolean {
  try {
    const result = spawnSync(bin, ['-e', 'require("node:sqlite")'], {
      stdio: 'ignore',
      timeout: 5_000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/** Find an external Node binary new enough to host the Copilot CLI, if any. */
function findCapableNode(): string | undefined {
  const candidates: string[] = [];
  const override = process.env.INKWELL_NODE_PATH;
  if (override) candidates.push(override);

  // Resolve `node` from the user's PATH without assuming a shell.
  const fromPath = spawnSync('/usr/bin/env', ['node', '-p', 'process.execPath'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (fromPath.status === 0) {
    const resolved = fromPath.stdout.trim();
    if (resolved) candidates.push(resolved);
  }

  // Common macOS install locations as a fallback (e.g. packaged app with a
  // minimal PATH that doesn't include Homebrew).
  candidates.push('/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node');

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (existsSync(candidate) && nodeSupportsSqlite(candidate)) return candidate;
  }
  return undefined;
}

/** Absolute path to the CLI entry point bundled with `@github/copilot`. */
function resolveBundledCli(): string {
  // `@github/copilot` restricts subpath exports, so we can't `resolve` its
  // package.json/index.js directly. Mirror the SDK's own fallback: search the
  // node_modules base paths and locate index.js by existence.
  const searchPaths = require_.resolve.paths('@github/copilot') ?? [];
  for (const base of searchPaths) {
    const candidate = join(base, '@github', 'copilot', 'index.js');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Could not locate the bundled @github/copilot CLI (index.js).');
}

/** POSIX single-quote a string for safe interpolation into a `/bin/sh` script. */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

let shimPath: string | undefined;

/**
 * Write (once) a tiny executable shim that runs the bundled Copilot CLI under
 * `nodeBin`. Because the shim has no `.js` extension, the SDK spawns it directly
 * instead of via Electron's Node, so the CLI runs on a `node:sqlite`-capable
 * runtime. The shim path is fed to the SDK through `COPILOT_CLI_PATH`.
 */
function buildCliShim(nodeBin: string): string {
  if (shimPath && existsSync(shimPath)) return shimPath;
  const cli = resolveBundledCli();
  const file = join(tmpdir(), `inkwell-copilot-cli-${process.pid}-${Date.now()}`);
  const script = `#!/bin/sh\nexec ${shQuote(nodeBin)} ${shQuote(cli)} "$@"\n`;
  writeFileSync(file, script, { mode: 0o755, flag: 'wx' });
  chmodSync(file, 0o755);
  shimPath = file;
  return file;
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
      const nodeBin = findCapableNode();
      if (!nodeBin) {
        throw new Error(
          'Copilot AI requires Node.js 22.5 or newer (for node:sqlite), which was not found. ' +
            'Install Node 22+ or set INKWELL_NODE_PATH to a compatible Node binary.',
        );
      }
      const env = runtimeEnv();
      // Route the SDK to our shim so the CLI runs on the capable Node, not Electron's.
      env.COPILOT_CLI_PATH = buildCliShim(nodeBin);

      const client = new CopilotClient({
        useLoggedInUser: true,
        env,
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
