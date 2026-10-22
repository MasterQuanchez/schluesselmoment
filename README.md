# Schlüsselmoment

Übergabeprotokoll-App für Wohnungsübergabe, -abnahme und Bestandsaufnahme – als installierbare PWA für Android,
ohne Backend. Gebaut auf dem **Phil Starter Kit** (Harbour-Theme, Cursor-Governance, agent-factory).

| Was | Wo |
|---|---|
| App (Vite, React 19, TypeScript) | [`frontend/`](frontend/README.md) |
| Spec + Akzeptanzkriterien | [`knowledge/specs/E002-schluesselmoment-v1.md`](knowledge/specs/E002-schluesselmoment-v1.md) |
| Entscheidungen, Orchestrierung, Architektur, Sicherheit | [`docs/app/`](docs/app/) |
| Prompts für Cursor (`SM-xx`) | [`docs/prompts/`](docs/prompts/) |
| Briefkasten Claude ↔ Cursor | [`docs/briefkasten/`](docs/briefkasten/) |
| Design (Harbour) | [`docs/design/phil-theme.md`](docs/design/phil-theme.md) |
| Altbestand v1 (Word-Vorlage, Anforderungen) | [`sourcing/v1-referenz/`](sourcing/v1-referenz/) |

```bash
cd frontend && npm install && npm run dev
```

> Das Kit brachte ein Next.js-Frontend und ein FastAPI-Backend mit. Beide wurden entfernt (D3, D5, D16).
> Die Python-Teile im Repo sind nur noch Kit-Werkzeuge (Skills, PII-Scan). Die Abschnitte unten beschreiben das Kit.

---

## What's Included

| Layer | Technology | Purpose |
|---|---|---|
| Backend | FastAPI + Azure OpenAI SDK | REST API, chat endpoint, pydantic models |
| Frontend | Next.js 15 App Router | Chat UI, Harbour theme tokens, Tailwind |
| Design | @wp/agentic-ux-toolkit | Components, tokens, Cursor skills/rules |
| Testing | pytest + Vitest + React Testing Library | Unit tests for both layers |
| AI Workflow | agent-factory Cursor skills | SDLC automation, spec management |

---

## Prerequisites

