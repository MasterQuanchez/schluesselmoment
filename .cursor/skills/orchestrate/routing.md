# Routing

Why a role gets a model. The numbers are in [`models.toml`](models.toml); this is the reasoning.

## Route by verifiability

Not by task size, and not by "is this frontend". The question is **what it costs to check the work**:

| Work shape | Gate cost | Route to |
|---|---|---|
| Server contracts, pure mappers, schema, resolvers — ACs a deterministic script can check | cheap | `implementer`. The gate is a `node` script, so a round is affordable |
| Live UI geometry, agent round-trips, escalation, taste | expensive | orchestrator-planned and orchestrator-verified, or built inline. The gate costs a browser session either way, so pay for one-round-correct |

This works only if the spec says what counts as proof. An AC without a `Proof:` clause routes badly
by construction, because "checkable by a deterministic script" is a property the spec has to state.

## Why not price, size, or taste

- **Price is not a visible lever.** When a session's bill is dominated by cache reads, subagent
  model price barely moves it — how the subagents were routed is unauditable and small against that
  total. Route for correctness, not for a saving you cannot measure.
- **The variable cost is rounds.** Verification is a fixed cost per feature — builder-never-grades
  applies at every tier — so a cheap builder pays for itself when the spec and the carry-forward list
  get it to one round, and is strictly worse than building it yourself when it needs three.
- **A taste tier rarely earns its keep.** Escalating to a higher-taste model does not reliably buy
  first-pass success. What predicts a single-round feature is how much prior verification was written
  down for the next builder, not the model tier.

## The real cost function

```
cost ≈ (number of tool calls) × (context size at each call)
```

When a session's tokens are dominated by cache reads and its tool calls by terminal probes, two
consequences follow:

- **Standing context is paid on every call.** Trimming instruction the orchestrator never acts on is a
  cost measure, not tidiness.
- **Batch probes.** Two hundred one-line terminal calls that could have been one script have a price.

Report tool-call count per gate, so a re-round is visibly expensive at the moment you decide to spend
one.

## Cursor's gotchas

- **One level of subagents.** No nesting, so a feature's loop cannot itself spawn a loop. This is why
  `implement` and `test` are two sibling subagents rather than a nested pair.
- **A requested model can be silently overridden.** Legacy request-based plans run subagents on
  Composer regardless; admin model-blocks and Max-Mode-only models also override. If a route looks
  ignored, check the plan and the policy before blaming the prompt.
- **Name the role and the model on every spawn.** Cursor routes subagents from the spawn call, not
  from a config file, so an unnamed model silently falls back to the session/plan default. The
  resolution order — user-named models for the run first (mapped to a session-available slug), else
  [`models.toml`](models.toml) by role — is in [`orchestrate`](SKILL.md) → "Spawning".
- **Effort is fixed at session start and at spawn** — never a mid-run knob.
