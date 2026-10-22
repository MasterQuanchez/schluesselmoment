---
name: knowledge-audit
description: |
  Audit an OKF bundle knowledge graph for drift, inconsistency, and data-safety
  risks that structural validation misses: date drift (filename vs frontmatter),
  future-dated entries, dangling frontmatter sources, broken in-bundle and
  cross-bundle links, PII leakage (surnames, emails, corporate IDs, user paths),
  and stale reviews. Then reason over the content for cross-file contradictions.
  Use when asked to: audit the knowledge base, check for drift, find
  inconsistencies, verify the bundle before a meeting or PR, or check data safety
  of tracked knowledge.
  TRIGGERS: 'audit knowledge', 'check for drift', 'find inconsistencies', 'knowledge health', 'verify the bundle', 'is the knowledge base consistent'.
metadata:
  author: dpr
  version: "0.1.0"
  department: DPR
  handle: knowledge_audit
---

# Knowledge Audit

Keep ingested knowledge trustworthy. `okf validate` checks structure (types,
indexes, link syntax); this skill checks **truth and safety**: that dates are
consistent and plausible, references resolve, no PII leaked, and facts do not
contradict across files. Run it before a demo, before a PR, and after every
ingest.

## Two layers

1. **Deterministic pass (script).** Fast, CI-friendly. Catches mechanical drift
   and PII without an LLM.
2. **Semantic pass (agent).** You read the flagged files plus recent `memory/`
   and reconcile contradictions a regex cannot see.

## Step 1: Run the deterministic audit

From the bundle root:

```bash
python .cursor/skills/knowledge-audit/audit.py
```

Sweep every sibling bundle in the workspace:

```bash
python .cursor/skills/knowledge-audit/audit.py --workspace
```

What it reports (ERROR fails the run, WARN is advisory):

| Check | Level | Why it matters |
|---|---|---|
| filename date != frontmatter `timestamp` | ERROR | Date transpositions corrupt chronology and ordering |
| `timestamp` / `last_reviewed` in the future | ERROR | Future-dated memory mis-sorts and signals bad ingest |
| in-bundle `sources:` path missing | ERROR | Dangling provenance; the cited file moved or was mistyped |
| in-bundle markdown link target missing | ERROR | Knowledge graph edge points nowhere |
| cross-repo `sources:`/link unresolved | WARN | Often clone naming/co-location (Q5), not a content bug |
| PII: email, `[A-Z]\d{6,}` ID, `C:\Users\...` path | ERROR | First-names-only / vault rule violated | <!-- pii-scan: ignore -->
| `last_reviewed` older than `--stale-days` (default 90) | WARN | Knowledge may have drifted from reality |

Useful flags: `--root <path>`, `--stale-days <n>`, `--today YYYY-MM-DD`.

## Step 2: Semantic reconciliation

The script cannot catch contradictions in prose. After it runs, read the
affected concepts plus the newest `memory/` summaries and check for:

- The same event, decision, owner, or date stated differently in two files.
- An open question marked resolved in one file but still open in another.
- Entities (people, products, systems) described inconsistently across bundles.
- Claims marked `<!-- UNVERIFIED: ... -->` that are now contradicted or confirmed.
- Surnames written as `Last, First` or `First Last` (the script does not gate on
  this - judge it here and route real names to first-name-only or the vault).

Report each contradiction with both file paths and the conflicting statements.
Propose the corrected value; do not guess a date or owner - if ground truth is
unclear, surface it for the user.

## Step 3: Fix and re-run

- Fix mechanical findings directly (dates, links, sources, PII).
- Route any real PII into `.sensitive/` and replace with first name / role.
- Re-run the deterministic audit until it is clean.
- For an OKF bundle, refresh the graph afterwards:

```bash
python .cursor/skills/okf/index.py
python .cursor/skills/okf/validate.py
python .cursor/skills/okf/log.py Update "Knowledge audit: fixed <summary>"
```

## Quality bar

- **Zero ERRORs** before a demo or PR is considered green.
- **No PII** in tracked files - surnames, emails, corporate IDs, user paths.
- **Provenance resolves** - every `sources:` path and link points to a real file.
- **No contradictions** left unflagged between memory and knowledge.
