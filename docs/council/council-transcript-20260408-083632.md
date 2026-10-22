# Council Transcript: Agent Factory Architecture

**Date:** 2026-04-08
**Question:** Is the skills-based agent-factory architecture the right approach for this team's digital transformation work?

---

## Anonymization Mapping

| Anonymous ID | Advisor Role |
|---|---|
| A | Expansionist |
| B | Contrarian |
| C | Executor |
| D | Outsider |
| E | First Principles |

---

## Step 1: Framed Question

Is the skills-based agent-factory architecture — a collection of 10 markdown-defined SKILL.md files orchestrating an AI-assisted SDLC through Cursor's subagent system — the right approach for this team's digital transformation work? Consider the architecture, skill decomposition, handoff protocol, specs-as-knowledge-graph design, and the tradeoffs of encoding process in markdown prompt files vs code.

---

## Step 2: Advisor Responses

### Advisor 1 — Contrarian

Skills as pure markdown give portability and fast iteration, but **zero guarantees**: nothing stops an agent (or a rushed human) from skipping constraints, checkpoints, or handoff fields. Without validation, "handoff" becomes **narrative glue**, not a contract—downstream phases inherit ambiguity and silent omissions.

**Where it will fail under real DT load:**

- **Scale and drift**: A wikilinked `docs/specs/` graph is fine for tens of pages; it rots at hundreds—broken links, duplicated truth, specs that disagree with code and with Azure DevOps after partial syncs.
- **Single sync-to-devops** is clean architecturally but concentrates reconciliation risk (who wins when ADO and repo diverge?).
- **Governance vs velocity**: "Checkpoint every stage" fights throughput unless roles and SLAs are explicit; otherwise you get checkbox approval or bypass (especially Solo).
- **Stories optional** may be too thin for audit/traceability if regulators or internal QA expect requirement IDs mapped to tests and releases.
- **TDD as mandate**: Strong for production code; weak for exploration and integration-heavy spikes where the right test is expensive to define first—agents may satisfy the letter with shallow tests.

**What's missing:** Explicit versioning of skills and templates; definition of done per phase that isn't prose-only; automation for link checks, minimal schema on handoffs, and coverage/traceability reports. Operational metrics (handoff quality, rework rate) would show whether the system works or only looks structured.

**Blind spot:** The approach assumes Cursor's subagent behavior stays stable and that everyone follows the same skill paths—enterprise DT usually needs exceptions (spikes, vendor blocks, emergency fixes) with a documented path that doesn't orphan compliance.

**Verdict**: Directionally right for traceability-minded AI-assisted SDLC, but not sufficient without lightweight enforcement, sync conflict rules, and scale controls on the spec graph—otherwise it becomes expensive documentation theater.

---

### Advisor 2 — First Principles

The fundamental problem is not "use AI for SDLC." It is: **how to ship software repeatedly under enterprise constraints**—auditability, ownership, change control, and evidence—while still gaining speed from AI. You need a shared contract for what "done" means at each step and artifacts that survive handoffs between people, tools, and time.

Markdown-defined skills with handoff templates are a **minimal, versionable process layer**: cheap to edit, readable in PRs, and aligned with "documentation as code." That is a valid simplest shape for governance and narrative traceability, because enforcement in regulated settings often still lives in humans, tickets, and reviews anyway.

What to challenge: (1) Ten fixed phases assume work cleaves cleanly; many real tasks are diagonal (fix + test + doc in one pass)—rigidity creates ceremony tax unless Solo path truly absorbs it. (2) Pure markdown means no mechanical guarantees—consistency depends on discipline; drift is the failure mode. (3) Wikilinked specs as the knowledge graph assume curation scales; without conventions and occasional hygiene, links and frontmatter rot. (4) TDD everywhere is a policy, not a law of nature—some discovery or integration-heavy work may need different evidence. (5) Single DevOps sync trades simplicity against latency and blast radius if that step blocks or mis-syncs. (6) Cursor subagents couple process to one product's execution model—acceptable if the team accepts that dependency.

**Bottom line:** For digital transformation with compliance and traceability, a thin, explicit SDLC encoded as skills plus specs is a **sound first-principles fit**: it optimizes for explainable process and artifacts, not automated enforcement. It is not the simplest architecture if the only goal were raw throughput; it is a coherent minimal architecture for governed, repeatable delivery—provided the team treats skills as living policy and invests in keeping specs and handoffs honest.

