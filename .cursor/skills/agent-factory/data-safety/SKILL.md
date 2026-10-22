---
name: data-safety
description: |
  Data safety and privacy enforcement for GDPR/BDSG compliance. Triggers when users add data files, create meeting notes, reference people by name, handle transcripts, or ask about anonymization, data protection, or sensitive content. Manages the .sensitive/ vault, anonymization rules, and abbreviation conventions.
  TRIGGERS: 'check data safety', 'anonymize this', 'add meeting notes', 'is this safe to commit', 'data protection', 'GDPR', 'sensitive data', 'vault', 'privacy mode', 'retention', 'copilot anonymize', 'how long is data stored', 'is cursor safe'.
---

# Data Safety

Enforce data privacy conventions and GDPR/BDSG compliance for all content in this
repository. Prevents personal and corporate data from entering version control.

## Step 0 — Setup check (stateless gateway, runs every time)

The kit ships its logic in git, but the parts that touch real PII — the commit gate,
your local redaction config, and the `.sensitive/` vault — are **per-clone and local
on purpose** (gitignored). A fresh clone never has them. Before doing real work,
check whether this clone is armed:

1. **Commit gate:** is `git config --get core.hooksPath` set to `.githooks`?
2. **Local config:** does `.sensitive/redaction-config.local.json` (or
   `redaction-config.local.json` at the repo root) exist?

**If either is missing** → read [setup-guide.md](setup-guide.md) and walk the user
through the one-time setup, then continue. **If both are present** → continue to the
checks below.

**Privacy Mode** cannot be detected from the repo. Remind the user once per session
to confirm it is enabled (see "Before You Start" below) — but do **not** treat it as
a setup gate or re-run the full setup walkthrough for it alone.

This is the same detect-then-guide pattern the `design` skill uses for the toolkit;
it never blocks, it guides.

## Before You Start — Three Checks

Complete these before putting any sensitive content into a Cursor prompt or tracked file.

### 1. Enable Privacy Mode in Cursor

Privacy Mode prevents Cursor from storing your prompts and code for training or
review. **It is off by default and must be enabled manually.**

> **How to verify:**
> 1. Open Cursor Settings → scroll to the bottom section **Privacy**
> 2. Set **Privacy Mode** to **Enabled**
> 3. You should see a confirmation that your code and prompts are not stored
>
> On a Business or Enterprise plan, your admin may enforce this at org level —
> but still verify your personal setting is on.

If Privacy Mode is off, every prompt you send (including any content you paste) may
be retained and reviewed. Enable it before continuing.

### 2. Understand data retention

Data you send to Cursor is processed by the underlying model provider (Anthropic,
OpenAI, etc.) and by Cursor itself. **Retention policies vary by plan, model, and
your privacy settings — and they change over time.** Do not rely on specific numbers
stated anywhere other than the current official policies:

