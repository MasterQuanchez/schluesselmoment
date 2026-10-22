---
name: review
description: |
  Grade a build in a fresh context against the spec — generic correctness and plan adherence, plus a
  selective Secure SDL security lane. TRIGGERS: 'review PR', 'review the changes', '/secure-review',
  'secure review', 'security review'.
---

# Review

The verifying half of the loop. **Runs in a context that never saw the build** — the builder is biased
by its own trajectory of justifications. Try to prove the thing is *not* passing.

**Ordering:** review runs **after** `test` and **consumes the tester's artifacts** — test logs,
screenshots, video, the running app. Do not re-run the suite or re-drive the browser when a tester
already did; that is the duplicated browser session that makes gates expensive.

**Verdict, carry-forward and the blocking test** are defined once, in
[`orchestrate`](../../orchestrate/SKILL.md) → "The gate". In short: PASS, PASS WITH NITS (advance), or
FAIL; what blocks is a broken AC this feature owns, not a severity adjective; and the fix list is a
required output.

## Lane A — generic

You see the spec, the plan and the diff — not the implementation conversation.

Grade against the **ACs as of the feature's starting commit** (`git show <sha>:knowledge/specs/F0NN.md`),
not the working tree, so an amended bar is visible rather than silently applied.

What to check:

- **Every owned AC, against its `Proof:` clause.** An AC proved by the presence of source text is not
  proved. This is the recurring failure: a panel that satisfied every HTML contract while rendering at
  height 0; an escalation path parsing a fence no live agent emitted.
- **Vacuous assertions.** Any assertion whose scope comes from an `indexOf`, a substring slice or a
  token `match` must show the scope is non-empty, and the property must survive a mutation test. The
  recurring escape is a test scoped by `indexOf` on a token that no longer exists: the scope resolves
  to `-1`, the assertion runs against a one-character slice, and it passes green.
- **The standing browser suite.** Require its result alongside the unit suite. A browser suite that
  boots a server and a real browser sits outside the default test command on purpose, which means the
  gate is the only thing that keeps it honest — left unrun, it lets a broken acceptance criterion ship
  unnoticed.
- **Correctness, error handling, patterns, obvious performance traps**, and WCAG 2.1 critical items on
  frontend work.
- **Scope**: did it stay inside the plan, and does the diff contain anything the plan did not ask for?
- **Secrets and boundaries**, lightly — hardcoded credentials, unvalidated inputs at boundaries. Leave
  control-ID depth to Lane B.

Don't nitpick what a linter catches, don't relitigate the plan's design decisions, and don't refactor.

**If you find a defect in something the plan put out of scope, raise it as a scope question — do not
render around it.** A defect carried as a nit at three consecutive features because its source was
out of scope is not a nit — it is a scope question that ships broken by default.

## Lane B — security (selective)

Triggered by `/secure-review`, or automatically after Lane A when the plan or diff touches a security
surface. Same fresh-context verifier — no new role.

1. **Identify surfaces** from the plan and diff; prefer the surfaces `plan` already listed.
2. **Open only the matching leaves** via [`../secure-sdl-map.md`](../secure-sdl-map.md) — typically one
   to a few, never all sixteen, never edited. Full-pillar only on an explicit full-scope request.
3. **Apply controls** at or below the target level (default **L2**).
4. **Emit findings** as `[SEV] CONTROL-ID — file:line — leaf — why it violates — minimal fix`.
5. **Verdicts for loaded domains only**, not a forced sixteen-row grid.
6. **Exceptions are explicit.** A control that cannot be met is documented, never silently bypassed.

Do not fix code in this lane unless asked afterwards.

## Handoff

FAIL → `implement`, with the finding list as carry-forward. PASS or PASS WITH NITS → `submit`, with
the nits carried. Security findings go to human triage or to `implement` as fixes.
