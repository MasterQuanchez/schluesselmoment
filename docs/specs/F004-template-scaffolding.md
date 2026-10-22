# Template Scaffolding

- **Type**: Feature
- **Status**: Done
- **Parent**: [E001-app-template](E001-app-template.md)
- **DevOps ID**: [#423641](https://siemensgamesa.visualstudio.com/SGRE%20Digital%20Transformation/_workitems/edit/423641)

## Context

Beyond the running application, the template must ship with the full project structure, configuration, and documentation that teams expect. This includes environment configs, deployment placeholders, API docs, and updated meta-files (AGENTS.md, README, .gitignore) so the repo is immediately navigable and clone-ready.

## Requirements

### In Scope

- `config/dev.json` and `config/prod.json` with environment-specific settings (API base URL, model name, temperature)
- `.env.example` documenting all required environment variables
- `docs/api-specification.md` for the `/api/chat` endpoint
- `deployment/pipelines/` and `deployment/k8s/base/`, `deployment/k8s/overlays/` placeholder directories
- Updated `AGENTS.md` reflecting actual project structure and commands
- Updated `README.md` with quick start, dev commands, project structure, AI workflow, and template usage guide
- Updated `.gitignore` adding `node_modules/`, `.next/`, `dist/`, `frontend/.next/`
- Removal of stale `requirements.txt`

### Out of Scope

- Actual CI/CD pipeline YAML
- Kubernetes manifests (placeholder dirs only)
- Terraform or infrastructure-as-code
- Contributing guidelines beyond branch naming and PR basics
- Changelog or release notes

## Acceptance Criteria

- Given a fresh clone, when a developer reads `README.md`, then they can start both backend and frontend within 5 minutes
- Given `.env.example`, when copied to `.env` and filled in, then the backend starts without config errors
- Given `config/dev.json`, when the backend loads it, then model name and temperature are configured
- Given the deployment directory, when inspected, then the k8s structure matches the architecture team's convention
- Given `AGENTS.md`, when read by a Cursor agent, then it accurately describes available commands and project layout
- Given `.gitignore`, when `git status` is run after `pnpm install`, then `node_modules/` and `.next/` are excluded

## Decisions

- 2026-04-06: **Placeholder deployment dirs over empty** — Having the directory structure (even empty) signals the expected convention and prevents teams from inventing their own layout.
- 2026-04-06: **README as template guide** — The README serves double duty: project docs for developers AND a guide for how to use this repo as a template. Keeps everything in one place.
