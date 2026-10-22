---
name: authorization
description: >-
  Enforce least-privilege access decisions at function, object, and field level,
  always server-side. Use when code performs access checks, fetches records by ID,
  verifies object ownership (IDOR / BOLA), exposes entity fields, isolates
  multi-tenant data, gates admin interfaces, or evaluates role / permission claims.
  Controls AUTHZ-1 … AUTHZ-4.
pillar: secure-coding
controls: [AUTHZ-1, AUTHZ-2, AUTHZ-3, AUTHZ-4]
level-default: L2
source:
  - docs/guidelines/Authorization.md
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#7-authorization
---

# Authorization

**Objective:** Grant access only to explicitly permitted consumers. Enforce least
privilege at function, object, and field level, and decide every access server-side.
Defends against IDOR/BOLA, privilege escalation, and cross-tenant data leakage.

## When this applies

Activate this skill when touching: endpoints or handlers that fetch or mutate a
resource by ID, queries that load records owned by a user, role / permission /
entitlement checks, response serializers that expose entity fields, multi-tenant
data access, and admin or privileged functions. If a task spans authentication
(login, tokens) also load the `authentication` leaf.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| AUTHZ-1 | L2 | Document function-level and data-specific access rules, field-level restrictions, and how contextual factors (time, location, device) affect decisions | An authorization model exists that names protected functions, per-record ownership rules, restricted fields, and contextual conditions |
| AUTHZ-2 | L1 | Restrict sensitive functions; enforce data-specific permissions so a user can only access their own records (prevent IDOR/BOLA); limit field exposure; apply context-adaptive controls | Every record access is scoped to the authenticated principal; sensitive functions and fields are denied by default and only granted explicitly |
| AUTHZ-3 | L2 | Enforce authorization server-side, never via client-side controls; apply permission changes immediately; decide based on the originating user's rights, not an intermediary service | No access decision relies on client input; revoked permissions take effect at once; service-to-service calls carry and check the originating user's rights |
| AUTHZ-4 | L2 | Isolate tenants so users cannot access or affect another tenant's data; secure admin interfaces with continuous identity verification, device posture, and contextual risk analysis | Tenant scope is derived from the authenticated principal on every query; admin access is continuously re-verified, not gated by network location alone |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```text
# IDOR: resource fetched by ID with no ownership check
record = db.orders.get(request.params.id)
return record

# Tenant scope taken from the request body (attacker-controlled)
rows = db.query("SELECT * FROM data WHERE tenant_id = ?", body.tenant_id)

# Client-supplied role trusted directly
if request.body.role == "admin":
    delete_user(target)

# Over-exposure: full entity returned to any authenticated user
return serialize(user)  # includes salary, internal flags, ssn
```

**Secure (apply instead):**

```text
# Scope the query by the authenticated principal
record = db.orders.get(id=request.params.id, owner_id=principal.id)
if record is None:
    return 404  # do not reveal existence of others' records

# Tenant derived from the authenticated principal, never from input
rows = db.query("SELECT * FROM data WHERE tenant_id = ?", principal.tenant_id)

# Re-validate authority server-side from trusted store
if authz.has_permission(principal, "user:delete"):
    delete_user(target)

# Field-level projection: expose only permitted fields
return serialize(user, fields=authz.visible_fields(principal, user))
```

## Review checklist

Concise checklist for code review or AI-generated-code review. Each item cites its
control ID.

- [ ] Every fetch/update by ID is scoped to the authenticated principal or its ownership is explicitly verified (AUTHZ-2)
- [ ] Tenant identifiers come from the authenticated principal, never from request body, query, or header (AUTHZ-4)
- [ ] Roles, permissions, and entitlements are read from a trusted server-side store, not client-supplied values (AUTHZ-3)
- [ ] Authorization is enforced on the server for every protected function; no decision relies on hidden fields or UI state (AUTHZ-3)
- [ ] Responses use field-level projection; sensitive fields are excluded unless the principal is entitled to them (AUTHZ-2)
- [ ] Sensitive and admin functions deny by default and require an explicit grant (AUTHZ-2)
- [ ] Admin interfaces apply continuous identity verification and contextual risk checks, not just network location (AUTHZ-4)
- [ ] Permission revocations take effect immediately; long-lived tokens are re-checked or revoked on change (AUTHZ-3)
- [ ] Cross-tenant access is impossible: every query and mutation filters by the principal's tenant (AUTHZ-4)
- [ ] The authorization model (functions, ownership, fields, context) is documented and matches the enforced code (AUTHZ-1)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/guidelines/Authorization.md` — Documentation, General Design, Operation Level, Other Considerations
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 7. Authorization

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
