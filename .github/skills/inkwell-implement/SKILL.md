---
name: inkwell-implement
description: Execute approved Inkwell plans with disciplined model usage, targeted validation, and clean handoff reporting.
---

# Inkwell Implement

Use this skill when the user has an approved plan and wants execution with high correctness and controlled AI credit usage.

## Goals

1. Deliver complete, scoped changes that follow Inkwell boundaries.
2. Keep model/tool usage efficient without compromising correctness.
3. Avoid rework by validating only what changed, at the right depth.

## Model and agent routing policy

- Use an efficient model tier for mechanical edits and straightforward code paths.
- Escalate model only if:
  - repeated attempts fail on the same blocker
  - the change is cross-cutting and architecture-sensitive
  - correctness remains uncertain after targeted checks
- For complex scoped implementation work, you MUST delegate to the custom `inkwell-implementation-engineer` agent before making edits.
- Log escalation in one short line when used.

## Execution workflow

1. Confirm the approved plan contract and scope boundaries.
2. Implement in ordered slices from the plan.
3. Reuse existing helpers/patterns before adding new abstractions.
4. Run the smallest targeted checks that validate changed behavior.
5. Stop when scope is complete and results are verified.

## Efficiency guardrails

- Batch related file reads/searches/tool calls.
- Avoid repeating broad scans after small edits.
- Avoid full-suite runs unless targeted checks indicate need.
- Keep user-facing summaries compact and decision-focused.

## Output contract (required)

Return exactly these sections:

- **Implemented:** what was changed
- **Validation:** what was exercised (targeted)
- **Escalation log:** none / short reason
- **Remaining blockers:** none / concrete blocker
- **Next handoff:** release-check or follow-up implementation item

If blocked, report the smallest viable unblock path.
