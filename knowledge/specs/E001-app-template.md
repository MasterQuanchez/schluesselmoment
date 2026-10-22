---
type: Product
title: App Template Hello World
description: Epic spec for the reusable FastAPI and Next.js app template.
timestamp: 2026-06-17T00:00:00Z
last_reviewed: 2026-06-17
owner:
sources:
  - ref: "docs/specs/E001-app-template.md"
tags: [epic, app-template, fastapi, nextjs]
---
# App Template Hello World

- **Type**: Epic
- **Status**: Done
- **Parent**: None (top-level epic)
- **DevOps ID**: [#423637](https://siemensgamesa.visualstudio.com/SGRE%20Digital%20Transformation/_workitems/edit/423637)

## Context

The `ai-first-dis` repo needs to become a reusable seed template for all future agentic MVP projects. Today it's an empty shell with dependency files and agent-factory skills but no runnable application. Teams cloning this repo should get a working chat app out of the box — FastAPI backend talking to Azure OpenAI, Next.js frontend with the Dojo design language — so they can skip boilerplate and start building features immediately.

## Requirements

### In Scope

- FastAPI backend with a single `/api/chat` endpoint wrapping Azure OpenAI
- Pydantic request/response models for the chat API
- Next.js App Router frontend with a functional chat page
- Simplified copies of pattern library components (AppShell, MessageCard, PromptBar) using Dojo tokens
- Tailwind CSS configured with the Dojo design token subset
- Vitest test setup for frontend, pytest for backend
- Environment config files (dev.json, prod.json, .env.example)
- Deployment directory placeholders (pipelines, k8s)
- Script to install design skills/rules from the pattern library repo
- Updated AGENTS.md, README.md, and .gitignore

### Out of Scope

- Authentication / authorization (placeholder dir only)
- Streaming responses (stretch goal, not MVP)
- Database or persistence layer
- CI/CD pipeline implementation (placeholder structure only)
- Publishing `@wp/agentic-ux-toolkit` as an npm package
- Production Azure deployment
- Multi-model or multi-provider support

## Acceptance Criteria

- Given a fresh clone, when the developer runs `uv sync && uv run uvicorn src.main:app`, then the backend starts and responds to `POST /api/chat`
- Given the backend is running, when the developer runs `cd frontend && pnpm install && pnpm dev`, then the chat UI loads at localhost:3000
- Given both services are running, when a user types a message and presses send, then the message appears in the chat and an AI response is displayed
- Given the repo is cloned, when a developer inspects the structure, then it matches the architecture team's reference layout from AGENTS.md
- Given the pattern library repo exists locally, when the developer runs `scripts/install-design-skills.sh`, then Dojo design skills and rules are copied into `.cursor/`
- Given the frontend components, when compared to the pattern library's prop interfaces, then they are API-compatible for future swap-in

## Features

- [F001-backend-api](F001-backend-api.md)
- [F002-frontend-chat-ui](F002-frontend-chat-ui.md)
- [F003-design-system-bridge](F003-design-system-bridge.md)
- [F004-template-scaffolding](F004-template-scaffolding.md)

## Decisions

- 2026-04-06: **FastAPI over Django** — Lighter weight, async-native, better fit for single-endpoint API templates. Django's ORM and admin are unnecessary overhead.
- 2026-04-06: **Azure OpenAI SDK over LangChain** — Direct SDK is simpler, has fewer dependencies, and avoids the LangChain abstraction tax for a single chat endpoint. LangChain was removed from deps.
- 2026-04-06: **Tailwind over MUI** — Pattern library is built on Tailwind + Dojo tokens. Using MUI would create a migration burden when teams adopt the real pattern library.
- 2026-04-06: **Copy components, don't depend on package** — The pattern library npm package isn't published yet. Simplified copies with matching prop interfaces let teams swap in the real package later with minimal changes.
- 2026-04-06: **Vitest over Jest** — Matches the pattern library's test setup. Faster execution, native ESM support, better TypeScript integration.
- 2026-04-07: **Lucide icons over custom Icon component** — Pattern library uses lucide-react internally. Using it directly avoids reimplementing the Icon wrapper for the template.
- 2026-04-08: **Added chatRetry utility** — `frontend/src/lib/chatRetry.ts` added to handle transient Azure OpenAI failures with exponential backoff. Not in original scope but necessary for a reliable hello-world experience.
