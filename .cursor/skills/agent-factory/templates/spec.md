# {Title}

- **Type**: Epic | Feature
- **Status**: Draft | Approved | In Progress | Done
- **Parent**: [parent spec](parent-spec.md) or "None (top-level epic)"
- **DevOps ID**: {work-item-id or "pending sync"}

## Context

{Why this exists. What problem it solves. 2-3 sentences.}

{If this spec references a prototype/mockup, include the Prototype authority note below — otherwise delete it.}

> **Prototype authority.** The Requirements and Acceptance Criteria here are the contract; the linked prototype (`prototypes/{name}.html`) is illustrative of interaction and layout only — not an implementation or pixel contract (the visual look is owned by the project design contract / `@wp/agentic-ux-toolkit`). Where the prototype and this spec conflict, the spec wins; flag the conflict rather than following the prototype literally, and don't carry its mock scaffolding (seed data, `setTimeout` pipelines, in-memory state) into the build.

## Requirements

{What must be true when this is done. Requirements and Acceptance Criteria are the **contract**: a
run may *add* to them when it discovers something missing, but weakening or removing one is a scope
decision that gets logged and announced — never a silent edit that lets a build pass.}

### In Scope

- {requirement 1}
- {requirement 2}

### Out of Scope

- {explicit exclusion 1}

## Acceptance Criteria

{Every AC carries a `Proof:` clause naming what counts as evidence. Without it a builder will satisfy
the AC with a search over the source, because that is the cheapest thing that resembles proof — and
that is how a panel rendering at height 0 passed every contract it had.

Good proofs: live DOM with a non-zero bounding box · an API round-trip · a mutation-tested assertion ·
a deterministic script's exit code. Bad proofs: the source contains a symbol; a test passes.

For an **epic**, also name the feature that owns each AC end to end. An AC spanning two features goes
to the last feature that touches it, or gets its own integration gate — an AC no single feature owns
is the one that ships broken while both owning features pass.}

- Given {context}, when {action}, then {outcome}
  **Proof:** {what evidence settles it} {· Owner: F0NN — epics only}
- Given {context}, when {action}, then {outcome}
  **Proof:** {what evidence settles it}

## Features

{For Epics only — link to child features.}

- [F001-feature-name](F001-feature-name.md)
- [F002-feature-name](F002-feature-name.md)

## Implementation Notes

{Chronological log of decisions, deviations, carry-forward reasons and cost figures, written during
discovery, planning and implementation. **Append-only and free** — unlike the contract above, this
half is where a run records what it learned without asking permission. It is the drift ledger the
orchestrator reads to judge whether a deviation was sound.}

- {YYYY-MM-DD}: **{decision or deviation}** — {rationale}
