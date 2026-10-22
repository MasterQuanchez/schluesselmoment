---
type: Product
title: Frontend Chat UI
description: Feature spec for the Next.js chat interface and Dojo-styled components.
timestamp: 2026-06-17T00:00:00Z
last_reviewed: 2026-06-17
owner:
sources:
  - ref: "docs/specs/F002-frontend-chat-ui.md"
tags: [feature, frontend, nextjs, chat-ui]
---
# Frontend Chat UI

- **Type**: Feature
- **Status**: Done
- **Parent**: [E001-app-template](E001-app-template.md)
- **DevOps ID**: [#423639](https://siemensgamesa.visualstudio.com/SGRE%20Digital%20Transformation/_workitems/edit/423639)

## Context

Teams cloning the template need a working chat interface that demonstrates the Next.js + Tailwind + Dojo pattern. The UI should look like a real product (not a tutorial scaffold) while remaining simple enough to understand and modify in an afternoon.

## Requirements

### In Scope

- `frontend/src/app/page.tsx` — Chat page with message state, send handler, backend API call
- `frontend/src/app/layout.tsx` — Root layout with Weissenhof Grotesk font and globals import
- `frontend/src/components/AppShell.tsx` — Page chrome: header, sidebar placeholder, main content area
- `frontend/src/components/MessageCard.tsx` — Renders a single chat message (user or assistant)
- `frontend/src/components/PromptBar.tsx` — Text input with send button, keyboard submit
- `frontend/src/services/api.ts` — Fetch wrapper calling `POST /api/chat`
- `frontend/src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `frontend/src/constants/index.ts` — API base URL, app name
- Vitest test setup and at least one component test (MessageCard)

### Out of Scope

- Markdown rendering in messages
- Code syntax highlighting
- Loading/typing indicators (animation)
- Conversation persistence (localStorage or backend)
- Multiple conversations / conversation management
- Mobile-responsive layout (desktop-first per design skill)

## Acceptance Criteria

- Given the frontend is running, when the user loads localhost:3000, then the AppShell renders with a header and empty chat area
- Given the chat page is loaded, when the user types a message and presses Enter, then the message appears as a user MessageCard
- Given a message was sent, when the backend responds, then an assistant MessageCard appears below the user's message
- Given the PromptBar, when the input is empty, then the send button is disabled
- Given `pnpm test` is run, then MessageCard renders correctly for both user and assistant roles
- Given the component props, when compared to the pattern library interfaces, then they are structurally compatible

## Decisions

- 2026-04-06: **React state over Zustand for MVP** — Simple `useState` for the message array. Zustand is in deps for teams to adopt when complexity grows, but the hello-world doesn't need it.
- 2026-04-07: **No loading skeleton** — Keep the first version dead simple. Teams can add streaming/loading UX when they implement real features.
- 2026-04-08: **Added chatRetry utility** — `frontend/src/lib/chatRetry.ts` with exponential backoff added to handle transient Azure OpenAI 429/5xx errors. Includes unit test. Not in original scope but required for reliable demo flow.
