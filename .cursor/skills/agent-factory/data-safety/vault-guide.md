# The `.sensitive/` Vault — Sharing Raw Material Without Putting It in Git

How to keep raw, high-PII material out of git while still sharing it with the
teammates who need it. The **data-safety** skill points here from `setup-guide.md`
Step 4. This pattern is optional — a solo user can keep `.sensitive/` purely local.

## The model

1. Keep **git** for versioned, shareable, **anonymized** work: meeting summaries,
   deliverables, rules, hooks, and scripts.
2. Keep **raw and high-PII material** in a folder named **`.sensitive/`** at the repo
   root. It is listed in `.gitignore`, so it **never enters git history**.
3. If the project folder is synced via **OneDrive/M365**, `.sensitive/` syncs to
   everyone with folder access — so it acts as a **shared team vault**, not a
   "only on my laptop" stash.

**Typical contents of `.sensitive/`:**

| Item | Why it lives here |
|------|-------------------|
| Raw / working transcripts | Full names, customer detail, unparsed ASR |
| Redacted working copies (optional) | Intermediate files before summaries |
| `redaction-config.local.json` | Real company names, org patterns, participant names |

**Tracked git content** stays at the summary layer: first names only, placeholders
like `[Company]`, and vault pointers at the bottom of notes — never the raw body.

## Why split git and OneDrive?

- **Git history is permanent.** Once PII is committed, removing it later is painful
  and never fully guaranteed across all clones and forks.
- **OneDrive (with your team's sharing model)** gives collaborators the **same files**
  without teaching git to hold secrets.
- The kit's **hooks and scanner** still guard what *does* get committed; the vault is
  where you intentionally keep what must **not** be committed.

## How a teammate gets the same redaction rules (without git)

One person fills `redaction-config.local.json` once and places it in
`.sensitive/redaction-config.local.json`. OneDrive syncs it to the rest of the team.
The ingest scripts and the PII scanner **auto-discover** that path — nothing sensitive
needs to be committed.

Each person still does the **two one-time, per-clone** steps from `setup-guide.md`:

1. `git config core.hooksPath .githooks`
2. Ensure `.sensitive/` exists with the config present — either copy from
   `redaction-config.example.json` and edit, or wait for OneDrive to sync a config a
   teammate already published.

## Honest limits (please read)

- **Not "private to one machine."** On a shared OneDrive folder, `.sensitive/` is
  visible to everyone with access, subject to **M365 permissions and audit policies**.
- **OneDrive version history** can retain older file versions. Treat the vault as
  **controlled team space**, not unlogged personal storage.
- **This is not enterprise DLP for every path.** Paste-into-chat, screenshots, cloud
  agents, and non-git copies are still human/product boundaries — the kit reduces risk
  on the **git + ingest** path, not everywhere.

## Mental model

```
OneDrive project folder
├── git-tracked: anonymized summaries, kit files, code/docs
└── .sensitive/ (gitignored, OneDrive-synced): raw transcripts + local redaction config
```

Git = durable, reviewable, safe-to-fork artifacts.
`.sensitive/` on OneDrive = shared team vault for material that must never enter git.
