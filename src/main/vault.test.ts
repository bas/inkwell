import { describe, expect, it, vi } from 'vitest';
import { resolveVaultDir, type VaultResolutionDeps } from './vault';

function baseDeps(overrides: Partial<VaultResolutionDeps> = {}): VaultResolutionDeps {
  return {
    homeDir: '/Users/test',
    documentsDir: '/Users/test/Documents',
    persist: vi.fn(),
    exists: () => false,
    ensureDir: vi.fn(),
    ...overrides,
  };
}

describe('resolveVaultDir', () => {
  it('uses the env override verbatim and never persists it', () => {
    const persist = vi.fn();
    const ensureDir = vi.fn();
    const dir = resolveVaultDir(
      baseDeps({ envVaultDir: '  /tmp/e2e-vault  ', persist, ensureDir }),
    );
    expect(dir).toBe('/tmp/e2e-vault');
    expect(persist).not.toHaveBeenCalled();
    expect(ensureDir).not.toHaveBeenCalled();
  });

  it('prefers a previously persisted vault path', () => {
    const persist = vi.fn();
    const dir = resolveVaultDir(baseDeps({ persistedVaultPath: '/Users/test/Chosen', persist }));
    expect(dir).toBe('/Users/test/Chosen');
    expect(persist).not.toHaveBeenCalled();
  });

  it('adopts the legacy Documents vault on first run when it exists', () => {
    const persist = vi.fn();
    const ensureDir = vi.fn();
    const legacy = '/Users/test/Documents/Inkwell';
    const dir = resolveVaultDir(baseDeps({ persist, ensureDir, exists: (p) => p === legacy }));
    expect(dir).toBe(legacy);
    expect(ensureDir).toHaveBeenCalledWith(legacy);
    expect(persist).toHaveBeenCalledWith(legacy);
  });

  it('defaults a fresh install to ~/Inkwell and persists it', () => {
    const persist = vi.fn();
    const ensureDir = vi.fn();
    const dir = resolveVaultDir(baseDeps({ persist, ensureDir, exists: () => false }));
    expect(dir).toBe('/Users/test/Inkwell');
    expect(ensureDir).toHaveBeenCalledWith('/Users/test/Inkwell');
    expect(persist).toHaveBeenCalledWith('/Users/test/Inkwell');
  });
});
