---
name: welcome
description: |
  First-time repo orientation for new users. Introduces the template structure,
  available skills, toolkit, and key resources. Creates a pinnable cheat sheet.
  TRIGGERS: 'welcome', 'onboard me', 'what is this repo', 'getting started',
  'show me the welcome', 'what can you do', 'help me get started',
  'hello', 'hi', 'where do I start', 'what can I do here', 'new here',
  'what's available', 'tour', 'show me around'.
---

# Welcome — First-Time Repo Orientation

A one-shot onboarding skill that introduces new users to the repo, surfaces
available skills and resources, and creates a pinnable cheat-sheet conversation.

**This skill discovers EVERYTHING at runtime. It contains ZERO hardcoded content
about the repo.** The repo may change over time (skills added/removed, tech stack
updated, new conventions). The welcome must always reflect the current state.

## Procedure

### Step 1 — Check the marker

Read `.cursor/.welcomed`.

- **File exists AND the user did NOT explicitly ask** for the welcome
  (e.g. "show me the welcome", "onboard me", "tour") → skip to Step 8 (Route)
  with a brief: "Welcome back! What can I help with today?"
- **File exists BUT user explicitly re-triggered** → continue (re-run the tour).
- **File does not exist** → continue (first-time user).

### Step 2 — Discover the repo

Read these files to build a live picture of the project. Total reads: ~4–6 files
plus a few existence checks. Do NOT read full skill sub-files.

1. **`README.md`** (repo root) — what the repo is, tech stack, quick start
2. **`AGENTS.md`** (repo root) — development rules, workflow triggers, conventions
3. **`.cursor/skills/agent-factory/SKILL.md`** — the orchestrator's **Skill Catalog
   table** lists every skill with a one-liner and invocation example. Use this as
   the single source of truth for the skill inventory. Do NOT scan each sub-skill
   individually.
4. **`pyproject.toml`** (if it exists) — Python dependencies and project metadata
5. **`frontend/package.json`** (if it exists) — Node dependencies, scripts

**Existence checks only** (do not read full contents):
- `frontend/` directory — does a frontend exist?
- **Data-safety kit armed?** Check `git config --get core.hooksPath` (expect
  `.githooks`) and whether `.sensitive/redaction-config.local.json` exists. Both are
  per-clone/local and gitignored, so a fresh clone won't have them — that's the cue to
  point the user at the `data-safety` skill's `setup-guide.md` and `vault-guide.md` as the primary, portable
  onboarding references. A `.sensitive/README.md` may also be present with optional
  team-specific vault detail.
- `node_modules/@wp/agentic-ux-toolkit/` — is the design toolkit installed?
- `knowledge/specs/` — are there any spec files?

### Step 3 — Introduce the repo

Compose a **conversational, warm** introduction — think "friendly colleague on
your first day", not a documentation dump. Keep it to 8–12 lines max.

Structure:
1. **One sentence**: what this repo is (from README.md's first paragraph)
2. **What's included**: a quick scan of what you found (backend? frontend?
   design toolkit? specs?). Use short bullet points, not a table wall.
3. **Available skills**: list each skill by name with its one-liner from the
   orchestrator's Skill Catalog table. Format as a compact list, not a full table.
4. **Hello-world**: if `frontend/src/components/` exists, mention it's a reference
   chat app showing recommended patterns.
5. **Toolkit status**: if `@wp/agentic-ux-toolkit` is installed, note it's ready;
   if not, mention the `design` skill handles setup.
6. **Data-safety kit status**: if `core.hooksPath` is `.githooks` and local redaction
   config exists, note the kit is armed; if not, mention the `data-safety` skill
   walks through a quick one-time setup (`setup-guide.md`).

### Step 4 — Ask 2–3 quick questions

Personalize the experience. Use Cursor's `AskQuestion` tool with structured
multiple-choice questions:

1. **"What are you building?"** — helps route to the right starting point
   - Options: "A new AI chat app", "Adding features to the existing app",
     "Just exploring / learning", "Something else (I'll describe it)"
