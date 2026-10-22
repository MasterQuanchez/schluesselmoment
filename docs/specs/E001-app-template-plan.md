# Implementation Plan: App Template Hello World

- **Spec**: [E001-app-template](E001-app-template.md)
- **Status**: Done
- **Scope**: `pyproject.toml`, `src/`, `frontend/`, `tests/`, `config/`, `scripts/`, `deployment/`, `docs/`, root meta-files

## Approach

Work bottom-up: backend first (no UI dependency), then frontend (can test against running backend), then the design bridge and scaffolding (documentation layer on top of working code). Each feature maps to a batch of tasks that can be a single PR. The backend and frontend features are independent and could be parallelized across developers, but within each feature, tasks are sequential because later code depends on earlier scaffolding.

Key design choice: keep the template minimally complex. Every file should be understandable by a developer in their first week. Prefer explicit code over abstractions — no factory patterns, no dependency injection, no middleware chains. The agent-factory skills handle development workflow; the template code itself should be boring.

## Tasks

### [F001-backend-api](F001-backend-api.md)

- [x] T1: Clean pyproject.toml — remove LangChain/numpy/pandas, keep FastAPI + OpenAI SDK — `pyproject.toml`
- [x] T2: Delete requirements.txt — `requirements.txt`
- [x] T3: Scaffold backend modules — `src/main.py`, `src/api/chat.py`, `src/services/ai_service.py`, `src/models/chat.py`, placeholder `__init__.py` files
- [x] T4: Write backend unit tests — `tests/unit/test_chat_api.py`, `tests/unit/test_chat_service.py`

### [F002-frontend-chat-ui](F002-frontend-chat-ui.md)

- [x] T5: Update frontend config — `frontend/package.json` (Tailwind, Vitest, remove MUI), `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- [x] T6: Create globals.css with Dojo tokens — `frontend/src/app/globals.css`
- [x] T7: Build simplified components — `frontend/src/components/AppShell.tsx`, `MessageCard.tsx`, `PromptBar.tsx`, `frontend/src/lib/utils.ts`
- [x] T8: Build chat page and services — `frontend/src/app/layout.tsx`, `page.tsx`, `frontend/src/services/api.ts`, `frontend/src/constants/index.ts`
- [x] T9: Frontend test setup and tests — `frontend/tests/setup.ts`, `frontend/tests/unit/MessageCard.test.tsx`

### [F003-design-system-bridge](F003-design-system-bridge.md)

- [x] T10: Create install-design-skills.sh — `scripts/install-design-skills.sh`

### [F004-template-scaffolding](F004-template-scaffolding.md)

- [x] T11: Create config and env files — `config/dev.json`, `config/prod.json`, `.env.example`
- [x] T12: Create deployment placeholders — `deployment/pipelines/`, `deployment/k8s/base/`, `deployment/k8s/overlays/`
- [x] T13: Write API specification doc — `docs/api-specification.md`
- [x] T14: Update meta-files — `AGENTS.md`, `.gitignore`, `README.md`

### Dependencies

```
T1 ──→ T3 ──→ T4       (backend: clean deps → scaffold → test)
T2     (independent, can run with T1)
T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9   (frontend: config → tokens → components → page → tests)
T10    (independent, needs pattern library repo available)
T11, T12, T13  (independent of each other, can parallelize)
T14    (runs last — needs final structure to document accurately)
```

T1-T4 and T5-T9 are independent tracks and can run in parallel.

## Test Strategy

| Layer | Tool | What's tested |
|-------|------|---------------|
| Backend unit | pytest + httpx | Chat endpoint returns correct response shape; AI service calls OpenAI SDK with right params (mocked) |
| Frontend unit | Vitest + Testing Library | MessageCard renders user/assistant variants; PromptBar disables send when empty |
| Integration (manual) | Developer verification | Send message in UI → see response from backend → message displayed correctly |
| Structure | Visual inspection | Directory layout matches architecture team's reference in AGENTS.md |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tailwind config token drift from pattern library | Medium | Document exact source commit in design manifest; install script supports `--update` |
| Component prop interfaces diverge from pattern library | Low | Use same prop names/types; add comment headers referencing source |
| Azure OpenAI SDK breaking changes | Low | Pin version in pyproject.toml; tests mock the client |
| Teams skip install-design-skills.sh and miss design context | Medium | README prominently documents the script; AGENTS.md references it |
