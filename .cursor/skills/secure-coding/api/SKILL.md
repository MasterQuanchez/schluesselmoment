---
name: api
description: >-
  API and web service security: HTTP method allowlisting, header validation,
  HTTP/2 downgrade safety, GraphQL hardening, and WebSocket authentication.
  Use when touching REST controllers, HTTP method configuration, proxy headers,
  GraphQL schemas or resolvers, WebSocket upgrade handlers, or API gateway
  configuration. Controls API-1 ... API-5.
pillar: secure-coding
controls: [API-1, API-2, API-3, API-4, API-5]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#4-api--web-service
---

# API & Web Service Security

**Objective:** Harden the API surface against HTTP smuggling, method abuse,
GraphQL abuse, and unauthenticated WebSocket connections. Validate what comes
in at the transport and protocol layer before business logic runs.

## When this applies

Activate this skill when touching: REST endpoint method configuration, HTTP
request header handling, proxy header forwarding (`X-Forwarded-For`,
`X-Real-IP`), HTTP/2 protocol downgrading, GraphQL schema, query depth or
cost limits, introspection settings, WebSocket upgrade handlers, or any
middleware processing raw HTTP requests.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| API-1 | L1 | Set `Content-Type` on all responses; only user-facing endpoints redirect HTTP→HTTPS; allowlist only required HTTP methods; return 405 for others. | No response missing `Content-Type`; non-user-facing endpoints do not redirect; unexpected methods return 405. |
| API-2 | L1 | Reject requests with both `Transfer-Encoding` and `Content-Length`; do not allow end-users to override proxy-set headers (e.g. `X-Forwarded-For`). | Requests with conflicting framing headers rejected; proxy headers not overrideable by untrusted clients. |
| API-3 | L2 | Correct request-length calculation when downgrading from HTTP/2; strip or reject `Transfer-Encoding` in HTTP/2; reject full CRLF sequences in HTTP/2 headers. | HTTP/2 downgrade does not introduce smuggling; CRLF in headers rejected. |
| API-4 | L2 | GraphQL: query allowlists, depth limiting, and cost analysis; disable introspection in production unless intentional for third-party use. | Max query depth enforced; introspection disabled in production; query cost limit rejects expensive queries. |
| API-5 | L2 | WebSocket: use `wss://` for all connections; validate `Origin` header against allowlist on handshake; authenticate with dedicated session tokens obtained via HTTPS before upgrade; rate limit per connection. | All WebSocket connections over `wss://`; `Origin` validated on upgrade; unauthenticated upgrades rejected; per-connection rate limit active. |

## Safe primitives

| Concern | Spring Boot | Node.js | Go |
|---------|-------------|---------|-----|
| Method allowlist | `@RequestMapping(method = {GET, POST})` | `app.get()` / `app.post()` | `r.Methods("GET", "POST")` |
| GraphQL depth limit | `graphql-java` `MaxQueryDepthInstrumentation` | `graphql-depth-limit` | `gqlgen` complexity |
| WebSocket auth | Spring `WebSocketMessageBrokerConfigurer` with interceptor | `ws` with custom `verifyClient` | `gorilla/websocket` with `CheckOrigin` |
| HTTP/2 | Spring Boot auto-configures; ensure `server.http2.enabled=true` with HTTPS | `http2` module | standard library |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// API-1: all HTTP methods accepted — DELETE and PUT not needed on this endpoint
@RequestMapping("/api/users/{id}")   // no method restriction

// API-2: user-controlled header trusted as proxy header
String ip = request.getHeader("X-Forwarded-For");   // attacker can spoof this

// API-4: introspection enabled in production
// No depth or cost limit configured — allows expensive nested queries

// API-5: WebSocket without Origin validation and no auth check
@Override
public void afterConnectionEstablished(WebSocketSession session) {
    sessions.add(session);   // no auth, no Origin check
}
```

**Secure (apply instead):**

```java
// API-1: explicit method allowlist
@GetMapping("/api/users/{id}")    // only GET; other methods return 405

// API-2: use RemoteAddrIpExtractor or trust only known proxy IPs
// Configure Spring Security to read IP from trusted proxy only
// Never read X-Forwarded-For directly from untrusted clients

// API-4: GraphQL with depth and cost limits
GraphQL graphQL = GraphQL.newGraphQL(schema)
    .instrumentation(new MaxQueryDepthInstrumentation(10))
    .instrumentation(new MaxQueryComplexityInstrumentation(200))
    .build();
// Disable introspection in prod:
// graphql-java: set NoIntrospectionInstrumentation in production profile

// API-5: WebSocket with Origin validation and session auth
@Override
public boolean beforeHandshake(ServerHttpRequest req, ServerHttpResponse res,
        WebSocketHandler handler, Map<String, Object> attrs) {
    String origin = req.getHeaders().getOrigin();
    if (!ALLOWED_ORIGINS.contains(origin)) { res.setStatusCode(HttpStatus.FORBIDDEN); return false; }
    HttpSession session = ((ServletServerHttpRequest) req).getServletRequest().getSession(false);
    if (session == null || session.getAttribute("user") == null) {
        res.setStatusCode(HttpStatus.UNAUTHORIZED); return false;
    }
    return true;
}
```

## Review checklist

- [ ] All endpoints restrict to required HTTP methods; unexpected methods return 405 (API-1)
- [ ] `Content-Type` set on every response (API-1)
- [ ] `X-Forwarded-For` and similar headers not trusted from untrusted clients (API-2)
- [ ] Requests with both `Transfer-Encoding` and `Content-Length` rejected (API-2)
- [ ] GraphQL query depth and cost limits configured (API-4)
- [ ] GraphQL introspection disabled in production (API-4)
- [ ] WebSocket connections use `wss://` (API-5)
- [ ] WebSocket `Origin` header validated against allowlist on handshake (API-5)
- [ ] WebSocket connections require authenticated session before upgrade (API-5)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 4 (API & Web Service, API-1 ... API-5)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
