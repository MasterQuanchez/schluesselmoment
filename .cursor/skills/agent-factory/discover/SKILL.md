---
name: discover
description: |
  Interview-driven requirements discovery for a new epic or feature. Produces a spec in knowledge/specs/
  and a handoff for plan. Use when starting from a high-level idea that needs exploring.
---

# Discover

Turn a high-level idea into a spec nobody has to guess against. Alignment is not deciding everything
up front — it is routing each open decision to the cheapest technique that closes it, so the human
*recognises* far more than they *author*. Techniques by quadrant: [`unknowns.md`](unknowns.md).

**The interview is orchestrator work** and runs inline — each answer steers the next question, so it is
never delegated to a subagent or a cheaper model. What *is* delegable is reconnaissance: fan codebase
exploration out to `explorer` subagents and fold the findings into the interview.

**HITL by default.** Spec approval is a held gate in every mode — the spec stays `Draft` until the human
approves it.

## Process

1. **Explore before interviewing.** Summarise the vision back, then read the codebase for existing
   patterns and integration points, and run a **blindspot pass** to convert unknown-unknowns into
   questions worth asking.

2. **Prototype first where the decisions are visual.** Taste and aesthetics are the quadrant a human
   cannot enumerate but can react to instantly, so generate real HTML directions and interview against
   them. A high-fidelity mockup is the single best reference form available downstream — better than a
   description, better than a screenshot — and it becomes the artifact `plan` and `implement` build
   against. On Cursor Cloud, share it as **screenshots or video from the VM browser**; the user cannot
   open raw HTML there.

3. **Interview relentlessly.** Walk the decision tree, resolving dependencies one at a time.

   - **One question at a time, and wait.** Each answer can open a follow-up a batched questionnaire
     would flatten and miss.
   - **Give your recommended answer** with every question, so the human accepts, refines, or rejects
     rather than starting from blank.
   - **If the codebase can answer it, explore instead of asking.**
   - **Challenge assumptions**, and follow threads when an answer reveals ambiguity.
   - Prioritise questions whose answers would change the **architecture**.

   Cover: does the problem exist and what does doing nothing cost; the simplest useful version; what
   we should *not* build and where phase 2 is hiding; prior art; and how we will know it worked.

   Continue until you could write the spec without guessing.

4. **Write the spec** using [`../templates/spec.md`](../templates/spec.md). Every section filled or
   marked N/A, at least one Out of Scope entry, and every key decision carrying its rationale.

   **Every acceptance criterion gets a `Proof:` clause** naming what counts as evidence — live DOM with
   a non-zero bounding box, an API round-trip, a mutation-tested assertion. This costs about thirty
   seconds per AC and it is the cheapest defence the harness has: a builder given an AC with no stated
   proof will satisfy it with a search over the source, because that is the cheapest thing that looks
   like evidence. Four separate green-but-vacuous ships trace to a missing proof clause.

   When the spec references a prototype, include the template's **Prototype authority** note — an
   executable artifact will otherwise be followed literally, mock scaffolding and all.

5. **Decompose** an epic into features, linked with relative markdown links, and **map every epic AC to
   the feature that owns it end to end**. An AC spanning two features goes to the last feature that
   touches it, or gets an integration gate. An epic AC that no single feature owns is the classic
   escape: each owning feature passes its own gate while the live cross-feature path stays broken.

6. **Present for approval** — key decisions, scope, deferred items.

## Invariants

- **Never write code**, and never create DevOps work items.
- **Product language comes from a root `GLOSSARY.md`, when the repo has one.** Use its terms;
  don't define parallel names in the spec. Propose an addition only when a term is load-bearing across
  two or more surfaces.
- **Specs are flat** in `knowledge/specs/` as `{E|F}NNN-{name}.md`, with relative markdown links per the
  [`okf`](../../okf/SKILL.md) conventions.
- **The interview is mandatory** unless the user explicitly skips it — including on Cursor Cloud, which
  is interactive over async chat. Deferring every open decision into the spec is not discovery.

## Next

`python .cursor/skills/okf/validate.py` and `index.py` to check conventions and refresh the graph, then
`plan` with the spec path.
