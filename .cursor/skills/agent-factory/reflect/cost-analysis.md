# Cost analysis

Reached from [`SKILL.md`](SKILL.md) when the human supplies a Cursor usage export.
[`cost_analysis.py`](cost_analysis.py) does the arithmetic; this file says how to feed it and
what its output means.

## Getting the inputs

**The usage CSV must come from the human.** The dashboard endpoint is behind Cloudflare and
WorkOS, and an injected `CURSOR_API_KEY` is an *agent* key (`crsr_…`) that returns `401` on
`api.cursor.com/teams/*` — only a team admin key (`key_…`) works there. Ask for the export;
do not burn calls trying to fetch it.

> Dashboard → Usage → set the date range around the run → export CSV.

Two optional inputs sharpen the report a lot:

- **Session transcript** — unlocks tool-call volume, the cost unit, and per-phase allocation.
  Fetch with the `cursor-cloud` MCP: `batch-fetch-details` with `include_transcripts: true`.
  It also carries the **subagent ledger** (`task` calls with their requested `model`), which is
  how the report checks routing against billing. Never read the transcript into context — it runs
  to megabytes. The script parses it.
- **The product's own agent transcripts** — if the thing under test runs agents itself, they bill
  against the API key, appear in the CSV with an *empty* Cloud Agent ID, and are invisible in the
  agent view. Point `--app-runs` at their directory to have them counted and matched.

## Running it

```bash
# 1. Which sessions are in this export?
python .cursor/skills/agent-factory/reflect/cost_analysis.py --usage <export.csv>

# 2. Full report for one of them.
python .cursor/skills/agent-factory/reflect/cost_analysis.py \
  --usage <export.csv> \
  --agent bc-<id> \
  --transcript <run-dir>/<bcId>/transcript.json \
  --app-runs <dir of the product's *.jsonl transcripts> \
  --base <base-ref> --rounds f037=3 f038=2 f041=3 \
  --until <ISO instant the run ended> \
  --out knowledge/specs/retro-<EPIC>-cost.md
```

`--base` derives phases from conventional-commit scopes in `<base>..HEAD` (`feat(f041): …` → phase
F041), so per-feature allocation needs no hand-kept boundary list. `--rounds` prices re-rounds.
`--until` matters whenever the same cloud agent has answered a later follow-up: without it, the
follow-up's spend inflates the run you are costing.

## Reading the output

Five blocks. The first three generalise; the last two are run-specific.

**The invoice.** Session spend, the product's own agent runs, and the run's share of the whole
export. This is the number the retro leads with.

**Billing lines by model, and subagents requested versus billed.** Expect the session to bill
entirely under the *orchestrator's* model, with **no line for any subagent model**. Subagent spend
rolls into the parent. The consequence is the one worth writing down: **builder-model routing is
not a visible cost lever, so judge routing on rounds, not on price.** If the report ever shows a
subagent model with its own line, that changed — say so, because it would reopen the question.

**The cost unit.** Cache reads dominate — around 97% of tokens, with output under half a percent.
The cost function is:

> cost ≈ (number of tool calls) × (context size at each call)

That single line reframes optimisation. Standing instruction is re-read on *every* call, so
trimming it is a cost measure; one-line terminal probes are individually priced, so batching them
is too; and a re-round replays a whole gate's call volume, which is why re-rounds are the largest
avoidable line. Quote the `$/tool call` figure in the retro — it makes every verification decision
priceable, and it cross-checks well against a second session on the same harness.

**Where the money went.** Cost allocated per phase by timestamped tool-call volume. The phases tile
the whole session, so every call is priced: a leading `setup` phase catches work before the first
commit, and the last phase runs to the end. Scope-derived boundaries are still a first cut — check
them against the run you remember. Two known distortions: work done *before* a phase's first scoped
commit tiles into that phase, and any gate you ran before committing its verdict lands in the phase
you were gating (so a closing epic gate and the retro inflate the final feature). Say which
boundaries you adjusted and why.

**The app's own agent runs.** If the count matches the CSV's empty-agent-id events, the join is
sound and you can trust the rest. Timestamps typically pair within a minute. A mismatch means
either unrelated local IDE usage in the window or missing transcripts — resolve it before quoting
the line.

## Two things the report cannot tell you

- **Whether an absent subagent billing line means "rolled up" or "not exported".** Compare the
  session's $/hour against sessions in the same export that spawned no subagents. Landing inside
  that band is consistent with roll-up, since an orchestrator's own context re-reads dwarf its
  subagents. The human's invoice is the tiebreaker; ask.
- **What a round *should* have cost.** The re-round estimate charges each phase's own per-round
  rate once, which assumes a clean round costs what a messy one did. It is an order-of-magnitude
  figure. Do not present it as precise, and note that a single-round phase can still be expensive
  when the orchestrator did heavy correction inside it.
