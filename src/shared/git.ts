/**
 * Git-backed vault types and pure helpers shared across the main, preload, and
 * renderer processes. This module must not import any Node or Electron runtime
 * APIs — it holds serializable contracts and pure validators used on both sides
 * of the IPC boundary.
 *
 * v1 scope is a ONE-WAY BACKUP: Inkwell keeps a local commit history of the
 * vault and can push it to a user-chosen remote. It never auto-pulls or merges
 * remote changes (bidirectional sync is deliberately out of scope).
 */

/** When Inkwell records a local commit off the autosave loop. */
export type GitAutoCommitMode = 'onSave' | 'interval' | 'manual';

/** How the backup remote was provisioned. */
export type GitRemoteMode = 'gh' | 'url';

/** GitHub repository visibility. Personal notes default to `private`. */
export type GitVisibility = 'private' | 'public' | 'internal';

/** Persisted configuration for a configured backup remote. */
export interface GitRemoteConfig {
  /** How the remote was set up: provisioned via `gh`, or a pasted URL. */
  mode: GitRemoteMode;
  /** Host the remote lives on, e.g. `github.com` or a GHE host. Empty for opaque URLs. */
  host: string;
  /** Owning login or org. Empty for opaque pasted URLs. */
  owner: string;
  /** Repository name. Empty for opaque pasted URLs. */
  repo: string;
  /** Last known/verified visibility. `unknown` for un-verifiable Mode C remotes. */
  visibility: GitVisibility | 'unknown';
  /** The ssh/https URL actually used by git as `origin`. */
  remoteUrl: string;
  /** Whether to push automatically after each local commit. */
  autoPush: boolean;
}

/** The persisted `git` block on {@link AppSettings}. Absent = never configured. */
export interface GitSettings {
  /** Local version history is on (a git repo is initialised in the vault). */
  enabled: boolean;
  /** When auto-commits happen. */
  autoCommit: GitAutoCommitMode;
  /** Interval length when `autoCommit === 'interval'`. */
  intervalMinutes: number;
  /** Configured backup remote, absent until the user sets one up. */
  remote?: GitRemoteConfig;
  /** ISO timestamp of the last successful push. */
  lastPushAt?: string;
}

export const DEFAULT_GIT_SETTINGS: GitSettings = {
  enabled: false,
  autoCommit: 'onSave',
  intervalMinutes: 5,
};

/**
 * The user-facing sync state. Distinguishes auth/DNS problems from generic
 * offline so the UI never collapses everything into "Offline".
 */
export type GitSyncState =
  | 'disabled' // version history is off
  | 'no-git' // the git binary is unavailable
  | 'not-ready' // vault is not a usable repo (foreign parent, detached, mid-op…)
  | 'clean' // working tree committed, nothing to push (or no remote)
  | 'uncommitted' // local changes not yet committed
  | 'committed-not-pushed' // local commits waiting to push
  | 'pushing' // a push is in flight
  | 'push-failed' // a push failed for a non-auth reason
  | 'remote-diverged' // remote has commits we don't (never force-pushed)
  | 'auth-required' // push failed because authentication is needed
  | 'offline'; // push failed because the network/host was unreachable

/** Availability of the external binaries Inkwell shells out to. */
export interface GitBinaryAvailability {
  /** `git` was found and responded to `--version`. Required for all features. */
  git: boolean;
  /** `gh` was found and responded. Required only for GitHub provisioning (Modes A/B). */
  gh: boolean;
}

/** The full backup status the renderer polls and renders. */
export interface GitBackupStatus {
  available: GitBinaryAvailability;
  settings: GitSettings;
  syncState: GitSyncState;
  /** Number of local commits ahead of the remote, when a remote is configured. */
  ahead?: number;
  /** Whether the working tree currently has uncommitted note changes. */
  dirty: boolean;
  /** Human-readable detail for diagnostics / the UI (e.g. an error message). */
  detail?: string;
}

