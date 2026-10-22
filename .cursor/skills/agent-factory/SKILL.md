---
name: agent-factory
description: |
  Router for the AI-assisted software development lifecycle. Points to the stage skill that
  matches the request.
  TRIGGERS: 'new epic', 'discover', 'plan this feature', 'implement', 'review PR',
  '/secure-review', 'secure review', 'security review', 'run tests', 'submit', 'reflect',
  'retro', 'capture learnings', 'what did this run cost', 'design a page', 'build the UI',
  'design review', 'UI', 'UX', 'frontend', 'check data safety', 'anonymize', 'sensitive data'.
---

# Agent Factory

Stage skills for the SDLC. Each one owns a stage's **bar and invariants**; the loop that sequences
them — who gates, what a gate may let through, and role→model routing — is
[`orchestrate`](../orchestrate/SKILL.md). One source of truth each: a stage skill never restates the
loop, and the loop never restates a stage's bar.

```
discover → plan → implement → test → review → submit → reflect
                     ↑__________|
                  tester FAIL, per orchestrate
```

Enter at any stage. A small fix goes straight to `implement`; a new epic starts at `discover`.

## Stages

| Stage | When |
|---|---|
| [discover](discover/SKILL.md) | a high-level idea that needs requirements and a spec |
| [plan](plan/SKILL.md) | decompose an approved spec into an implementation plan |
| [implement](implement/SKILL.md) | build it |
| [test](test/SKILL.md) | verify against acceptance criteria and produce the evidence |
| [review](review/SKILL.md) | grade it in a fresh context — generic, plus a selective Secure SDL lane |
| [submit](submit/SKILL.md) | align specs, write the PR description, open the PR |
| [reflect](reflect/SKILL.md) | retro: learnings to the spec, harness proposals to the ledger |
| [design](design/SKILL.md) | gateway to the repo's design system for any UI/UX/frontend work |
| [data-safety](data-safety/SKILL.md) | anonymisation and the transit rules for raw material |

**By name only** (no description, so you must ask for them): `debug`, `simplify`,
`sync-to-devops`, [`handoff`](../handoff/SKILL.md), [`grill-me`](../grill-me/SKILL.md).

## Secure SDL

Corporate leaves live under [`../secure-coding/`](../secure-coding/) and are consumed **as-is** —
never edited, never forked. Interpretation and routing belong here.

`plan` → `implement` → `test` → `review` load **only** the leaves their surfaces imply, typically one
to a few. Controls apply at or below the target level (default **L2**), and findings cite control IDs.
A full-pillar pass happens only when the user explicitly asks for a full-scope `/secure-review`.

Surface → leaf routing: [`secure-sdl-map.md`](secure-sdl-map.md).

## Conventions

**Specs** live flat in `knowledge/specs/` as `{E|F}NNN-{name}.md`, linked with relative markdown links,
following [`templates/spec.md`](templates/spec.md) and the [`okf`](../okf/SKILL.md) conventions. They
are the durable state that survives a session ending. Every acceptance criterion carries a `Proof:`
clause; requirements and ACs are the contract, Implementation Notes are append-only — see
[`orchestrate`](../orchestrate/SKILL.md) → "The spec is the contract".

**Product language** comes from a root `GLOSSARY.md` when the repo has one. Use its terms rather
than inventing parallel names, and propose an addition when a new term is load-bearing across two or
more surfaces.

**Handoffs** between stages follow [`templates/handoff.md`](templates/handoff.md). The other
interfaces are [`plan.md`](templates/plan.md), [`pr.md`](templates/pr.md) and
[`decision-log.md`](templates/decision-log.md).

**Project metadata** is in `config.yaml`; development commands are in `AGENTS.md`.
