---
name: reflect
description: |
  Post-run retrospective through two lenses — the implementation, and the harness that produced it. Outputs dated learnings on the spec and numbered harness proposals for the human; never edits the harness itself. Use after review/test/submit, when the user says "reflect" / "retro" / "capture learnings", or when they ask what a run cost.
---

# Reflect

Turn a completed run into durable learning. The builder produced code; this stage asks what the run
taught us, and records it where the next run will see it.

Every retro looks through **two lenses**:

- **The implementation** — did the run build the right thing, and where did it drift?
- **The harness** — did the specs, the brief, the skills and the model routing *let* it? A run that
  shipped well can still have cost twice what it needed to.

The second lens is the one that compounds, and the one a retro skips by default: the code is in
front of you and the instructions that shaped it are not.

> Prompt-shaping: see [`orchestrate`](../../orchestrate/SKILL.md) → "learning".

## Inputs

- The spec, the plan, the diff/PR, and the review + test verdicts
- **The brief** — the launch prompt the session started from, plus the prompt handed to each subagent
- Deviations already logged in the spec's `## Implementation Notes`
- Optionally, the session transcript: `agent-transcripts/`, or the `cursor-cloud` MCP for a cloud run
- Optionally, a Cursor usage export, when the human supplies one

## Process

1. **Gather** — Read the spec, plan, diff and verdicts, and re-read the deviations already logged so
   learnings build on them instead of restating them. Done when every gate verdict in the run is
   accounted for.

2. **Lens one: the implementation** — For each learning, name what happened, the artifact that shows
   it, and why it matters. Cover what worked and should be repeated, where the run drifted from the
   spec and whether the drift was sound, and what surprised the agent or the human. Done when every
   logged deviation has become a learning or been judged a one-off out loud.

3. **Lens two: trace the rework** — Every hand-correction, re-round and carried-forward fix is
   **rework**, and rework has a cause upstream of the builder or it has none. For each one, name the
   cause: the spec, the brief, a skill, the model routing, a house rule — or "builder error, no
   instruction to fix". Rework with an instruction behind it is the finding; the rest is noise.
   Done when every hand-correction and re-round in the run carries a named cause.

   **The brief earns the hardest look**, because it is written once, read by every subagent, and
   reviewed by nobody. Look for an instruction that aimed a builder at the wrong approach; a
   constraint that forbade fixing a defect the run then rendered around; a bar for done that said
   what to build but not what counts as proof; and length that buried the parts which mattered.

4. **Cost the run** — When the human supplies a Cursor usage export, read
   [`cost-analysis.md`](cost-analysis.md) and run its script. Without an export, say the run is
   uncosted rather than estimating: an invented cost gets planned against.

5. **Write the learnings** — Route each one to its home (below) as
   `{YYYY-MM-DD}: **{learning}** — {evidence + why it matters}`. For an epic run, read
   [`epic-retro.md`](epic-retro.md) first; its findings live in a retro document, not in one spec.

6. **Propose, do not apply** — A learning that implies a harness change becomes a numbered
   proposal: what to change, why, expected effect, and the files it touches. Distinguish "improve
   the harness" from "one-off, no change needed". **Do not edit harness files** — the human decides
   which proposals become work, and each approved one goes through `plan` → `implement` as its own
   change.

## Where learnings go

- **Implementation learning** → the spec's `## Implementation Notes`, appended, never rewriting
  requirements.
- **Harness learning** → the standing harness ledger (`knowledge/specs/plan-reflect-*.md`) as a numbered
  proposal, so open harness work has one index.
- **Epic learning that belongs to no single spec** → `knowledge/specs/retro-{EPIC}-{slug}.md`,
  cross-linked from the epic spec and the ledger. Cross-feature seams and harness findings have no
  other home; see [`epic-retro.md`](epic-retro.md).

## Bar for done

Every claim traces to an artifact from the run — a diff, a verdict, a test count, a transcript
entry, a CSV row. A retro is the one artifact nobody verifies afterwards, so an unsourced number in
it survives indefinitely and gets planned against. State the gap instead of filling it.

## Next steps

1. `sync to devops` to persist the updated spec, so learnings are visible on the work item.
2. Hand approved proposals to `plan` with the spec path and the specific proposals to act on.
