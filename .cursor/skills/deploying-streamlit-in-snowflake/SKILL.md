---
name: deploying-streamlit-in-snowflake
description: >-
  Step-by-step prepare, verify, and promote Streamlit in Snowflake (SiS) apps
  via GitLab CI/CD (DEV → UAT → master/PRD). Checks streamlit_src, streamlit_setup.py,
  local Streamlit startup, environment.yml, CI CLI flags on streamlit_setup.py, and deploy jobs; asks before editing;
  helps commit, merge requests, and pipeline deploys. Use when packaging or deploying
  SiS, Streamlit in Snowflake, streamlit_src, streamlit_setup.py, SiS CI/CD, or
  promoting to UAT/PRD.
---

# Deploying Streamlit in Snowflake (SiS)

Guided workflow: verify the Snowflake GitLab project → fix gaps (only with user approval) → start Streamlit locally and confirm clean startup → finish remaining config checks → commit on **DEV** → merge to **UAT** (deploy) → user verifies → merge **UAT → master** (PRD).

For Streamlit UI/code help, also use `developing-with-streamlit` if available. Full admin docs: [reference.md](reference.md). Templates: [templates/](templates/).

## Operating rules (always)

1. **Ask before changing code.** After each verification finding, report what is wrong/missing and ask: “May I apply this fix?” Do not edit until the user agrees. Batch related fixes into one ask when sensible.
2. **One phase at a time.** Finish the current checklist phase before starting the next. Show a short progress tracker after each phase.
3. **Do not skip promotion gates.** Never create the UAT→master MR until the user confirms UAT works.
4. Prefer matching existing project conventions over inventing new names.

---

## Phase 0 — Confirm repo and branch (start here)

**Say this to the user at the start of every session using this skill:**

> This workflow must run in the **GitLab repository of your Snowflake project** (the repo that already has / will get `streamlit_src`, `CICD_Setup`, and `.gitlab-ci.yml`). You should be on the **`DEV`** branch before we prepare or commit anything.

Then verify with git (do not change branches unless the user asks):

```bash
git remote -v
git branch --show-current
git status
```

Gate:

| Check | Required |
|-------|----------|
| Working tree is the Snowflake project GitLab repo | yes |
| Current branch is `DEV` | yes |

If not on `DEV`: stop and tell the user to check out `DEV` (or ask if you should). Do not proceed to edits or commits until they confirm.

Progress tracker (copy and update throughout):

```
SiS promote progress:
- [ ] Phase 0: On DEV in Snowflake GitLab project
- [ ] Phase 1: Code/layout verified (fixes approved + applied)
- [ ] Phase 2: streamlit_setup.py TODO params confirmed with user (+ CI CLI flags verified)
- [ ] Phase 3: Local Streamlit server starts with no errors
- [ ] Phase 4: environment.yml verified
- [ ] Phase 5: .gitlab-ci.yml SiS jobs verified
- [ ] Phase 6: DEV committed and pushed
- [ ] Phase 7: MR DEV → UAT merged; UAT pipeline OK
- [ ] Phase 8: User confirmed SiS works in UAT
- [ ] Phase 9: MR UAT → master merged; PRD pipeline OK
```

---

## Phase 1 — Verify app structure (read-only first)

Inspect the repo. Report findings; **ask before** moving/creating files.

Required layout at GitLab project root:

```
streamlit_src/                 # required — all SiS app logic
  streamlit_main.py            # required — home/entrypoint
  environment.yml              # recommended
  pages/                       # optional — multi-page subpages
  utils/                       # optional
CICD_Setup/
  streamlit_setup.py           # required
.gitlab-ci.yml                 # SiS deploy jobs required
```

Verify:

- [ ] `streamlit_src/` exists at repo root
- [ ] Entrypoint is `streamlit_main.py` (or name matches config)
- [ ] Multi-page apps use `streamlit_src/pages/`
- [ ] App logic is not only outside `streamlit_src/` (setup uploads that folder only)
- [ ] Single-page vs multi-page choice is clear

| Single-page | Multi-page |
|-------------|------------|
| One main `.py`; small apps; can use Snowsight | Mid/large; local + CI/CD only; `pages/` folder |

If gaps: list concrete fixes → ask permission → apply only approved changes.

---

## Phase 2 — Verify `CICD_Setup/streamlit_setup.py`