| Tool | Purpose |
|---|---|
| Git | Version control |
| [Cursor](https://cursor.sh) | AI-first IDE with agent-factory skills |
| [uv](https://docs.astral.sh/uv/) | Python package manager |
| Node.js ≥ 20 | Frontend runtime |
| npm / pnpm | Frontend package manager |
| Azure OpenAI subscription | AI model access |

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url> my-app
cd my-app
cp .env.example .env
# Edit .env with your Azure OpenAI credentials
```

### 2. Backend

```bash
uv sync --all-extras
uv run uvicorn src.main:app --reload
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:3000
```

### 4. Data safety (one-time per clone)

Before working with internal content (meeting transcripts, stakeholder notes, etc.):

1. Enable **Cursor Privacy Mode** (Settings → Privacy).
2. Arm the commit gate: `git config core.hooksPath .githooks`
3. Copy and fill in local redaction config:

```bash
mkdir -p .sensitive
cp .cursor/skills/ingest-transcript/redaction-config.example.json \
   .sensitive/redaction-config.local.json
# Edit with your project's real company/org/participant terms — never commit this file.
```

Full walkthrough: `.cursor/skills/agent-factory/data-safety/setup-guide.md`
Vault / team sharing: `.cursor/skills/agent-factory/data-safety/vault-guide.md`

Or say **`check data safety`** in Cursor — the data-safety skill detects what's missing
and guides you through setup.

---

## Project Structure

```
.
├── src/                          # Python backend (FastAPI)
│   ├── main.py                   # App entry point, CORS, routers
│   ├── api/chat.py               # POST /api/chat
│   ├── services/ai_service.py    # Azure OpenAI SDK wrapper
│   ├── models/chat.py            # Pydantic schemas
│   ├── auth/                     # Auth placeholder
│   ├── utils/                    # Shared utilities
│   └── constants/                # App constants
├── frontend/                     # Next.js App Router
│   ├── src/app/                  # Pages and layouts
│   ├── src/components/           # WP CI components (hello-world reference)
│   ├── src/services/api.ts       # Backend client
│   ├── src/lib/utils.ts          # cn() helper
│   └── tests/                    # Vitest unit tests
├── tests/                        # Python backend tests
├── knowledge/
│   ├── specs/                    # Spec knowledge graph (agent-factory)
│   └── reference/api-specification.md # REST API docs
├── memory/                       # Decisions and meeting memory
├── data-products/                # Data product contracts, if owned
├── sourcing/                     # Raw inputs, scratch output, and drafts
├── config/
│   ├── dev.json                  # Dev environment settings
│   └── prod.json                 # Prod environment settings
├── scripts/                      # Utility scripts (add yours here)
├── deployment/
│   ├── pipelines/                # CI/CD definitions (add yours here)
│   └── k8s/                      # Kubernetes manifests
├── .cursor/skills/agent-factory/ # AI workflow automation
├── pyproject.toml                # Python dependencies
├── .env.example                  # Required environment variables
└── AGENTS.md                     # AI agent conventions and commands
```

---

## Development Commands

### Backend

```bash
uv run uvicorn src.main:app --reload   # dev server
uv run pytest                          # tests
uv run pytest --cov                    # tests + coverage
uv run ruff check .                    # lint
uv run mypy .                          # type check
```

### Frontend

```bash
cd frontend
npm run dev             # dev server (http://localhost:3000)
npm run build           # production build
npm run lint            # ESLint
npm run test            # Vitest unit tests
npm run test:watch      # Vitest watch mode
npm run test:coverage   # Coverage report
```

---

## AI Workflow

This repo uses the **agent-factory** skill collection. Open Cursor and type:

| Command | What it does |
|---|---|
| `new epic` | Discover requirements → write spec → plan implementation |
| `plan this feature` | Break a spec into implementation tasks |
| `implement` | TDD implementation from a spec/plan |
| `review PR` | Code review against spec and standards |
| `debug this` | Hypothesis-driven debugging |
| `sync to devops` | Push specs/decisions to Azure DevOps work items |
| `design a page` / `build the UI` | Gateway to @wp/agentic-ux-toolkit — design, UX, UI work |
| `check data safety` / `anonymize this` | GDPR/BDSG compliance and vault routing |
| `sustainability` / `which model` | Cost- and quality-aware Cursor usage guidance |
| `hello` / `onboard me` | First-time repo orientation and skill cheat sheet |

See `.cursor/skills/agent-factory/SKILL.md` for the full orchestration guide.

---

## Design System

**Default theme: Harbour** (`frontend/src/app/globals.css`, documented in `docs/design/phil-theme.md`). The section below describes the original SE toolkit, which only applies inside the Siemens Energy network.

Components originally followed the **WP CI Dojo design system** via [`@wp/agentic-ux-toolkit`](https://siemensgamesa.visualstudio.com/SGRE%20Digital%20Transformation/_git/wp-agentic-ux-toolkit). The toolkit provides design tokens, 40+ React components, and 7 specialized Cursor skills for design, UX, and accessibility work.

### Toolkit already installed (most projects)

If the toolkit is a dependency in `frontend/package.json`, it's ready to use. The design skill (`.cursor/skills/agent-factory/design/SKILL.md`) detects it automatically and routes to the appropriate toolkit skill. Just say `design a page` or `build the UI` in Cursor.

### Manual install (new projects)

```bash
cd frontend
npm install @wp/agentic-ux-toolkit
```

Then in `frontend/src/app/layout.tsx`:

```tsx
import "@wp/agentic-ux-toolkit/styles.css";
```

See `.cursor/skills/agent-factory/design/install-guide.md` for the full setup walkthrough including fonts, icons, and dark mode.

---

## Data Safety

Raw transcripts and project-specific redaction terms stay **out of git** in a
gitignored `.sensitive/` vault. Tracked files get anonymized summaries only.

The **data-safety** skill (`.cursor/skills/agent-factory/data-safety/SKILL.md`) is a
gateway like `design`: it detects whether this clone is armed and walks through setup
if not.

| Resource | Purpose |
|---|---|
| `setup-guide.md` | One-time per clone: Privacy Mode, commit gate, local config |
| `vault-guide.md` | Optional OneDrive team vault pattern and honest limits |
| `ingest-transcript` skill | Local no-AI redaction + OKF meeting summaries (`.docx`/`.txt`/`.vtt`) |

Say `check data safety` before handling internal content, or follow **Quick Start §4**.

---

## Hello-World Example

The `frontend/` directory contains a **reference chat app** demonstrating recommended patterns:

- **Folder structure** — `src/app/`, `src/components/`, `src/services/`, `tests/`
- **Component patterns** — `AppShell`, `MessageCard`, `PromptBar` matching the toolkit's API
- **Design tokens** — Harbour theme on the Dojo token names (`globals.css`, `tailwind.config.ts`)
- **Backend integration** — `api.ts` REST client with error recovery
- **Testing** — Vitest + React Testing Library unit tests

The hello-world components are **self-contained copies** — they don't import from `@wp/agentic-ux-toolkit`. When building your own app:

1. **Modify the hello-world** — extend it for your use case, or
2. **Start fresh** — delete `frontend/` and scaffold a new Next.js app, then install the toolkit

Either way, install `@wp/agentic-ux-toolkit` for production-ready components, tokens, and design skills.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Required | Description |
|---|---|---|
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI resource API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI resource endpoint URL |
| `OPENAI_API_VERSION` | Yes | API version (e.g. `2024-08-01-preview`) |
| `AZURE_OPENAI_COMPLETION_DEPLOYMENT_NAME` | Yes | Deployed model name |
| `NEXT_PUBLIC_API_URL` | No | Frontend API base URL (default: `http://localhost:8000`) |

---

## Contributing

1. Branch: `<initials>/<short-description>` (e.g. `asb/add-chart-component`, `jsr/fix-chat-retry`)
2. Write tests before implementation (TDD)
3. Run linters and tests before opening a PR
4. Sync spec decisions to Azure DevOps with `sync to devops`
5. Request review — agent-factory `review PR` provides an initial automated review
