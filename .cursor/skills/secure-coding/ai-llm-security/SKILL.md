---
name: ai-llm-security
description: >-
  Secure construction of LLM/AI prompts, handling of model output, and review of
  AI-generated code. Use when building or templating LLM prompts, concatenating user
  input into prompts, handling or using model output (queries, shell, backend, UI),
  scoping RAG sources, reviewing AI-generated code, integrating autonomous agents, or
  handling system prompts. Controls ENC-6, SUPPLY-1.
pillar: secure-coding
controls: [ENC-6, SUPPLY-1]
level-default: L2
source:
  - docs/ai/AISecureDevelopmentGuideline.md
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#1-encoding--sanitization
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#17-supply-chain
---

# AI / LLM Security

**Objective:** Defend against prompt injection, insecure handling of model output, and
the silent merge of unreviewed AI-generated code (OWASP LLM Top 10 + supply-chain risk).

## When this applies

Activate this skill when touching:

- Prompt construction or templating that includes user input.
- Code that handles or consumes model output (SQL, shell, backend calls, UI rendering).
- RAG / document-retrieval source scoping and exclusions.
- System-prompt definition, storage, or logging.
- Review of AI-generated code (Copilot, Cursor, ChatGPT, Claude, etc.).
- Autonomous-agent integrations that can act on live systems.

If the task involves non-AI injection sinks (SQL, HTML, shell, deserialization), also
load `input-validation-and-encoding` (ENC-1 … ENC-5, VAL-*).

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| ENC-6 | L2 | Sanitize all user input before including it in an LLM/AI prompt. Maintain explicit separation between system prompt and user input using delimiters and validation - never direct concatenation. Treat LLM output as untrusted before using it in any security-sensitive path (backend, queries, shell, UI). | User input is validated/sanitized and passed in a delimited or structured field distinct from the system prompt; model output is validated/encoded at the sink before use; no raw f-string/`+` concatenation of user text into a prompt. |
| SUPPLY-1 | L1 | Treat AI-generated code as untrusted third-party code requiring full review. NEVER merge AI-generated auth/authz/crypto code without explicit security review. Validate AI-suggested dependency names exist in official registries before use. Run SAST on AI-generated code. Document when AI tools were used in security-sensitive areas. | AI-generated security-sensitive code carries a recorded review; every AI-suggested package is confirmed present in the official registry before install; SAST runs on the change; AI usage in sensitive areas is documented in the PR. |

### OWASP LLM Top 10 mapping

| LLM vector | Risk | Control |
|------------|------|---------|
| LLM01 Prompt Injection | User input overrides team-defined behaviour | ENC-6 |
| LLM02 Sensitive Info Disclosure | Model leaks other users' data or prompt content | ENC-6 |
| LLM05 Insecure Output Handling | Output reaches backend/query/UI unvalidated | ENC-6 |
| LLM06 Excessive Agency | Agent acts beyond approved scope | SUPPLY-1 + agent governance |
| LLM07 System Prompt Leakage | Internal instructions extracted by users | ENC-6 |

### Autonomous agent governance

Agent autonomy must be matched by an active, documented control level. Automatic
classifiers carry an approximate 17% false-negative rate, so a classifier alone is not
sufficient for high-autonomy agents.

| Level | Mechanism | Coverage |
|-------|-----------|----------|
| 1 | Built-in automatic classifier | Auto-approval; ~17% false negatives |
| 2 | Built-in sandbox | Blocks filesystem writes and network; read permitted |
| 3 | Third-party sandboxing | Full isolation of the execution environment |

No agent runs without at least one active and documented control level. Greater autonomy
demands a higher level.

## Secure vs insecure patterns

**Insecure (flag and fix):**

```text
# Prompt injection: user text concatenated directly into the prompt (ENC-6)
prompt = f"You are a support bot. Answer this: {user_input}"

# Insecure output handling: model output used directly in a SQL query (ENC-6)
cursor.execute("SELECT * FROM docs WHERE topic = '" + llm_output + "'")

# Output used directly in a shell command (ENC-6)
os.system("summarize " + llm_output)

# AI-generated auth code merged without review (SUPPLY-1)
# (Copilot-suggested login handler committed straight to main)

# AI-suggested package installed without registry verification (SUPPLY-1)
pip install fast-json-helper   # name hallucinated by the model
```

**Secure (apply instead):**

```text
# Delimited/structured prompt with validated input; system role kept separate (ENC-6)
user_input = validate(user_input)            # allowlist, length bound
messages = [
  {"role": "system",  "content": SYSTEM_PROMPT},   # never concatenated with user text
  {"role": "user",    "content": user_input},       # isolated, delimited field
]

# Model output treated as untrusted: validate, then use a parameterized query (ENC-6)
topic = validate_against_allowlist(llm_output)
cursor.execute("SELECT * FROM docs WHERE topic = ?", (topic,))

# AI-generated security-sensitive code: gated review before merge (SUPPLY-1)
# - explicit security review recorded on the PR
# - SAST run on the diff
# - dependency names confirmed in the official registry
# - AI usage noted in the PR description
```

## Review checklist

Concise checklist for code review or AI-generated-code review. Each item cites its control.

- [ ] User input is validated/sanitized before reaching any prompt (ENC-6).
- [ ] System prompt and user input are separated by delimiters/structured roles - no direct concatenation (ENC-6).
- [ ] Model output is treated as untrusted and validated/encoded before backend, query, shell, or UI use (ENC-6).
- [ ] Prompts carry no credentials, PII, or confidential data to the provider (ENC-6).
- [ ] System prompt is version-controlled and excluded from logs and error responses (ENC-6, LLM07).
- [ ] RAG source set is explicitly scoped; exclusions documented (ENC-6).
- [ ] AI-generated auth/authz/crypto code has an explicit recorded security review before merge (SUPPLY-1).
- [ ] AI-suggested dependency names verified to exist in the official registry before install (SUPPLY-1).
- [ ] SAST has run on AI-generated code (SUPPLY-1).
- [ ] Autonomous agents run under at least one documented control level proportional to autonomy (SUPPLY-1, LLM06).

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/ai/AISecureDevelopmentGuideline.md` - OWASP LLM Top 10 mapping, controls by SDL phase, autonomous-agent governance levels.
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` - section 1 (ENC-6, Prompt Injection Prevention) and section 17 (SUPPLY-1, AI-Generated Code Security Review).

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.

This leaf overlaps `input-validation-and-encoding` for non-AI injection (ENC-1 … ENC-5);
load that leaf when the same change also writes SQL/HTML/shell/deserialization sinks.
