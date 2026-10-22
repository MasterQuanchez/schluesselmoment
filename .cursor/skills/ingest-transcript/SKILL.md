---
name: ingest-transcript
description: |
  Ingest a meeting transcript file (.vtt, .srt, .docx, .txt, .md) and produce a lossless OKF
  Meeting Summary that preserves every insight, decision, argument, and action item for
  handoff to another agent for reasoning. Writes into the bundle memory/ concept area with
  OKF frontmatter (or a path the user provides). Anonymizes speaker PII before writing to
  tracked files.
  TRIGGERS: 'ingest transcript', 'summarize this meeting', 'summarize transcript', 'meeting summary', 'ingest the vtt', 'process this transcript', 'turn this recording into notes', 'handoff summary for another agent'.
metadata:
  author: dpr
  version: "1.2.0"
  department: DPR
  handle: ingest_transcript
disable-model-invocation: true
---

# Ingest Transcript

Turn a raw meeting transcript into a structured, **lossless** summary that a
downstream agent can reason over. Optimize for completeness of insight, not
brevity: a downstream reader should be able to act without the original recording.

## Inputs

- A transcript file: WebVTT (`.vtt`), SubRip (`.srt`), Microsoft Teams Word export
  (`.docx`), or plain text (`.txt`/`.md`).
- Optional: an explicit output path. If absent, the redactor writes a safe working
  copy to the vault (see Step 1) and you infer the summary path (see Step 2).

## Outputs

- One OKF Meeting Summary concept written to the bundle `memory/` area (or an agreed path).
- OKF frontmatter (`type: Meeting Summary`) - no redundant HTML header comments.
- Speaker names reduced to **first name + surname initial** (e.g. `Anna S.`) or role
  (data-safety, see Step 3). The redactor does this locally, with no AI.

## Workflow

```
- [ ] 1. Normalize the transcript with the script
- [ ] 2. Determine the output location
- [ ] 3. Data-safety pass (PII + raw transcript routing)
- [ ] 4. Write the lossless summary using the OKF template
- [ ] 5. Regenerate OKF indexes, append log.md, and validate
- [ ] 6. Report what was written
```

### Step 1: Normalize and locally redact the transcript

Run the normalizer to strip timestamps/markup, merge speaker turns, and **redact PII
locally (no AI, on by default)**: surnames → first name + initial, plus emails,
phones, user-home paths, and corporate IDs. It prints stats and redaction counts to
stderr. Run this **before** attaching anything to an agent.

```bash
python .cursor/skills/ingest-transcript/scripts/prepare_transcript.py "<input>"
```

On Windows hosts, use the `py` launcher:

```bash
py .cursor/skills/ingest-transcript/scripts/prepare_transcript.py "C:/path/to/file.docx"
```

With no `--output`, the redacted working copy is written to
`.sensitive/meetings/{slug}-redacted.txt` (gitignored vault). **Read that redacted
file in full** — it is the source you summarize from. Never feed the raw
`.vtt`/`.docx` or a `--keep-pii` copy to an agent.

**Project-specific terms (company, org codes, participant surnames):** copy
`redaction-config.example.json` → `.sensitive/redaction-config.local.json`
(gitignored) and fill in real values; the script auto-discovers it. Use
[pseudonym-lexicon.md](pseudonym-lexicon.md) for consistent dummy identifiers.

Guardrails back this up: a `beforeSubmitPrompt` hook
(`.cursor/hooks/check-raw-transcript.sh`) blocks prompts that attach a raw
transcript, and a deterministic `scripts/pii_scan.py` pre-commit gate blocks commits
containing PII — see the **data-safety** skill.

### Step 2: Determine the output location

Priority order:

1. **User-provided path** - if the user named a directory or file, use it verbatim.
2. **OKF bundle memory area** - if the repo is an OKF bundle (has `memory/` and the
   `okf` skill), write the summary into `memory/`. This is the default for team bundles.
