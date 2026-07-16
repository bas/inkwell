import { describe, expect, it } from 'vitest';
import { isValidRemoteUrl, normalizeRepoName, validateRepoName, DEFAULT_GIT_SETTINGS } from './git';

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
});

describe('DEFAULT_GIT_SETTINGS', () => {
  it('is disabled with no remote and safe defaults', () => {
    expect(DEFAULT_GIT_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_GIT_SETTINGS.autoCommit).toBe('onSave');
    expect(DEFAULT_GIT_SETTINGS.remote).toBeUndefined();
  });
});
