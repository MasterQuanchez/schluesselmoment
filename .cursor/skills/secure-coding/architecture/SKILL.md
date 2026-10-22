---
name: architecture
description: >-
  Build resilient software through documented architecture, defence-in-depth
  patterns, defensive coding, and proper concurrency controls. Use when touching
  architectural decisions, mass-assignment patterns (@RequestBody bound to ORM
  entities), concurrent state modifications, HTTP client redirect handling, or
  any check-then-act pattern on shared state. Controls ARCH-1 ... ARCH-4.
pillar: secure-coding
controls: [ARCH-1, ARCH-2, ARCH-3, ARCH-4]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#15-secure-architecture--coding
---

# Secure Architecture & Coding

**Objective:** Build resilient software through documented architecture, defence-in-depth patterns, defensive coding, and proper concurrency controls.

## When this applies

Activate this skill when touching: architectural decisions, mass-assignment patterns (`@RequestBody` bound to ORM entities), concurrent state modifications, HTTP client redirect handling, or any check-then-act pattern on shared state.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| ARCH-1 | L2 | Document trust boundaries, data flows, high-risk components, and architectural security decisions (ADRs); keep documentation updated as the system evolves. | Architecture diagram exists; trust boundaries marked; ADRs recorded for security decisions. |
| ARCH-2 | L2 | Apply defence in depth; fail-secure defaults; minimal attack surface; sandboxing for risky operations; rate limiting, timeouts, and circuit breakers against resource exhaustion. | No single point of security failure; all external calls have timeouts and circuit breakers. |
| ARCH-3 | L1 | Return only data the user is authorized to access; protect against mass assignment with explicit DTOs; configure backend not to follow redirects unless intended; use strict type checking. | No `@RequestBody` bound directly to JPA/ORM entity; explicit DTO with allowlisted fields used for all writes. |
| ARCH-4 | L2 | Use thread-safe types or explicit synchronization; atomic operations to prevent TOCTOU race conditions; consistent locking strategies to avoid deadlocks; fair resource allocation policies. | No read-check-write on shared state without atomic guarantee; `compareAndSet` or DB-level locking used. |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// ARCH-3: @RequestBody bound directly to JPA entity — all fields writable by attacker
@PostMapping("/create")
public ResponseEntity<Payment> createPayment(@RequestBody Payment payment) {
    // payment.status, payment.approvedBy, payment.feeWaived are attacker-controlled
    return ResponseEntity.ok(repo.save(payment));
}

// ARCH-4: TOCTOU — non-atomic read-check-write on shared state
double balance = balances.getOrDefault(userId, 0.0);  // read
if (balance < amount) { return badRequest(); }         // check
balances.put(userId, balance - amount);                // write — race window
```

**Secure (apply instead):**

```java
// ARCH-3: explicit DTO with only client-writable fields
public record CreatePaymentRequest(String recipientId, double amount) {}

@PostMapping("/create")
public ResponseEntity<PaymentResponse> createPayment(
        @RequestBody CreatePaymentRequest req, Principal principal) {
    Payment p = new Payment();
    p.setUserId(resolveUser(principal).getId()); // from principal, not body
    p.setRecipientId(req.recipientId());
    p.setAmount(req.amount());
    p.setStatus("PENDING");                      // server-side only
    return ResponseEntity.ok(toDto(repo.save(p)));
}

// ARCH-4: atomic conditional update — no race window
boolean success = balances.computeIfPresent(userId, (k, cur) ->
    cur >= amount ? cur - amount : cur
) != null;
```

## Review checklist

- [ ] No `@RequestBody` bound directly to a JPA/ORM entity — explicit DTO used (ARCH-3)
- [ ] Internal fields (status, approvedBy, role, flags) set server-side only — not from request body (ARCH-3)
- [ ] No read-check-write on shared mutable state without atomic guarantee (ARCH-4)
- [ ] `ConcurrentHashMap` conditional updates use `compute`/`computeIfPresent` not `get`+`put` (ARCH-4)
- [ ] All external HTTP calls have connection and read timeouts configured (ARCH-2)
- [ ] Trust boundaries and high-risk components documented (ARCH-1)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 15 (Secure Architecture & Coding, ARCH-1 ... ARCH-4)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