- **Cursor**: [cursor.com/privacy](https://cursor.com/privacy) · [cursor.com/security](https://cursor.com/security)
- **Anthropic (Claude)**: [anthropic.com/legal/privacy](https://www.anthropic.com/legal/privacy)
- **OpenAI (GPT)**: [openai.com/policies/privacy-policy](https://openai.com/policies/privacy-policy)

**Rule of thumb:** treat everything you send as potentially retained. If data cannot
be retained under any circumstances, it must not be sent — use the `.sensitive/`
vault instead and work with anonymized summaries.

### 3. Optional — Use MS Copilot for a pre-clean pass

If your source material is heavy with PII (full meeting transcripts, HR content,
customer details), you have two options:

**Option A — Vault-first (preferred):** Keep the raw file in `.sensitive/` and write
an anonymized summary into the tracked file yourself. You control every token. For
meeting transcripts, the **ingest-transcript** skill ships a local, no-AI redactor
(`prepare_transcript.py`) that does this pre-pass for you — surnames → first name +
initial, plus emails / phones / user-home paths / corporate IDs — writing a redacted
working copy to `.sensitive/meetings/`. Use it instead of hand-redacting.

**Option B — Copilot pre-clean + manual verify:** Paste the content into
[Microsoft Copilot](https://copilot.microsoft.com) (the SE-sanctioned enterprise
version, identifiable by the green shield / "Protected" label) and ask it to
produce an anonymized draft. Then **manually verify the output** before it enters
the repo or a Cursor prompt.

> **Cursor recommendation:** LLMs — including Copilot — are not reliable redactors.
> They miss ~5–15% of PII on typical enterprise content. Treat any LLM-generated
> anonymization as a first draft that requires human review, never as a finished
> result. The vault-first approach is safer because you remain in control of every
> substitution.

## Inputs

One of:
- Content to review for sensitive data (files, meeting notes, transcripts)
- A question about what's safe to commit
- New data files being added to the project
- A request to anonymize content

## Outputs

- Identified sensitive data with specific replacement guidance
- Anonymized content ready for tracked files
- Vault routing (what goes to `.sensitive/`, what can be tracked)

## Procedure

### Step 1: Classify the content

Read the content and check for items from [anonymization-rules.md](anonymization-rules.md):

| Severity | What to look for |
|----------|-----------------|
| **HIGH** | Full names with last names, corporate user IDs, Windows usernames in paths, employee IDs, org unit codes, pay grades, credentials |
| **MEDIUM** | Vendor names with contract details, internal project codes with timelines, financial data, IT infrastructure details, documented security vulnerabilities |
| **LOW** | Location details, SAP transaction codes |

### Step 2: Apply anonymization

For each finding, apply the rules from [anonymization-rules.md](anonymization-rules.md).
Use [abbreviations.md](abbreviations.md) for the canonical abbreviation list.

### Step 3: Route to vault or tracked files

| Content type | Where it goes |
|-------------|--------------|
| Raw meeting transcripts with speaker names | `.sensitive/meetings/` |
| Security vulnerability details | `.sensitive/security-notes/` |
| Documents with PII that can't be anonymized | `.sensitive/` |
| Structured meeting summaries (anonymized) | Tracked folder |
| Code, configs, documentation (no PII) | Tracked as normal |

When routing to the vault, add a reference in the tracked file:

```markdown
> **Full content moved to local vault.** See `.sensitive/<path>` (gitignored).
```

### Step 4: Verify git safety

- Check that `.sensitive/` is in `.gitignore`
- Warn about auto-generated paths (Cursor, Teams, screenshots) that may embed corporate IDs
- If the user has committed sensitive data in the past, advise on git history cleanup

**Deterministic backstop (recommended).** Beyond this advisory pass, the repo ships a
hard pre-commit gate: `scripts/pii_scan.py` scans staged content for emails,
corporate IDs, user-home paths, and configured company/org/participant terms, and
blocks the commit on a hit. Enable once per clone:

```bash
git config core.hooksPath .githooks
```

Run it ad hoc with `python scripts/pii_scan.py --staged` (or `... PATH ...`). This is
the deterministic complement to the model-advisory rules above; it is enforced by a
git pre-commit hook regardless of what the agent does.

## Vault Pattern

The `.sensitive/` directory is gitignored and serves as the local vault for all
content that must never enter version control. See [vault-guide.md](vault-guide.md)
for the full convention, including team sharing via an OneDrive-synced vault and its
honest limits. The `.sensitive/README.md` file is the team-specific vault note, present in this
kit, while the tracked `vault-guide.md` is the portable, durable reference; keep both
in view.

## Human Checkpoints

- **Before committing**: User confirms anonymization is complete
- **Git history**: User decides whether to rewrite history if past commits contain PII

## Constraints

- Never write last names into tracked files — first names or role descriptions only
- Never write corporate user IDs, employee IDs, or org unit codes into tracked files
- Never move content from `.sensitive/` to tracked files without anonymizing first
- Always use the canonical abbreviation from [abbreviations.md](abbreviations.md)
