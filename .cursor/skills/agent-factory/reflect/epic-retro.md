# The epic retro document

Reached from [`SKILL.md`](SKILL.md) when the run was an epic — several features, several subagents,
several gates. A feature retro fits in the spec's Implementation Notes; an epic retro does not,
because its most valuable findings are about the *seams between* features and about the harness,
and neither belongs to any one spec.

Write it to `knowledge/specs/retro-{EPIC}-{slug}.md`. Then cross-link it both ways: a dated `### Reflect`
entry in the epic spec pointing at it, and the condensed proposals indexed on the standing harness
ledger. The retro carries the reasoning; the ledger stays the single index of open harness work.

## Extra legwork an epic retro needs

**Build the subagent ledger before writing a word about models.** Every claim about which model
built what must come from the session transcript's `task` calls, never from memory — memory
misattributes, and a wrong attribution inverts the conclusion. [`cost_analysis.py`](cost_analysis.py)
prints the ledger grouped by requested model when given `--transcript`. Report each feature's
builder *per round*, since escalation changes the model mid-feature.

**Count gates, not tokens.** A gate is the expensive unit: it costs a full verification pass whatever
model built the code. So the number that matters per feature is **rounds**, and the headline metric
is the first-pass rate. Report rounds and hand-corrections per feature in one table.

**Hunt the seams.** Any defect the *epic* pass caught that no feature gate caught is the highest-value
finding in the retro, because it is structural: a contract split across two features gets verified
half by each and end to end by neither. Name the two features and the contract for each one.

## Section shape

| Section | Must contain | Fails when |
|---|---|---|
| What shipped | Commit count, diff size, test-count delta, surfaces retired — facts only | It argues |
| Model quality, feature by feature | Rounds table with per-round builder from the transcript; first-pass rate | Attribution is from memory |
| Did escalation help | Rounds before and after escalating, and what *actually* cut rounds | It assumes the answer |
| The orchestrator as planner | Self-assessment: decomposition, what was improvised, what was let slide | It is flattering |
| Were the specs sufficient | Separate "what to build" from "what counts as proof" — they fail differently | Treated as one question |
| Did the brief misdirect | Rework traced to the instruction that caused it (see SKILL.md) | Only the specs are examined |
| What blocked the best work | Harness instructions the run had to work around, break, or ask to override | It lists only nice-to-haves |
| Architecture as a foundation | What the next app should copy, and what it must not | Only praise |
| Golden path verdict | Whether this bundle is ready to be a template, and what is missing | Hedged into uselessness |
| Cost assessment | The script's output, read per [`cost-analysis.md`](cost-analysis.md) | Numbers without conclusions |
| Proposals | Numbered P-items, each with evidence, expected effect, and files | Proposals without evidence |
| If I ran this again | The two or three changes with the largest expected effect | A list of everything |
