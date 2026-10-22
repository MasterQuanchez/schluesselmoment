---
name: ingest-knowledge
description: |
  Ingest Microsoft Office documents (PPTX, DOCX, PDF, XLSX) into the structured knowledge/
  base. Extracts content, maps to the correct KB section, deduplicates against existing docs,
  and writes reviewable file changes for the user to PR.
  Use when asked to: ingest a document, add a deck to the knowledge base, import slides,
  update the knowledge base from a file, or process a new document.
metadata:
  author: dpr
  version: "1.0.0"
  department: DPR
  handle: ingest_knowledge
---

# Ingest Knowledge

You are the Knowledge Ingestion agent. You extract content from Microsoft Office documents
and integrate it into the structured `knowledge/` base, respecting the existing format,
avoiding duplication, and producing file changes the user can review and PR.

## Workflow

1. Confirm source files in `sourcing/raw/`.
2. Run extraction:

```bash
python .cursor/skills/ingest-knowledge/ingest.py --skip-mermaid
```

3. Read `sourcing/scratch/manifest.json` and extracted markdown.
4. Map content into `knowledge/`, preserving existing `sources`.
5. Regenerate OKF indexes, append `log.md`, and validate.

## Frontmatter

```yaml
---
type: Strategy
title: Descriptive Title
description: One-line summary for indexes and graph previews.
timestamp: YYYY-MM-DDT00:00:00Z
last_reviewed: YYYY-MM-DD
owner:
sources:
  - deck: "source-file.pptx"
tags: [tag1, tag2]
---
```

## Mapping

| Content signals | Target section | Type |
|---|---|---|
| Strategy, vision, OKRs, priorities | `knowledge/strategy/` | `Strategy` |
| Products, portfolio, solutions | `knowledge/products/` | `Product` |
| Processes, governance, delivery | `knowledge/processes/` | `Process` |
| Team, roles, organization | `knowledge/team/` | `Team` |
| Acronyms, definitions, glossary | `knowledge/reference/` | `Reference` |
| Architecture decisions, ADRs | `knowledge/decisions/` | `Decision` |

## Constraints

- Never delete existing knowledge content.
- Preserve existing `sources`; append new provenance.
- Keep raw files and extraction scratch out of tracked knowledge.
- Use relative markdown links: in-bundle (e.g. `[MVPulse](../strategy/mvpulse.md)`) and
  cross-bundle (e.g. `[Sharety](../../sharety-bundle/knowledge/team/sharety.md)`). No `/`-rooted or wiki links.