---

### Advisor 3 — Expansionist

The hidden upside is that you have treated **governance as a product**: traceability, compliance, and handoffs are not bolted on later but encoded as repeatable rituals (handoff template, specs graph, single DevOps spine). Markdown-only skills are a feature for enterprise work: they are **auditable, diffable, and portable** across models and tools. A reviewer can read a SKILL.md like a control procedure; nothing is buried in opaque code. That aligns digital transformation with how regulated or risk-conscious orgs already think about process.

What this unlocks that teams often miss: **compounding organizational memory**. The wikilinked spec graph plus standardized handoffs turns each project into reusable narrative and decision structure, not just code. Over time you can mine patterns (recurring risks, estimation errors, which checkpoints caught real issues) and tighten skills without rewriting software. The dual Solo/Team workflow is leverage for adoption: skeptics can start light while the same vocabulary scales to full SDLC when stakes rise.

Where it could go next: **metrics and evidence packs** tied to each skill (what was produced, who approved, links to ADO work items), optional **lightweight validators** (lint the spec graph for broken wikilinks, required frontmatter) without abandoning markdown-first design, and **role-specific views** of the same skills (PM vs engineer vs auditor).

The biggest leverage point is the **single integration point to Azure DevOps** combined with human checkpoints: it is the thread that stitches intent, artifact, and audit trail. Strengthen that spine—clear mapping from spec nodes to work items and back—and everything else (TDD, council, simplify) becomes provable process, not just good habits.

---

### Advisor 4 — Outsider

Ten named "skills" for a full SDLC sounds systematic until you ask who decides which skill runs next and what happens when work doesn't fit the pipeline (hotfixes, spikes, legacy glue). Without code or enforcement, this is mainly shared prompts and habits—calling it an "architecture" can oversell it and leave newcomers expecting automation that isn't there.

The handoff template plus wikilinked specs plus Azure DevOps sync risks three parallel truths: local markdown, ADO, and chat history. Unless someone owns deduplication and "source of truth" rules, traceability becomes busywork and drift.

"Knowledge graph" is often just linked markdown; the heavy term can hide fuzzy ownership of what is canonical and how often it must be updated. Human checkpoints at every stage align with compliance but fight speed; teams may quietly route everything through a "solo" lane and only pretend to use the full chain.

Mandating TDD in one skill while the rest of the system is soft process can feel arbitrary unless the team already agrees on when tests are non-negotiable. Jargon like "agent-factory," "council," and "orchestrator" sounds like a product; a newcomer really sees: long docs, Cursor-specific wiring, and discipline. That can work if leadership treats it as living process docs and trims overlap (e.g. discover vs plan, test vs review)—otherwise it reads as ten folders of ceremony that are easy to admire and hard to sustain.

---

### Advisor 5 — Executor

Yes, it can work in practice, but only if you treat it as **process + documentation glue**, not as automation. Markdown skills are cheap to maintain and map cleanly to how Cursor already behaves: they are routing instructions and checklists. The risk is not the format; it is **discipline** (people actually following handoffs, updating specs, and using checkpoints) and **Azure DevOps hygiene** (IDs, fields, and sync cadence).

**Fastest path to value:** Pick one real, small initiative (one epic, one feature), run **discover → plan → implement** end-to-end with **sync-to-devops** only after the spec is stable enough to not thrash work items. Prove traceability: spec wikilink → ADO item → PR → tests. Skip **council** and heavy **design** polish until the loop works once.

**Build first vs later:** First: a thin **solo path** (plan + implement + review + test) with mandatory TDD only where your codebase already supports fast tests. Next: **sync-to-devops** as the single source of truth for "what we committed to." Defer: full 10-skill ceremony, elaborate knowledge-graph grooming, and **simplify** passes until you have code worth simplifying.

**Bottlenecks:** (1) Human checkpoints scale linearly with team size and can become approval queues. (2) No enforcement means drift—skills are ignored under pressure unless leads model them. (3) Spec ↔ ADO sync fails when titles, scope, or parent/child relationships change often. (4) TDD slows teams without test infrastructure or flaky CI.

**Verdict:** Right enough for transformation teams that need narrative and audit trails; wrong if you expect the markdown alone to enforce behavior. Prove one vertical slice fast; expand the skill set only after that slice ships with traceability intact.

