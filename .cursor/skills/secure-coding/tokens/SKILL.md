---
name: tokens
description: >-
  Validate integrity, source, and context of self-contained tokens (JWT, SAML)
  before accepting their claims. Never trust the token's own header for
  algorithm selection. Use when touching JWT generation or validation, SAML
  assertions, token signing keys, alg header handling, token expiry, or
  audience validation. Controls TOK-1 ... TOK-2.
pillar: secure-coding
controls: [TOK-1, TOK-2]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#9-self-contained-tokens
---

# Self-contained Tokens

**Objective:** Validate integrity, source, and context of tokens (JWT, SAML) before accepting their claims. Never trust the token's own header for algorithm selection.

## When this applies

Activate this skill when touching: JWT generation or validation, SAML assertions, token signing keys, `alg` header handling, token expiry, or audience validation. If the same change also issues or validates sessions, load `session` as well.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| TOK-1 | L2 | Validate digital signature or MAC before accepting token content; maintain an explicit allowlist of accepted algorithms; never accept `alg=none`; validate `jku`, `x5u`, `jwk` headers against a trusted allowlist. | Signature verified before claims are used; algorithm allowlist enforced server-side; `alg=none` always rejected. |
| TOK-2 | L2 | Accept tokens only if current time is within validity period (`nbf` and `exp`); validate token type matches intended use; validate `aud` claim; prevent cross-service replay via audience restrictions. | `exp` and `nbf` always checked; `aud` validated; expired tokens rejected; token type validated. |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// TOK-1: alg:none accepted — unsigned token forgery
if (headerJson.contains("\"alg\":\"none\"")) {
    return true; // critical — no signature check
}

// TOK-1: structural check only — not signature verification
return parts.length == 3; // presence of segment ≠ valid HMAC

// TOK-2: exp and nbf parsed but never validated
String payloadJson = decode(parts[1]); // claims read but expiry ignored
```

**Secure (apply instead):**

```java
// TOK-1 + TOK-2: vetted library enforces algorithm allowlist and claims validation
JwtParser parser = Jwts.parserBuilder()
    .setSigningKey(signingKey)
    .requireAudience("my-service")        // TOK-2: audience enforced
    .build();
Claims claims = parser.parseClaimsJws(token).getBody(); // exp/nbf auto-checked
// alg:none rejected by library; algorithm allowlist enforced
```

## Review checklist

- [ ] `alg=none` always rejected — never accepted as a valid algorithm (TOK-1)
- [ ] Algorithm enforced from server-side allowlist, not from the token header (TOK-1)
- [ ] `exp` claim validated on every token verification (TOK-2)
- [ ] `nbf` claim validated when present (TOK-2)
- [ ] `aud` claim validated against expected audience (TOK-2)
- [ ] Signature verified cryptographically — not by structural check only (TOK-1)
- [ ] Vetted JWT library used (JJWT, Nimbus JOSE, python-jose, jsonwebtoken) — no manual parsing (TOK-1)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 9 (Self-contained Tokens, TOK-1 ... TOK-2)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
