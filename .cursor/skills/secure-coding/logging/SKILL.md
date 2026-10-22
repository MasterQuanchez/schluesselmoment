---
name: logging
description: >-
  Log security-relevant events with sufficient metadata for investigation;
  protect log integrity; fail gracefully without exposing internals to clients.
  Use when touching log statements, exception handlers, error responses, audit
  trails, or any code that catches and surfaces errors to callers.
  Controls LOG-1 ... LOG-5.
pillar: secure-coding
controls: [LOG-1, LOG-2, LOG-3, LOG-4, LOG-5]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#14-logging--error-handling
---

# Logging & Error Handling

**Objective:** Log security-relevant events with sufficient metadata for investigation; protect log integrity; fail gracefully without exposing internals to clients.

## When this applies

Activate this skill when touching: log statements, exception handlers, error responses, audit trails, or any code that catches and surfaces errors to callers.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| LOG-1 | L2 | Document what events are logged at each layer, log formats, storage locations, access controls, and retention periods. | Logging policy documented and reviewed; covers all security-relevant event types. |
| LOG-2 | L1 | Every log entry includes: timestamp (UTC RFC 3339), source IP, user agent, principal ID, action, resource, outcome, severity, correlation/request ID; synchronize time sources. | All log entries contain required fields; no entries missing correlation ID or principal. |
| LOG-3 | L2 | Log all authentication attempts (success and failure) including MFA factors used; log authorization failures; log input validation bypass attempts; log security control failures; log sensitive data access (record ID only, never the data itself). | Auth events logged with outcome; authz failures logged; no sensitive field values in log entries. |
| LOG-4 | L2 | Encode log data to prevent log injection; restrict write access to logs; transmit logs to a separate system for analysis; append-only sink where possible. | Log output encoded; no user-controlled newlines or ANSI sequences in entries; logs forwarded to SIEM. |
| LOG-5 | L1 | Show only generic error messages for security-sensitive or unexpected errors; **never** expose stack traces, query plans, connection strings, or internal paths in HTTP responses; include a correlation/request ID for support reference. | No stack trace, class name, or file path in any HTTP error response; all errors return a correlation ID. |

## What to NEVER log

- Passwords, password hashes, or password reset tokens.
- Full session tokens, JWT values, API keys, or bearer tokens.
- Full credit card numbers (PAN), CVV, or bank account numbers.
- Decrypted PII (SSN, passport, biometrics).
- Encryption keys or key material.

## What to always log

- Login success and failure (username/userID, never password).
- Authorization denials (who tried to access what).
- Account lifecycle events (create, modify, delete, disable).
- Privilege changes and MFA changes.
- Security control bypass attempts.

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// LOG-3: credential logged in plaintext
log.info("Login: email={}, password={}, token={}", email, password, token);

// LOG-5: full stack trace returned in HTTP response
catch (Exception e) {
    return ResponseEntity.status(500).body("Error: " + e.getMessage() + "\n" + stackTraceToString(e));
}

// LOG-1: access denied event silently swallowed — no audit trail
if (!adminKey.equals(expectedKey)) {
    return ResponseEntity.status(403).body("Forbidden"); // nothing logged
}
```

**Secure (apply instead):**

```java
// LOG-3: log outcome, never the credential
log.warn("Login failure — email={}, ip={}", email, request.getRemoteAddr());

// LOG-5: generic error with correlation ID; detail in log only
catch (Exception e) {
    String ref = UUID.randomUUID().toString();
    log.error("Unexpected error [{}]", ref, e);
    return ResponseEntity.status(500).body("An error occurred. Reference: " + ref);
}

// LOG-3: access denied logged for audit trail
log.warn("Access denied — resource={}, principal={}, ip={}", id, principal.getName(), ip);
return ResponseEntity.status(403).body("Forbidden");
```

## Review checklist

- [ ] No password, token, or key material in any log statement (LOG-3)
- [ ] All authentication events (success and failure) logged with outcome and IP (LOG-3)
- [ ] All authorization failures logged with principal and resource (LOG-3)
- [ ] No stack trace, class name, or file path returned in HTTP responses (LOG-5)
- [ ] All error responses include a correlation/reference ID (LOG-5)
- [ ] Log entries include timestamp, principal, action, resource, outcome (LOG-2)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 14 (Logging & Error Handling, LOG-1 ... LOG-5)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
