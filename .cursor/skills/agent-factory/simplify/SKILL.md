---
name: simplify
description: |
  Post-implementation code simplification pass. Identifies YAGNI violations, unnecessary complexity, and redundancy. Preserves exact functionality while improving clarity. Use after implementation is complete.
---

# Simplify

Review recently changed code for unnecessary complexity. Apply the YAGNI principle ruthlessly while preserving functionality and clarity.

## Inputs

- Recently modified files (from the current session or a specific diff)
- Or a specific file/directory to review

## Outputs

- A simplification analysis with prioritized recommendations
- Optionally, the simplified code (if the user approves)

## What to Look For

1. **Unnecessary abstractions** — Interfaces, base classes, or helpers used only once. Recommend inlining.

2. **Premature generalization** — Generic solutions for specific problems. Extensibility points without clear use cases.

3. **Redundant code** — Duplicate error checks, repeated patterns that can be consolidated, commented-out code.

4. **Over-complex logic** — Nested ternaries, dense one-liners, deep nesting. Prefer early returns, switch statements, and explicit flow.

5. **Speculative features** — Code that handles scenarios that can't happen yet. "Just in case" fallbacks.

6. **Style consistency** — Follow project conventions from AGENTS.md. Align naming, structure, and patterns with the existing codebase.

## Constraints

- Never change what the code does — only how it does it
- Never flag `docs/*.md` for removal
- Prefer clarity over brevity — explicit code beats clever code
- Don't combine too many concerns into single functions
- Only refine code that was recently modified unless explicitly asked otherwise
- Don't over-simplify — removing helpful abstractions is also a mistake

## Output Format

```
## Simplification Analysis

### Core Purpose
{What this code actually needs to do}

### YAGNI Violations
- {What's unnecessary and why}

### Recommendations
1. {Most impactful change} — {LOC saved, clarity improved}

### Assessment
Complexity: High/Medium/Low
Action: Proceed with simplifications / Minor tweaks / Already minimal
```

## Next Steps

After simplifications are applied and verified:
- Run `test` to confirm no regressions were introduced.
- Then continue with `submit` if the feature is ready for PR.
