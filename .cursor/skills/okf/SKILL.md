---
name: okf
description: |
  Validate and maintain a bundle's Open Knowledge Format (OKF) convention:
  concept frontmatter, relative markdown links, generated index.md files, log.md, and
  self-contained single-bundle or workspace viz.html graphs.
metadata:
  author: dpr
  version: "0.2.0"
  department: DPR
  handle: okf
---

# Open Knowledge Format for Team Bundles

Use this skill whenever you add, update, validate, index, or visualize a
bundle knowledge graph.

## Concept Area

Ground-truth concepts live in three roots:

- `knowledge/` - semantic knowledge the repo owns.
- `memory/` - episodic meeting and decision memory.
- `data-products/` - structured data product contracts and live access paths.

Staging content lives outside the graph:

- `sourcing/raw/` - raw source documents, gitignored.
- `sourcing/scratch/` - extraction output, gitignored unless a rollout log is explicitly tracked.
- `sourcing/drafts/` - tracked drafts in flight only.
- `.sensitive/` - raw transcripts and PII, gitignored.

## Frontmatter

Every non-reserved concept markdown file has YAML frontmatter:

```yaml
---
type: Strategy
title: Human-readable title
description: One-line summary for indexes and graph previews.
timestamp: 2026-06-16T00:00:00Z
last_reviewed: 2026-06-16
owner:
sources:
  - ref: "source"
tags: [tag1, tag2]
---
```

Allowed types: `Strategy`, `Product`, `Process`, `Team`, `Reference`,
`Decision`, `Meeting Summary`, `Skill`, `Data Product`.

## Links

Use standard markdown links with relative paths. Do not use double-bracket wiki syntax.

- In-bundle concepts: relative links from the current file, e.g. `[MVPulse](../strategy/mvpulse.md)`.
- Cross-bundle concepts: relative sibling paths, e.g. `[Sharety](../../sharety-bundle/knowledge/team/sharety.md)`.

Workspace visualization preserves sibling links and namespaces concept IDs by
bundle folder.

## Commands

Run from the bundle root:

```bash
python .cursor/skills/okf/index.py
python .cursor/skills/okf/validate.py
python .cursor/skills/okf/visualize.py
python .cursor/skills/okf/log.py Update "Refreshed OKF indexes"
```

Generate the global workspace graph (all sibling bundles) from any cloned bundle:

```bash
python .cursor/skills/okf/visualize.py --workspace
```

The workspace graph is written to the parent of the bundle root (the workspace
folder that holds the sibling clones), so it lives outside any single repo. Its
`bundles` dropdown filters across every sibling. When that file exists, each
per-bundle `viz.html` shows a `Workspace graph` link in its header pointing to
`../viz.html`, so the global graph is discoverable from any bundle. Generate the
workspace graph first, then (re)generate per-bundle graphs to pick up the link.

## Producer Rules

- Never delete existing knowledge during migration. Extend or update.
- Preserve existing `sources` frontmatter.
- Use first names only in tracked files when people are mentioned.
- Do not cite `sourcing/` as ground truth. Promote first.
