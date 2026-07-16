import type { GitDestinations, GitVisibility } from '../../shared/git';
import { runGh, type RunResult } from './runner';
import { isAlreadyExistsError } from './classify';

/**
 * `gh`-backed provisioning helpers: destination discovery, name availability,
 * repo creation, and visibility read-back. Provisioning is API-only and
 * idempotent — remote wiring and pushing happen in the hardened git runner, not
 * via `gh repo create --source --push` (research R3 §4.1, RD-10).
 */

function hostEnv(host?: string): { env?: Record<string, string> } {
  return host && host !== 'github.com' ? { env: { GH_HOST: host } } : {};
}

function repoArg(host: string | undefined, owner: string, repo: string): string {
  return host && host !== 'github.com' ? `${host}/${owner}/${repo}` : `${owner}/${repo}`;
}

/** Parse hosts out of `gh auth status` output. */
function parseHosts(output: string): string[] {
  const hosts: string[] = [];
  for (const line of output.split('\n')) {
    const match = /^([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.exec(line.trim());
    const host = match?.[1];
    if (host && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

/** Discover hosts, the active login, and candidate owners from `gh`. */
export async function discoverDestinations(ghBin: string): Promise<GitDestinations> {
  const status = await runGh(ghBin, ['auth', 'status'], { allowNonZero: true });
  const hosts = parseHosts(`${status.stdout}\n${status.stderr}`);
  if (hosts.length === 0) hosts.push('github.com');

  const loginResult = await runGh(ghBin, ['api', 'user', '--jq', '.login'], { allowNonZero: true });
  const login = loginResult.code === 0 ? loginResult.stdout.trim() || undefined : undefined;

  const orgsResult = await runGh(ghBin, ['api', 'user/orgs', '--jq', '.[].login'], {
    allowNonZero: true,
  });
  const orgOwners =
    orgsResult.code === 0
      ? orgsResult.stdout
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

  const owners = [...(login ? [login] : []), ...orgOwners];
  return {
    hosts,
    ...(login ? { login } : {}),
    owners: owners.length > 0 ? owners : login ? [login] : [],
    orgOwners,
  };
}

/** Whether a repo of that name already exists under the owner (collision check). */
export async function repoExists(
  ghBin: string,
  host: string | undefined,
  owner: string,
  repo: string,
): Promise<boolean> {
  const result = await runGh(
    ghBin,
    ['repo', 'view', repoArg(host, owner, repo), '--json', 'name'],
    { allowNonZero: true, ...hostEnv(host) },
  );
  return result.code === 0;
}

/** Read a repo's actual visibility (never trust the requested value). */
export async function readVisibility(
  ghBin: string,
  host: string | undefined,
  owner: string,
  repo: string,
): Promise<GitVisibility | 'unknown'> {
  const result = await runGh(
    ghBin,
    ['repo', 'view', repoArg(host, owner, repo), '--json', 'visibility'],
    { allowNonZero: true, ...hostEnv(host) },
  );
  if (result.code !== 0) return 'unknown';
  try {
    const parsed = JSON.parse(result.stdout) as { visibility?: string };
    const v = parsed.visibility?.toLowerCase();
    if (v === 'private' || v === 'public' || v === 'internal') return v;
  } catch {
    // fall through
  }
  return 'unknown';
}

/** Resolve the clone/remote URL gh would use for the repo. */
export async function resolveRemoteUrl(
  ghBin: string,
  host: string | undefined,
  owner: string,
  repo: string,
): Promise<string | undefined> {
  const result = await runGh(
    ghBin,
    ['repo', 'view', repoArg(host, owner, repo), '--json', 'sshUrl,url'],
    { allowNonZero: true, ...hostEnv(host) },
  );
  if (result.code !== 0) return undefined;
  try {
    const parsed = JSON.parse(result.stdout) as { sshUrl?: string; url?: string };
    return parsed.sshUrl || (parsed.url ? `${parsed.url}.git` : undefined);
  } catch {
    return undefined;
  }
}

export interface CreateRepoInput {
  host?: string;
  owner: string;
  repo: string;
  visibility: GitVisibility;
}

/** Thrown by {@link createRepo} when the target repo already exists. */
export class RepoAlreadyExistsError extends Error {
  constructor(
    message = 'A repository with that name already exists. Choose "Use an existing repository" to attach to it, or pick a different name.',
  ) {
    super(message);
    this.name = 'RepoAlreadyExistsError';
  }
}

/**
 * Create the remote repo. The full `OWNER/REPO` argument plus an explicit
 * visibility flag makes `gh repo create` non-interactive (no prompt), which is
 * required because the hardened env sets `GH_PROMPT_DISABLED=1`. An
 * "already exists" result is surfaced as {@link RepoAlreadyExistsError} rather
 * than treated as success, so the caller must route the user through the
 * explicit "attach to existing repo" flow instead of silently pushing notes to
 * a repo it did not create (guards against a race / untrusted renderer).
 */
export async function createRepo(ghBin: string, input: CreateRepoInput): Promise<void> {
  const result: RunResult = await runGh(
    ghBin,
    ['repo', 'create', `${input.owner}/${input.repo}`, `--${input.visibility}`],
    { allowNonZero: true, ...hostEnv(input.host) },
  );
  if (result.code === 0) return;
  if (isAlreadyExistsError(result.stderr)) throw new RepoAlreadyExistsError();
  throw new Error(result.stderr.trim() || 'Could not create the repository.');
}
