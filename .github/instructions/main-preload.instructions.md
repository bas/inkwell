---
applyTo: 'src/main/**,src/preload/**'
---

# Main & preload process rules

- This code runs in Node/Electron main or the preload bridge. The renderer must never gain direct
  access to anything here except through the typed `contextBridge` API.
- **Preload is a thin bridge only**: expose a typed API that forwards to `ipcRenderer.invoke`. No
  business logic, no `fs`, no database calls in preload.
- **All fs/db/Node work lives in main**, behind `ipcMain.handle` handlers.
- **Validate every IPC argument** before use (ids, paths, payload shapes). Treat all input as
  untrusted. Never resolve paths outside the configured vault directory.
- **Atomic file writes only**: temp file → `fsync` → `rename`. Never truncate/write a note in place.
- Keep SQLite as a rebuildable cache: maintain a `schema_version`, run migrations on open, verify
  integrity on startup, and rebuild from `.md` files if the index is missing or corrupt.
- Open external URLs with `shell.openExternal`; reject non-http(s) protocols.
- Window security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
