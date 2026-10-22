# Data-Safety Kit — Setup Guide

Step-by-step walkthrough for arming the data-safety kit in a fresh clone. The
**data-safety** skill offers this when the kit is not yet set up. The user can skip
any step they've already done.

> **Why this exists.** The kit ships its *logic* in git (skills, hooks, scanner),
> but the parts that touch real PII — your redaction terms and the `.sensitive/`
> vault — are **per-user and local on purpose**. They are gitignored, so a fresh
> clone never contains them. These steps create them locally, once per clone.
> Nothing sensitive is ever committed.

## Step 1 — Enable Cursor Privacy Mode

Privacy Mode is **off by default** and must be enabled manually. It prevents Cursor
from storing your prompts and code for training or review.

1. Open **Cursor Settings** → scroll to the bottom section **Privacy**
2. Set **Privacy Mode** to **Enabled**
3. Confirm the notice that your code and prompts are not stored

On a Business/Enterprise plan your admin may enforce this org-wide — still verify
your personal setting is on. Do this **before** putting any internal content into a
prompt.

## Step 2 — Arm the commit gate (one-time per clone)

The deterministic PII scanner (`scripts/pii_scan.py`) runs as a git `pre-commit`
hook, but git only uses the repo's `.githooks/` directory once you point it there:

```bash
git config core.hooksPath .githooks
git config --get core.hooksPath   # expect: .githooks
```

From now on, every `git commit` scans staged content for emails, corporate IDs,
user-home paths, and your configured company/org/participant terms, and **blocks the
commit on a hit**.

Run it ad hoc anytime:

```bash
python scripts/pii_scan.py --staged      # scan what's staged
python scripts/pii_scan.py <path>        # scan a specific file
```

## Step 3 — Create your local redaction config

The scanner and the transcript redactor read your **real** sensitive terms from a
gitignored config. Copy the shipped template and fill it in:

```bash
# macOS / Linux
mkdir -p .sensitive
cp .cursor/skills/ingest-transcript/redaction-config.example.json \
   .sensitive/redaction-config.local.json
```

```powershell
# Windows / PowerShell
New-Item -ItemType Directory -Force .sensitive | Out-Null
Copy-Item ".cursor/skills/ingest-transcript/redaction-config.example.json" `
          ".sensitive/redaction-config.local.json"
```

Then edit `.sensitive/redaction-config.local.json` and fill in your project's real
values: company / legacy names, org-code patterns, and participant full names.

| Question | Answer |
|----------|--------|
| Why manual? | It contains **real** PII. No safe default can live in git. |
| Why not committed? | Clones, forks, CI, and history all leak tracked secrets. |
| Where does it live? | `.sensitive/redaction-config.local.json` — gitignored. Scripts auto-discover it there (searched upward from the input and in `.sensitive/`). |

> **`*.local.json` and `.sensitive/` are gitignored.** Never commit either. Only the
> `redaction-config.example.json` template is tracked.

## Step 4 — (Optional) Share the vault across a team

If your repo is synced via OneDrive/M365 and you want teammates to share the same
raw material and redaction rules **without** committing them, read
[vault-guide.md](vault-guide.md) for the `.sensitive/` OneDrive vault pattern and its
honest limits.

## Step 5 — Verify

1. **Hooks registered:** open **Cursor Settings → Hooks** and confirm the
   `beforeSubmitPrompt` raw-transcript check is listed (it ships in `.cursor/hooks.json`).
2. **Commit gate armed:** `git config --get core.hooksPath` returns `.githooks`.
3. **Config discovered:** run the redactor on any small `.txt`/`.docx` and confirm it
   reports your configured terms being redacted:

   ```bash
   py .cursor/skills/ingest-transcript/scripts/prepare_transcript.py "<some file>"
   ```

Restart Cursor or start a new chat if you just enabled Privacy Mode or changed hooks.

## After setup

Return to the **data-safety** skill — it will detect the kit is armed and proceed
with classifying, anonymizing, and routing your content. For meeting transcripts, use
the **ingest-transcript** skill, which redacts locally before anything reaches an agent.
