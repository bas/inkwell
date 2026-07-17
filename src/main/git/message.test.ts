import { describe, expect, it } from 'vitest';
import { autoCommitMessage } from './message';
import { classifyPushFailure, isAlreadyExistsError } from './classify';

describe('autoCommitMessage', () => {
  it('falls back to a generic message with no titles', () => {
    expect(autoCommitMessage([])).toBe('Update notes');
    expect(autoCommitMessage(['   '])).toBe('Update notes');
  });

  it('names a single note', () => {
    expect(autoCommitMessage(['Groceries'])).toBe('Update note: Groceries');
  });

  it('lists up to three notes', () => {
    expect(autoCommitMessage(['A', 'B', 'C'])).toBe('Update notes: A, B, C');
  });

  it('summarizes four or more notes by count', () => {
    expect(autoCommitMessage(['A', 'B', 'C', 'D'])).toBe('Update 4 notes');
  });
});

describe('classifyPushFailure', () => {
  it('detects a diverged remote', () => {
    expect(classifyPushFailure('! [rejected] main -> main (non-fast-forward)')).toBe(
      'remote-diverged',
    );
    expect(classifyPushFailure('Updates were rejected because fetch first')).toBe(
      'remote-diverged',
    );
  });

  it('detects authentication problems', () => {
    expect(classifyPushFailure('fatal: Authentication failed for repo')).toBe('auth-required');
    expect(classifyPushFailure('git@github.com: Permission denied (publickey).')).toBe(
      'auth-required',
    );
    expect(classifyPushFailure('terminal prompts disabled')).toBe('auth-required');
  });

  it('detects connectivity problems', () => {
    expect(classifyPushFailure('fatal: unable to access: Could not resolve host: github.com')).toBe(
      'offline',
    );
    expect(classifyPushFailure('Connection timed out')).toBe('offline');
  });

  it('falls back to a generic push failure', () => {
    expect(classifyPushFailure('some unexpected error')).toBe('push-failed');
  });
});

describe('isAlreadyExistsError', () => {
  it('recognizes an existing repository', () => {
    expect(isAlreadyExistsError('GraphQL: Name already exists on this account')).toBe(true);
    expect(isAlreadyExistsError('HTTP 422: name already exists')).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isAlreadyExistsError('HTTP 404: Not Found')).toBe(false);
  });
});
