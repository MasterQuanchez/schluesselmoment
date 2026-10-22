---
name: web-frontend
description: >-
  Browser-side security controls: headers, cookies, CSP, CORS, SRI, and
  anti-forgery. Use when touching HTTP response headers, cookie configuration,
  Content-Security-Policy, CORS preflight handling, SameSite settings,
  Subresource Integrity, postMessage handlers, or any server-side code that
  sets browser security features. Controls WEB-1 ... WEB-7.
pillar: secure-coding
controls: [WEB-1, WEB-2, WEB-3, WEB-4, WEB-5, WEB-6, WEB-7]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#3-web-frontend-security
---

# Web Frontend Security

**Objective:** Ensure the browser enforces the security posture you intend. Set
headers, cookies, and content policies that prevent XSS propagation, CSRF,
clickjacking, MIME-sniffing, and data leakage across origins.

## When this applies

Activate this skill when touching: HTTP response header configuration, cookie
creation or modification, Content-Security-Policy directives, CORS preflight
handling, `SameSite` cookie attributes, Subresource Integrity tags,
`postMessage` event handlers, redirect URL validation, or any middleware that
wraps responses with security headers.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| WEB-1 | L2 | Document required browser security features: HTTPS, HSTS, CSP, cookie flags, SRI policy. | Security header policy documented and reviewed; deviations recorded as exceptions. |
| WEB-2 | L1 | Set correct `Content-Type` on all responses; use `Content-Disposition: attachment` to force file downloads; render text with `createTextNode` or `textContent` — never `innerHTML`. | No response missing `Content-Type`; no user-controlled content rendered via `innerHTML`. |
| WEB-3 | L1 | All cookies: `Secure`, `HttpOnly`, `SameSite=Strict`; prefer `__Host-` prefix; never `SameSite=None` without `Secure`; max 4096 bytes per cookie. | Every `Set-Cookie` header includes `Secure`, `HttpOnly`, and `SameSite=Strict`; no oversized cookies. |
| WEB-4 | L1 | `Strict-Transport-Security: max-age=31536000; includeSubDomains`; `X-Content-Type-Options: nosniff`; `Content-Security-Policy` with `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`; CSP report-uri endpoint. | All four headers present on every response; CSP blocks inline scripts and framing. |
| WEB-5 | L1 | Anti-forgery tokens or `SameSite=Strict` for state-changing requests; validate `Origin` header on CORS preflight; restrict sensitive operations to POST/PUT/DELETE; no JSONP with sensitive data. | CSRF protection active on all state-changing endpoints; CORS allowlist is explicit and minimal. |
| WEB-6 | L2 | Subresource Integrity (`integrity="sha384-…"`) on every third-party `<script>` and `<link rel="stylesheet">`. | No third-party script or stylesheet loaded without a valid SRI hash. |
| WEB-7 | L2 | Validate `postMessage` origin in sender and receiver; never `targetOrigin: '*'` with sensitive payload; no deprecated technologies (Flash, ActiveX, Silverlight); redirect only to allowlisted URLs. | All `postMessage` handlers check `event.origin`; no wildcard target origin with sensitive data; no deprecated plugins. |

## Safe primitives

| Concern | Spring Boot | Node.js / Express | Go |
|---------|-------------|------------------|-----|
| Security headers | `spring-security` (`headers()` DSL) | `helmet` | `secure` middleware |
| CSP | `ContentSecurityPolicyHeaderWriter` | `helmet.contentSecurityPolicy()` | custom middleware |
| Cookie flags | `ResponseCookie.from(...).httpOnly(true).secure(true).sameSite("Strict")` | `res.cookie(..., { httpOnly: true, secure: true, sameSite: 'strict' })` | `http.SetCookie` with flags |
| CSRF | `CsrfTokenRepository` | `csurf` | `gorilla/csrf` |
| SRI | `<script integrity="sha384-…" crossorigin="anonymous">` | same | same |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// WEB-3: cookie without security flags
Cookie c = new Cookie("session", token);
response.addCookie(c);   // no Secure, no HttpOnly, no SameSite

// WEB-4: missing security headers
// No HSTS, no CSP, no X-Content-Type-Options in SecurityConfig

// WEB-5: CORS wildcard
config.addAllowedOrigin("*");   // accepts any origin

// WEB-7: open redirect
response.sendRedirect(request.getParameter("next"));   // attacker-controlled
```

**Secure (apply instead):**

```java
// WEB-3: fully secured cookie
ResponseCookie cookie = ResponseCookie.from("session", token)
    .httpOnly(true)
    .secure(true)
    .sameSite("Strict")
    .path("/")
    .maxAge(Duration.ofHours(8))
    .build();
response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

// WEB-4: security headers via Spring Security
http.headers(h -> h
    .httpStrictTransportSecurity(hsts -> hsts.maxAgeInSeconds(31536000).includeSubDomains(true))
    .contentTypeOptions(Customizer.withDefaults())
    .frameOptions(fo -> fo.deny())
    .contentSecurityPolicy(csp -> csp.policyDirectives(
        "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    ))
);

// WEB-5: explicit CORS allowlist
config.setAllowedOrigins(List.of("https://app.example.com"));

// WEB-7: allowlisted redirect
private static final Set<String> ALLOWED = Set.of("/dashboard", "/profile");
String next = request.getParameter("next");
response.sendRedirect(ALLOWED.contains(next) ? next : "/");
```

## Review checklist

- [ ] All cookies set with `Secure`, `HttpOnly`, and `SameSite=Strict` (WEB-3)
- [ ] `__Host-` cookie prefix used where applicable (WEB-3)
- [ ] `Strict-Transport-Security` header present with `includeSubDomains` (WEB-4)
- [ ] `X-Content-Type-Options: nosniff` on all responses (WEB-4)
- [ ] `Content-Security-Policy` blocks `object-src`, `base-uri`, and `frame-ancestors` (WEB-4)
- [ ] CORS origin allowlist is explicit — no wildcard `*` for credentialed requests (WEB-5)
- [ ] CSRF protection active on all state-changing endpoints (WEB-5)
- [ ] Third-party scripts and stylesheets have SRI `integrity` attribute (WEB-6)
- [ ] All `postMessage` handlers validate `event.origin` explicitly (WEB-7)
- [ ] Redirect targets validated against an allowlist (WEB-7)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 3 (Web Frontend Security, WEB-1 ... WEB-7)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