**Required path:** `CICD_Setup/streamlit_setup.py`

- If **missing**: propose copying [templates/streamlit_setup.py](templates/streamlit_setup.py) → ask → copy on approval. Do not invent a new deploy script.
- If **present**: do not overwrite customized scripts unless the user asks to reset to the admin template.

### Verify CI CLI compatibility (required for `.sis.gitlab-ci.yml`)

Projects that use the **preferred** SiS jobs (trigger `.sis.gitlab-ci.yml` with `STREAMLIT_*` / `SNOWFLAKE_*` variables) invoke `streamlit_setup.py` with extra flags. The script **must** accept them; otherwise the deploy job fails with:

`streamlit: error: unrecognized arguments: -name … -title … -query_wh … -schema … -stage …`

**Checklist** — confirm `CICD_Setup/streamlit_setup.py` includes these optional `argparse` entries (the skill template ships them):

| CI variable | CLI flag | `dest` / fallback field |
|-------------|----------|-------------------------|
| `STREAMLIT_NAME` | `-name` | `streamlit_name` |
| `STREAMLIT_TITLE` | `-title` | `streamlit_title` |
| `STREAMLIT_ENTRYPOINT` | `-entrypoint` | `streamlit_entrypoint` |
| `STREAMLIT_QUERY_WAREHOUSE` | `-query_wh` | `streamlit_query_warehouse` |
| `SNOWFLAKE_SCHEMA` | `-schema` | `snowflake_schema` |
| `SNOWFLAKE_STAGE` | `-stage` | `snowflake_stage` |

The `param_*` defaults should use `args.<dest> or <default_formula>` so local/manual runs still work without CI flags.

If any flags are missing: propose copying the updated [templates/streamlit_setup.py](templates/streamlit_setup.py) or patching only the `argparse` + `param_*` block → **ask** → apply on approval.

Legacy projects that trigger the root `CI_template/.gitlab-ci.yml` (no `STREAMLIT_*` CI variables) may not pass these flags; still prefer the updated template for forward compatibility.

### Collect TODO parameters from the user (required)

The admin template has this block — **ask the user for each value** before changing anything. Do not silently keep placeholders.

```python
#
# TODO: Adjust these parameters for your Streamlit in Snowflake application
# CI (.sis.gitlab-ci.yml) overrides via -name, -title, -entrypoint, -query_wh, -schema, -stage
#
param_streamlit_name = args.streamlit_name or f"STL_{args.project_name}_Streamlit".replace(" ", "_").upper()
param_streamlit_title = args.streamlit_title or f"{args.project_name} Streamlit"
param_streamlit_entrypoint = args.streamlit_entrypoint or "streamlit_main.py"
param_streamlit_query_warehouse = args.streamlit_query_warehouse or f"WH_{args.environment_name}_{args.project_name}_DEPLOYMENT_XS"
param_snowflake_schema = args.snowflake_schema or f"PS_AC_{args.project_name}"
param_snowflake_stage = args.snowflake_stage or f"STG_{args.project_name}_Streamlit".replace(" ", "_").upper()
```

Resolve **`project_name`** first:

- Default: **GitLab repository name** (from `git remote` / folder / `CI_PROJECT_NAME` — e.g. `CLAIMS_MGM`).
- Confirm with the user: “I'll use `<repo_name>` as project_name — OK, or different?”

Then ask for each parameter. If they are unsure, **recommend the defaults below** (using the confirmed `project_name` and `environment_name` from CI: `UAT` / `PRD` at deploy time).

| Parameter | Ask the user | Recommended default if unsure |
|-----------|--------------|-------------------------------|
| `param_streamlit_name` | Object name in Snowflake (not shown to end users) | `STL_{project_name}_Streamlit` → uppercase, spaces → `_` |
| `param_streamlit_title` | Title shown in the UI | `{project_name} Streamlit` |
| `param_streamlit_entrypoint` | Home/entrypoint file | `streamlit_main.py` (must match the file under `streamlit_src/`) |
| `param_streamlit_query_warehouse` | Warehouse for app + queries | `WH_{environment_name}_{project_name}_DEPLOYMENT_XS` |
| `param_snowflake_schema` | Schema for stage + Streamlit object | `PS_AC_{project_name}` |
| `param_snowflake_stage` | Internal stage for app files | `STG_{project_name}_Streamlit` → uppercase, spaces → `_` |

