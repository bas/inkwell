<!--
Keep PRs small and task-scoped: one logical change per PR.
Title should follow Conventional Commits, e.g. `feat(storage): atomic note write`.
-->

## Summary

<!-- What does this PR do, and why? One or two sentences. -->

## Motivation / Context

<!-- The problem being solved. Link the issue if one exists. -->

Closes #

## Changes

<!-- Bullet the notable changes. Keep them focused and in scope. -->

-

## Screenshots / Recordings

<!-- For UI changes, include before/after in light and dark mode. Delete if not applicable. -->

## Testing

<!-- How did you verify this works? -->

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Unit tests (Vitest) added/updated and passing
- [ ] E2E (Playwright) added/updated where relevant
- [ ] Manually verified on macOS (arm64)

## Checklist

- [ ] Change is **task-scoped** — one logical change, no unrelated refactors
- [ ] Commits follow **Conventional Commits** and history is clean
- [ ] UI built with **Primer** components, primitives (tokens), and Octicons only — no hardcoded colors/spacing/fonts
- [ ] Electron security preserved (`contextIsolation`/`sandbox` on, no `fs`/db/Node in renderer, IPC inputs validated)
- [ ] Note writes stay atomic and the SQLite index remains rebuildable from `.md` files
- [ ] Error states handled, not just the happy path
- [ ] Interactive elements have stable `data-testid` and correct accessible role/name
- [ ] Docs updated if behavior changed
- [ ] Stayed in scope (macOS arm64 only; no GitHub interop or image embedding)
