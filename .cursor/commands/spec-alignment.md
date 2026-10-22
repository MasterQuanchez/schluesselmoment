# Spec Alignment

## Overview

Align documentation with implementation by converting verbose design docs into concise specs. The output serves as a knowledge base for AI coding agents—complementary to code, not redundant with it.

## Inputs

- `$DOC`: Path to the markdown doc to update (e.g., `docs/data_filtering.md`)
- `$MODULES`: Comma-separated module paths to study (e.g., `flow/data_filtering.py, flow/ui.py`)

e.g. `/spec-alignment docs/data_filtering.md flow/data_filtering.py,flow/ui.py`

## Steps

1. **Study the implementation**
    - Read all files in the specified `$MODULES`
    - Understand the public APIs, key abstractions, and data flows
    - Note how modules interact with each other and external dependencies

2. **Identify what's worth documenting**
    - Non-obvious design decisions and their rationale
    - Module boundaries and responsibilities
    - Key entry points and extension points
    - Important constraints, edge cases, or gotchas
    - Configuration options and their effects

3. **Skip what's redundant**
    - Implementation details obvious from reading code
    - Standard patterns the agent can infer
    - Outdated planning artifacts (original requirements, task lists, TODOs)
    - Verbose explanations of straightforward logic

4. **Write the aligned spec**
    - Start with a brief module overview (1-2 sentences)
    - List key components with one-line descriptions
    - Document module interactions and data flow
    - Add important file references (relative paths)
    - Use bullet points; avoid prose paragraphs

## Output Format

```markdown
# Module Name

Brief description of what this module provides.

## Key Components

- `ComponentA`: What it does
- `ComponentB`: What it does

## Module Interactions

- How this module connects to others
- Key data flows

## Important Details

- Non-obvious constraints or gotchas
- Configuration notes

## References

- `path/to/key_file.py`: Why it's important
```

## Guidelines

- **Concise over comprehensive**: If it's obvious from code, skip it
- **Index, not manual**: Help agents find things, don't explain everything
- **Current state only**: Remove planning artifacts that don't reflect implementation
- **Actionable references**: Include file paths agents can immediately open
