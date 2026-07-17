import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Inputs for {@link resolveVaultDir}. Everything the OS/settings provide is
 * injected so the resolution rules can be unit-tested without Electron or a real
 * filesystem.
 */
export interface VaultResolutionDeps {
  /** `process.env.INKWELL_VAULT_DIR` — a dev/E2E override, trimmed of surrounding whitespace. */
  envVaultDir?: string;
  /** The user's home directory (`app.getPath('home')`). */
  homeDir: string;
  /** The user's Documents directory (`app.getPath('documents')`). */
  documentsDir: string;
  /** The path previously chosen and persisted, if any (`settings.vaultPath`). */
  persistedVaultPath?: string;
  /** Persist a freshly chosen default so it stays stable across launches. */
  persist: (path: string) => void;
  /** Test seam for `existsSync`. */
  exists?: (path: string) => boolean;
  /** Test seam for creating the vault directory. */
  ensureDir?: (path: string) => void;
}

/**
 * Resolve the notes vault directory for this launch, in priority order:
 *
 * 1. An explicit `INKWELL_VAULT_DIR` env override (dev/E2E) — trimmed of
 *    surrounding whitespace and never persisted.
 * 2. A previously chosen, persisted `vaultPath`.
 * 3. First run: adopt the legacy `~/Documents/Inkwell` vault when it already
 *    exists (so existing users are never stranded), otherwise default to
 *    `~/Inkwell`. macOS protects `~/Documents`, so a fresh install lands in the
 *    home folder where the spawned `git` process can operate without a TCC
 *    permission prompt. The chosen default is created and persisted.
 */
export function resolveVaultDir(deps: VaultResolutionDeps): string {
  const exists = deps.exists ?? existsSync;
  const ensureDir = deps.ensureDir ?? ((path: string) => void mkdirSync(path, { recursive: true }));

  const env = deps.envVaultDir?.trim();
  if (env) return env;

  if (deps.persistedVaultPath) return deps.persistedVaultPath;

  const legacy = join(deps.documentsDir, 'Inkwell');
  const fresh = join(deps.homeDir, 'Inkwell');
  const chosen = exists(legacy) ? legacy : fresh;
  ensureDir(chosen);
  deps.persist(chosen);
  return chosen;
}
