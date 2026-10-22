---
name: orchestrate
description: >-
  Run work as an orchestrator over subagents — the loop, the gate, and role→model routing.
  Use when spawning subagents, taking a feature or an epic end to end, deciding what a gate
  may let through, or recovering a run that drifted.
---

# Orchestrate

**One level of subagents, no nesting.** Cursor gives you exactly one, so every strategy here is
that single primitive arranged differently. What changes between them is *who gates* and *which
stages share a context* — never the set of skills.

**The gate is the expensive unit, not the token.** Re-rounds dominate the bill; the builder's model
price barely registers against them. Everything below optimises for landing a feature in one round.

## The loop

| Stage | Who | Why there |
|---|---|---|
| plan | orchestrator, inline | the plan is locked before anything spawns — an orchestrator-written plan is one of the strongest predictors of a single-round feature |
| implement | subagent | carry-forward injected verbatim |
| test | subagent, **fresh context** | the builder never tests its own work |
| verify | orchestrator | runs only once the tester says PASS |

Routing:

- **Tester FAIL → a fresh `implement` subagent**, carrying the tester's evidence. No orchestrator
  gate is spent on a mechanical failure.
- **Two tester FAILs on one feature → stop delegating.** Re-plan it or build it yourself. A third
  attempt on the same prompt is the loop that eats the session.
- **Tester PASS → orchestrator verify.** One gate is what a healthy feature costs.

Delegate reading, keep judgment: fan broad codebase reconnaissance out to `explorer` subagents and
fold their findings in. Interview, planning and drift calls stay with the orchestrator.

## Spawning: name the model explicitly

Cursor routes a subagent from the spawn call itself — there is no per-agent config file — so **every
spawn names its model explicitly**. A spawn that leaves the model implicit falls back to the session
or plan default, which is exactly how a builder lands on the wrong tier without anyone choosing it.

Resolve the model in this order:

1. **User-named models for this run.** When the user specifies models for a HOTL workflow — per role
   ("plan on Opus, implement on Grok") or per stage — map each name to the exact model slug available
   in *this* session and pass that slug on the spawn. If a named model is not available in the
   session, say so and pick the nearest available tier rather than substituting silently.
2. **Otherwise, [`models.toml`](models.toml) by role.** Resolve role→model from the table and pass
   that slug explicitly too — never rely on an implicit default even when it would match.

The **orchestrator** is the exception: it is whatever model the session was started with — a launch
decision, not a spawn parameter. It names the model for every subagent it spawns; it cannot rename
itself mid-run.

## The gate

Three verdicts, shared by tester and verifier:

| Verdict | Meaning |
|---|---|
| **PASS** | every owned AC verified, nothing carried |
| **PASS WITH NITS** | every owned AC verified; nits logged and carried — **the loop advances**. The expected outcome |
| **FAIL** | an AC this feature owns is unverified or broken |

**What blocks is scope, not severity.** Does it break an acceptance criterion this feature owns? Then
FAIL. Otherwise it is a nit: log it, carry it, move on. Severity adjectives are how a run gets stuck;
an AC reference is checkable.

**A nit carried twice becomes a scope question.** The third sighting is not a third nit, it is a
deferred task — raise it as an AC addition or an explicit won't-fix, logged either way. A nit that
rides the carry-forward list silently from feature to feature is a defect that ships broken.

**Scrutiny scales with scope.** The wider the run, the higher the bar for spending a round: an epic
session protects its remaining context for feature work rather than perfecting feature one. Nits
accumulate on the carry-forward list and land as a batch or as ACs.

## Carry-forward

Every gate outputs the fix list for the next builder — each unresolved nit, deferred item and
hand-correction, **with its reason**, injected verbatim into the next `implement` prompt.

This is not optional and not a courtesy. It is the strongest correlate with first-pass success on
record: a feature that lands in **one round** is almost always one whose carry-forward list told the
builder exactly what the last gate found. Skip it and the same defect returns gate after gate.

## The spec is the contract, and half of it is amendable

An epic adapts by amending its specs between features rather than executing a stale plan. The two
halves have different rules:

- **Requirements and Acceptance Criteria — the contract.** Add an AC when a feature reveals a missing
  one. Never weaken or delete one to let a build pass: that is a scope decision, logged and announced.
- **Implementation Notes and Decisions — append-only and free.** Mid-epic learning, drift calls,
  carry-forward reasons, cost figures.

**Verify against the ACs as of the feature's starting commit**, not the working tree —
`git show <sha>:knowledge/specs/F0NN.md`. The orchestrator plans, may amend, and grades, so reading the
bar it started from is what keeps that honest. One command per gate.

## Strategies

| Strategy | Who gates | Shape |
|---|---|---|
| **HITL** (default) | human, at every documented checkpoint | one stage per request; checkpoints block and wait. Use while decisions are still open |
| **Feature HOTL** | orchestrator inside a feature, human between features | the full loop runs per feature, then hands back. Stages may each be a subagent for granular routing |
| **Epic HOTL** | orchestrator throughout, human at the epic boundary | features run back to back; specs amend between them; nits ride the carry-forward list |

HOTL is opt-in and explicit — "e2e", "run the full loop", "autonomous", "don't stop to ask". It
relaxes *convenience* checkpoints only. **Hard gates hold in every strategy:** irreversible or
external actions, and a genuine scope change.

Pause only for those. Otherwise make the call, log it, and keep going.

## Verification

**The builder never grades its own work** — a build is biased by its own trajectory of
justifications, so grading happens in a context that never saw it. In Cursor a spawned subagent is
already isolated, so this costs a separate subagent, not a new session. Point it at real output and
have it try to prove the thing is *not* passing.

**One browser pass, not two.** The tester drives the browser and captures the artifacts; the verifier
consumes them. On Cursor Cloud the artifacts are the evidence, because the user cannot open raw HTML
there — a cloud run that skips capture is making an unverified claim. On the desktop, leave visual
checking to the user.

**A builder-produced screenshot is not evidence.** Neither is an assertion whose scope came from an
`indexOf`, a substring slice or a token `match` without proof the scope is non-empty — that has
shipped green three times across two epics.

**Ground every claim in a tool result from this session.** A claim written from memory rather than
from the run's artifacts gets the facts wrong, and a wrong fact in a verdict or retro gets planned
against.

## Bar for done

No adjectives — "high quality" stops at the agent's idea of good enough, below yours. Give a
concrete, checkable bar. If you cannot measure it, hand *that* problem over and let the agent invent
the measuring stick.

**House rules** are the handful of things that must hold however the goal is reached: an
underspecified goal plus house rules is what makes autonomy safe. Example: don't hard-code a special
case for one input — describe the behaviour and let the agent reason.

## Reference

- Role→model, the verifiability rule, and Cursor's routing gotchas →
  [`routing.md`](routing.md) (numbers in [`models.toml`](models.toml))
- Finding your unknowns before a run → [`discover/unknowns.md`](../agent-factory/discover/unknowns.md)
- Stage bars and invariants → the [`agent-factory`](../agent-factory/SKILL.md) stage skills
- Learnings are captured at the end by [`reflect`](../agent-factory/reflect/SKILL.md), not scattered
  mid-run
