---
name: plan
description: |
  Feature-level planning: read a spec, explore the codebase, produce an implementation plan with
  tasks and a test strategy. Read-only — never writes code.
---

# Plan

Turn an approved spec into a plan a builder can execute without guessing. **Read-only.**

**The orchestrator writes this plan inline.** It is not a subagent stage by default, because an
orchestrator-written locked plan is one of the strongest predictors of a single-round feature —
skipping it is what turns a one-round feature into a three-round one. Spawn a dedicated planner only
when the session model is a light/fast one.

## Bar for done

The plan is ready when a builder could execute it without asking a question, and when every task
names how it will be verified. Specifically:

- **The approach and its key decisions carry rationale**, so a builder hitting an edge case can tell
  which way the design leans.
- **Tasks are one session each** — a few files, a clear scope boundary, dependencies explicit.
- **Every task states its verification method**, matching the `Proof:` clause of the AC it serves. A
  task whose proof is "the code contains X" is not verifiable; that is the failure this bar exists to
  prevent.
- **Deep modules are named.** Look for functionality that can be encapsulated behind a simple,
  testable interface that rarely changes. The best architectural decision is usually one such seam;
  the worst defects are usually code that bypasses it.
- **Security surfaces are listed** when the feature touches any, so `implement` and the review's
  selective lane stay cheap and targeted — see [`../secure-sdl-map.md`](../secure-sdl-map.md) and cite
  the `DES-*` / leaf controls that shape the approach.

## Invariants

- **Never edit code.** Plan only.
- **Plan the volatile parts first** — data models, interfaces, the user-facing surface. Mechanical
  refactors last.
- **A prototype is illustrative, not authoritative.** Plan against the spec text and its acceptance
  criteria; flag a spec/prototype conflict rather than resolving it toward the prototype, and never
  carry mock scaffolding (seed data, `setTimeout` pipelines, in-memory state) into the plan.
- **Reference existing patterns; do not invent conventions.** Use a root `GLOSSARY.md`, when one
  exists, for product language rather than defining terms in the plan.
- **Every epic AC has an owning feature.** Map each one to the feature that owns it *end to end*; an
  AC spanning two features goes to the **last** feature that touches it, or gets its own integration
  gate. An AC that no single feature owns is the classic epic escape — each owning feature passes its
  own gate while the live cross-feature path stays broken.

## Handoff

`implement` expects the plan plus a task, and — in an orchestrated run — the carry-forward list from
the previous gate. Approval is the human's in HITL; in HOTL the orchestrator approves against the
front-loaded intent and logs the plan to the spec's Implementation Notes.
