---
name: session-management
description: >-
  Server-side session lifecycle: token generation, inactivity and absolute
  timeouts, session termination on logout, session fixation prevention, and
  federated re-authentication. Use when touching session creation or
  invalidation, login/logout flows, session token generation, inactivity
  timeout configuration, concurrent session handling, or federated identity
  session coordination. Controls SESS-1 ... SESS-6.
pillar: secure-coding
controls: [SESS-1, SESS-2, SESS-3, SESS-4, SESS-5, SESS-6]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#8-session-management
---

# Session Management

**Objective:** Ensure sessions are generated securely, expire predictably,
terminate fully on logout, and resist fixation and hijacking. Session tokens
must come from a CSPRNG, be validated server-side, and be rotated on
authentication.

## When this applies

Activate this skill when touching: session token creation (`HttpSession`,
`express-session`, custom token stores), login and logout flows, session
timeout configuration, concurrent session policy, account disable/delete
flows, sensitive account attribute changes (email, phone, MFA), or federated
identity (SAML, OIDC) session coordination. If tokens are JWT-based, also load
the `tokens` skill.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| SESS-1 | L2 | Define inactivity timeout (default ≤ 15 min) and absolute session lifetime (default ≤ 8 h); document concurrent session policy; document federated identity session coordination. | Session policy documented; inactivity ≤ 15 min and absolute ≤ 8 h enforced; concurrent session behaviour defined. |
| SESS-2 | L1 | Verify session tokens using a trusted backend service; use dynamically generated reference tokens — never static secrets; generate tokens with ≥ 128 bits entropy from CSPRNG. | Session token validated server-side on every request; tokens are CSPRNG-generated with ≥ 128 bits entropy; no static or predictable tokens. |
| SESS-3 | L1 | Enforce inactivity timeout ≤ 15 min; enforce absolute session lifetime ≤ 8 h; issue a new session token on authentication, terminating the previous one (prevents fixation). | Inactivity and absolute timeouts enforced; session rotated on login — old session ID invalidated before issuing new one. |
| SESS-4 | L1 | Logout and expiration must fully terminate the session server-side; terminate all sessions when account is disabled or deleted; provide logout functionality on all authenticated pages. | Server-side session invalidated on logout; expired sessions rejected; account disable clears all sessions; logout link present on every authenticated page. |
| SESS-5 | L2 | Re-authenticate before modifying sensitive account attributes (email, phone, MFA); allow users to view and terminate all active sessions; administrators can terminate sessions for any user. | Sensitive changes require re-auth; session management UI available to users; admin session termination available. |
| SESS-6 | L2 | Session lifetime and termination between RPs and IdPs must follow documented requirements; require explicit user action to create new federated sessions. | Federated session coordination documented and implemented; back-channel logout handled; new federated sessions require user consent. |

## Safe primitives

| Concern | Spring Boot | Node.js | Go |
|---------|-------------|---------|-----|
| Session generation | `spring-session` with `SecureRandom`-backed token store | `express-session` with `genid: () => crypto.randomBytes(32).toString('hex')` | `gorilla/sessions` with `securecookie` |
| Session invalidation | `session.invalidate()` | `req.session.destroy()` | `session.Options.MaxAge = -1` |
| Inactivity timeout | `server.servlet.session.timeout=15m` | `cookie.maxAge: 15 * 60 * 1000` | `MaxAge: 900` in session store |
| Session rotation on login | `SessionFixationProtectionStrategy` (Spring Security default) | `req.session.regenerate()` after auth | manual: delete old, create new |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// SESS-2: predictable session token from Math.random (not CSPRNG)
String token = Long.toHexString((long)(Math.random() * Long.MAX_VALUE));

// SESS-3: no session rotation on login — session fixation possible
// Attacker plants a known session ID; after victim logs in, attacker reuses it
httpSession.setAttribute("user", authenticatedUser);   // same session ID kept

// SESS-4: client-side-only logout — server session persists
// Just clearing a cookie or local storage without server-side invalidation
response.addCookie(new Cookie("session", ""));   // server session still valid

// SESS-3: no inactivity timeout configured
// application.properties: server.servlet.session.timeout not set (defaults to 30 min or none)
```

**Secure (apply instead):**

```java
// SESS-2: CSPRNG session token (Spring Security does this automatically)
// Ensure SessionCreationPolicy and SecureRandom are used:
// Spring Security's default HttpSessionSecretSessionRepository uses SecureRandom

// SESS-3: session rotation on login (Spring Security default with SessionFixationProtectionStrategy)
http.sessionManagement(sm -> sm
    .sessionFixation().newSession()              // invalidates old, creates new
    .maximumSessions(1)                          // concurrent session policy
    .expiredSessionStrategy(event -> {})
);

// SESS-3 + SESS-4: timeouts in application.properties
// server.servlet.session.timeout=15m           // inactivity timeout
// Absolute lifetime requires custom filter or Spring Session with maxInactiveInterval

// SESS-4: full server-side logout
@PostMapping("/logout")
public ResponseEntity<Void> logout(HttpSession session) {
    session.invalidate();                        // server-side invalidation
    // also clear the session cookie
    return ResponseEntity.ok().build();
}

// SESS-5: re-authentication before sensitive change
@PostMapping("/account/change-email")
public ResponseEntity<Void> changeEmail(@RequestBody ChangeEmailRequest req,
        Principal principal) {
    authService.verifyPassword(principal.getName(), req.currentPassword());   // re-auth
    userService.updateEmail(principal.getName(), req.newEmail());
    return ResponseEntity.ok().build();
}
```

## Review checklist

- [ ] Session tokens generated with CSPRNG with ≥ 128 bits entropy (SESS-2)
- [ ] Session token validated server-side on every request — no client-side-only validation (SESS-2)
- [ ] Session rotated on login — old session ID invalidated before issuing new one (SESS-3)
- [ ] Inactivity timeout ≤ 15 min configured (SESS-3)
- [ ] Absolute session lifetime ≤ 8 h configured (SESS-3)
- [ ] Server-side session fully invalidated on logout (SESS-4)
- [ ] All sessions terminated when account is disabled or deleted (SESS-4)
- [ ] Logout functionality present on all authenticated pages (SESS-4)
- [ ] Sensitive account changes (email, phone, MFA) require re-authentication (SESS-5)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 8 (Session Management, SESS-1 ... SESS-6)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
