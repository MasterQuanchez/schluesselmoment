"""Tests for sync-to-devops/spec_to_ado_html.py."""

from pathlib import Path

import pytest
from spec_to_ado_html import spec_to_html


@pytest.fixture
def sample_spec(tmp_path: Path) -> Path:
    p = tmp_path / "F-sample.md"
    p.write_text(
        """# Sample Feature

- **Type**: Feature
- **Status**: Draft

## Context

One paragraph of context.

## Requirements

### In Scope

- First requirement
- Second requirement

### Out of Scope

- Excluded thing

## Acceptance Criteria

- Given a, when b, then c

## Implementation Notes

- 2026-01-01: **Decision** — Rationale.
""",
        encoding="utf-8",
    )
    return p


def test_spec_to_html_includes_sections(sample_spec: Path) -> None:
    desc, ac = spec_to_html(sample_spec, repo_spec_url=None)
    assert "<h2>Context</h2>" in desc
    assert "One paragraph of context" in desc
    assert "First requirement" in desc
    assert "Excluded thing" in desc
    assert "<h2>Implementation Notes</h2>" in desc
    assert "Decision" in desc
    assert "<ul>" in ac
    assert "Given a, when b, then c" in ac
