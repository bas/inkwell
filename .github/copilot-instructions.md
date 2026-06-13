# Inkwell — Copilot / Agent Instructions

Inkwell is a **macOS (Apple Silicon, arm64) desktop app for keeping notes in Markdown**, with a
WYSIWYG editor, a notes list, labels, full-text search, dark mode, and English spellcheck.

These instructions are binding for all contributors (human and AI). Keep changes minimal and in
scope; do not add features, refactors, or abstractions beyond what a task requires.

## Stack (do not deviate without an explicit decision)

- **Electron** + **electron-vite** (build) + **electron-builder** (package).
- **React 18** + **TypeScript** in `strict` mode.
- **Primer** for all UI: `@primer/react`, `@primer/primitives`, `@primer/octicons-react`.
  Rendered markdown uses the `markdown-body` class from `@primer/css`.
- **TipTap** (ProseMirror) for the WYSIWYG editor.
- **better-sqlite3** + **FTS5** for the search/metadata index (main process only).
- **gray-matter** / **yaml** for note frontmatter.

## Hard UI rule — Primer only

- Build **all UI** with Primer components, Primer **primitives (design tokens)** for color, spacing,
  typography, radii, and shadows, and **Octicons** for icons.
- **Never** hardcode colors, spacing, or font values. Use Primer CSS variables / theme tokens.
- **No other UI, component, or icon libraries.** No Tailwind, MUI, Bootstrap, Font Awesome, etc.
- Custom CSS is permitted **only** for the editor surface (ProseMirror) and layout mechanics
  (e.g. resizable panes). Even then, all values must come from Primer tokens — never ad-hoc colors.
- Support light and dark via Primer `ThemeProvider` `colorMode`. Default follows the macOS system
  appearance; a persisted in-app override (light / dark / auto) is available.

## Electron security (non-negotiable)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on all renderers.
- The renderer **never** touches `fs`, the database, or Node APIs directly.
- The only renderer↔main channel is a **typed `contextBridge` API** exposed from the preload, which
  forwards to `ipcRenderer`. All Node/fs/db work lives in the **main** process.
- **Validate every IPC input** in main; treat the renderer as untrusted.
- Open external links via `shell.openExternal`; block unsafe URL protocols. Rendered markdown must be
  sanitized and must never execute script.

## Architecture & boundaries

- `src/main/**` — main process: windows, file IO, SQLite, spellchecker, native menus, IPC handlers.
- `src/preload/**` — thin typed `contextBridge` bridge only (no business logic).
- `src/renderer/**` — React + Primer UI + TipTap. No `fs`/db/Node access.
- `src/renderer/editor/**` — TipTap setup and markdown serialization.
- `src/shared/**` — types/constants shared across processes (no runtime Node/Electron imports).

## Storage contract

- **Plain `.md` files are the source of truth.** Each note is one `.md` file with YAML frontmatter
  (`id`, `title`, `labels`, `pinned`, `createdAt`, `updatedAt`) plus the markdown body.
- **SQLite is a rebuildable cache** for list/search/labels. The DB must be reconstructable from the
  files at any time, and must carry a `schema_version` for migrations.
- **Writes must be atomic**: write to a temp file, fsync, then rename. Never write a note in place.
- Handle external edits (file watching), missing/duplicate frontmatter ids, and external
  rename/delete. The files and the index must never silently diverge.

## Testing

- **Vitest** for unit tests: frontmatter parse/serialize, slug generation, markdown round-trip,
  storage and db logic (against a temp vault/db).
- **Playwright (Electron)** for E2E: launch the app, create/edit/delete/search/pin a note, toggle
  theme, and verify the `.md` on disk.
- New features ship with tests. The markdown round-trip has **golden `.md` fixtures**.

## E2E testability

- Every interactive element needs a stable **`data-testid`** and a correct accessible **role/name**.
- Prefer role/name queries in tests; use `data-testid` for disambiguation.

## Conventions

- TypeScript `strict`; **no `any`** (use `unknown` + narrowing). Prefer named exports.
- IPC handlers are async and return typed results; surface errors as typed error states in the UI.
- First-class error states (not just happy path): vault unavailable, permission denied, invalid
  frontmatter, corrupted note, DB rebuild failure, save/delete failure, disk full, external conflict.

## Git history (required)

- Keep a **clean history**: small, **task-scoped** commits — one logical change each. Do not batch
  unrelated work.
- Each commit should be self-contained and green (the pre-commit hook runs typecheck/lint/format).
- Use **Conventional Commits**: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`, `build:`,
  `ci:`. Scope to the area, e.g. `feat(storage): atomic note write`.
- No giant "WIP" / end-of-day dump commits. Each phase is a coherent series of commits.

## Scope guardrails

- macOS arm64 only for now. No Windows/Linux work.
- GitHub interop (Issues/Gists) is **future**, not now. Do not add it.
- Image embedding/paste is out of scope for v1.
