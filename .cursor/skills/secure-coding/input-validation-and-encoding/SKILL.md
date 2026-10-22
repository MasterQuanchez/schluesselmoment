---
name: input-validation-and-encoding
description: >-
  Prevents injection, XSS, and logic-abuse by enforcing context-aware output
  encoding, parameterized data access, safe deserialization, and server-side
  input/business-rule validation. Use when building or reviewing code that runs
  SQL/NoSQL/LDAP queries, renders HTML or template output, makes subprocess/shell
  calls, deserializes data, parses XML, validates input with regex, enforces
  business rules, or applies rate limiting. Controls ENC-1 … ENC-5, VAL-1 …
  VAL-4. Note: prompt injection (ENC-6) lives in the `ai-llm-security` leaf, not
  here.
pillar: secure-coding
controls: [ENC-1, ENC-2, ENC-3, ENC-4, ENC-5, VAL-1, VAL-2, VAL-3, VAL-4]
level-default: L1
source:
  - docs/guidelines/Encoding-Sanitization.md
  - docs/guidelines/Validation-Business-Logic.md
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#1-encoding--sanitization
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#2-validation--business-logic
---

# Input Validation and Encoding

**Objective:** Stop injection, XSS, and business-logic abuse by treating all input as untrusted: decode once, validate server-side against an allowlist, and encode at every output sink with context-aware escaping. The server is the single source of truth for validation.

## When this applies

Activate this skill when touching: SQL/NoSQL/LDAP/XPath queries; HTML, template, or JavaScript/JSON output sinks; subprocess or shell invocation; object/XML/JSON deserialization; regex-based input checks; business-rule enforcement (limits, sequential flows, approvals); rate limiting and anti-automation. If touching LLM prompts, also load the `ai-llm-security` leaf (ENC-6).

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| ENC-1 | L1 | Decode URL-encoded input exactly once before validation; store data in original form, not pre-encoded | No double-decoding; DB/store holds raw values, not HTML/URL-encoded forms |
| ENC-2 | L1 | Context-aware output encoding at every sink; parameterized queries for every SQL/NoSQL/LDAP call | No untrusted data concatenated into a query, HTML, or JS context; sinks use the canonical primitive |
| ENC-3 | L1 | Sanitize user-generated rich HTML with a vetted library; allowlist URL protocols; never `eval()` user input | DOMPurify/bleach applied to rich HTML; URLs checked against `http:`/`https:`; no dynamic eval of input |
| ENC-4 | L2 | Safe string handling; validate integer ranges; argument-array subprocess APIs, never string `exec` | Subprocess calls pass an arg array with `shell=False`; integer inputs range-checked |
| ENC-5 | L2 | Disable external entity resolution (XXE) in XML parsers; type-allowlist deserialization; no `pickle`/`ObjectInputStream` on untrusted data | XML parser has DTD/entity resolution disabled; no native deserializers on untrusted bytes |
| VAL-1 | L2 | Document business-logic rules (limits, valid transitions, relationships) before implementation | Limits, required steps, and approval rules are written down and traceable to code |
| VAL-2 | L1 | Validate all input server-side; allowlist over denylist; anchored regex `^…$` with length bounds; check format, range, consistency | Every input has a server-side check; regexes anchored and length-bounded |
| VAL-3 | L2 | Enforce sequential flows and documented limits server-side; use DB transactions for multi-step ops; require multi-user approval for high-value actions | Steps cannot be skipped via direct calls; limits enforced at the domain layer, not UI |
| VAL-4 | L2 | Rate limit per user/IP on sensitive endpoints; CAPTCHA on high-risk actions; reject superhuman request rates; enforce per-user quotas | Login/registration/reset endpoints are rate limited; quotas enforced server-side |

## Safe primitives by concern

| Concern | Java | Python | Node.js | Go |
|---------|------|--------|---------|-----|
| SQL | `PreparedStatement`, JPA named params | DB-API `?`, SQLAlchemy | `pg`/`mysql2` params, Prisma | `database/sql` placeholders |
| HTML encode | OWASP Java Encoder, Thymeleaf | `markupsafe`, Jinja2 autoescape | `dompurify` | `html/template` |
| Subprocess | `ProcessBuilder(List<String>)` | `subprocess.run([...], shell=False)` | `child_process.execFile` | `exec.Command(name, args...)` |
| XML | `disallow-doctype-decl=true` | `defusedxml` | `fast-xml-parser` strict mode | `encoding/xml` (no DTD) |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```python
# ENC-2: SQL string concat
cur.execute("SELECT * FROM users WHERE id = '" + user_id + "'")

# ENC-2: innerHTML with user data (XSS)
el.innerHTML = userComment;

# ENC-4: string-based shell exec
subprocess.run("convert " + filename + " out.png", shell=True)

# ENC-5: native deserialization of untrusted data
import pickle; obj = pickle.loads(request.body)
import xml.etree.ElementTree as ET; ET.fromstring(body)  # XXE
```

**Secure (apply instead):**

```python
# ENC-2: parameterized query
cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# ENC-2/ENC-3: context-aware output + sanitized rich HTML
import bleach
el.textContent = userComment            # plain text sink
safe = bleach.clean(rich_html)          # rich HTML via vetted lib

# ENC-4: argument-array subprocess, no shell
subprocess.run(["convert", filename, "out.png"], shell=False)

# ENC-5: safe XML, no pickle
from defusedxml.ElementTree import fromstring
tree = fromstring(body)                 # entity resolution disabled
data = json.loads(request.body)         # JSON instead of pickle

# VAL-2: anchored, length-bounded allowlist regex
import re
if not re.fullmatch(r"^[a-z0-9_]{3,32}$", username):
    raise ValueError("invalid username")
```

## Review checklist

- [ ] Input decoded exactly once before validation; stored in original form (ENC-1)
- [ ] Every SQL/NoSQL/LDAP call uses parameterized queries, never concatenation (ENC-2)
- [ ] Output encoded per context: HTML escape, `textContent`, URL/JS encoding (ENC-2)
- [ ] Rich HTML sanitized via DOMPurify/bleach; no `eval()` on input; URL protocols allowlisted (ENC-3)
- [ ] Subprocess calls use an argument array with `shell=False`; integer ranges checked (ENC-4)
- [ ] XML parsers disable external entities; no `pickle`/`ObjectInputStream` on untrusted data (ENC-5)
- [ ] Business-logic limits, transitions, and approvals documented before code (VAL-1)
- [ ] All input validated server-side, allowlist-based, anchored regex `^…$` with length bounds (VAL-2)
- [ ] Sequential flows and limits enforced server-side; multi-step ops in DB transactions (VAL-3)
- [ ] Rate limiting/CAPTCHA/quotas on sensitive endpoints; superhuman rates rejected (VAL-4)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up. Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/guidelines/Encoding-Sanitization.md` — Validation Architecture, Injection Prevention, Sanitization, Memory/Strings, Safe Deserialization
- `docs/guidelines/Validation-Business-Logic.md` — Documentation, Input Validation, Business Logic Security, Anti-automation
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 1 (Encoding & Sanitization, ENC-1..ENC-5) and section 2 (Validation & Business Logic, VAL-1..VAL-4)

Control IDs above are the audit anchors. ENC-6 (prompt injection) is owned by the `ai-llm-security` leaf and is intentionally excluded here. If the source guideline changes, re-run the distillation pipeline and reconcile this table; do not hand-drift control text.
