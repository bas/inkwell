---
applyTo: 'src/renderer/**'
---

# Renderer (React + Primer) rules

- **Primer only.** Build UI with `@primer/react` components, `@primer/primitives` tokens, and
  `@primer/octicons-react`. No hardcoded colors/spacing/fonts. No other UI/icon libraries.
- Wrap rendered markdown output in a `markdown-body` container.
- No `fs`, database, or Node access. Talk to main exclusively through the typed `window` bridge
  exposed by the preload.
- Theme via Primer `ThemeProvider` `colorMode`; respect the persisted light/dark/auto override.
- **Accessibility + testability**: every interactive element has a stable `data-testid` and a correct
  accessible role/name. Use semantic Primer components rather than raw `div`/`span` for controls.
- Model and render error states explicitly (loading / empty / error), not just the happy path.
- Keep components focused; lift IPC calls into a small typed client layer rather than scattering
  `window.api` calls across components.