Example prompt pattern:

> Here are recommended defaults based on repo name `<project_name>`:
> - name: `STL_<PROJECT>_STREAMLIT`
> - title: `<project_name> Streamlit`
> - entrypoint: `streamlit_main.py`
> - warehouse: `WH_<ENV>_<PROJECT>_DEPLOYMENT_XS`
> - schema: `PS_AC_<PROJECT>`
> - stage: `STG_<PROJECT>_STREAMLIT`
>
> Accept these, or tell me what to change?

After they confirm, show the exact `param_*` assignments you will write, **ask permission**, then edit only that TODO block.

If the file already has custom values (or CLI/CI overrides): show current vs recommended, ask whether to keep or replace.

When CI jobs pass `STREAMLIT_*` / `SNOWFLAKE_*` variables (`.sis.gitlab-ci.yml` pattern), keep those job variables **aligned** with the confirmed `param_*` values (propose CI edits in Phase 5; ask before changing).

| Variable | Purpose |
|----------|---------|
| `param_streamlit_name` | Object name (not end-user visible) |
| `param_streamlit_title` | Title shown to users |
| `param_streamlit_entrypoint` | Home file (usually `streamlit_main.py`) |
| `param_streamlit_query_warehouse` | Warehouse for app + queries |
| `param_snowflake_schema` | Schema for stage + Streamlit object |
| `param_snowflake_stage` | Internal stage (created if missing) |

---

## Phase 3 — Local Streamlit startup check

After layout and `streamlit_setup.py` look correct, **start the app locally** and confirm it boots without errors before continuing.

1. Ask the user: “May I start the Streamlit server locally to verify startup?”
2. Resolve the entrypoint (usually `streamlit_src/streamlit_main.py`; must match `param_streamlit_entrypoint`).
3. Prefer the project’s existing venv / conda env if present. Check terminals so you do not start a duplicate server.
4. From the GitLab project root, start Streamlit (background), e.g.:

```bash
streamlit run streamlit_src/streamlit_main.py --server.headless true
```

5. Watch startup logs until healthy or failed:
   - **Pass:** no traceback; “You can now view your Streamlit app” (or equivalent); process stays up.
   - **Fail:** ImportError, SyntaxError, missing module, crash on first run — capture the error.
6. On failure: diagnose, propose code/dependency fixes, **ask before editing**, re-run until startup is clean (or user accepts a documented blocker, e.g. Snowflake secrets only available in SiS).
7. Missing packages here are OK to note; Phase 4 will formalize `environment.yml` — if startup failed only due to deps, fix/install with approval, then re-check startup before leaving this phase.
8. Stop the local server when verification is done (or leave it running if the user wants to click around), then continue.

Do not proceed to Phase 4 until startup is clean or the user explicitly waives a non-blocking local-only issue.

---

## Phase 4 — Verify `streamlit_src/environment.yml`

Recommended. Template: [templates/environment.yml](templates/environment.yml).

Checks:

- [ ] File exists under `streamlit_src/`
- [ ] `channels: [snowflake]`
- [ ] Streamlit version pinned
- [ ] **No** `python` pin (Snowflake picks runtime)
- [ ] Dependencies exist on Snowflake Anaconda channel (infer from imports)
- [ ] Packages needed for the clean Phase 3 startup are listed

Propose adds/edits → ask → apply on approval. If `environment.yml` changes add packages that were installed ad hoc in Phase 3, optionally re-run a quick local startup check.

---

## Phase 5 — Verify `.gitlab-ci.yml` SiS jobs

Search for `Deploy_UAT_Streamlit` and `Deploy_PRD_Streamlit` (suffixes like `_P` count).

- If present → confirm they watch `streamlit_src/**/*` and use sensible variables; skip adding duplicates.
- If missing → propose adding jobs from [templates/gitlab-ci-sis-jobs.yml](templates/gitlab-ci-sis-jobs.yml) (preferred: trigger `.sis.gitlab-ci.yml`) → ask → add on approval.

Legacy admin snippets (trigger root `.gitlab-ci.yml`) are in [reference.md](reference.md).

### Commit title rules (needed later for pipeline triggers)

- **Into UAT** (deploy UAT): branch `UAT`, title matches  
  `/^[A-Za-z][A-Za-z]+ [A-Za-z]+ 'DEV'? [A-Za-z]+ 'UAT'?$/`
