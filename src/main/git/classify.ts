import type { GitSyncState } from '../../shared/git';

/**
 * Classify a failed `git push` from its stderr so the UI can distinguish
 * authentication and connectivity problems from a diverged remote or a generic
 * failure — never collapsing everything into "offline" (research R3 §4.2, RD-13).
 */
export function classifyPushFailure(
  stderr: string,
): Extract<GitSyncState, 'auth-required' | 'offline' | 'remote-diverged' | 'push-failed'> {
  const text = stderr.toLowerCase();

  if (
    text.includes('non-fast-forward') ||
    text.includes('fetch first') ||
    text.includes('rejected') ||
    text.includes('tip of your current branch is behind')
  ) {
    return 'remote-diverged';
  }

  if (
    text.includes('authentication failed') ||
    text.includes('could not read username') ||
    text.includes('could not read password') ||
    text.includes('permission denied') ||
    text.includes('403') ||
    text.includes('terminal prompts disabled') ||
    text.includes('access rights') ||
    text.includes('publickey')
  ) {
    return 'auth-required';
  }

  if (
    text.includes('could not resolve host') ||
    text.includes('could not resolve hostname') ||
    text.includes('network is unreachable') ||
    text.includes('connection timed out') ||
    text.includes('timed out') ||
    text.includes('temporary failure in name resolution') ||
    text.includes('operation timed out') ||
    text.includes('connection refused')
  ) {
    return 'offline';
  }

  return 'push-failed';
}

/** Whether a `gh repo create` error means the repo already exists (idempotent). */
export function isAlreadyExistsError(stderr: string): boolean {
  const text = stderr.toLowerCase();
  return (
    text.includes('name already exists') ||
    text.includes('already exists on this account') ||
    (text.includes('422') && text.includes('already exists'))
  );
}
