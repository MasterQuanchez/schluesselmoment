# Backend Chat API

- **Type**: Feature
- **Status**: Done
- **Parent**: [E001-app-template](E001-app-template.md)
- **DevOps ID**: [#423638](https://siemensgamesa.visualstudio.com/SGRE%20Digital%20Transformation/_workitems/edit/423638)

## Context

The template needs a minimal but realistic backend that demonstrates the FastAPI + Azure OpenAI pattern teams will use in production. A single chat endpoint is enough to prove the architecture without overcomplicating the template.

## Requirements

### In Scope

- `src/main.py` with FastAPI app, CORS middleware, and router inclusion
- `src/api/chat.py` with `POST /api/chat` endpoint
- `src/services/ai_service.py` wrapping `openai.AzureOpenAI` client
- `src/models/chat.py` with Pydantic schemas: `Message`, `ChatRequest`, `ChatResponse`
- Placeholder directories: `src/auth/`, `src/utils/`, `src/constants/`
- Clean `pyproject.toml` with only required deps (fastapi, uvicorn, pydantic, python-dotenv, httpx, openai)
- Unit tests for the chat endpoint and AI service

### Out of Scope

- Streaming responses (SSE/WebSocket)
- Rate limiting or throttling
- Request validation beyond Pydantic model enforcement
- Health check endpoint
- OpenAPI schema customization

## Acceptance Criteria

- Given the backend is started, when `POST /api/chat` receives `{"messages": [{"role": "user", "content": "hello"}]}`, then it returns `{"message": {"role": "assistant", "content": "..."}, "usage": {...}}`
- Given Azure OpenAI credentials are missing, when the service is called, then a clear error is raised (not a silent failure)
- Given `pytest` is run, when all backend tests execute, then they pass without requiring a live Azure OpenAI connection (mocked)
- Given `pyproject.toml`, when dependencies are inspected, then LangChain, numpy, and pandas are absent

## Decisions

- 2026-04-06: **Single `chat()` method on service** — One method that accepts messages and returns a response. No abstraction for different "modes" until a real use case demands it.
- 2026-04-06: **Config via env vars, not config files for secrets** — `config/dev.json` holds non-sensitive settings (model name, temperature). API keys come from `.env` only.
