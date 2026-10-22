---
name: authentication
description: >-
  Verifying user and device identity and protecting credentials against
  impersonation, brute force, and credential theft. Use when touching login
  endpoints, password storage and hashing, MFA/TOTP/out-of-band codes, account
  recovery and password reset, default accounts, or IdP/SAML/federated sign-in.
  Controls AUTH-1 ... AUTH-8.
pillar: secure-coding
controls: [AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-5, AUTH-6, AUTH-7, AUTH-8]
level-default: L2
source:
  - docs/guidelines/Authentication.md
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#6-authentication
---

# Authentication

**Objective:** Verify the identity of users and devices and protect credentials
from interception or recovery, resisting impersonation, brute force, credential
stuffing, and MFA bypass.

## When this applies

Activate this skill when touching: login and sign-in endpoints, password storage
and hashing, password change and reset flows, account recovery, MFA / TOTP /
out-of-band (OOB) code generation and verification, lookup secrets, default or
seed accounts, certificate / FIDO2 / WebAuthn auth, and IdP / SAML / OIDC
federated sign-in. If a task also issues sessions or tokens, also load the
`session` and `token` leaves.

## Controls

Apply every control at or below the application's target level (`L1 subset of L2 subset of L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| AUTH-1 | L2 | Document rate-limiting, anti-automation, lockout policy, and every authentication pathway. | All auth paths inventoried; lockout and anti-automation behaviour is written down and enforced consistently. |
| AUTH-2 | L1 | Passwords: min 12 chars (15+ recommended, 26+ for admin), accept any character, accept up to 64+ chars, no periodic rotation unless compromised, block context-specific words, check against breach DB (HIBP k-anonymity at L2/L3), hash with a memory-hard algorithm. | Stored with Argon2id (preferred), or bcrypt cost >= 12 / scrypt; per-password random salt; breach check rejects known-compromised passwords. |
| AUTH-3 | L1 | Rate-limit login per IP and per identifier with exponential backoff; disable/remove default accounts; require MFA for L2+ (hardware-based at L3); prevent user enumeration. | Repeated failures throttled; no `admin`/`root` default creds in prod; identical error message and constant-time response for unknown user vs wrong password. |
| AUTH-4 | L2 | Initial passwords / activation codes via CSPRNG, single-use, expire quickly, force change on first login; no password hints or secret questions; reset does not bypass MFA. | Reset/initial-credential flow generates CSPRNG single-use codes; password reset still requires the user's MFA factor. |
| AUTH-5 | L2 | Lookup secrets, OOB codes, and TOTPs single-use; min 20-bit entropy; TOTP valid 30 s; OOB codes valid <= 10 min; rate-limit MFA verification; biometrics only as secondary factor. | Each code accepted once; entropy >= 20 bits via CSPRNG; TOTP validated against trusted time source; expired/replayed codes rejected. |
| AUTH-6 | L3 | PSTN/SMS OTP only as secondary factor alongside stronger methods and not allowed at L3; bind OOB codes to the originating request; use number matching to stop push bombing. | SMS not offered as the sole or L3 factor; OOB code tied to the request that triggered it; push prompts require number matching. |
| AUTH-7 | L3 | Store certificates securely; challenge nonces >= 64 bits, unique over device lifetime; implement FIDO2/WebAuthn for highest assurance. | Cert store tamper-protected; each challenge nonce is >= 64 bits and never reused for that device. |
| AUTH-8 | L2 | Federated sign-in: register users by IdP ID + user ID combination; validate digital signatures on assertions; SAML assertions single-use within validity period. | User bound to (IdP id, user id); JWT/SAML signature verified; replayed SAML assertion rejected within its validity window. |

## Safe primitives

| Concern | Java | Python | Node.js | Go |
|---------|------|--------|---------|-----|
| Password hash | `Argon2PasswordEncoder` (Spring Security) | `argon2-cffi` (`PasswordHasher`) | `argon2` package | `golang.org/x/crypto/argon2` |
| CSPRNG codes | `SecureRandom` | `secrets` | `crypto.randomBytes` | `crypto/rand` |
| TOTP | `dev.samstevens.totp` | `pyotp` | `otplib` | `pquerna/otp` |
| Constant-time compare | `MessageDigest.isEqual` | `hmac.compare_digest` | `crypto.timingSafeEqual` | `subtle.ConstantTimeCompare` |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```text
# Unsalted fast hash - trivially cracked / rainbow-tabled (AUTH-2)
store(user, sha256(password))

# Leaks which accounts exist + timing oracle (AUTH-3)
if not user_exists(email):      return error("No account with that email")
if not check(pw, user.hash):    return error("Incorrect password")

# Reset flow skips the second factor (AUTH-4)
def reset_password(token, new_pw):
    user = lookup(token); user.set_password(new_pw)   # MFA never re-checked
```

**Secure (apply instead):**

```text
# Memory-hard, salted, breach-checked (AUTH-2)
if hibp_breached(password): reject("password found in breach corpus")
store(user, argon2id(password))   # per-password random salt built in

# Identical message + constant-time path prevents enumeration (AUTH-3)
record = lookup(email)            # may be None
ok = verify_constant_time(password, record.hash if record else DUMMY_HASH)
if not ok: return error("Invalid email or password")   # same for both cases
throttle(ip, email)               # rate-limit + exponential backoff

# Reset preserves MFA (AUTH-4)
def reset_password(token, new_pw, mfa_code):
    user = lookup(single_use(token))
    require_mfa(user, mfa_code)    # second factor still enforced
    user.set_password(new_pw)
```

## Review checklist

Concise checklist for code review or AI-generated-code review. Each item cites its control ID.

- [ ] Passwords hashed with Argon2id (or bcrypt cost >= 12 / scrypt) and per-password salt; never MD5/SHA-256 unsalted (AUTH-2)
- [ ] Password policy: min 12 chars (26+ admin), any character, no forced rotation; new passwords breach-checked via HIBP k-anonymity (AUTH-2)
- [ ] Login rate-limited per IP and identifier with exponential backoff (AUTH-3)
- [ ] No default/seed credentials (`admin`, `root`) active in production (AUTH-3)
- [ ] Auth failures return a single generic message with constant-time response - no user enumeration (AUTH-3)
- [ ] MFA enforced for L2+ (hardware factor at L3); biometrics only secondary (AUTH-3, AUTH-5)
- [ ] OOB/TOTP/lookup codes are single-use, CSPRNG-generated, >= 20-bit entropy, expire (<= 10 min OOB, 30 s TOTP) - never reusable (AUTH-5)
- [ ] SMS not used as sole or L3 factor; push uses number matching (AUTH-6)
- [ ] Crypto challenge nonces >= 64 bits and unique per device (AUTH-7)
- [ ] Password reset and recovery preserve MFA and use single-use CSPRNG codes; no hints/secret questions (AUTH-4)
- [ ] Federated sign-in binds IdP id + user id, verifies assertion signatures, and rejects replayed single-use SAML assertions (AUTH-8)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/guidelines/Authentication.md` - Password Security, General Authentication Security, Factor Lifecycle and Recovery, MFA Requirements, Out-of-Band, Cryptographic, IdP chapters
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` - section 6 (Authentication, AUTH-1 ... AUTH-8 with Antipatterns)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