---

## Step 3: Peer Reviews

### Peer Reviewer 1
**Strongest:** E (First Principles) — enterprise framing, conditional verdict, decision-useful.
**Blind spot:** Incentives and power — nobody ties failures to who is rewarded for maintaining specs vs shipping features.
**Missed:** Concrete evaluation frame, pilot success metrics, time-boxed review criteria, AI risk in regulated contexts.

### Peer Reviewer 2
**Strongest:** E (First Principles) — clear thesis, honest limits, decision-oriented bottom line.
**Blind spot:** How adoption is sustained — incentives, accountability, roles, KPIs, exception workflows.
**Missed:** Concrete success criteria and feedback loops — what to measure and how often.

### Peer Reviewer 3
**Strongest:** B (Contrarian) — most falsifiable, concrete failure modes, operational punch list.
**Blind spot:** Measurement and economics — no tie to outcomes or cost.
**Missed:** Partial adoption and toolchain reality — DT spans non-Cursor users, legacy systems, fragmented AI tooling.

### Peer Reviewer 4
**Strongest:** E (First Principles) — clear qualified verdict, real tradeoffs, conditions stated.
**Blind spot:** Incentives, funding, sustained ownership.
**Missed:** Outcome evidence and comparators, governed exception paths beyond solo vs team.

### Peer Reviewer 5
**Strongest:** E (First Principles) — conditional verdict, decision-useful framing.
**Blind spot:** Outcome and adoption proof — no metrics tied to business outcomes.
**Missed:** Explicit success criteria, comparison set, security/data governance for AI, total cost of ownership.

---

## Step 4: Chairman Synthesis

### Where the Council Agrees

- Markdown skills are a legitimate, minimal process layer for governed AI-assisted delivery.
- Handoff + wikilinked specs give narrative traceability without tooling lock-in.
- Human checkpoints at phase boundaries are necessary for compliance.
- This is process glue, not automation — the team must understand it as such.
- Cursor coupling is a real vendor risk but acceptable at this stage.

### Where the Council Clashes

| Question | Camp A | Camp B |
|---|---|---|
| Is "architecture" the right word? | Yes — coherent minimal governance structure | No — shared prompts with no enforcement; oversells it |
| Ship all 10 skills at once? | Yes — compounding value from full loop | No — prove with 3-4 first |
| TDD mandate | Fine as aspirational policy | Premature where test infra doesn't exist |
| Spec graph scalability | Biggest long-term asset | Rots without automated link-checking and ownership |

Deepest clash: Compounding organizational memory (upside) vs. compounding ceremony and three parallel truths (downside). Which dominates depends entirely on curation discipline.

### Blind Spots Caught

1. **Incentives & ownership.** No skill assigns a human owner. Under deadline pressure, the path of least resistance is to skip the pipeline.
2. **Partial adoption.** DT spans people who won't use Cursor, legacy systems, non-agent workflows.
3. **Cost of the process.** Token spend, senior time curating specs, ceremony overhead — none measured or bounded.
4. **AI-specific governance.** Data handling, model usage policies, prompt audit trails for regulated contexts.
5. **Exception paths.** Hotfixes, spikes, and legacy glue don't fit the pipeline.

### The Recommendation

**Yes, adopt it — but scope it honestly and harden it incrementally.**

The First Principles advisor has the strongest framing: a thin, explicit SDLC encoded as skills + specs is the right shape for governed, repeatable AI-assisted delivery. Call it what it is — structured prompts and conventions, not a mechanically-enforced architecture. Adopt it as living policy with known gaps.

Conditions for success:
1. Start with 4 skills, not 10 (plan, implement, review, test).
2. Assign a human owner per skill.
3. Document a fast-path (hotfix/spike) with lighter ceremony but equivalent audit trail.
4. Lint the spec graph — broken wikilinks and missing frontmatter should fail CI.
5. Measure from week one: lead time (plan → merged PR) and spec-to-ADO sync accuracy.

### The One Thing to Do First

Run one real feature end-to-end through plan → implement → review → test → sync-to-devops, then measure what broke. Not a hello-world. A real, small, scoped feature with a real ADO work item. Document every friction point vs. every real issue caught. That evidence earns team buy-in and tells you which of the remaining 6 skills to activate next.
