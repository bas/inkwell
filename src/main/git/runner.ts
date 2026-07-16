import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * A minimal, hardened runner for `git` and `gh`.
 *
 * Rationale (see research R3 §2.1/§2.4, RD-6/RD-8):
 * - A packaged app launched from Finder inherits a stripped PATH, so the
 *   binaries are discovered across common install locations, not assumed on PATH.
 * - git spawns credential helpers, hooks, SSH and signing tools, so every
 *   invocation runs with an allow-listed environment (ambient GitHub tokens
 *   stripped) and safety flags: no repo hooks, no signing, never block on a
 *   prompt. Stored Keychain / `gh` credentials still work because the credential
 *   helper reads them itself.
 */

/** Tokens that could shadow the user's real credentials — never forwarded. */
const MASKED_ENV_VARS = ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'] as const;

/**
 * Parent-process env vars forwarded into git/gh so SSH remotes authenticate
 * non-interactively (gh provisioning prefers sshUrl and most users rely on the
 * SSH agent / macOS Keychain). These carry no secrets themselves.
 */
const SSH_AGENT_ENV_VARS = ['SSH_AUTH_SOCK', 'SSH_AGENT_PID'] as const;

/** Directories searched (after PATH) for the binaries on macOS. */
const FALLBACK_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];

/** git config flags applied to every invocation to neutralise side effects. */
const GIT_HARDENING_FLAGS = [
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'commit.gpgSign=false',
  '-c',
  'core.fsmonitor=false',
];

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class GitCommandError extends Error {
  constructor(
    message: string,
    readonly result: RunResult,
  ) {
    super(message);
    this.name = 'GitCommandError';
  }
}

function safePath(): string {
  const fromEnv = (process.env.PATH ?? '').split(':').filter(Boolean);
  const merged = [...FALLBACK_BIN_DIRS, ...fromEnv];
  return Array.from(new Set(merged)).join(':');
}

/** The allow-listed environment used for every git/gh invocation. */
function hardenedEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: safePath(),
    HOME: homedir(),
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
    LANG: 'C',
    ...extra,
  };
  // Forward SSH agent vars (if present) so SSH remotes can authenticate via the
  // running agent without an interactive prompt. Applied before masking below.
  for (const name of SSH_AGENT_ENV_VARS) {
    const value = process.env[name];
    if (value) env[name] = value;
  }
  // Defensively ensure masked tokens never leak in via `extra`.
  for (const name of MASKED_ENV_VARS) delete env[name];
  return env;
}

const resolvedBinary = new Map<string, string | undefined>();

async function respondsToVersion(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ['--version'], { timeout: 5_000, env: hardenedEnv() });
    return true;
  } catch {
    return false;
  }
}

/** Locate an absolute path to `git` or `gh`, or `undefined` when unavailable. */
export async function resolveBinary(name: 'git' | 'gh'): Promise<string | undefined> {
  if (resolvedBinary.has(name)) return resolvedBinary.get(name);

  const candidates: string[] = [];
  const override = process.env[name === 'git' ? 'INKWELL_GIT_PATH' : 'INKWELL_GH_PATH'];
  if (override) candidates.push(override);

  try {
    const fromPath = await execFileAsync(
      '/usr/bin/env',
      [name === 'git' ? 'which' : 'which', name],
      {
        timeout: 5_000,
        env: hardenedEnv(),
      },
    );
    const resolved = fromPath.stdout.trim().split('\n')[0]?.trim();
    if (resolved) candidates.push(resolved);
  } catch {
    // PATH lookup failed; fall back to known locations.
  }

  for (const dir of FALLBACK_BIN_DIRS) candidates.push(`${dir}/${name}`);

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (existsSync(candidate) && (await respondsToVersion(candidate))) {
      resolvedBinary.set(name, candidate);
      return candidate;
    }
  }
  resolvedBinary.set(name, undefined);
  return undefined;
}

/** Test seam: clear the binary discovery cache. */
export function resetBinaryCache(): void {
  resolvedBinary.clear();
}

interface RunOptions {
  /** When true, a non-zero exit resolves instead of throwing. */
  allowNonZero?: boolean;
  timeoutMs?: number;
  /** Extra allow-listed environment entries (e.g. `GH_HOST` for enterprise). */
  env?: Record<string, string>;
}

async function run(
  bin: string,
  args: readonly string[],
  cwd: string | undefined,
  options: RunOptions,
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args as string[], {
      cwd,
      env: hardenedEnv(options.env),
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    const result: RunResult = {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? '',
      code: typeof e.code === 'number' ? e.code : 1,
    };
    if (options.allowNonZero) return result;
    throw new GitCommandError(
      `${bin} ${args.join(' ')} failed (exit ${result.code}): ${result.stderr.trim()}`,
      result,
    );
  }
}

/** Run `git` in `vaultDir` with hardening flags and pathspec separator handling. */
export async function runGit(
  gitBin: string,
  vaultDir: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<RunResult> {
  return run(gitBin, [...GIT_HARDENING_FLAGS, ...args], vaultDir, options);
}

/** Run `gh`. Not scoped to the vault; used for API-only provisioning calls. */
export async function runGh(
  ghBin: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<RunResult> {
  return run(ghBin, args, undefined, options);
}

/** A validated 7–40 char lowercase hex SHA, guarding against arg injection. */
export function isValidSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/.test(value);
}
