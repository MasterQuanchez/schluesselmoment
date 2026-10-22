---
name: submit
description: |
  Closes the SDLC loop after testing passes. Aligns specs with what was built, generates a PR description using the standard template, creates the PR, and suggests a DevOps sync. Use after the test skill produces a PASS verdict.
---

# Submit

Align specs with the implementation, generate a PR description, and open the PR for human review. This is the handoff from the developer to the reviewer.

> Prompt-shaping: bundle the evidence for the bar-for-done into the PR and check it against the house rules before shipping — see [`orchestrate`](../../orchestrate/SKILL.md).

## Inputs

One of:
- A passing test result from the `test` skill
- A PR branch name and associated spec/plan
- A feature work item ID

## Outputs

- Updated specs reflecting what was actually built (`Status: Done`, plan tasks ticked, deviations noted)
- A PR description using `templates/pr.md`, under 4000 characters
- An open pull request on the feature branch
- A handoff using `templates/handoff.md` for the reviewer

## Process

1. **Align specs** — Compare the feature branch diff against the spec and plan:
   - Set spec `Status` to `Done`
   - Tick completed task checkboxes in the plan document
   - For any deviation from the spec (something added, changed, or omitted), add an entry to the spec's `## Implementation Notes` section: `{YYYY-MM-DD}: **{what changed}** — {why it diverged from original spec}`
   - Do not rewrite spec requirements — note divergences, don't silently erase them

2. **Generate PR description** — Using `templates/pr.md`, populate all sections. Verify total character count stays under 4000. Link the spec and ADO work item ID if available.

3. **Present for approval** — Show the spec changes and PR description to the human. Wait for approval before creating the PR.

4. **Push and create PR** — Run `git push -u origin <branch>` to ensure the branch is up to date. Then provide the PR description as a ready-to-paste block and the Azure DevOps PR creation URL: `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequestcreate`. Include the ADO work item ID in the PR title or description if the spec has a DevOps ID.

5. **Suggest next steps** — After the PR is created, prompt: "Run `sync to devops` to push the final spec status to Azure DevOps and close the work item."

## Constraints

- Never push the branch without human approval of both the spec changes and the description
- Never rewrite original spec requirements — only add divergence notes to `## Implementation Notes`
- PR description must be under 4000 characters — truncate notes, not acceptance criteria
- Only run against a branch that has a passing test verdict
- Do not merge the PR — that is the human reviewer's action

## Human Checkpoints

- **Spec alignment** — Human reviews and approves spec updates before they are committed
- **PR description** — Human reviews and approves the description before PR is created
- **Branch push** — `git push` requires explicit confirmation
- **PR creation** — Human creates the PR in Azure DevOps using the generated description

## Next Steps

After the PR is created:
- Run `sync to devops` to push `Status: Done` and the PR link to Azure DevOps

## Handoff

The reviewer (human) receives the PR link. Include in the handoff: PR URL, spec link, ADO work item ID (if synced), and a brief summary of any deviations from the original spec.
