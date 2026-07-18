---
name: inkwell-research
description: Structured discovery and deep evidence gathering for Inkwell. Use for early investigation, feasibility checks, and option framing before planning. Expect a brief requirements grill and a plan-ready handoff.
---

# Inkwell Research

Use this skill when the user is still exploring a problem and wants evidence, constraints, and viable options before implementation planning. This skill elicits and locks requirements before investigating solutions.

## Goals

1. Elicit and lock the real requirements before investigating solutions.
2. Produce a decision-ready, traceable evidence base.
3. Hand off to planning with a requirements lock, owned open decisions, and a plan-ready backlog.

## Model and credit policy

- Start with an efficient model tier, but **default to deeper research**: exhaust the repo, relevant docs, and external sources before stopping.
- Escalate if any of the following is true:
  - requirements remain ambiguous after the discovery phase
  - the task crosses multiple architecture boundaries with non-obvious tradeoffs
  - earlier attempts produced conflicting conclusions
  - the research question touches user-facing behavior, security, data integrity, or persistence
- If escalation happens, state the reason in one short line.
- Efficiency means avoiding redundant work, not skipping depth.

## Research workflow

1. **Confirm question and outcome.** Restate the research question and the decision the user needs to make.
2. **Bound scope.** Define affected areas, out-of-scope areas, assumptions, and constraints.
3. **Discovery / requirements grill.** Before gathering solution evidence, elicit:
   - user/stakeholder goals and anti-goals
   - functional and non-functional requirements (performance, security, accessibility, macOS conventions)
   - explicit constraints and assumed constraints
   - risks and unknowns that could invalidate options
   Stop when requirements are stable enough to evaluate options. Ask focused questions in small batches (up to three at a time) only for information you cannot retrieve yourself; otherwise investigate.
4. **Deep evidence gathering.** Collect evidence that directly tests the requirements and options:
   - code paths, existing patterns, and prior art in the repo
   - relevant docs, ADRs, or product specs
   - external references (API docs, library behavior, Electron/macOS specifics)
   - counter-evidence that could invalidate the preferred option
   Reuse existing findings from the session instead of re-running broad searches.
5. **Synthesize.** Map each requirement to the evidence; identify conflicts and gaps.
6. **Second opinion.** Request a second opinion from the built-in `rubber-duck` sub-agent on requirements coverage, evidence strength, options, and recommendation.
7. **Finalize.** Produce the output contract below.

## Clarification discipline

- During discovery, ask up to three focused, unresolved questions at a time. Stop asking once requirements are locked.
- Never ask for facts you can retrieve from the repo/tooling/docs yourself.
- If blocked by missing product direction, present a recommended default, the consequences, and ask for confirmation or override. Do not silently assume.

## Output contract (required)

Return exactly these sections:

- **Research question:** what was investigated and the decision it must support.
- **Scope & assumptions:** in/out boundaries and assumptions that shaped the research.
- **Requirements lock:** numbered requirements with IDs, each marked Must / Should / Won't, plus constraints and anti-goals. Format: `REQ-01 (Must): description`.
- **Evidence traceability:** for each finding, cite the source (file path, doc link, external reference, or prior session finding). Format: `EV-01 → source: claim`.
- **Options & tradeoffs:** 2–4 viable paths, each scored against the requirements lock. Include feasibility, risk, and estimated cost/complexity.
- **Recommendation:** preferred option, rationale tied to requirements and evidence, and explicit rejection of other options.
- **Open decisions & owners:** decisions still unresolved, who must make them (user / product / another session), recommended default, and impact if deferred.
- **Plan-ready backlog:** ordered implementation slices/stories with acceptance criteria that the `inkwell-plan` skill can turn into an execution contract.
- **Handoff to plan:** summary of what is locked, what is open, and what the planning phase must resolve first.

Keep it complete enough to plan from, but concise. Every claim must be traceable to evidence.
