---
name: inkwell-release-check
description: Release and merge-readiness checklist for Inkwell. Use when asked to validate a task, prepare a PR, assess production readiness, or explain change risk and impact.
---

# Inkwell Release Check

Use this skill for tasks like:

- "Is this fixed?"
- "Verify PR is ready to merge"
- "Prepare production build requirements"
- "What changed and what are the risks?"

## Required project context

Apply Inkwell's repository constraints from `.github/copilot-instructions.md`:

- Primer-only UI in renderer
- strict Electron security boundaries (typed preload bridge, no direct Node APIs in renderer)
- markdown files as source of truth, SQLite as rebuildable cache
- atomic note writes
- first-class error states

## Workflow

1. Confirm scope from the request and changed files.
2. Check for boundary violations relevant to touched paths:
   - `src/renderer/**`: no `fs`/db/Node APIs, Primer-only UI usage
   - `src/preload/**`: typed bridge only, no business logic
   - `src/main/**`: input validation and explicit error handling for IPC
3. Run only existing project checks needed for confidence (`typecheck`, `lint`, unit tests, and e2e where behavior changed materially).
4. Identify release blockers and classify severity:
   - **blocking**: correctness, security, data-loss, broken core flow
   - **warning**: non-blocking risk that should be tracked
5. Provide a concise readiness verdict and transparent report.

## Output format

Always provide this structure:

- **Verdict:** ready / not ready
- **What changed:** short file-level summary
- **Risk review:** blockers and warnings
- **Validation summary:** what was exercised
- **Next actions:** only concrete follow-ups

If not ready, include exact blocker(s) and the smallest fix path.
