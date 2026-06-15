# Inkwell

> ⚠️ **Status: early development — not production ready.** Inkwell is a work in progress and is
> provided as-is. Expect breaking changes, incomplete features, and rough edges. There are no
> stability or data-format guarantees yet — back up any notes you care about before using it. Not
> recommended for daily use.

A macOS (Apple Silicon) desktop app for keeping notes in **Markdown**, with a WYSIWYG editor, a
notes list, labels, full-text search, dark mode, and English spellcheck.

> Notes are stored as plain `.md` files (with YAML frontmatter) — they are the source of truth. A
> rebuildable SQLite index powers fast listing and search.

## Stack

- **Electron** + **electron-vite** + **electron-builder**
- **React 18** + **TypeScript** (strict)
- **[Primer](https://primer.style/)** design system for all UI
- **TipTap** (ProseMirror) WYSIWYG editor
- **better-sqlite3** + FTS5 for the search/metadata index

## Requirements

- macOS on Apple Silicon (arm64)
- Node `20.19.x` (see [.nvmrc](.nvmrc))

## Getting started

```sh
npm install
npm run dev
```

## Scripts

| Script                    | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `npm run dev`             | Run the app in development                            |
| `npm run build`           | Typecheck and build the production bundles            |
| `npm run package`         | Build and package an arm64 `.dmg`                     |
| `npm run typecheck`       | Typecheck main, preload, and renderer                 |
| `npm run lint`            | Lint with ESLint                                      |
| `npm run format`          | Format with Prettier                                  |
| `npm test`                | Run unit tests (Vitest)                               |
| `npm run test:e2e`        | Run end-to-end tests headless (Playwright + Electron) |
| `npm run test:e2e:headed` | Run end-to-end tests with the app window visible      |

## Contributing

Read [.github/copilot-instructions.md](.github/copilot-instructions.md) before contributing — it
defines the binding architecture, security, UI (Primer-only), storage, testing, and commit
conventions for this project.

## Distribution

v1 ships an **unsigned** arm64 `.dmg`. On first launch, right-click the app and choose **Open** to
bypass Gatekeeper. Code signing and notarization can be added later (paid Apple Developer Program)
as a build-config change.
