---
name: bundle-sync
description: |
  Install, update, list, drift-check, and environment-check bundle skills declared in bundle.toml.
  Use when a team bundle needs canonical skills vendored into .cursor/skills,
  bundle.lock.json refreshed, or AGENTS.md skill provenance updated.
metadata:
  author: dpr
  version: "0.1.0"
  department: DPR
  handle: bundle_sync
---

# Bundle Sync

`bundle-sync` keeps a bundle self-contained while preserving provenance for
skills installed from another repo.

## Manifest

Declare installed skills in `bundle.toml`:

```toml
[identity]
name = "magicai-bundle"
type = "bundle"

[skills.okf]
source = "../ai-first-dis/.cursor/skills/okf"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = []

[skills.ingest-knowledge]
source = "../ai-first-dis/.cursor/skills/ingest-knowledge"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = [
    "openai>=1.0.0",
    "python-dotenv",
    "markitdown[pptx,docx,pdf,xlsx]>=0.1.4",
    "pptx2png>=2025.1",
]
```

The source may point directly at a skill directory containing `SKILL.md`.
Supported `source_kind` values are `sibling-path`, `git-url`, `public-repo`,
`npm-package`.

## Commands

Run from the target bundle root:

```bash
python .cursor/skills/bundle-sync/bundle_sync.py install
python .cursor/skills/bundle-sync/bundle_sync.py update
python .cursor/skills/bundle-sync/bundle_sync.py status
python .cursor/skills/bundle-sync/bundle_sync.py status --check-source
python .cursor/skills/bundle-sync/bundle_sync.py doctor
python .cursor/skills/bundle-sync/bundle_sync.py list
```

Or run from the canonical source with an explicit target:

```bash
python ../ai-first-dis/.cursor/skills/bundle-sync/bundle_sync.py --target . install
```

## Outputs

- Copies declared skills to `.cursor/skills/<name>/`.
- Writes `bundle.lock.json` with source, ref, resolved ref, install path, content hash, source hash, and dependency group.
- Merges each skill's optional dependency group into `pyproject.toml`.
- Refreshes the generated skills table in `AGENTS.md` only when `install --refresh-agents` or `update --refresh-agents` is used.
- Checks source availability, Python package dependencies, required tools, and known environment variables with `doctor`.

## Rules

- Do not edit vendored `SKILL.md` files in consuming bundles. Update upstream in
  `ai-first-dis`, then run `bundle-sync update`.
- Owned domain skills stay in `.cursor/skills/` but are omitted from `bundle.toml`.
- `bundle-sync status` must report no drift before a bundle rollout is considered green.
- Run `bundle-sync doctor` after install when validating whether the local environment can execute installed skills.
