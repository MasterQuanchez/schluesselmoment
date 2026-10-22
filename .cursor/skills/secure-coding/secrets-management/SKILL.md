---
name: secrets-management
description: >-
  Keeps credentials out of source code, configuration, and version-control history,
  and governs how secrets are stored, injected, and rotated. Use when touching config
  files (application.yml, application.properties, appsettings.json, .env),
  connection strings, API keys, tokens, OAuth client secrets, or private key material,
  and when writing Dockerfiles, docker-compose, or CI/CD pipelines that handle secrets.
  Controls SECRETS-1 … SECRETS-3.
pillar: secure-coding
controls: [SECRETS-1, SECRETS-2, SECRETS-3]
level-default: L1
source:
  - docs/guidelines/Config.md
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#16-secrets-management
---

# Secrets Management

**Objective:** Prevent credential exposure in source code, VCS history, build
artifacts, and logs. Manage secrets through dedicated systems with defined rotation
lifecycles and least-privilege access.

## When this applies

Activate this skill when touching: config files (`application.yml`,
`application.properties`, `appsettings.json`, `.env`), connection strings, API keys,
bearer tokens, OAuth client secrets, HMAC/signing keys, TLS private keys, `Dockerfile`
/ `docker-compose.yml`, or CI/CD pipeline definitions that reference credentials. If a
task spans crypto key handling or logging of secrets, also load those leaves.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| SECRETS-1 | L1 | No credentials, API keys, tokens, or passwords hardcoded in source, config, or VCS history — ever; run pre-commit/CI secret scanning (truffleHog, gitleaks, detect-secrets); rotate any exposed secret immediately | No literal secret resolves in tracked files or git history; a secret-scanning gate runs on commit and in CI and blocks on findings |
| SECRETS-2 | L2 | Store secrets in a dedicated manager (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager); inject at runtime via env vars or mounted volumes, never baked into images; least-privilege per service; audit secret access | Secrets resolve from a manager at runtime; no secret in image layers; each service's identity can read only its own secrets; access is logged |
| SECRETS-3 | L2 | Define rotation periods; automate rotation; maintain a tested emergency revocation process; prefer short-lived credentials (OIDC tokens, temporary IAM roles) over long-lived static secrets; remove orphaned secrets | Every secret has a documented rotation period and owner; revocation is exercised; static long-lived keys are replaced by short-lived credentials where available |

## Secure vs insecure patterns

**Insecure (flag and fix) — secret committed in config:**

```yaml
# application.yml committed to VCS  (SECRETS-1, SECRETS-2)
spring:
  datasource:
    url: jdbc:postgresql://db:5432/app
    username: app
    password: S3cr3t-Pa55w0rd!          # hardcoded credential
api:
  stripe-key: sk_live_51Hxk...redacted   # live API key in VCS
```

```dotenv
# .env committed to VCS  (SECRETS-1)
DATABASE_URL=postgres://app:S3cr3t@db:5432/app
JWT_SIGNING_KEY=9f2c...e1   # signing seed in tracked file
```

```dockerfile
# Secret baked into the image layer  (SECRETS-2)
ENV STRIPE_KEY=sk_live_51Hxk...redacted
```

**Secure (apply instead) — reference only, injected at runtime:**

```yaml
# application.yml — placeholders only; values resolved from the environment
spring:
  datasource:
    url: jdbc:postgresql://db:5432/app
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}        # supplied by env / secret manager at runtime
api:
  stripe-key: ${STRIPE_KEY}
```

```dotenv
# .env.example — committed; contains names and dummy values only, never real secrets
DATABASE_URL=postgres://app:CHANGE_ME@db:5432/app
JWT_SIGNING_KEY=CHANGE_ME
```

```python
# Runtime resolution from a dedicated manager  (SECRETS-2, SECRETS-3)
import boto3, json

def get_secret(name: str) -> dict:
    client = boto3.client("secretsmanager")  # least-privilege IAM role, audited
    return json.loads(client.get_secret_value(SecretId=name)["SecretString"])

db = get_secret("prod/app/db")   # rotated on a schedule; access logged in CloudTrail
```

**Secret scanning gate — block secrets before they land:**

```yaml
# .pre-commit-config.yaml  (SECRETS-1)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
        args: ["--baseline", ".secrets.baseline"]
```

```yaml
# CI step — fail the build on any finding  (SECRETS-1)
- name: Scan for secrets
  run: gitleaks detect --source . --redact --exit-code 1
```

**Prefer short-lived credentials over static keys (SECRETS-3):** use OIDC federation
in CI (e.g. GitHub Actions → cloud role assumption) and temporary IAM roles instead of
long-lived access keys stored as repository secrets.

## What counts as a hardcoded secret

- Connection strings with embedded credentials (DB, broker, cache, SMTP).
- API keys, bearer tokens, or service-account passwords.
- Private keys, certificates, or signing seeds.
- OAuth client secrets or HMAC signing keys.

## Review checklist

Concise checklist for code review or AI-generated-code review. Each item cites its
control ID.

- [ ] No literal credential, API key, token, or password in source or config files (SECRETS-1)
- [ ] No secret present in committed `.env`, `application.yml`, `appsettings.json`, or `docker-compose.yml` (SECRETS-1)
- [ ] git history is clean; any previously committed secret was rotated and revoked (SECRETS-1)
- [ ] Pre-commit and CI secret-scanning gate (gitleaks / detect-secrets / truffleHog) is configured and blocks on findings (SECRETS-1)
- [ ] Secrets resolve at runtime from a dedicated manager (Vault, AWS/Azure/GCP), not from source (SECRETS-2)
- [ ] No secret baked into a `Dockerfile`, image layer, or build log; injected via env or mounted volume (SECRETS-2)
- [ ] Each service has least-privilege access to only its own secrets, and access is audited (SECRETS-2)
- [ ] No secret passed as a command-line argument (visible in process lists) (SECRETS-2)
- [ ] Every secret has a documented rotation period and an automated rotation path (SECRETS-3)
- [ ] Short-lived credentials (OIDC, temporary IAM roles) are used over long-lived static keys; orphaned secrets are removed (SECRETS-3)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale, compensating control,
and a follow-up date. Never silently bypass a control or commit a secret "temporarily".

## Source & drift audit

Distilled from:
- `docs/guidelines/Config.md` — Secret Management, Backend Communication, Build and Deploy
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 16, Secrets Management

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
