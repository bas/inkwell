---
name: inkwell-research
description: Cost-aware discovery for Inkwell. Use for early investigation, feasibility checks, and option framing before planning.
---

# Inkwell Research

Use this skill when the user is still exploring a problem and wants evidence, constraints, and viable options before implementation planning.

## Goals

1. Build shared understanding of the problem quickly.
2. Produce decision-ready findings with minimal token/tool waste.
3. Hand off cleanly to planning without re-research.

## Model and credit policy

- Start with an efficient model tier.
- Escalate only if one of these is true:
  - unresolved ambiguity remains after one clarification round
  - the task crosses multiple architecture boundaries with non-obvious tradeoffs
  - earlier attempts produced conflicting conclusions
- If escalation happens, state the reason in one short line.

## Research workflow

1. Confirm the exact research question and desired outcome.
2. Bound scope tightly (affected areas, out-of-scope areas, assumptions).
3. Gather only the evidence needed to answer the question.
4. Reuse existing findings from this session instead of re-running broad searches.
5. Stop when evidence is sufficient for an implementation decision.

## Clarification discipline

- Ask at most one unresolved question at a time.
- Do not ask for facts you can retrieve from the repo/tooling yourself.
- If blocked by missing product direction, present a recommended default and proceed.

## Second-opinion requirement

- Before finalizing output, request a second opinion from the built-in `rubber-duck` sub-agent on the findings, options, and recommendation.
- Incorporate high-signal feedback or explicitly state why feedback was not applied.

## Output contract (required)

Return exactly these sections:

- **Question:** what was investigated
- **Findings:** concise, evidence-backed points
- **Options:** 2-3 viable paths with tradeoffs
- **Recommendation:** preferred path and why
- **Handoff to plan:** decisions already made, decisions still open

Keep it compact and actionable.
