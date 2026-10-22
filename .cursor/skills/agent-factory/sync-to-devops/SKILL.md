---
name: sync-to-devops
description: |
  Bidirectional sync between local specs in knowledge/specs/ and Azure DevOps work items. Pushes specs as Epics/Features/Stories, pushes decisions as comments, pulls status back into spec frontmatter. Single integration point for all DevOps operations.
---

# Sync to DevOps

Push local spec documents and decisions to Azure DevOps. Pull work item status back into spec frontmatter. No other skill needs to interact with DevOps directly — this is the single integration point.

## Inputs

One of:

- A spec file path (e.g., "sync knowledge/specs/E001-auth.md to devops")
- A decision log entry to add as a work item comment
- A request to pull status updates from DevOps

## Outputs

- Azure DevOps work items (Epic, Feature, User Story) created or updated
- Spec frontmatter updated with DevOps IDs and status
- Decision log entries pushed as work item comments

## Configuration

Read `config.yaml` (next to the orchestrator SKILL.md) for:

- `project.name` — DevOps project name
- `devops.area_path` — Area path for work items
- `specs_path` — Local specs directory

## Azure DevOps field mapping (spec → work item)

Specs follow `templates/spec.md`. **Do not** push only a one-line summary and a repo link — stakeholders who live in Azure DevOps need the same substance as the markdown spec.

| Spec section | ADO field | Notes |
|--------------|-----------|--------|
| Title (`# …`) | `System.Title` | Strip leading `#`; prefix with epic/feature id if useful (e.g. `E001: …`). |
| **Context** | Part of `System.Description` | Render as HTML `<h2>Context</h2>` + `<p>…</p>`. |
| **Requirements** (In / Out of scope) | Part of `System.Description` | Use `<h4>In Scope</h4><ul><li>…</li></ul>` and same for Out of scope. |
| **Features** (epics only) | Part of `System.Description` | List relative markdown links as plain text bullets under `<h2>Features</h2>`. |
| **Implementation Notes** | Part of `System.Description` | Full bullet list under `<h2>Implementation Notes</h2>` (decisions + deviations from the plan). Do not omit — this is often what reviewers need. |
| **Acceptance Criteria** | `Microsoft.VSTS.Common.AcceptanceCriteria` | HTML `<ul><li>…</li></ul>`. Keeps AC visible in the dedicated AC control on the form. |
| Spec link | Footer in `System.Description` | Append `<p><strong>Source spec (repo):</strong> <a href="…">…</a></p>` using the Azure DevOps **Files** URL for `knowledge/specs/…` so the file opens in the browser. |

**Optional fields** (when useful; set via `wit_create_work_item` / `wit_update_work_item`):

| Field | Reference name | Use |
|-------|----------------|-----|
| Area | `System.AreaPath` | From `config.yaml` → `devops.area_path`. |
| Assigned to | `System.AssignedTo` | Email of the authenticated user (from `wit_my_work_items` / identity). |
| Priority | `Microsoft.VSTS.Common.Priority` | `1` = highest … `4` = low (Agile default is often `2`). |
| Tags | `System.Tags` | Semicolon-separated (e.g. `spec-sync; ai-first-dis`). |
| Value area | `Microsoft.VSTS.Common.ValueArea` | Often `Business` (process default). |

**HTML rules**

- Escape user-facing text with HTML entities (`html.escape` in Python): `&`, `<`, `>`, quotes where needed.
- Preserve inline code in specs as plain text or `` `code` `` inside list items (ADO renders plain text in HTML fields).
- `wit_create_work_item` supports `format: Html` (or `Markdown` where applicable) on field entries.
- `wit_update_work_item` uses JSON Patch paths such as `/fields/System.Description` and `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` with `op: replace`.

**Size limits**

- If combined Description approaches ~32k characters, trim verbose sections last: keep Context + Requirements + Implementation Notes, shorten repeated boilerplate, and keep the repo link. Never drop Acceptance Criteria — prefer trimming Description.

**Automation**

