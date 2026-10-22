---
name: secure-communications
description: >-
  Protect all data in transit — internal and external — with strong TLS. Never
  fall back to plaintext for any channel carrying real data. Use when touching
  HTTP client configuration, TLS/SSL settings, TrustManager or SSLContext setup,
  HostnameVerifier, connection strings to databases/brokers/caches, or internal
  service URLs. Controls COMM-1 ... COMM-4.
pillar: secure-coding
controls: [COMM-1, COMM-2, COMM-3, COMM-4]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#12-secure-communications
---

# Secure Communications

**Objective:** Protect all data in transit — internal and external — with strong TLS. Never fall back to plaintext for any channel carrying real data.

## When this applies

Activate this skill when touching: HTTP client configuration, TLS/SSL settings, `TrustManager` or `SSLContext` setup, `HostnameVerifier`, connection strings to databases/brokers/caches, or internal service URLs.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion | Detectable statically |
|------|-------|-------------|----------------------|----------------------|
| COMM-1 | L2 | Enable only TLS 1.2 and TLS 1.3; prefer TLS 1.3; use AEAD cipher suites with forward secrecy; enable OCSP Stapling. | TLS 1.0 and 1.1 disabled; verified with TLS scanner (testssl.sh, Qualys). | ⚠️ Config only; runtime version requires live scanner |
| COMM-2 | L1 | All client-to-external service connections over TLS; **never** fall back to plaintext; validate hostname and chain — **never** `InsecureSkipVerify`, trust-all `TrustManager`, or `verify=False`. | No trust-all `TrustManager`; no `HostnameVerifier` returning `true` unconditionally; default JVM `SSLContext` used. | ✅ Fully static |
| COMM-3 | L2 | Encrypt all inbound and outbound server communications (databases, message queues, external APIs); TLS clients validate server certificates before communicating. | All connection strings include `ssl=true` or equivalent. | ⚠️ Connection string detectable; mTLS requires runtime |
| COMM-4 | L2 | TLS or equivalent for all internal HTTP-based service communication; use trusted certificates; mTLS for intra-service auth at L3. | No `http://` URLs for internal service calls; internal base URLs use `https://`. | ✅ URL scheme in config/code |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// COMM-2: trust-all TrustManager — accepts any certificate including attacker-issued ones
TrustManager[] trustAll = new TrustManager[]{
    new X509TrustManager() {
        public void checkServerTrusted(X509Certificate[] c, String a) {} // empty — no validation
        public void checkClientTrusted(X509Certificate[] c, String a) {}
        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
    }
};
// CAUTION: setDefaultSSLSocketFactory / setDefaultHostnameVerifier are JVM-GLOBAL —
// affects ALL subsequent HTTPS connections in the process, not just this one

// COMM-2: hostname verifier that always returns true
HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);

// COMM-4: internal service called over plain HTTP
URL url = new URL("http://internal-payment-service:8081/api/process");

// COMM-3: database connection without SSL
spring.datasource.url=jdbc:postgresql://db:5432/app  # missing ssl=true
```

**Secure (apply instead):**

```java
// COMM-2: use JVM default SSLContext — validates chain and hostname automatically
URL url = new URL(serviceUrl);
HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();
// No custom TrustManager — default validates certificate chain and hostname correctly

// COMM-4: internal services always over HTTPS
internal.payment-service.url=https://internal-payment-service:8443

// COMM-3: database connection with SSL required
spring.datasource.url=jdbc:postgresql://db:5432/app?ssl=true&sslmode=require
```

## Review checklist

- [ ] No trust-all `TrustManager` (empty `checkServerTrusted`) anywhere in the codebase (COMM-2)
- [ ] No `HostnameVerifier` that returns `true` unconditionally (COMM-2)
- [ ] `setDefaultSSLSocketFactory` / `setDefaultHostnameVerifier` not called with permissive values (COMM-2)
- [ ] All internal service URLs use `https://` not `http://` (COMM-4)
- [ ] Database, cache, and broker connection strings include `ssl=true` or equivalent (COMM-3)
- [ ] No `InsecureSkipVerify`, `verify=False`, or `rejectUnauthorized: false` in any config (COMM-2)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 12 (Secure Communications, COMM-1 ... COMM-4)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
