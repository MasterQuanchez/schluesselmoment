---
name: meeting-prep
description: |
  Draft the agenda and talking points for an upcoming recurring meeting, synthesized from recent
  memory/ summaries plus any new topics. Writes a human meeting prompt into sourcing/drafts/.
  TRIGGERS: 'prep the next meeting', 'draft the agenda', 'meeting prep', 'prepare for the meeting'.
metadata:
  author: dpr
  version: "0.1.0"
  department: DPR
  handle: meeting_prep
---

# Meeting Prep

Turn recent `memory/` summaries into the next meeting agenda. The output is a
draft prompt for humans, not ground truth. The later transcript should be
ingested back into `memory/`.

## Workflow

1. Scope the meeting: series, date, attendees by first name or role, time box, and new topics.
2. Read the newest 1-3 `memory/` summaries.
3. Extract carry-over open questions, decisions, due actions, and downstream-agent notes.
4. Write `sourcing/drafts/next_<series-slug>.md`.
5. Report what was carried over and remind the user to run `ingest-transcript` after the meeting.

## Draft Template

```markdown
# <Meeting series> - prep for <date>

<!-- draft: a prompt for the live meeting; not ground truth -->
<!-- after the meeting: ingest-transcript -> memory/, then delete this file -->

## Objective

## Attendees
- First (role)

## Agenda
| # | Item | Why now / source | Desired outcome | Time |
|---|------|------------------|-----------------|------|

## Carry-over open questions
- From [<memory title>](/memory/<file>.md): <question> - what would resolve it.

## Action items to check
| Owner | Action | From |
|-------|--------|------|

## Pre-reads
- [<concept>](/knowledge/...md)

## Parking lot
- Raised but out of scope for this session.
```

## Quality Bar

- Ground every carry-over item in a `memory/` source.
- Give each agenda item a desired outcome.
- Use first names or roles only.
- Do not add OKF frontmatter to `sourcing/drafts/`.
