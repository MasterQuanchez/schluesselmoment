---
type: Reference
title: Chat API Specification
description: HTTP API reference for the template chat endpoint and health check.
timestamp: 2026-06-17T00:00:00Z
last_reviewed: 2026-06-17
owner:
sources:
  - ref: "docs/api-specification.md"
tags: [api, fastapi, chat, reference]
---
# Chat API Specification

Base URL: `http://localhost:8000` (dev) | configurable via `NEXT_PUBLIC_API_URL`

---

## `POST /api/chat`

Send a conversation and receive the next assistant message.

### Request

```http
POST /api/chat
Content-Type: application/json
```

**Body**

```json
{
  "messages": [
    { "role": "system",    "content": "You are a helpful assistant." },
    { "role": "user",      "content": "Hello!" }
  ]
}
```

| Field      | Type     | Required | Description                                                |
|------------|----------|----------|------------------------------------------------------------|
| `messages` | `array`  | Yes      | Ordered list of messages. Must contain at least one entry. |

**Message object**

| Field     | Type     | Values                           | Description       |
|-----------|----------|----------------------------------|-------------------|
| `role`    | `string` | `"system"`, `"user"`, `"assistant"` | Message author |
| `content` | `string` | —                                | Message text      |

### Response `200 OK`

```json
{
  "message": {
    "role": "assistant",
    "content": "Hello! How can I help you today?"
  },
  "usage": {
    "prompt_tokens": 22,
    "completion_tokens": 10,
    "total_tokens": 32
  }
}
```

| Field               | Type              | Description                              |
|---------------------|-------------------|------------------------------------------|
| `message`           | `Message`         | The assistant's reply                    |
| `message.role`      | `string`          | Always `"assistant"`                     |
| `message.content`   | `string`          | Reply text                               |
| `usage`             | `object` \| `null` | Token counts (null if unavailable)     |

### Error Responses

| Status | Condition                                            |
|--------|------------------------------------------------------|
| `422`  | Validation error — e.g. `messages` is empty or malformed |
| `502`  | AI service error — Azure OpenAI returned an error    |

---

## `GET /health`

Liveness probe.

**Response `200 OK`**

```json
{ "status": "ok" }
```
