---
name: debug
description: |
  Hypothesis-driven debugging. Documents the bug, generates hypotheses, investigates systematically, implements a minimal fix, cleans up instrumentation, and hands back to test.
---

# Debug

Systematic, hypothesis-driven investigation to find and fix bugs.

> Prompt-shaping: convert unknowns to known-unknowns with a blindspot pass, then ground each hypothesis in session evidence — see [`prompting-agents/unknowns.md`](../../prompting-agents/unknowns.md).

## Inputs

One of:
- A failed test result from the `test` skill
- A bug description or error message
- A work item ID with bug context

## Outputs

- A minimal, targeted fix with passing tests
- A handoff using `templates/handoff.md` back to `test` for re-verification

## Process

1. **Document the bug** — Symptom, expected behavior, reproduction steps, affected environment (backend/frontend/both).

2. **Hypothesize** — List 3-5 potential causes ranked by likelihood. For each, specify how to verify it. Common categories: data flow errors, state management, API contract mismatches, race conditions, config issues.

3. **Investigate** — Search the codebase, trace the data flow, collect runtime evidence (console logs, network requests, server output). Narrow to the most likely root cause.

4. **Instrument** — Add targeted debug logs at suspected locations. Use clear markers (`[DEBUG-REMOVE]`) for easy cleanup. Reproduce and analyze the output.

5. **Identify root cause** — Document the location, the issue, why it happens, and the evidence.

6. **Fix minimally** — Make the smallest change that resolves the bug. Run unit tests to verify.

7. **Clean up** — Remove all debug instrumentation. Confirm with the user before cleanup.

8. **Hand off** — Return to the `test` skill for full re-verification.

## Constraints

- Never fix without understanding the root cause
- Never leave debug logs in production code
- Never make sweeping changes — fix minimally
- After 3 genuine attempts, stop and report BLOCKED with exact errors
- Do not weaken tests to make them pass

## Human Checkpoints

- **Server logs** — Human may need to provide runtime logs
- **Cleanup approval** — Human confirms the fix before removing debug logs

## Next Steps

After the fix is committed:
- Run `test work item #<id>` to re-verify the full acceptance criteria suite (not just the fixed scenario).

## Handoff

The `test` skill expects the work item ID and a note about which scenario to re-test and any related scenarios that might be affected.
