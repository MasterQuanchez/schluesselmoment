from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _load_okf_lib():
    path = Path(__file__).resolve().parents[2] / ".cursor" / "skills" / "okf" / "okf_lib.py"
    spec = importlib.util.spec_from_file_location("okf_lib", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["okf_lib"] = module
    spec.loader.exec_module(module)
    return module


def test_extracts_markdown_links_with_relative_targets() -> None:
    okf_lib = _load_okf_lib()
    body = """
See [backend](F001-backend-api.md), [workflow](../development/workflow.md), and
[Template](../products/template.md).
"""

    links = okf_lib.extract_internal_links(body, "knowledge/specs/E001-app-template.md")

    assert links == [
        "knowledge/specs/F001-backend-api",
        "knowledge/development/workflow",
        "knowledge/products/template",
    ]


def test_namespaces_sibling_bundle_links_for_workspace_graphs() -> None:
    okf_lib = _load_okf_lib()
    body = "See [DPR](../../dpr-bundle/knowledge/strategy/overview.md)."

    links = okf_lib.extract_internal_links(
        body,
        "knowledge/team/magicai.md",
        bundle="magicai-bundle",
        namespace=True,
    )

    assert links == ["dpr-bundle/knowledge/strategy/overview"]


def test_ignores_sibling_bundle_links_for_single_bundle_validation() -> None:
    okf_lib = _load_okf_lib()
    body = "See [DPR](../dpr-bundle/knowledge/README.md)."

    links = okf_lib.extract_internal_links(body, "knowledge/README.md")

    assert links == []


def test_ignores_shell_syntax_inside_fenced_code() -> None:
    okf_lib = _load_okf_lib()
    body = """
```bash
if [[ "$command" =~ dangerous_pattern ]]; then
    exit 1
fi
```
See [real concept](real-concept.md).
"""

    links = okf_lib.extract_internal_links(body, "knowledge/security/cursor-hooks.md")

    assert links == ["knowledge/security/real-concept"]


def test_ignores_inline_code_examples_and_non_concept_links() -> None:
    okf_lib = _load_okf_lib()
    body = "Use `[example](example.md)` as syntax. See [Agents](../AGENTS.md)."

    links = okf_lib.extract_internal_links(body, "knowledge/specs/specs-overview.md")

    assert links == []
