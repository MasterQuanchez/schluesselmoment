# AI-Native Software Development

The single guide to what this repo is about: how we build software when capable
coding agents do most of the typing, and humans stay accountable for intent and
outcome. It consolidates what used to live in three separate documents into one.

If you read nothing else, read [Core principles](#core-principles) and
[The workflow](#the-workflow).

---

## What this repo is

`ai-first-dis` is an AI-first development template for agentic and traditional apps. It
ships:

- A **structured SDLC** operated through Cursor skills - the **agent-factory** collection
  (`.cursor/skills/agent-factory/`), one skill per phase (discover, plan, implement,
  review, test, debug, submit, reflect, sync-to-devops, design, simplify).
- An **orchestration layer** on top - the **orchestrate** skill
  (`.cursor/skills/orchestrate/`) that runs the loop over subagents, owns the gate and
  carry-forward, and routes each role to a model (naming it explicitly on every spawn), so the
  workflow doesn't depend on every user being a prompt engineer.
- A **design system** for all UI/UX/frontend work - the **wp-agentic-ux-toolkit** (WP CI /
  Dojo), reached through the `design` skill so agents compose from tokens and patterns rather
  than hardcoding styles.
- **Specs as a knowledge graph** (`knowledge/specs/`) and optional **Azure DevOps** traceability.
- **data-safety & compliance** - Cursor hooks plus the `.sensitive/` vault and `data-safety`
  skill for GDPR / BDSG (runtime guardrails around the agent).
- **Secure SDL harness** - a vendored copy of corporate secure-coding leaves under
  `.cursor/skills/secure-coding/`, wired selectively into agent-factory
  (`plan` → `implement` → `test` → `review` Lane B). Control IDs and domain verdicts without
  loading Oscar's always-on Cursor compiler.

The premise: as models get better, output quality is bottlenecked by *your* unknowns and
*your* routing choices, not by the model. So the repo's job is to close those gaps and keep
a human accountable at the boundaries that matter - not to out-clever the model.

## The shift (orientation, not prophecy)

We don't need to predict dates to design well. One durable observation is enough: as agents
absorb implementation, effort moves to the **ends** of the lifecycle.

| Phase | Traditional | AI-native |
|---|---|---|
| **Intent** - what needs building | thin | the primary craft: framing, constraints, acceptance criteria |
| **Implementation** - writing the code | most of the work | increasingly delegated to agents |
| **Validation** - does it meet intent | thin | a capacity constraint: review + testing must scale |

What matters *more*: forming clear intent, and validating outcomes. What matters *less*:
typing speed, syntax recall, manual boilerplate. The craft shifts from *writing code* to
*shaping intent and validating outcomes* - and, increasingly, *orchestrating agents*.

Treat this as a direction to lean into, not a fixed roadmap. The governance in this repo
(human checkpoints, specs, audit trails) is designed to hold regardless of how fast the
capability curve moves; the prompting technique is expected to adapt.

## Core principles

1. **AI augments, it does not replace.** Treat a coding agent as an over-confident, very
   fast pair programmer. Human leads, AI executes. Verify everything - its failures are
   inhuman (hallucinated APIs, subtly wrong logic).
2. **Context is king.** Most of the craft is managing what the agent knows: `AGENTS.md`,
   `.cursor/rules/`, the right `@files`, and a clean conversation. When a chat stops being
   useful, reset context.
3. **Capability amplifies expertise.** Your prompts inherit your judgment. Domain knowledge,
   not prompt tricks, is what makes the output good.
4. **Hand a goal, not steps.** Every dictated step overrides the agent's judgment with
   yours. Give the reason and the bar; let it find the path.
5. **The builder never grades its own work.** Whatever builds a thing is biased toward its
   own trajectory. Verification runs in a fresh context against the real output.
6. **Humans stay accountable at the boundaries.** Irreversible or external actions (git
   push, PR, DevOps items) are human-gated or pre-authorized once, never silently automated.

---

## The workflow

Two entry points, one language. Mix them: prototype Solo, formalize with the factory.

### Solo developer

Cursor's native loop, for personal projects and fast iteration:

1. **Research** with Ask Mode. 2. **Plan** with Plan Mode (a thinking model).
3. **Build** in Agent Mode. 4. **Test** (write unit tests if the agent didn't).
5. **Review** with Cursor's Agent Review in Source Control. 6. **Debug** with Debug Mode.
7. **Ship** with `submit`. 8. Optionally `sync to devops`.

### Team workflow (agent-factory)

A structured SDLC with work-item tracking, human checkpoints, and traceability:

```
discover -> plan -> [sync-to-devops] -> implement -> test -> review
                                                          |
                                                   [fail] -> debug -> test
                                                          |
                                                   [pass] -> submit -> [sync-to-devops] -> reflect
```

Enter at any point: small changes skip to `implement`; large features start at `discover`.
Inner loop order is deliberate: **test precedes review** so the fresh-context reviewer
consumes tester artifacts rather than re-running them.
The **spec** (`knowledge/specs/`) is the durable contract across sessions; each stage appends
decisions and deviations to **Implementation Notes**. Skill-to-skill handoffs
(`templates/handoff.md`) document inputs and outputs within a run.

| Skill | Purpose | Invocation |
|---|---|---|
| **discover** | Interview-driven requirements | "discover requirements for X" |
| **plan** | Decompose into an implementation plan; list security surfaces when relevant | "plan this feature" |
| **implement** | TDD build with branch/commit/PR; selective Secure SDL leaves | "implement F001" |
| **test** | Verify acceptance criteria; selective abuse cases when surfaces apply | "test work item #456" |
| **review** | Lane A generic correctness; selective Lane B Secure SDL when surfaces apply | "review PR #123" / `secure review` |
| **debug** | Hypothesis-driven bug fix | "debug TypeError in auth" |
| **submit** | Align specs, open PR | "submit" |
| **reflect** | Post-run learnings to spec; propose harness improvements | "reflect" / "capture learnings" |
| **sync-to-devops** | Specs <-> Azure DevOps | "sync E001 to devops" |
| **design** | UI/UX via the WP toolkit | "design a page" |
| **simplify** | Post-implementation cleanup | "simplify recent changes" |

---

## The orchestration layer

The stage skills define *what* each phase does and its bar. **orchestrate** defines *how* the
loop runs over them - who gates, what a gate may let through, carry-forward between rounds, and
role→model routing. It is human-gated by default: you still start and approve the run.

**You do not have to be a prompt engineer.** The skill runs the shaping sequence; the human's
job is narrower. Division of labour:

- **The skill does the mechanical shaping** - locates the stage and role, drafts the four
  components (context, request, output format, constraints), proposes the model routing, and
  sets up the fresh-context verifier.
- **You supply what only you know** - your starting point and known unknowns; the answers to
  its grill (architecture-first, one question at a time); the hard bar for done; and final
  approval of the prompt and model before the run.

For reference, the sequence the skill runs is: locate the stage -> align (close unknowns) ->
write the four components -> set the gates -> route the run.

**Durable core:** close *your* unknowns, set a *hard* bar, name a *fresh* verifier. These
survive any model generation because they encode the human's knowledge gaps and the org's
trust boundary - not model-capability crutches.

**How it plugs in without duplication:**

- Each stage skill carries a one-line `Prompt-shaping:` pointer into the relevant
  `orchestrate` section - the single integration seam.
- Depth lives in `agent-factory/discover/unknowns.md` (finding unknowns) and `orchestrate/SKILL.md`
  (the loop, the gate, carry-forward, strategies, bar for done).
- Role->model routing lives in `orchestrate/routing.md` (the reasoning); the numbers and the
  swappable role mapping are in `orchestrate/models.toml`. Skills refer to *roles*, never model
  names, and the orchestrator names the model explicitly on every spawn.

Expect this layer to **shrink** over time: as models do more by default, an instruction for
it becomes redundant and should be pruned. The governance scaffolding stays; the technique
adapts.

### How it fires in practice

There is **no silent prompt-rewriter**. Cursor loads a skill when your message matches its
description, then the agent follows it. The layer engages three ways, least to most
automated:

- **Mode 1 - direct stage command (passive shaping).** A plain command runs the stage; its
  inline pointer makes the agent apply the principles *while executing*. Your sentence isn't
  transformed. Example: `implement T2 from the plan`.
- **Mode 2 - meta prompting (the agent helps you write the prompt).** You ask for a launch
  prompt; orchestrate runs its shaping pass, may grill you one question at a time, and
  hands back a launch prompt or spec to approve. Example: `help me prompt this: <rough idea>,
  then show me the launch prompt before running it`.
- **Mode 3 - orchestrator delegating to subagents (active transformation).** The
  orchestrator writes each subagent's spawn prompt and routes its role->model from
  `models.toml`. The transformation is real, done by the orchestrator agent. Example:
  `orchestrate F001 end-to-end: run plan -> implement -> test -> review as subagents`.

### Authoring an orchestrator run (Mode 2 -> Mode 3)

Mode 2 is the natural way to *draft* a Mode 3 run. You use the shaping pass to write the
orchestrator launch prompt, review it, then hand it to an orchestrator (ideally a cloud
agent) to execute.

```bash
help me shape an orchestrator launch prompt to run F001-dashboard-api
end-to-end, human-on-the-loop, then show it to me before I run it
```

orchestrate then, on your behalf:

- **Aligns** by running the `discover` grill *once, up front* - the architecture-shaping
  unknowns and what "done" means. The output is the spec, which becomes the run's contract.
- **Writes** context / goal-not-steps / output format / constraints.
- **Sets the gates** - the hard bar, the fresh-context verifier, and which actions are
  pre-authorized versus still stop for you.
- **Routes** each subagent's role->model from `models.toml`.

The output *is* the Mode 3 prompt. The pipeline is: **Mode 2 shapes it -> you review and
approve the prompt -> Mode 3 executes it.** That review step is itself a lightweight gate:
you approve the plan of attack before delegating, which is what makes end-of-run (rather
than per-stage) verification safe. Mode 2 can run in a normal desktop session; its
deliverable is just prompt text you hand to the Mode 3 runner.

**Separation of concerns.** Alignment, implementation, and verification are done by
different actors, at different times:

1. **Align - you (Mode 2).** The `discover` grill defines intent and what "done" means;
   the spec is the contract.
2. **Implement - the agent (Mode 3).** A `plan -> implement -> test -> review` inner loop runs
   autonomously against that spec, without re-litigating intent. In HOTL the orchestrator
   approves the plan on the human's behalf (intent was front-loaded).
3. **Verify - a fresh-context subagent.** Review runs in isolated context against the
   *original* spec — a separate subagent in the same session is enough; it does not require a
   new human session.

So the human owns the two ends - intent at the start, acceptance at the finish. In **HITL**
that touch also lands between every stage; in **HOTL** it is front-loaded in the Mode 2 grill
and repeated only at the end.

---

## Human-in-the-loop vs human-on-the-loop

The default agent-factory flow is **human-in-the-loop (HITL)**: a human gates *every* stage
(plan approval, review verdict, test sign-off). Safe, cheap, no drift - the right default.

**Human-on-the-loop (HOTL)** moves the human to the *end*: with intent already aligned in the
Mode 2 grill, one orchestrator session drives the `plan -> implement -> test -> review` inner
loop via subagents, appends to the spec's **Implementation Notes** each stage, and returns for
a single verification pass. This is the inner loop in `orchestrate/SKILL.md`.

HOTL pays off most with **Cursor cloud agents**: a cloud agent provisions its own
environment and can build, run, and test end-to-end in a VM - exactly what a human would do
at a desktop - instead of stopping to ask you to run things. The end-of-run verification is
then meaningful: you get a branch already exercised against real acceptance criteria, not
just code that compiles.

Guardrails that **stay** even in HOTL:

- **The builder never grades its own work.** Review always runs in a fresh-context verifier
  subagent (different from the builder) pointed at the real output. Same session is fine.
- **Irreversible / external actions stay bounded.** Git push, PR, and ADO items are gated or
  pre-authorized once, up front - never left fully open.
- **The spec is durable state.** The orchestrator supervises drift via **Implementation Notes**
  on the spec; a stopped or resumed run keeps context and every deviation is auditable.
- **Learnings stay on the spec.** The `reflect` stage appends post-run learnings and proposes
  harness improvements as a plan — the human decides what to act on; agents do not scatter
  state files.

An HOTL launch prompt bakes the principles in from the start:

```bash
orchestrate F001-dashboard-api end-to-end, human-on-the-loop.

Context: real-time analytics dashboard. Intent and acceptance criteria are already
  aligned in the spec at knowledge/specs/F001-dashboard-api.md (from the Mode 2 grill).
Goal (not steps): ship the feature to a reviewable PR - you decide the approach.
Inner loop: plan -> implement -> test -> review, each a subagent with role+model per models.toml.
House rules: follow existing codebase patterns; no new deps beyond the plan.
Bar for done: all acceptance criteria pass under a FRESH-context verifier subagent,
  verified by running the app end-to-end in your environment - not just a passing compile.
Pre-authorized actions: create the branch and commits; STOP before opening the PR or
  touching ADO - I approve those.
Log decisions and deviations to the spec's Implementation Notes as you go.
Report back with evidence (e2e results + the verifier's verdict).
```

Maturity: the single-session cycle is **opt-in today**. Fully autonomous, cross-session runs
need a **Cursor Automation** (cron/PR/webhook trigger) - a deferred seam. Build the rails
(spec, Implementation Notes, gates) now; add the driver later.

---

## Checkpoints and traceability

Any action creating external resources or making irreversible changes needs human approval:

| Category | Examples |
|---|---|
| **Discovery** | interview answers, spec approval |
| **Planning** | clarifying questions, plan approval |
| **Git** | branch, commit, push |
| **External** | PR creation, DevOps work items |
| **QA** | test pass/fail, merge vs debug |

Specs live in `knowledge/specs/` (`E001-*` epics, `F001-*` features, relative markdown links).
Use `sync-to-devops` twice: after **plan** approval (timestamps "planned") and after **submit**
(links PR, sets Done). The gap between the two is measurable implementation lead time, with
no manual tracking. **Implementation Notes** on each spec is the drift ledger reviewers see
on the work item and at PR time.

---

## Guidelines by role

### Developers

- **Plan before building.** Research options in Ask Mode; write the plan in markdown; break
  work into small, independently verifiable increments; keep a "later" list to fight scope
  creep.
- **Prompt authoritatively.** State framework, patterns, error handling, and the expected
  signature; reference working code with `@file`; build the simple version first.
- **Verify relentlessly.** Run every output. Prefer integration tests - agents often
  "improve" unrelated code. Confirm APIs and libraries actually exist.
- **Use Git as the source of truth.** Commit each working increment; branch per feature;
  recover with `git reset --hard HEAD`, not Cursor's undo; review diffs carefully.

### Designers & PMs

- **Prototype to think.** Have the agent generate several divergent directions as artifacts
  you react to (the `design` skill + the WP toolkit) rather than specifying visuals up front.
- **Front the intent.** Frame the problem, constraints, and acceptance criteria clearly -
  agents operate directly on this, so clarity here determines execution quality.
- **Compose from the system.** Keep UI on WP CI / Dojo tokens and patterns; never hardcode
  colors, spacing, or type.

### Managers

- **Set expectations.** Real gains for experienced devs; code review stays essential; AI
  accelerates learning but doesn't replace fundamentals. Best fit: boilerplate, tests, docs,
  exploration, tedious refactors.
- **Enable the team.** Keep `AGENTS.md` current, define shared `.cursor/rules/`, allow
  per-developer variation, and revisit workflows when new models land.
- **Manage risk.** Require tests + review for all AI code; keep Secure SDL Lane B for auth
  and sensitive paths; insist on human-readable code to avoid knowledge silos.

### QA

- **Probe what agents skip.** Edge cases, error handling, integration points, and regression
  in unrelated files.
- **Verification order.** Automated tests -> acceptance criteria -> manual UI/UX ->
  security scan.
- **Red flags.** "Refactored for clarity" in untouched files, surprise dependencies,
  over-complex solutions, missing error handling.

---

## Testing AI-native (non-deterministic) features

Traditional code is deterministic: `assert calculate_tax(1000) == 200`. LLM-backed features
vary run to run, so exact-match assertions don't work. Use:

- **Semantic checks** - assert meaning and bounds (a key phrase is present; output under N
  words), not exact strings.
- **LLM-as-judge** - a separate model scores accuracy/conciseness against the input; gate on
  a threshold.
- **Human evaluation** - sample-review a fraction of outputs; feed patterns back into prompts.
- **Golden datasets** - curated input/output exemplars; run new model versions against them
  to catch quality drift, and keep versioning/rollback ready.

---

## Safety and compliance

Three complementary layers - do not collapse them:

| Layer | Job | Where |
|---|---|---|
| **Runtime hooks** | Stop catastrophic shell/git/secret exposure while the agent runs | `docs/security.md`, `docs/cursor-hooks.md` |
| **Data safety** | GDPR/BDSG vault, first names only, credentials out of git | `.sensitive/`, `data-safety` skill |
| **Secure SDL harness** | Apply Siemens Energy control IDs while building; governed security review | `.cursor/skills/secure-coding/` + agent-factory |

### Secure SDL harness (vendored copy)

Corporate Secure SDL leaves originate in Oscar's **`sdlskills`** repo. Their Cursor
compiler installs them as always-on `.mdc` rules. That is the wrong fit for this template:
agent-factory already carries a large skill set, and loading all 16 leaves every turn is
expensive and unselective.

Instead we keep a **vendored copy** of the leaf `SKILL.md` files under
`.cursor/skills/secure-coding/<leaf>/` and **consume them as-is**:

- **Do not edit the leaves** in this repo to "adapt" them. Interpretation lives only in
  agent-factory (the [Secure SDL leaf map](../.cursor/skills/agent-factory/SKILL.md#secure-sdl-leaf-map)).
- **Refresh from upstream** when Oscar ships leaf changes: copy the leaf tree, then update
  the leaf map if names or surfaces moved. Last resort: ask Oscar to change a leaf upstream.
- **Selective load** - `plan` / `implement` / `test` open only the leaves the surface cues
  imply (typically 1–few). Full-pillar breadth only when the user explicitly asks for a
  full-scope secure review.
- **Review is one stage, two lanes** - Lane A is generic correctness (no leaf load). Lane B
  is Secure SDL: control IDs, severity, `file:line`, domain PASS/FAIL for loaded leaves.
  Auto-dispatch selective Lane B after generic when the plan or diff hits security surfaces
  (auth, secrets, tokens, web/API, crypto, PII, agent/LLM, …).

Triggers: `secure review`, `security review`, or a normal `review` on a security-relevant
change. Inner loop remains HITL by default and HOTL when opted in - security is baked into
those stages, not a separate periodic product.

- **Hooks** - block catastrophic operations, require confirmation for risky ones, prevent
  credential exposure, audit agent actions. See `docs/security.md` and `docs/cursor-hooks.md`.
- **Data safety** - `.sensitive/` is a gitignored vault; first names only in tracked files;
  credentials in `.env` or a secrets manager. Say `check data safety` to run the skill.
- **Your responsibility** - review all AI code before merge, test security paths, never paste
  secrets into prompts, verify external calls.

---

## Quick reference

```bash
# Solo: research -> plan -> build -> test -> review -> ship
submit

# Team stages
discover requirements for a real-time analytics dashboard
plan the API layer for F001-dashboard-api
implement T2 from the plan
test work item #12345
review PR #789
secure review                    # Lane B only; or auto after generic when surfaces apply
debug AC3 fails - allocation returns wrong results
submit
reflect
sync to devops

# Orchestration layer
help me prompt this: <rough idea>, then show me the launch prompt before running
orchestrate F001 end-to-end, human-on-the-loop

# Recovery
git reset --hard HEAD        # undo all uncommitted AI changes
git reset --soft HEAD~1      # undo last commit, keep changes
```

Model selection is not hard-coded in prose. Unless the user overrules it, roles map to models
in `orchestrate/models.toml` (the numbers); the reasoning lives in `orchestrate/routing.md` and
the summary in `AGENTS.md` -> "Model selection". The orchestrator names the model explicitly on
every subagent spawn.

## References

- [Simon Willison: How I use LLMs to write code](https://simonwillison.net/2025/Mar/11/using-llms-for-code/)
- [Cursor documentation](https://cursor.com/docs)
- `docs/security.md` - runtime hooks harness
- `AGENTS.md` - always-on dev commands, rules, model-selection rubric, proactive PII rule
- `.cursor/skills/agent-factory/` - SDLC stages + Secure SDL leaf map
- `.cursor/skills/secure-coding/` - vendored corporate Secure SDL leaves (do not edit)
- `.cursor/skills/orchestrate/` - the loop, the gate, carry-forward, and role→model routing
- Upstream provenance: `sdlskills` (Oscar) - refresh leaves from there; do not use the
  Cursor always-on compiler in this harness