3. **Project docs dir** - for non-OKF repos, detect with the helper, then pick the most
   specific match:

   ```bash
   py .cursor/skills/ingest-transcript/scripts/prepare_transcript.py --detect-docs "<project_root>"
   ```

   Prefer `.cursor/docs/` for internal/working notes, `docs/` for shared docs.
4. **Fallback** - if none found, ask the user once where to write; do not guess.

Filename: kebab-case slug of the meeting topic, optionally date-prefixed for memory
entries, e.g. `20260611_ai-fight-club.md` or `secure-sdl-skills-planning-summary.md`.

### Step 3: Data-safety pass

Step 1 already redacted the working copy locally, but verify before writing tracked
output. Tracked files must contain **no** last names, emails, corporate IDs, or
user-home paths.

- Confirm you summarized from the **redacted** vault file, not the raw recording.
- Map any remaining full names to **first name + initial or role** (e.g.
  `Oscar (Cybersecurity)`, `Javier (DPR)`).
- If heavy PII slipped through, stop and invoke the **data-safety** skill (or add the
  terms to `.sensitive/redaction-config.local.json` and re-run Step 1).
- The **raw file and redacted working copy stay in `.sensitive/`** (gitignored).
  Only the anonymized summary goes to the tracked docs / `memory/` dir.

### Step 4: Write the lossless summary

Use this template. Capture **every distinct point** - including minority opinions,
tangents that carried information, specific numbers, tool/system names, and
rationale. When in doubt, keep it. Write in English by default (preserve key
original-language terms in parentheses when translation could lose nuance) unless
the user or surrounding docs use another language.

```markdown
---
type: Meeting Summary
title: <Meeting topic> - Summary
description: One-line summary for indexes and graph previews.
timestamp: <YYYY-MM-DDT00:00:00Z>
last_reviewed: <YYYY-MM-DD>
owner:
sources:
  - transcript: "<filename>"
language: <source language>
duration: <from script>
tags: [memory, <topic-tag>, <topic-tag>]
---

# <Meeting topic> - Summary

## TL;DR
- 3-6 bullets covering the most consequential outcomes.

## Participants & roles
- First (role) - what they own / their stake in the discussion.

## Context & background
What prompted the meeting; prior state; constraints assumed going in.

## Discussion (detailed, lossless)
Group by topic (or chronologically if topics interleave). Under each topic,
capture every distinct point, the reasoning behind it, examples given, numbers,
named tools/systems, and any disagreement. Attribute non-obvious claims to a
speaker. Do not compress away nuance.

### <Topic 1>
- Point, with rationale and who raised it.
- Counter-point / alternative considered and why.

## Decisions
| # | Decision | Owner | Rationale |
|---|----------|-------|-----------|

## Open questions & disagreements
- Unresolved item - positions taken, what would resolve it.

## Action items
| Owner | Action | Due / trigger |
|-------|--------|---------------|

## Entities & glossary
Tools, systems, acronyms, project codes mentioned, with a one-line gloss.

## Notes for the downstream agent
- Ambiguities, missing context, and what is NOT settled - so the next agent
  knows the boundaries of what was decided.
```

### Step 5: Regenerate OKF indexes and validate

In an OKF bundle, after writing the summary into `memory/`, refresh the graph from the
bundle root:

```bash
python .cursor/skills/okf/index.py
python .cursor/skills/okf/validate.py
python .cursor/skills/okf/log.py Update "Ingested <meeting topic> meeting summary"
```

Skip this step for non-OKF repos.

### Step 6: Report

State the output path, participant count, duration, and any PII you anonymized or
routed to the vault. Flag anything ambiguous you had to interpret.

## Quality bar

- **OKF-conformant:** valid `type: Meeting Summary` frontmatter, no redundant HTML header.
- **Lossless on insight:** no decision, argument, number, or named entity dropped.
- **Attributed:** non-obvious claims tied to a speaker (by first name/role).
- **Self-contained:** a downstream agent needs nothing but this file to reason.
- **PII-clean:** no last names, emails, corporate IDs, or paths with usernames.
