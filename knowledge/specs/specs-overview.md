---
type: Reference
title: Specs Overview
description: Index and conventions for the ai-first-dis specification knowledge graph.
timestamp: 2026-06-17T00:00:00Z
last_reviewed: 2026-06-17
owner:
sources:
  - ref: "docs/specs/index.md"
tags: [specs, index, agent-factory]
---
# Specs Index

This directory contains the project's specification knowledge graph.
Each spec is a standalone markdown file linked with relative markdown links.

## Conventions

- **Naming**: `E001-{epic-name}.md` for epics, `F001-{feature-name}.md` for features
- **Links**: Use relative markdown links, e.g. `[E001-epic-name](E001-epic-name.md)`
- **Template**: Follow `.cursor/skills/agent-factory/templates/spec.md`
- **Sync**: Use the `sync-to-devops` skill to push specs to Azure DevOps

## Epics

- [E001-app-template](E001-app-template.md) — Seed template with FastAPI + Next.js + Dojo chat app
  - Plan: [E001-app-template-plan](E001-app-template-plan.md)

## Features

- [F001-backend-api](F001-backend-api.md) — FastAPI chat endpoint wrapping Azure OpenAI
- [F002-frontend-chat-ui](F002-frontend-chat-ui.md) — Next.js chat page with Dojo-styled components
- [F003-design-system-bridge](F003-design-system-bridge.md) — Tailwind tokens, copied components, design skills install script
- [F004-template-scaffolding](F004-template-scaffolding.md) — Config, deployment placeholders, docs, meta-files
- F005-sustainability-skill (not present in this repo) — Cost + quality discipline skill, model-routing rule, and local usage dashboard
