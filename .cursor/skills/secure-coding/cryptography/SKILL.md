---
name: cryptography
description: >-
  Use only vetted cryptographic libraries and modern algorithms. Design for
  crypto agility. Manage keys through KMS/HSM, not in source code. Use when
  touching encryption/decryption, password hashing, token or nonce generation,
  key management, IV or salt generation, or any use of Cipher, MessageDigest,
  SecretKey, Random, or equivalent primitives. Controls CRYPT-1 ... CRYPT-8.
pillar: secure-coding
controls: [CRYPT-1, CRYPT-2, CRYPT-3, CRYPT-4, CRYPT-5, CRYPT-6, CRYPT-7, CRYPT-8]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#11-cryptography
---

# Cryptography

**Objective:** Use only vetted cryptographic libraries and modern algorithms. Design for crypto agility. Manage keys through KMS/HSM, not in source code.

## When this applies

Activate this skill when touching: encryption/decryption logic, password hashing, token or nonce generation, key management, IV or salt generation, or any use of `Cipher`, `MessageDigest`, `SecretKey`, `Random`, or equivalent primitives.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| CRYPT-1 | L2 | Maintain a key management policy (NIST SP 800-57); keep an inventory of all keys, algorithms, and certificates; use static and dynamic scanning to discover all cryptographic operations. | Key inventory exists; all crypto operations are catalogued; scanning integrated into CI. |
| CRYPT-2 | L2 | Use only industry-validated libraries; design for crypto agility (algorithms upgradeable via config); all primitives provide ≥ 128-bit security; use constant-time operations to prevent timing attacks. | No home-grown crypto; algorithm configurable without code change; timing-safe comparison used for secrets. |
| CRYPT-3 | L2 | AEAD only: AES-GCM, AES-GCM-SIV, ChaCha20-Poly1305; unique nonces per key/data pair; **never** ECB, CBC/CTR raw, DES, or PKCS#1 v1.5 padding. | Only AEAD modes in use; nonces generated fresh per operation; no ECB, DES, or RC4. |
| CRYPT-4 | L1 | Use only SHA-256, SHA-3, SHA-384, SHA-512; **never** MD5 or SHA-1 for any cryptographic purpose; store passwords with Argon2id (≥ 19 MiB memory) or bcrypt (≥ cost 12) or scrypt. | No MD5 or SHA-1 in any security path; passwords hashed with Argon2id or bcrypt. |
| CRYPT-5 | L1 | All non-guessable values (tokens, IVs, salts, nonces, keys) generated with OS CSPRNG with ≥ 128 bits of entropy; **never** `Math.random`, `java.util.Random`, `rand()`, Mersenne Twister, or UUID as a security token. | `SecureRandom` / `secrets` / `crypto.randomBytes` used exclusively for security values; no `Random()` or `Math.random()`. |
| CRYPT-6 | L3 | Use only approved algorithms (RSA ≥ 3072 bits, ECC P-256+, Ed25519/X25519) and modes for key generation and signatures; secure DH parameters. | No RSA < 3072 bits; no weak DH; approved curves only. |
| CRYPT-7 | L3 | Full memory encryption for sensitive data during processing; minimize exposure time; encrypt immediately after use. | Sensitive data not held in plaintext beyond immediate need. |
| CRYPT-8 | L3 | Maintain a cryptographic inventory with a documented PQC migration plan; monitor PQC standards and align with NIST selections. | PQC migration plan documented and reviewed annually. |

## Safe primitives

| Concern | Java | Python | Node.js | Go |
|---------|------|--------|---------|-----|
| Symmetric encryption | `AES/GCM/NoPadding` (JCA) | `cryptography.hazmat.primitives.ciphers.aead.AESGCM` | `crypto.createCipheriv('aes-256-gcm', ...)` | `crypto/cipher.NewGCM` |
| Password hash | `Argon2PasswordEncoder` (Spring Security) | `argon2-cffi` (`PasswordHasher`) | `argon2` package | `golang.org/x/crypto/argon2` |
| CSPRNG | `SecureRandom` | `secrets` | `crypto.randomBytes` | `crypto/rand` |
| Constant-time compare | `MessageDigest.isEqual` | `hmac.compare_digest` | `crypto.timingSafeEqual` | `subtle.ConstantTimeCompare` |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// CRYPT-4: MD5 used for password hashing — trivially reversed by rainbow tables
String hash = DigestUtils.md5Hex(rawPassword);

// CRYPT-3: AES/ECB — identical plaintext blocks produce identical ciphertext blocks
Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");

// CRYPT-5: java.util.Random is not a CSPRNG — seed is predictable
String token = Long.toHexString(new Random().nextLong());

// CRYPT-3 + CRYPT-5: static IV reused across all encryptions
private static final byte[] FIXED_IV = "1234567890123456".getBytes();
IvParameterSpec ivSpec = new IvParameterSpec(FIXED_IV); // never reuse an IV
```

**Secure (apply instead):**

```java
// CRYPT-4: Argon2 for password hashing — memory-hard, salted, slow
PasswordEncoder encoder = new Argon2PasswordEncoder(16, 32, 1, 65536, 3);
String hash = encoder.encode(rawPassword);

// CRYPT-3: AES-GCM with fresh random IV per encryption
byte[] iv = new byte[12];
new SecureRandom().nextBytes(iv);
Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));

// CRYPT-5: SecureRandom for all security-sensitive values
byte[] token = new byte[32];
new SecureRandom().nextBytes(token);
String tokenHex = HexFormat.of().formatHex(token);
```

## Review checklist

- [ ] No MD5 or SHA-1 used for any cryptographic purpose (CRYPT-4)
- [ ] Passwords hashed with Argon2id, bcrypt (≥ cost 12), or scrypt — never fast hashes (CRYPT-4)
- [ ] No AES/ECB mode anywhere in the codebase (CRYPT-3)
- [ ] IV/nonce generated fresh per encryption with CSPRNG — never hardcoded or static (CRYPT-3, CRYPT-5)
- [ ] No hardcoded encryption keys, IVs, or signing secrets in source code (CRYPT-5)
- [ ] `java.util.Random` / `Math.random()` not used for any security-sensitive value (CRYPT-5)
- [ ] All crypto uses vetted libraries (JCA, Bouncy Castle) — no custom implementations (CRYPT-2)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 11 (Cryptography, CRYPT-1 ... CRYPT-8)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
