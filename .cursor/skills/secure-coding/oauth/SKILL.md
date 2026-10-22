---
name: oauth
description: >-
  OAuth2 and OIDC security: PKCE, state parameter, redirect URI validation,
  token audience enforcement, scope minimisation, consent management, and
  authorization server hardening. Use when touching OAuth2 authorization flows,
  PKCE implementation, redirect URI configuration, access or refresh token
  handling, OIDC nonce validation, introspection endpoints, or consent screens.
  Controls OAUTH-1 ... OAUTH-7.
pillar: secure-coding
controls: [OAUTH-1, OAUTH-2, OAUTH-3, OAUTH-4, OAUTH-5, OAUTH-6, OAUTH-7]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#10-oauth2--oidc
---

# OAuth2 & OIDC

**Objective:** Implement OAuth2 and OIDC flows securely — prevent CSRF via
state/PKCE, prevent mix-up attacks, enforce token audience, validate nonces,
and restrict redirect URIs to exact matches. Never expose tokens to the browser
or use implicit/password grants.

## When this applies

Activate this skill when touching: OAuth2 authorization code flow, PKCE
(`code_verifier`, `code_challenge`), `state` parameter generation and
validation, redirect URI registration and validation, access token or refresh
token handling, OIDC `nonce` claim, `id_token` validation, token introspection,
consent screens, or authorization server configuration. If sessions are involved,
also load the `session-management` skill.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| OAUTH-1 | L2 | Restrict access and refresh tokens to backend components only; accept authorization codes or ID tokens only if resulting from a flow initiated by the same user-agent session using PKCE, state, or nonce. | Tokens never exposed to browser JavaScript; authorization code accepted only after validating matching state/PKCE/nonce from session. |
| OAUTH-2 | L2 | Use PKCE (`S256`) or `state` parameter to prevent CSRF; validate `iss` parameter to prevent mix-up attacks; request minimum required scopes. | PKCE (`S256`) implemented on all authorization requests; `state` validated on callback; `iss` validated; scopes are minimal. |
| OAUTH-3 | L2 | Accept access tokens only for the intended audience (validate `aud`); enforce authorization using `sub`, `scope`, and `authorization_details`; require sender-constrained tokens to prevent replay. | `aud` claim validated on every token use; `sub` and `scope` enforced; DPoP or mTLS sender-constraining at L3. |
| OAUTH-4 | L3 | Exact-string match for redirect URI validation; authorization codes single-use and ≤ 10 min (≤ 1 min at L3); do not allow implicit or password grants; require PKCE; reject `plain` code_challenge_method. | Redirect URI exact-matched; codes expire ≤ 10 min and are single-use; no implicit or password grant; only `S256` challenge method accepted. |
| OAUTH-5 | L2 | Validate `nonce` claim matches value sent in auth request; identify users using non-reassignable `sub` claim; reject metadata if issuer URL does not match expected value. | `nonce` validated on ID token; user identified by `sub` not `email`; issuer URL exact-matched against configuration. |
| OAUTH-6 | L3 | Allow only `code`, `ciba`, `id_token`, or `id_token code` response modes; prefer `code`; do not use implicit flows. | No implicit flow; `response_type=token` rejected; authorization server only issues code flow responses. |
| OAUTH-7 | L2 | Always prompt users for consent when client identity cannot be assured; present clear information about requested authorizations and their lifetime; allow users to review, modify, and revoke consents. | Consent prompt shown for unrecognised clients; consent UI lists scopes clearly; consent revocation available in account settings. |

## Safe primitives

| Concern | Spring Boot | Node.js | Go |
|---------|-------------|---------|-----|
| PKCE generation | `spring-security-oauth2-client` (auto PKCE with `S256`) | `openid-client` with `code_challenge_method: 'S256'` | `golang.org/x/oauth2` with PKCE extension |
| State validation | Spring Security handles automatically | `openid-client` state parameter | manual: store in session, validate on callback |
| Token validation | `spring-security-oauth2-resource-server` | `jsonwebtoken` with `audience` option | `coreos/go-oidc` |
| Redirect URI | `spring.security.oauth2.client.registration.*.redirect-uri` (exact match) | `openid-client` `redirect_uris` (exact match) | exact string comparison |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// OAUTH-2: no state or PKCE — CSRF possible
String authUrl = "https://idp.example.com/oauth/authorize"
    + "?client_id=" + clientId
    + "&redirect_uri=" + redirectUri
    + "&response_type=code";   // no state, no PKCE

// OAUTH-4: redirect URI with wildcard match
if (redirectUri.startsWith("https://app.example.com")) {   // too broad
    // attacker uses https://app.example.com.evil.com
}

// OAUTH-1: access token exposed to browser JavaScript
// Frontend fetches token and stores in localStorage — attacker can steal via XSS

// OAUTH-5: user identified by email (reassignable)
String userId = idToken.getClaim("email");   // email can be reassigned by IdP
```

**Secure (apply instead):**

```java
// OAUTH-2: PKCE S256 with state (Spring Security auto-handles this)
// In application.yml:
// spring.security.oauth2.client.registration.idp.authorization-grant-type: authorization_code
// Spring Security automatically adds PKCE S256 and state for public clients

// OAUTH-4: exact redirect URI match
private static final Set<String> ALLOWED_REDIRECT_URIS = Set.of(
    "https://app.example.com/callback"   // exact strings only, no wildcards
);
if (!ALLOWED_REDIRECT_URIS.contains(redirectUri)) {
    throw new OAuth2AuthenticationException("Invalid redirect_uri");
}

// OAUTH-3: validate audience on resource server
@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
    decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuerUri));
    // audience validated via spring.security.oauth2.resourceserver.jwt.audiences
    return decoder;
}

// OAUTH-5: user identified by sub (non-reassignable)
String userId = idToken.getSubject();   // sub is stable and non-reassignable
```

## Review checklist

- [ ] PKCE (`S256`) used on all authorization requests — never `plain` (OAUTH-2, OAUTH-4)
- [ ] `state` parameter generated, stored in session, and validated on callback (OAUTH-2)
- [ ] `iss` parameter validated to prevent mix-up attacks (OAUTH-2)
- [ ] Minimum required scopes requested (OAUTH-2)
- [ ] Access and refresh tokens kept in backend — never exposed to browser JavaScript (OAUTH-1)
- [ ] `aud` claim validated on every token use (OAUTH-3)
- [ ] Redirect URI validated by exact string match — no prefix or wildcard matching (OAUTH-4)
- [ ] Authorization codes single-use and expire ≤ 10 min (OAUTH-4)
- [ ] No implicit or password grants used (OAUTH-4, OAUTH-6)
- [ ] `nonce` validated on ID token (OAUTH-5)
- [ ] Users identified by `sub` claim — not `email` or other reassignable claim (OAUTH-5)
- [ ] Consent UI presents requested scopes clearly and allows revocation (OAUTH-7)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 10 (OAuth2 & OIDC, OAUTH-1 ... OAUTH-7)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
