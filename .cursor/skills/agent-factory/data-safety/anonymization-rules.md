# Anonymization Rules

Detailed guidance for removing or replacing sensitive data before content enters
version control.

## Names

| Scenario | Bad | Good |
|----------|-----|------|
| Referencing a colleague | "Jane Doe noted that..." | "Jane noted that..." |
| Transcript speaker label | `**Doe, Jane** (0:03)` | `**Jane** (0:03)` |
| External contact mentioned once | "John Smith from Acme Corp" | "the vendor PM" or "John" |
| Email in text | "jane.doe@example.com" | Remove entirely or use "[email removed]" |

**Rule: First names only. Never write last names in tracked files.**

## Corporate Identifiers

| What | Why it's sensitive | Replacement |
|------|-------------------|-------------|
| Windows username (e.g., `Z004WYAM`) | Directly identifies an individual | `[user]` or remove the path |
| Employee ID / badge number | HR-identifiable | Remove entirely |
| Org unit code (e.g., `OE-1234`) | Resolves to people via corporate directory | `[Org Unit]` |
| Pay grade / Entgeltgruppe | HR-sensitive | Remove entirely |

**Watch for auto-generated paths:** Cursor, Teams, and screenshot tools often embed
paths like `C:\Users\Z004WYAM\AppData\...`. These must be redacted before committing.

## Company and Organization Names

Use abbreviations from [abbreviations.md](abbreviations.md). When no abbreviation
exists, use `[Company]` or `[Organization]` as a placeholder and add an entry to
the abbreviation list.

## Meeting Notes

Tracked meeting files contain **structured summaries only**:
- Key topics discussed
- Decisions made
- Action items with owners (first names only)

Raw transcripts with full speaker labels go to `.sensitive/meetings/`. Add a vault
reference at the bottom of the tracked file:

```markdown
## Transcript

> **Transcript moved to local vault.** The raw transcript for this meeting is
> stored in `.sensitive/meetings/transcript-<filename>.md` and is not tracked
> by git. This protects personal data and conversational content from accidental
> exposure.
```

## Git History

Even after anonymizing current files, git history retains all old versions. If
sensitive data was committed in the past:

1. **Audit**: `git log --all --oneline` — check for commits that may contain PII
2. **Assess**: Is this a private repo? Who has access?
3. **Clean** (if needed): Squash into a single clean commit on an orphan branch

```bash
git checkout --orphan clean-main
git add -A
git commit -m "Initial commit — anonymized"
git branch -M clean-main main
git push --force origin main   # DESTRUCTIVE — inform all team members first
```

**This is a human checkpoint.** Never rewrite git history without explicit user approval.

## What's Acceptable in Tracked Files

These do NOT need anonymization:
- Established abbreviations (SE, SGRE, WP, DIS)
- Vendor and product names (SAP, Azure, Zebra, ECharts)
- Location names (cities, sites, warehouses)
- Technical system names and SAP transaction codes
- Financial figures needed for project tracking (not individual compensation)
- First names of team members in action items
