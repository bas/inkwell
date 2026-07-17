import { describe, expect, it } from 'vitest';
import { describeVaultAccessError, isVaultAccessError } from './classify';

describe('isVaultAccessError', () => {
  it('matches the TCC-protected folder failures git emits', () => {
    expect(
      isVaultAccessError('fatal: unable to get current working directory: Operation not permitted'),
    ).toBe(true);
    expect(isVaultAccessError('error: open("note.md"): Permission denied')).toBe(true);
    expect(isVaultAccessError('fatal: Read-only file system')).toBe(true);
    expect(isVaultAccessError('could not open a required file')).toBe(true);
  });

  it('does not match unrelated failures', () => {
    expect(isVaultAccessError('fatal: not a git repository')).toBe(false);
    expect(isVaultAccessError('Updates were rejected because the tip is behind')).toBe(false);
    expect(isVaultAccessError('')).toBe(false);
  });
});

describe('describeVaultAccessError', () => {
  it('names the folder and points at the Settings control', () => {
    const message = describeVaultAccessError('/Users/test/Documents/Inkwell');
    expect(message).toContain('/Users/test/Documents/Inkwell');
    expect(message.toLowerCase()).toContain('permission');
    expect(message).toContain('Notes vault');
    expect(message).not.toContain('/usr/bin/git');
  });
});
