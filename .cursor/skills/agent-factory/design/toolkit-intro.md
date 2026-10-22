# Toolkit Introduction — Runtime Procedure

This file is a **procedure for the AI to execute**, not static documentation.
Follow these steps every time the design skill fires and the toolkit is installed.
Do not cache results between sessions — the toolkit may have been updated via npm.

## Step 1 — Read the toolkit README

Read the file:

```
node_modules/@wp/agentic-ux-toolkit/README.md
```

Extract:
- The "what it is" summary (first paragraph or section)
- The package exports table (import paths and what they provide)
- Any version or compatibility notes

## Step 2 — Scan skill frontmatter

Glob for all skill files:

```
node_modules/@wp/agentic-ux-toolkit/.cursor/skills/*/SKILL.md
```

For each file, read **only the YAML frontmatter** (between the `---` delimiters).
Extract the `name` and `description` fields to build a skill inventory.

Do NOT read the full skill body at this stage — that happens after routing.

## Step 3 — Check for hello-world

Check if `frontend/src/components/` exists and contains files like `AppShell.tsx`,
`MessageCard.tsx`, or `PromptBar.tsx`. If yes, note that the project has a
reference chat app demonstrating toolkit patterns (self-contained copies, not
imports from the toolkit).

## Step 4 — Present to the user

Compose a **concise** summary (not a wall of text):
- One sentence: what the toolkit is
- A compact list of available skills (name + one-line description each)
- If hello-world exists: one sentence noting it as a reference example
- Ask the user what they want to do

Example tone:

> The project has @wp/agentic-ux-toolkit installed — it provides WP CI design
> tokens, 40+ components, and 7 specialized skills: design-build, design-audit,
> wp-ci-adoption, wp-pattern-library, component-token-audit,
> pattern-doc-template, and project-dev-workflow. The frontend/ directory has a
> reference chat app showing these patterns in action. What would you like to do?

## Step 5 — Route

Based on the user's response (or their original intent if clear), read the full
SKILL.md of the matched toolkit skill and follow its procedure:

```
node_modules/@wp/agentic-ux-toolkit/.cursor/skills/{skill-name}/SKILL.md
```

See the routing table in the design SKILL.md for the intent → skill mapping.