/** Result of validating/normalizing a proposed GitHub repository name. */
export interface RepoNameValidation {
  /** The normalized name that would actually be created. */
  normalized: string;
  /** True when normalization changed the user's input (lossy). */
  changed: boolean;
  /** True when the normalized name is a legal GitHub repository name. */
  valid: boolean;
  /** Why it is invalid, when `valid` is false. */
  error?: string;
}

/** GitHub repository names are capped near this length. */
export const REPO_NAME_MAX_LENGTH = 100;

const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const RESERVED_REPO_NAMES = new Set(['.', '..']);
const DISALLOWED_RUN = /[^A-Za-z0-9._-]+/g;
const REPEATED_HYPHEN = /-{2,}/g;
const EDGE_TRIM = /^[-.]+|[-.]+$/g;

/**
 * Normalize a proposed repository name to GitHub's allowed character set,
 * matching what the app will actually pass to `gh` so the preview never
 * diverges from the created repo. Unlike GitHub's own silent normalization,
 * this also collapses repeated hyphens and trims edge separators for a cleaner
 * result.
 */
export function normalizeRepoName(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(DISALLOWED_RUN, '-')
    .replace(REPEATED_HYPHEN, '-')
    .replace(EDGE_TRIM, '');
}

/** Validate + normalize a proposed repository name against GitHub's rules. */
export function validateRepoName(input: string): RepoNameValidation {
  const normalized = normalizeRepoName(input);
  const changed = normalized !== input.trim();
  if (normalized.length === 0) {
    return { normalized, changed, valid: false, error: 'Enter a repository name.' };
  }
  if (normalized.length > REPO_NAME_MAX_LENGTH) {
    return {
      normalized,
      changed,
      valid: false,
      error: `Repository names must be ${REPO_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (RESERVED_REPO_NAMES.has(normalized) || !REPO_NAME_PATTERN.test(normalized)) {
    return { normalized, changed, valid: false, error: 'That name is not allowed by GitHub.' };
  }
  return { normalized, changed, valid: true };
}

/**
 * Whether a pasted remote URL is a shape we accept: HTTPS, ssh:// or the
 * scp-like `git@host:owner/repo` form. Insecure/other schemes (http, file, …)
 * are rejected, mirroring the app's non-http(s) link blocking.
 */
export function isValidRemoteUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) return true;
  if (/^ssh:\/\/[^\s]+$/i.test(trimmed)) return true;
  if (/^[A-Za-z0-9._-]+@[A-Za-z0-9._.-]+:[^\s]+$/.test(trimmed)) return true;
  return false;
}

/** Whether an owner is eligible to create `internal` repositories (orgs only). */
export interface GitDestinations {
  /** Hosts discovered from `gh auth status`, healthiest first. */
  hosts: string[];
  /** The authenticated login for the active host, when known. */
  login?: string;
  /** Candidate owners (personal login + orgs). */
  owners: string[];
  /** Owners that are organizations (eligible for `internal` visibility). */
  orgOwners: string[];
}

/** Input for provisioning/attaching a backup remote. */
export interface GitRemoteSetupInput {
  mode: GitRemoteMode;
  /** For `gh` mode: create a new repo, or attach to an existing one. */
  ghAction?: 'create' | 'existing';
  host?: string;
  owner?: string;
  repo?: string;
  visibility?: GitVisibility;
  /** For `url` mode: the pasted remote URL. */
  remoteUrl?: string;
  autoPush: boolean;
  /** Explicit acknowledgement required to create/attach a public repo. */
  acknowledgePublic?: boolean;
}

/** Result of a remote-setup attempt, including the freshly recomputed status. */
export interface GitRemoteSetupResult {
  /** The push state produced by the first push after wiring the remote. */
  pushState: GitSyncState;
  /** Diagnostic detail when the push did not fully succeed. */
  detail?: string;
  /** The recomputed backup status after setup. */
  status: GitBackupStatus;
}

/** Result of a manual push, including the freshly recomputed status. */
export interface GitPushResult {
  state: GitSyncState;
  detail?: string;
  status: GitBackupStatus;
}

/** Result of checking a proposed repository name for availability. */
export interface GitRepoNameCheck {
  available: boolean;
  normalized: string;
  error?: string;
}
