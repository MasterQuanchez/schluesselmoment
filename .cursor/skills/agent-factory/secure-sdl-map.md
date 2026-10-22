# Secure SDL leaf map

Harness-owned index of the corporate leaves under [`../secure-coding/`](../secure-coding/). A
discovery aid, not a fork: read a leaf's own frontmatter (`controls`, `description`) when deciding
relevance. If a leaf is renamed or added upstream, refresh this table — never edit the leaf.

| Surface cues (plan / diff) | Leaf | Control prefixes |
| --- | --- | --- |
| login, passwords, MFA, recovery, federated sign-in | `authentication/SKILL.md` | AUTH-* |
| RBAC/ABAC, IDOR, tenant isolation, admin paths | `authorization/SKILL.md` | AUTHZ-* |
| session create/rotate/terminate, cookies | `session-management/SKILL.md` | SESS-* |
| JWT / self-contained tokens, alg/exp/aud | `tokens/SKILL.md` | TOK-* |
| OAuth2 / OIDC | `oauth/SKILL.md` | OAUTH-* |
| `.env`, keys, connection strings, CI secrets | `secrets-management/SKILL.md` | SECRETS-* |
| injection, encoding, validation, prompt injection | `input-validation-and-encoding/SKILL.md` | ENC-*, VAL-* |
| CSP, cookies, CSRF, CORS, open redirect | `web-frontend/SKILL.md` | WEB-* |
| REST / GraphQL / WebSocket hygiene | `api/SKILL.md` | API-* |
| upload, download, path traversal | `file-handling/SKILL.md` | FILE-* |
| hashing, encryption, CSPRNG, key management | `cryptography/SKILL.md` | CRYPT-* |
| TLS, HTTPS, trust managers | `secure-communications/SKILL.md` | COMM-* |
| PII, minimisation, retention | `data-protection/SKILL.md` | DATA-* |
| audit events, secret-in-logs, error leakage | `logging/SKILL.md` | LOG-* |
| trust boundaries, mass-assignment, concurrency | `architecture/SKILL.md` | ARCH-* |
| prompts, tool output, agent surfaces | `ai-llm-security/SKILL.md` | ENC-6, AI paths |

**Surfaces that auto-dispatch the selective security lane after a generic review:** auth, passwords,
MFA; authorization / IDOR; sessions / cookies; tokens / JWT; OAuth/OIDC; secrets / `.env` / keys;
input boundaries / injection; web headers / CSRF / CORS; API privilege; file upload / path; crypto;
TLS config; PII / retention; security logging; agent or LLM prompt and tool paths; public-mode and
trust-boundary changes.
