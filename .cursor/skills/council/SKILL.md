---
name: council
description: |
  Run any question, idea, or decision through a council of 5 AI advisors who independently analyze it, peer-review each other anonymously, and synthesize a final verdict. Based on Karpathy's LLM Council methodology.
  MANDATORY TRIGGERS: 'council this', 'run the council', 'war room this', 'pressure-test this', 'stress-test this', 'debate this'.
  STRONG TRIGGERS (use when combined with a real decision or tradeoff): 'should I X or Y', 'which option', 'what would you do', 'is this the right move', 'validate this', 'get multiple perspectives'.
  Do NOT trigger on simple yes/no questions, factual lookups, or casual 'should I' without a meaningful tradeoff.
---

# LLM Council

Run a question through 5 independent advisors (subagents), have them peer-review each other anonymously, then synthesize a final verdict via a chairman.

The council is for questions where being wrong is expensive: architecture tradeoffs, go/no-go calls, pricing decisions, build-vs-buy choices. If the question has one right answer, just answer it directly.

## The Five Advisors

Each advisor is a thinking style, not a persona:

1. **The Contrarian** — Hunts for what's wrong, missing, or will fail
2. **The First Principles Thinker** — Strips assumptions, rebuilds from scratch
3. **The Expansionist** — Looks for upside everyone else misses
4. **The Outsider** — Zero context, catches the curse of knowledge
5. **The Executor** — Only cares if it can be done and the fastest path

## Execution Protocol

### Step 1: Frame the Question
Scan the workspace for context (project docs, memory, referenced files). Reframe as a clear, neutral prompt with: core decision, key context, what's at stake. Don't add your own opinion.

### Step 2: Convene (5 subagents in parallel)
Spawn all 5 advisors simultaneously using the Task tool with `subagent_type: "generalPurpose"`, `readonly: true`, `model: "fast"`. Each advisor responds in 150-300 words from their assigned angle.

### Step 3: Peer Review (5 subagents in parallel)
Anonymize responses as A-E (randomized). Spawn 5 reviewers (same settings). Each reviewer identifies: strongest response, biggest blind spot, what all five missed.

### Step 4: Chairman Synthesis (1 subagent)
Spawn one chairman using the default model (not fast). Produces:
- Where the Council Agrees
- Where the Council Clashes
- Blind Spots Caught
- The Recommendation (a clear answer, not "it depends")
- The One Thing to Do First

### Step 5: Generate Report
Create `docs/council/council-report-YYYYMMDD-HHmmss.html` — a scannable briefing with the verdict prominent and collapsible advisor details.

### Step 6: Save Transcript
Save `docs/council/council-transcript-YYYYMMDD-HHmmss.md` with all raw responses and the anonymization mapping.

## Rules

- Always spawn all 5 advisors in parallel
- Always anonymize for peer review (prevents deference bias)
- The chairman can disagree with the majority if the dissenter's reasoning is strongest
- Don't council trivial questions — just answer them directly
