---
name: implement
description: |
  Build a feature or fix test-first: failing tests, minimum passing code, conventional commits.
  Operates from a plan task, a work item, or a direct description.
---

# Implement

Build the task. You are the builder, so you do **not** grade this work — a separate tester in a fresh
context does that, and a separate verifier grades the tester. Your job is to make the acceptance
criteria true and to leave evidence a tester can check.

## Inputs

- A plan task, a work item ID, or a direct description
- The spec's acceptance criteria, each with its `Proof:` clause
- **The carry-forward list** from the previous gate, when one exists

## Process

1. **Read the requirement.** Extract what must be built and the acceptance criteria it must satisfy.
   Ask before coding if the requirement is genuinely ambiguous; do not guess at architecture.

2. **Work the carry-forward list first.** Every item is a nit, deferred cleanup or hand-correction from
   an earlier gate, and each carries the reason it matters. Fix it, or state explicitly why it is being
   deferred again. An item silently dropped comes back as a scope question two gates later.

3. **Create a feature branch** with a descriptive name.

4. **Write the failing tests first.** Assert observable outcomes, not implementation details, and run
   them to confirm they fail before you write the code. Order matters here for a specific reason: a
   test written *after* the code tends to be shaped to pass it, and the most common failure in this
   harness is a test that asserts nothing and goes green.

   A test whose scope comes from an `indexOf`, a substring slice or a token `match` must prove the
   scope is non-empty. A slice that resolves to `-1` asserts against nothing.

5. **Implement the minimum that passes.** Follow the patterns already in the codebase. No gold-plating,
   no refactoring outside the task, no new dependencies the plan did not name.

6. **Verify.** Run the full suite and the linter. Fix regressions you caused.

7. **Commit and push.** Conventional messages, one logical change each, no force push, no amend.

### Secure development

When the plan lists security surfaces — or you hit one it missed — open **only** the matching leaves via
[`../secure-sdl-map.md`](../secure-sdl-map.md), apply their controls, and cite control IDs
(`SECRETS-1`, `ENC-2`) where one shaped the code. Add any surface the plan omitted to your handoff so
the review's security lane stays targeted.

## Invariants

- **Stay in scope.** A defect you find outside the task is a finding for the handoff, not a fix — and
  not something to render around either.
- **Write code that reads like the surrounding code**: its comment density, naming and idiom.
- **Three failed attempts at the same problem is a report, not a fourth attempt.** Say what you tried,
  what the failure was, and what you think it needs.

## Output

```
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED
Tests:  {N passed, M failed}
Commit: {short sha} {message}
Carry-forward addressed: {item → how, or item → deferred because …}
Findings out of scope: {defects seen but not fixed, or none}
Concerns: {if any}
```

`test` runs next, in a fresh context, against the acceptance criteria and their `Proof:` clauses.
