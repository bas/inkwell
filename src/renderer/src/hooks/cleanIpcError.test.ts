import { describe, expect, it } from 'vitest';
import { cleanIpcError } from './cleanIpcError';

describe('cleanIpcError', () => {
  it('strips the Electron invoke wrapper and the Error class token', () => {
    expect(
      cleanIpcError("Error invoking remote method 'git:setEnabled': Error: Inkwell can't set up"),
    ).toBe("Inkwell can't set up");
  });

  it('strips a GitCommandError class token too', () => {
    expect(
      cleanIpcError(
        "Error invoking remote method 'git:setEnabled': GitCommandError: git init failed",
      ),
    ).toBe('git init failed');
  });

  it('leaves an already-clean message untouched', () => {
    expect(cleanIpcError('Something went wrong')).toBe('Something went wrong');
  });
});
