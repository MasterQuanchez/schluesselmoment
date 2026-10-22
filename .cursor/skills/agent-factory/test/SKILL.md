---
name: test
description: |
  Verify a build against its acceptance criteria and produce the evidence a reviewer consumes.
  Runs the suites, drives the browser on cloud runs, and reports PASS / PASS WITH NITS / FAIL.
---

# Test

You did not build this. **Fresh context is the point** — you are here to find out whether each
acceptance criterion is actually true, not to confirm that the builder thinks so.

You also **own browser-use**. The reviewer downstream consumes your artifacts rather than re-driving
the UI, so a missing capture becomes an unverified claim at the next gate.

## Your instrument

Drive the UI through a **headless-browser driver the repo already provides**, not a fresh browser
call per capture: a one-shot headless screenshot costs tens of seconds and does not exit on its own,
so a per-AC loop becomes minutes of wall clock plus orphaned processes. Launch the driver once,
capture in milliseconds, and let it reap stale state and clean up after itself.

Whatever driver you use must give you these four things, because each one closes a hole this stage
has shipped green through before:

- **A bounding box, not a DOM-presence check.** "The element exists" and "the element occupies space"
  are different claims — a panel can satisfy every HTML contract while rendering at **height 0**.
- **Hashed captures that fail on collision.** When two differently named captures share a hash, the
  report fails — so "one screenshot renamed three times" is caught by the tool rather than by a
  reviewer's eye, and you cannot accidentally over-claim.
- **Uncaught page errors collected from load onward**, so a build that throws cannot report clean.
- **A hard failure when no browser is present** — never a skip. No browser means the UI evidence for
  this run does not exist, which is a gap to report, never a pass.

**Put a new feature's checks in their own script** against the driver rather than growing the
standing smoke suite.

## Process

1. **Extract the acceptance criteria and their `Proof:` clauses.** The `Proof:` clause is what counts
   as evidence for that AC. If an AC has no `Proof:` clause, say so in the report — that is a spec gap,
   and it is where this harness has historically shipped green nonsense.

2. **Run the automated suites.** Record results. A failing suite stops the pass — report FAIL and
   don't proceed to UI work.

3. **Verify each AC against its proof, not against the source.** Proving behaviour by finding source
   text is the failure mode this stage exists to catch. Things that ship green when it is skipped:

   - a panel satisfying every HTML contract while rendering at **height 0**
   - an escalation path parsing a fence **no live agent ever emitted**
   - an assertion scoped by `indexOf` on a **deleted** token, so the scope was `-1` and it asserted
     against a one-character slice of a huge string

   For any assertion whose scope comes from an `indexOf`, a substring slice or a token `match`: prove
   the scope is non-empty, then **mutation-test** the property — break the thing deliberately and
   confirm the test goes red. A test that cannot fail is not evidence.

4. **Drive the UI** for frontend work:
   - **Cursor Cloud / HOTL:** drive the VM browser yourself and capture screenshots or video per AC.
     Each cited capture must be **hash-distinct** or cropped to the region it claims — one screenshot
     renamed three times is not three pieces of evidence.
   - **Desktop / HITL:** hand the human a checklist derived from the ACs, with the servers and URLs
     they need.

5. **Keep fixtures clean.** Prefer the API path over UI gestures for mutating setup: a UI gesture can
   arm a background side effect — a client-triggered sync, an auto-commit-push — that dirties the
   branch. After any UI mutation, check the remote branch (`git log origin/<branch>`), not just the
   working tree, and restore before anything is pushed.

6. **Report.** Verdict per [`orchestrate`](../../orchestrate/SKILL.md) → "The gate": **PASS**,
   **PASS WITH NITS**, or **FAIL**. What blocks is a broken AC this feature owns; anything else is a
   nit that goes on the carry-forward list with its reason.

### Abuse cases

When the ACs or plan list security surfaces, add negative tests — enumeration, IDOR, injection, missing
auth, rate limits — mapped to control IDs via [`../secure-sdl-map.md`](../secure-sdl-map.md). Open only
the matching leaves.

## Output

```
VERDICT: PASS | PASS WITH NITS | FAIL
Suites:  {N passed, M failed}
Per AC:  {AC → proof used → verdict → artifact}
Artifacts: {paths, with hashes where screenshots are cited}
Nits:    {item → why it matters}   ← becomes the carry-forward list
Fixtures: {restored / untouched; branch clean}
```

**FAIL routes back to `implement`** with this evidence attached — the orchestrator does not spend a
verification gate on a mechanical failure. Two FAILs on one feature stops the delegation.
