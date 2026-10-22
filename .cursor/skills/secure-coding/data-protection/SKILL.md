---
name: data-protection
description: >-
  Protect sensitive data throughout its lifecycle. Classify data, minimize
  collection, prevent leakage via URLs/logs/cache, and enforce retention. Use
  when touching API responses that return user data, entities with PII or
  financial fields, data access patterns, response DTOs, pagination, or data
  retention logic. Controls DATA-1 ... DATA-5.
pillar: secure-coding
controls: [DATA-1, DATA-2, DATA-3, DATA-4, DATA-5]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#13-data-protection
---

# Data Protection

**Objective:** Protect sensitive data throughout its lifecycle. Classify data, minimize collection, prevent leakage via URLs/logs/cache, and enforce retention.

## When this applies

Activate this skill when touching: API responses that return user data, entities with PII or financial fields, data access patterns, response DTOs, pagination, or data retention logic.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| DATA-1 | L2 | Classify all sensitive data and define protection levels (encryption, integrity, retention, logging, access controls); document compliance with applicable privacy regulations (GDPR, CCPA). | Data classification exists; PII fields identified; protection levels documented. |
| DATA-2 | L1 | Never send sensitive data in URLs or query strings; prevent caching of sensitive data; return only the minimum required sensitive data; mask fields (e.g. credit card last 4 only). | No PII in URLs; sensitive responses have `Cache-Control: no-store`; responses scoped to minimum needed. |
| DATA-3 | L2 | Clear authenticated data from client storage after session termination; use `Clear-Site-Data` header on logout; set `Cache-Control: no-store` on responses carrying sensitive data. | Logout clears client data; sensitive responses not cached; no PII in localStorage beyond session IDs. |
| DATA-4 | L2 | Apply data minimization: collect only what is needed; mask or redact sensitive fields in API responses; show full data only when explicitly authorized. | API responses use scoped DTOs; internal fields not exposed to unauthorized callers. |
| DATA-5 | L2 | Define and document retention periods per data category; implement automated deletion or anonymization at expiry; support right-to-erasure; remove sensitive metadata from user-submitted files. | Retention periods documented; automated deletion in place; erasure requests handled. |

## Detectable by static analysis

DATA-1, DATA-2, DATA-4 are fully detectable statically (JPA entity returned directly, no pagination, internal fields in response). DATA-3 is partially detectable (Cache-Control header in config). DATA-5 requires runtime verification of deletion jobs.

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// DATA-4: full JPA entity returned — exposes internalRiskScore, creditCardLast4 to all callers
@GetMapping("/{id}")
public ResponseEntity<UserProfile> getProfile(@PathVariable Long id) {
    return profileRepo.findById(id).map(ResponseEntity::ok)...;
}

// DATA-2: unbounded findAll() — full table dump on every request
@GetMapping
public ResponseEntity<List<UserProfile>> getAllProfiles() {
    return ResponseEntity.ok(profileRepo.findAll());
}

// DATA-4: internal fields writable from request body
existing.setInternalRiskScore(incoming.getInternalRiskScore()); // attacker-controlled
```

**Secure (apply instead):**

```java
// DATA-4: scoped DTO — only fields the caller is authorized to see
public record UserProfileResponse(String userId, String phoneNumber) {}

@GetMapping("/{id}")
public ResponseEntity<UserProfileResponse> getProfile(@PathVariable Long id, Principal principal) {
    return profileRepo.findByIdAndUserId(id, resolveUser(principal).getId())
        .map(p -> new UserProfileResponse(p.getUserId(), maskPhone(p.getPhoneNumber())))
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}

// DATA-2: paginated with max page size, scoped to principal's tenant
@GetMapping
public ResponseEntity<Page<UserProfileResponse>> getProfiles(
        @PageableDefault(size = 20, max = 100) Pageable pageable, Principal principal) {
    return ResponseEntity.ok(
        profileRepo.findByTenantId(resolveUser(principal).getTenantId(), pageable)
                   .map(this::toDto));
}
```

## Review checklist

- [ ] API responses use scoped DTOs — no JPA/ORM entity returned directly to callers (DATA-4)
- [ ] Internal fields (risk scores, internal IDs, financial data) excluded from responses unless explicitly authorized (DATA-4)
- [ ] List endpoints paginated with a maximum page size (DATA-2)
- [ ] No PII in URL query parameters (DATA-2)
- [ ] Sensitive responses include `Cache-Control: no-store` (DATA-2, DATA-3)
- [ ] PII fields classified and protection levels documented (DATA-1)
- [ ] Internal fields not writable from request body — explicit allowlist DTO used for writes (DATA-4)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 13 (Data Protection, DATA-1 ... DATA-5)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
