import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { runGit } from './runner';

/**
 * The state of the vault as a git repository. Drives what operations are safe
 * and what the UI should show (research R3 §2.2, RD-9).
 */
export type RepoPreflight =
  | { kind: 'not-a-repo' }
  | { kind: 'foreign-repo'; root: string } // vault is nested inside another repo
  | { kind: 'blocked'; reason: string } // detached HEAD, mid-rebase/merge, index locked
  | { kind: 'unborn'; branch: string } // repo exists, no commits yet
  | { kind: 'ready'; branch: string; hasUpstream: boolean; remoteUrl?: string };

function samePath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return a === b;
  }
}

async function currentBranch(gitBin: string, vaultDir: string): Promise<string | undefined> {
  const ref = await runGit(gitBin, vaultDir, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowNonZero: true,
  });
  if (ref.code !== 0) return undefined;
  const branch = ref.stdout.trim();
  return branch.length > 0 ? branch : undefined;
}

/**
 * Resolve the repository's actual git directory. In plain repos this is
 * `${vaultDir}/.git`, but with worktrees/submodules `.git` is a *file* pointing
 * elsewhere, so we ask git rather than assuming the path. Falls back to the
 * conventional location if the command fails.
 */
async function resolveGitDir(gitBin: string, vaultDir: string): Promise<string> {
  const result = await runGit(gitBin, vaultDir, ['rev-parse', '--git-dir'], {
    allowNonZero: true,
  });
  const raw = result.code === 0 ? result.stdout.trim() : '';
  if (raw.length === 0) return join(vaultDir, '.git');
  return isAbsolute(raw) ? raw : join(vaultDir, raw);
}

/** Inspect the vault's git state without mutating anything. */
export async function preflight(gitBin: string, vaultDir: string): Promise<RepoPreflight> {
  const inside = await runGit(gitBin, vaultDir, ['rev-parse', '--is-inside-work-tree'], {
    allowNonZero: true,
  });
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    return { kind: 'not-a-repo' };
  }

  const top = await runGit(gitBin, vaultDir, ['rev-parse', '--show-toplevel'], {
    allowNonZero: true,
  });
  const root = top.stdout.trim();
  if (root.length > 0 && !samePath(root, vaultDir)) {
    return { kind: 'foreign-repo', root };
  }

  const gitDir = await resolveGitDir(gitBin, vaultDir);
  if (existsSync(join(gitDir, 'index.lock'))) {
    return {
      kind: 'blocked',
      reason: 'A previous git operation is still in progress (index.lock).',
    };
  }
  if (
    existsSync(join(gitDir, 'rebase-merge')) ||
    existsSync(join(gitDir, 'rebase-apply')) ||
    existsSync(join(gitDir, 'MERGE_HEAD'))
  ) {
    return { kind: 'blocked', reason: 'The repository is in the middle of a rebase or merge.' };
  }

  const branch = await currentBranch(gitBin, vaultDir);
  if (!branch) {
    return { kind: 'blocked', reason: 'The repository has a detached HEAD.' };
  }

  const head = await runGit(gitBin, vaultDir, ['rev-parse', '--verify', '--quiet', 'HEAD'], {
    allowNonZero: true,
  });
  if (head.code !== 0) {
    return { kind: 'unborn', branch };
  }

  const remote = await runGit(gitBin, vaultDir, ['remote', 'get-url', 'origin'], {
    allowNonZero: true,
  });
  const remoteUrl = remote.code === 0 ? remote.stdout.trim() : undefined;

  const upstream = await runGit(gitBin, vaultDir, ['rev-parse', '--abbrev-ref', '@{u}'], {
    allowNonZero: true,
  });
  const hasUpstream = upstream.code === 0;

  return {
    kind: 'ready',
    branch,
    hasUpstream,
    ...(remoteUrl ? { remoteUrl } : {}),
  };
}

/** Count local commits ahead of the configured upstream (0 when no upstream). */
export async function countAhead(gitBin: string, vaultDir: string): Promise<number> {
  const result = await runGit(gitBin, vaultDir, ['rev-list', '--count', '@{u}..HEAD'], {
    allowNonZero: true,
  });
  if (result.code !== 0) return 0;
  const n = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Whether there are uncommitted changes to the files Inkwell manages — markdown
 * notes plus the git meta files (`.gitignore`/`.gitattributes`). Scoped to those
 * pathspecs (porcelain, NUL-safe) so it matches the commit's staging set: stray
 * non-managed files, which we deliberately never stage, must not report the
 * vault as perpetually dirty. `git status` (unlike `git add`) does not fatal on
 * a pathspec that matches nothing, so the meta pathspecs are always safe to pass.
 */
export async function isDirty(gitBin: string, vaultDir: string): Promise<boolean> {
  const result = await runGit(
    gitBin,
    vaultDir,
    ['status', '--porcelain', '-z', '--', ':(icase)*.md', '.gitignore', '.gitattributes'],
    { allowNonZero: true },
  );
  if (result.code !== 0) return false;
  return result.stdout.replace(/\0/g, '').trim().length > 0;
}
