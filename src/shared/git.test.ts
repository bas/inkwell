import { describe, expect, it } from 'vitest';
import {
  clampIntervalMinutes,
  isValidGitHost,
  isValidGitHubOwner,
  isValidRemoteUrl,
  MAX_INTERVAL_MINUTES,
  MIN_INTERVAL_MINUTES,
  normalizeRepoName,
  validateRepoName,
  DEFAULT_GIT_SETTINGS,
} from './git';

describe('normalizeRepoName', () => {
  it('collapses disallowed runs and repeated hyphens', () => {
    expect(normalizeRepoName('my notes!!repo')).toBe('my-notes-repo');
  });

  it('trims leading/trailing separators', () => {
    expect(normalizeRepoName('--inkwell.notes.')).toBe('inkwell.notes');
    expect(normalizeRepoName('.hidden')).toBe('hidden');
  });

  it('keeps valid names unchanged', () => {
    expect(normalizeRepoName('inkwell-notes')).toBe('inkwell-notes');
    expect(normalizeRepoName('Notes_2026.backup')).toBe('Notes_2026.backup');
  });
});

describe('validateRepoName', () => {
  it('accepts a clean name', () => {
    const result = validateRepoName('inkwell-notes');
    expect(result).toEqual({ normalized: 'inkwell-notes', changed: false, valid: true });
  });

  it('reports lossy normalization', () => {
    const result = validateRepoName('my notes');
    expect(result.normalized).toBe('my-notes');
    expect(result.changed).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('treats a trimming-only difference as changed', () => {
    const result = validateRepoName('  inkwell-notes  ');
    expect(result.normalized).toBe('inkwell-notes');
    expect(result.changed).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('rejects empty and reserved names', () => {
    expect(validateRepoName('').valid).toBe(false);
    expect(validateRepoName('   ').valid).toBe(false);
    expect(validateRepoName('.').valid).toBe(false);
    expect(validateRepoName('..').valid).toBe(false);
  });

  it('rejects names longer than the GitHub limit', () => {
    expect(validateRepoName('a'.repeat(101)).valid).toBe(false);
    expect(validateRepoName('a'.repeat(100)).valid).toBe(true);
  });
});

describe('isValidRemoteUrl', () => {
  it('accepts https, ssh, and scp-like remotes', () => {
    expect(isValidRemoteUrl('https://github.com/owner/repo.git')).toBe(true);
    expect(isValidRemoteUrl('ssh://git@github.com/owner/repo.git')).toBe(true);
    expect(isValidRemoteUrl('git@github.com:owner/repo.git')).toBe(true);
  });

  it('rejects insecure or malformed remotes', () => {
    expect(isValidRemoteUrl('http://github.com/owner/repo.git')).toBe(false);
    expect(isValidRemoteUrl('file:///tmp/repo')).toBe(false);
    expect(isValidRemoteUrl('')).toBe(false);
    expect(isValidRemoteUrl('not a url')).toBe(false);
  });

  it('rejects hosts that could be parsed as ssh option flags', () => {
    expect(isValidRemoteUrl('ssh://-oProxyCommand=calc/repo.git')).toBe(false);
    expect(isValidRemoteUrl('-oProxyCommand=calc@github.com:owner/repo.git')).toBe(false);
    expect(isValidRemoteUrl('git@-oProxyCommand=calc:owner/repo.git')).toBe(false);
  });
});

describe('isValidGitHubOwner', () => {
  it('accepts normal user and org logins', () => {
    expect(isValidGitHubOwner('octocat')).toBe(true);
    expect(isValidGitHubOwner('my-org')).toBe(true);
    expect(isValidGitHubOwner('a1')).toBe(true);
  });

  it('rejects logins that could be parsed as gh options or are malformed', () => {
    expect(isValidGitHubOwner('-flag')).toBe(false);
    expect(isValidGitHubOwner('')).toBe(false);
    expect(isValidGitHubOwner('bad/owner')).toBe(false);
    expect(isValidGitHubOwner('has space')).toBe(false);
    expect(isValidGitHubOwner('a'.repeat(40))).toBe(false);
  });
});

describe('isValidGitHost', () => {
  it('accepts github.com and GHE hostnames', () => {
    expect(isValidGitHost('github.com')).toBe(true);
    expect(isValidGitHost('ghe.example.org')).toBe(true);
  });

  it('rejects hosts that could be parsed as gh options or are malformed', () => {
    expect(isValidGitHost('-flag')).toBe(false);
    expect(isValidGitHost('.leading-dot')).toBe(false);
    expect(isValidGitHost('')).toBe(false);
    expect(isValidGitHost('has space')).toBe(false);
  });
});

describe('DEFAULT_GIT_SETTINGS', () => {
  it('is disabled with no remote and safe defaults', () => {
    expect(DEFAULT_GIT_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_GIT_SETTINGS.autoCommit).toBe('onSave');
    expect(DEFAULT_GIT_SETTINGS.remote).toBeUndefined();
  });
});

describe('clampIntervalMinutes', () => {
  it('allows the full supported range up to 24 hours', () => {
    expect(MAX_INTERVAL_MINUTES).toBe(1440);
    expect(clampIntervalMinutes(1440)).toBe(1440);
    expect(clampIntervalMinutes(60)).toBe(60);
  });

  it('clamps out-of-range and rounds fractional values', () => {
    expect(clampIntervalMinutes(0)).toBe(MIN_INTERVAL_MINUTES);
    expect(clampIntervalMinutes(-5)).toBe(MIN_INTERVAL_MINUTES);
    expect(clampIntervalMinutes(10_000)).toBe(MAX_INTERVAL_MINUTES);
    expect(clampIntervalMinutes(4.6)).toBe(5);
  });
});