- **Into master** (deploy PRD): branch `master`, title matches  
  `/^[A-Za-z][A-Za-z]+ [A-Za-z]+ 'UAT'? [A-Za-z]+ 'master'?$/`

Only changes under `streamlit_src/**/*` trigger Streamlit deploy jobs.

**Important:** Fixes to `CICD_Setup/streamlit_setup.py` or `.gitlab-ci.yml` alone do **not** satisfy the `changes:` rule. If a merge to UAT/master only touches those paths, `Deploy_UAT_Streamlit*` / `Deploy_PRD_Streamlit*` will **not** run. When redeploying after a setup-only fix, include a trivial change under `streamlit_src/**/*` in the same commit/MR (e.g. comment in `streamlit_main.py`) so the pipeline triggers.

When Phases 1–5 are green, summarize config (name, title, schema, stage, warehouse, jobs, local startup OK) and ask to proceed to commit.

---

## Phase 6 — Commit on DEV

Help the user commit **on `DEV`** (still ask before committing if your user rules require explicit commit requests — here the user is in this skill’s deploy flow, so confirm once: “Ready to commit these SiS prep changes on DEV?”).

1. Confirm branch is still `DEV`.
2. `git status` / `git diff` — show what will be committed.
3. Stage relevant files (not secrets).
4. Commit with a clear message about SiS prep/deploy readiness.
5. Push `DEV` to GitLab (`git push -u origin DEV` if needed).

Do not merge yet.

---

## Phase 7 — Promote DEV → UAT (deploy to UAT)

Goal: merge into `UAT` so GitLab runs `Deploy_UAT_Streamlit*` and deploys SiS to UAT.

1. Confirm user wants UAT promotion.
2. Create merge request **DEV → UAT** (via `glab`/`gh`-equivalent for GitLab, or GitLab UI instructions).
   - Ensure the **merge commit title** on `UAT` will satisfy the DEV→UAT regex above (e.g. style like `Feature Deploy 'DEV' to 'UAT'` — match the project’s existing commit-title convention).
3. Help merge the MR when the user approves.
4. Point the user to the GitLab pipeline; confirm `Deploy_UAT_Streamlit*` ran (triggered by `streamlit_src/**/*` changes).
5. Wait for pipeline success before Phase 8.

If the pipeline fails: help diagnose; fix on `DEV` (with approval), recommit, new MR or push as appropriate — do not jump to master.

---

## Phase 8 — User verifies UAT

**Hard gate.** Ask the user to open the SiS app in Snowflake UAT and confirm it works.

Do **not** create the UAT→master MR until they explicitly say UAT is OK.

Remind briefly:

- End users need `USAGE` on database, schema, and Streamlit object.
- App runs with owner’s rights on the query warehouse.

---

## Phase 9 — Promote UAT → master (deploy to PRD)

Only after UAT confirmation:

1. Create merge request **UAT → master**.
2. Ensure merge commit title on `master` matches the UAT→master regex (e.g. `Feature Deploy 'UAT' to 'master'` — follow project convention).
3. Help merge when the user approves.
4. Confirm `Deploy_PRD_Streamlit*` pipeline succeeds.
5. Mark progress complete; summarize what was deployed (object name, schema, stage).

---

## Runtime facts (do not ignore)

- SiS apps are schema-level objects; RBAC controls access.
- Owner’s rights at runtime (creating role = runtime role).
- One warehouse for app + queries; WebSocket idle ~15 minutes after last use.
- SiS ≠ open-source Streamlit version — respect [SiS limitations](https://docs.snowflake.com/en/developer-guide/streamlit/limitations).

## Multiple SiS apps in one repo

Deploy one after another with a **different stage** (and usually different Streamlit object name) per app. See [reference.md](reference.md).

## Additional resources

- [reference.md](reference.md) — admin documentation
- [templates/streamlit_setup.py](templates/streamlit_setup.py) → `CICD_Setup/streamlit_setup.py`
- [templates/environment.yml](templates/environment.yml), [templates/gitlab-ci-sis-jobs.yml](templates/gitlab-ci-sis-jobs.yml)
- Snowflake: [Build your first SiS app](https://docs.snowflake.com/en/developer-guide/streamlit/getting-started), [CREATE STREAMLIT](https://docs.snowflake.com/en/developer-guide/streamlit/create-streamlit-sql)