- Use `spec_to_ado_html.py` in this folder to turn a spec file into `{ "description": "<html>", "acceptanceCriteria": "<html>" }` for MCP updates. Example (from repo root):
  `python .cursor/skills/agent-factory/sync-to-devops/spec_to_ado_html.py knowledge/specs/F001-backend-api.md --repo-url "<azure-devops-files-url>"`

## Process

### Push Spec to DevOps

1. **Resolve user identity** — Use `wit_my_work_items` to get the authenticated user's email for `System.AssignedTo`.

2. **Read the spec** — Parse the spec frontmatter (Type, Status, DevOps ID).

3. **Build HTML** — Use `spec_to_ado_html.py` (this folder) or equivalent: full Context, Requirements (in/out), Features (if epic), Implementation Notes, footer link; Acceptance Criteria as a separate HTML blob.

4. **Create or update work items** — Map as in the table above. On create, use `wit_create_work_item` with `fields` including `System.Title`, `System.Description`, `Microsoft.VSTS.Common.AcceptanceCriteria`, `System.AreaPath`, and assignee if required.

5. **Link parent-child relationships** — Use relative markdown links in the spec to determine hierarchy. Link Features to their parent Epic (`wit_work_items_link`, type `parent`).

6. **Link PRs** — After a PR exists, `wit_link_work_item_to_pull_request` (requires `projectId`, `repositoryId` GUID, `pullRequestId`, `workItemId`).

7. **Update spec frontmatter** — Write back the DevOps ID and URL.

### Push Decision as Comment

1. **Read the decision** — Parse the decision-log entry.
2. **Find the work item** — Use the DevOps ID from the related spec.
3. **Add comment** — Post the decision as a formatted comment via `wit_add_work_item_comment` (`markdown` or `html` per tool schema).

### Pull Status from DevOps

1. **Read specs with DevOps IDs** — Scan `knowledge/specs/` for specs that have a DevOps ID in their frontmatter.
2. **Fetch work item status** — Use `wit_get_work_item` for each.
3. **Update spec frontmatter** — Write the current DevOps status back (optional; map ADO state names to spec Status values consistently).

## Recommended Sync Cadence

Two touchpoints per feature give you lead time measurement in ADO automatically:

1. **After `plan` approval** — Sync specs as work items in "Active" state. This timestamps when work was committed to. Run: `sync knowledge/specs/F001-*.md to devops`
2. **After `submit`** — Update work items to "Resolved" or "Done" state. This timestamps when implementation was delivered. Run: `sync to devops` (pulls current status and closes items).

The gap between the two timestamps becomes measurable implementation lead time in ADO's work item history, without any manual tracking.

## Constraints

- Only this skill interacts with Azure DevOps MCP tools
- Never create work items without user approval
- Always assign work items to the authenticated user (unless the project dictates otherwise)
- Preserve existing DevOps content when updating (don't overwrite comments)
- **Push full spec content** into Description + Acceptance Criteria — not link-only summaries

## Human Checkpoints

- **Work item creation** — Creates external resources, requires approval
- **Dependency linking** — Modifies work item relationships, requires approval

## Next Steps

- After post-plan sync: proceed to `implement T1` (or the first unblocked task).
- After post-submit sync: the ADO work item is closed. The PR is open for human review and merge.

## MCP Tools Used

- `wit_my_work_items` — Resolve authenticated user
- `wit_create_work_item` — Create Epic/Feature/Story (`fields` array with `name` / `value` / optional `format`)
- `wit_update_work_item` — Update fields (JSON Patch: `path` `/fields/...`, `value`, `op`)
- `wit_get_work_item` — Fetch work item details (`fields`, `expand`)
- `wit_add_work_item_comment` — Post decisions/updates (`format`: `markdown` | `html`)
- `wit_work_items_link` — Link parent-child relationships
- `wit_link_work_item_to_pull_request` — Associate a PR with a work item
- `repo_get_pull_request_by_id` — Resolve `repositoryId`, merge state, linked artifacts
