---
name: inkwell-plan
description: Convert research into a tight, credit-conscious implementation contract for Inkwell.
---

# Inkwell Plan

Use this skill after research has produced a preferred direction and the user wants a concrete implementation plan before coding.

## Goals

1. Translate research into an execution-ready contract.
2. Resolve only the decisions required to implement safely.
3. Minimize costly back-and-forth during implementation.

## Model and credit policy

- Default to an efficient model tier.
- Escalate only for high-risk architecture decisions or persistent unresolved ambiguity.
- Never escalate just to produce longer prose.

## Planning workflow

1. Ingest research handoff and restate assumptions.
2. Identify the minimal set of unblocked decisions (the frontier).
3. Resolve decisions in dependency order.
4. Define implementation slices that can be executed and verified incrementally.
5. Produce deterministic validation steps tied to changed behavior.

## Clarification discipline

- Ask one question at a time only when a missing decision blocks planning.
- Where a reasonable default exists, propose it and continue.
- Do not reopen decisions already settled in research unless new evidence invalidates them.

## Second-opinion requirement

- Before finalizing output, request a second opinion from the `rubber-duck` agent on scope, slices, validation, and risk coverage.
- Incorporate high-signal feedback or explicitly state why feedback was not applied.

## Output contract (required)

Return exactly these sections:

- **Scope:** in/out boundaries
- **Files and surfaces:** expected paths/components touched
- **Implementation slices:** ordered steps with dependencies
- **Validation plan:** targeted checks only
- **Risk and rollback notes:** key failure modes and mitigation
- **Ready for implementation:** yes/no with blocker list if no

Be brief and concrete. This plan is the contract for the implementation phase.