2. **"Have you used Cursor's agent mode before?"** — adjusts guidance depth
   - Options: "Yes, I'm comfortable", "A little", "No, this is new to me"
3. **"Which layers will you work on?"** — focuses next steps
   - Options: "Backend only", "Frontend only", "Full stack (both)",
     "Not sure yet"

### Step 5 — Share key resources

Assemble a **cheat sheet** from what was discovered (not hardcoded):

1. **Skill invocation cheat sheet** — built from the orchestrator's Skill Catalog.
   Format as a compact command → description list:
   ```
   "new epic"           → discover requirements, write specs
   "plan this feature"  → break spec into implementation tasks
   "implement"          → TDD implementation, branch, commit, PR
   ...etc (from catalog)
   ```
2. **Quick start commands** — extracted from README.md or AGENTS.md
3. **Data safety conventions** — briefly note the vault pattern and the kit. If the
   kit looks un-armed (Step 2 check: no `core.hooksPath` / no local config), nudge:
   "Before handling any internal content, run the `data-safety` skill — it walks you
   through a quick one-time setup." Link to the tracked
   `.cursor/skills/agent-factory/data-safety/setup-guide.md` (one-time setup) and
   `vault-guide.md` (the `.sensitive/` OneDrive vault pattern). If a `.sensitive/README.md` is present, it adds optional
   team-specific vault detail.
4. **Privacy Mode reminder** — always include this, regardless of vault status:

   > **Privacy check:** Cursor's Privacy Mode is off by default. Before using this
   > repo with any internal or sensitive content, open **Cursor Settings → Privacy**
   > (bottom of the page) and enable Privacy Mode. This prevents your prompts and
   > code from being stored or used for training. See the `data-safety` skill for
   > full guidance on safe data handling.

5. **External links** — any URLs found in README.md (Figma, ADO, docs)

### Step 6 — Suggest pinning

Tell the user:

> **Tip:** Pin this conversation so you have a quick-reference cheat sheet
> available anytime. You can always say "show me the welcome" to re-run this tour.

### Step 7 — Create marker

Write the file `.cursor/.welcomed` with this content:

```
welcomed: <ISO 8601 timestamp>
```

This prevents the welcome from auto-firing on subsequent conversations.

### Step 8 — Route

Based on the user's answers from Step 4, suggest a concrete next step using the
skill names discovered in Step 2:

- Building something new → suggest `discover` to explore requirements
- Adding features → suggest `plan` to decompose, or `implement` to jump in
- Exploring → suggest browsing `knowledge/specs/` or the hello-world frontend
- Needs UI/design help → suggest `design` (the toolkit gateway)
- Will handle meeting notes / transcripts / internal docs → suggest `data-safety`
  first if the kit looks un-armed, then `ingest-transcript` for summarization
- New to Cursor → offer to walk through a simple example together

## Tone

Conversational and welcoming. Like a friendly colleague showing you around on
your first day — not a documentation dump. Use short sentences, contractions,
and a bit of personality.

Good: "The repo comes with a reference chat app in `frontend/` — it's a good
starting point to see how everything fits together."

Bad: "The frontend directory contains a Next.js application that demonstrates
the recommended component patterns, design token system, testing approach, and
backend integration methodology."

## What This Skill Does NOT Do

- Does not teach Cursor basics (that's a separate onboarding effort)
- Does not replace live team onboarding sessions
- Does not make any code changes
- Does not install dependencies
- Is read-only except for creating the `.cursor/.welcomed` marker

## Nudge Protocol (for other skills)

**All skills in agent-factory should check for the welcome marker.** Add this
check early in your procedure:

```
If `.cursor/.welcomed` does not exist, briefly suggest:
"It looks like you're new here — try saying 'onboard me' for a quick tour
of what this repo offers."
Then continue with the skill's normal procedure.
```

This ensures users who skip the welcome still discover it organically.
