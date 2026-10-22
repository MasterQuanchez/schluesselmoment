# Transcript pseudonym lexicon

Use this lexicon when sanitizing meeting transcripts for ingestion into the
drp-scanner-usability repo. **Replace sensitive identifiers with stable fictional
equivalents** — not with `[redacted]` placeholders — so operational context
(HU vs bin, which WT failed, who owns which decision) stays readable.

## Principles

1. **Pseudonymize, don't obliterate.** Keep numbers, relationships, and distinctions.
2. **Stay consistent within one transcript.** The same real identifier always maps to
   the same dummy value in that session.
3. **Align with repo conventions** below so sanitized transcripts match reference docs.
4. **Hard-redact only** credentials (passwords, API keys, tokens, PINs) and truly
   unusable leaks (real personal emails if no safe substitute is known).

---

## People

| Real | Sanitized |
|------|-----------|
| `Last, First` speaker label | `First` or `First (Role)` |
| `First Last` | `First` or `First M.` if initial is used in repo |
| Corporate user ID (e.g. `Z004WYAM`) | `USER-01`, `USER-02`, … (stable per person in transcript) |
| Unknown external contact | Role label: `Vendor PM`, `Operator A` |

**Known project first names (use consistently):** Anna, Maria, Sim, Laura, Izze,
Bjoern H., Henning P., Niklas R., Juancho, Rita, Lina, Lisa, Tigis, Jann, Nakal, Sue

---

## Organization & company

| Real | Sanitized |
|------|-----------|
| Full company legal name | `[Company]` or `SE` |
| Legacy company name | `[Company Legacy]` or `SGRE` |
| Org unit code (`SE WP…`, internal org strings) | `OU-LOG-01` (default logistics org) — use `OU-IT-01`, `OU-WH-01` only if the transcript clearly distinguishes multiple org units |
| Vendor company (Worktechniques) | `Worktechniques` (public vendor name; keep) |

---

## Sites & locations

Keep **pilot site names** when they are operational context, not PII:

- `Berlin`, `Mülheim`, `Wittenburg` — keep as-is (used throughout repo)
- Other internal site codes → `Site-A`, `Site-B`, …

---

## SAP EWM / warehouse identifiers

Keep **standard SAP artifacts** (not customer-specific):

- Transaction `/SCWM/RFUI`
- Storage types: `S820`, `S821`, `S870`, `S871`, `S710`, `S711`, `S740`, `S741`
- GS1 Application Identifiers: `00` (HU), `04` (Material), `05` (Batch), `06` (Serial), `01` (Delivery)
- Function keys: F1, F3, F4, F6, etc.

| Real | Sanitized | Notes |
|------|-----------|-------|
| Warehouse number | `WH-01` | Matches `<WH_01>` in [rf-standard-operating-instructions](../../reference/rf-standard-operating-instructions.md) |
| Resource | `RES-01` | Matches `<RES_01>` |
| Handling unit (HU) | `157151900099000001`, `157151900099000002`, … | Increment last digits; matches [rf-menu-overview-sanitized](../../reference/rf-menu-overview-sanitized.md) examples |
| Material number | `A9B90312682`, `GP986112`, … | Use repo examples first; then `MAT-10001`, `MAT-10002` |
| Batch | `3995507104`, `BATCH-20001`, … | |
| Serial number | `400009749524-733`, `SN-30001`, … | |
| Outbound delivery | `8009900001`, `DEL-8009900002`, … | |
| Warehouse task (WT) | `WT-900001`, `WT-900002`, … | |
| Warehouse order (WO) | `WO-800001`, `WO-800002`, … | |
| Storage bin | `BIN-R01-A01`, `BIN-R01-A02`, … | Rack–aisle–position pattern preserves “wrong bin” narratives |
| Cost center / order (adhoc GI) | `CC-500001`, `ORD-600001` | |

---

## Contact & paths

| Real | Sanitized |
|------|-----------|
| Email `first.last@company.com` | `first@example.internal` (derive from first name when known) |
| Phone | `+49-555-0100`, `+49-555-0101`, … |
| `C:\Users\<corp-id>\…` | `C:\Users\USER-01\Documents\…` (match corp-id pseudonym) |
| OneDrive / SharePoint URL with corp domain | `https://sharepoint.example/sites/ProjectDocs/…` |

---

## Mapping table (append to sanitized output)

After the transcript, include a short **Pseudonym key** only for items that were
transformed (not for already-safe terms like `S820`):

```markdown
## Pseudonym key
| Pseudonym | Category | Notes |
|-----------|----------|-------|
| Anna | person | was speaker "Schmidt, Anna" |
| OU-LOG-01 | org unit | was "SE WP DS BP" |
| 157151900099000001 | HU | first HU mentioned |
| WT-900001 | warehouse task | |
```

Do **not** include the original sensitive values in the key — category + ordinal
is enough for the user to sanity-check without re-leaking PII.

---

## Example

**Before:**
```
<v Mueller, Maria>WT 7012345 for HU 8000567890123 failed in bin 01-02-03-A.
Email z004wyam@siemens-energy.com for the SE WP DS BP team.</v>
```

**After:**
```
Maria: WT-900001 for HU 157151900099000001 failed in bin BIN-R01-A01.
Email maria@example.internal for the OU-LOG-01 team.
```
