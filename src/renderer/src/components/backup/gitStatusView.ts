import type { GitSyncState } from '@shared/git';

/** Primer-token status tone for a sync state pill. */
export type GitStatusTone = 'neutral' | 'success' | 'attention' | 'danger' | 'accent';

export interface GitStatusView {
  label: string;
  tone: GitStatusTone;
  /** Longer, human description used for captions and tooltips. */
  description: string;
}

/**
 * Map a {@link GitSyncState} to a short label, a tone, and a description. Pure
 * so it can be unit tested and reused by the settings section and header pill.
 */
export function describeSyncState(state: GitSyncState, hasRemote: boolean): GitStatusView {
  switch (state) {
    case 'disabled':
      return {
        label: 'Off',
        tone: 'neutral',
        description: 'Version history is off. Your notes are still saved as Markdown files.',
      };
    case 'no-git':
      return {
        label: 'Git unavailable',
        tone: 'danger',
        description: 'The `git` command was not found, so backup features are unavailable.',
      };
    case 'not-ready':
      return {
        label: 'Not ready',
        tone: 'attention',
        description: 'The vault is not a usable git repository yet.',
      };
    case 'uncommitted':
      return {
        label: 'Saving…',
        tone: 'accent',
        description: 'Recent changes are about to be recorded in version history.',
      };
    case 'committed-not-pushed':
      return {
        label: 'Backup pending',
        tone: 'attention',
        description: 'Local history is up to date; changes are waiting to reach the backup.',
      };
    case 'pushing':
      return {
        label: 'Backing up…',
        tone: 'accent',
        description: 'Sending your latest changes to the backup repository.',
      };
    case 'push-failed':
      return {
        label: 'Backup failed',
        tone: 'danger',
        description: 'The last backup attempt failed. Your notes are safe locally.',
      };
    case 'remote-diverged':
      return {
        label: 'Remote ahead',
        tone: 'attention',
        description: 'The backup repository has changes Inkwell does not. Resolve them in GitHub.',
      };
    case 'auth-required':
      return {
        label: 'Sign in needed',
        tone: 'danger',
        description: 'GitHub authentication is required. Run `gh auth login`, then retry.',
      };
    case 'offline':
      return {
        label: 'Offline',
        tone: 'neutral',
        description: 'The backup host is unreachable. Inkwell will retry when you are back online.',
      };
    case 'clean':
    default:
      return hasRemote
        ? { label: 'Backed up', tone: 'success', description: 'Everything is backed up.' }
        : {
            label: 'History on',
            tone: 'success',
            description: 'Local version history is up to date.',
          };
  }
}
