"""Render knowledge/specs/*.md sections into HTML for Azure DevOps work item fields.

Used by sync-to-devops: System.Description + Microsoft.VSTS.Common.AcceptanceCriteria.
Run (from repo root): python .cursor/skills/agent-factory/sync-to-devops/spec_to_ado_html.py path/to/spec.md
Prints JSON: {"description": "<html>", "acceptanceCriteria": "<html>"}
"""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path


def _section(lines: list[str], start_heading: str) -> tuple[list[str], int]:
    """Return lines belonging to section starting at start_heading (## ...) until next ##."""
    i = 0
    while i < len(lines):
        if lines[i].strip() == start_heading:
            i += 1
            body: list[str] = []
            while i < len(lines) and not lines[i].startswith("## "):
                body.append(lines[i])
                i += 1
            return body, i
        i += 1
    return [], 0


def _strip_title_and_meta(text: str) -> list[str]:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    if lines and lines[0].startswith("# "):
        i = 1
    while i < len(lines) and not lines[i].startswith("## "):
        i += 1
    while i < len(lines):
        out.append(lines[i])
        i += 1
    return out


def _bullets_to_ul(block: list[str]) -> str:
    items: list[str] = []
    for line in block:
        s = line.strip()
        if s.startswith("- "):
            items.append(f"<li>{html.escape(s[2:].strip())}</li>")
    if not items:
        return ""
    return "<ul>" + "".join(items) + "</ul>"


def _paragraphs(block: list[str]) -> str:
    chunks: list[str] = []
    buf: list[str] = []
    for line in block:
        if not line.strip():
            if buf:
                chunks.append("<p>" + html.escape(" ".join(buf)) + "</p>")
                buf = []
        else:
            buf.append(line.strip())
    if buf:
        chunks.append("<p>" + html.escape(" ".join(buf)) + "</p>")
    return "".join(chunks)


def _subblocks(body: list[str]) -> str:
    """Handle ### In Scope / ### Out of Scope / plain lists."""
    parts: list[str] = []
    i = 0
    while i < len(body):
        line = body[i]
        if line.startswith("### "):
            title = line.strip()
            i += 1
            sub: list[str] = []
            while i < len(body) and not body[i].startswith("### ") and not body[i].startswith("## "):
                sub.append(body[i])
                i += 1
            parts.append(f"<h4>{html.escape(title.replace('### ', ''))}</h4>")
            ul = _bullets_to_ul(sub)
            if ul:
                parts.append(ul)
            else:
                parts.append(_paragraphs(sub))
        else:
            i += 1
    return "".join(parts)


def spec_to_html(spec_path: Path, repo_spec_url: str | None = None) -> tuple[str, str]:
    raw = spec_path.read_text(encoding="utf-8")
    lines = _strip_title_and_meta(raw)

    ctx_lines, _ = _section(lines, "## Context")
    req_lines, _ = _section(lines, "## Requirements")
    ac_lines, _ = _section(lines, "## Acceptance Criteria")
    feat_lines, _ = _section(lines, "## Features")
    dec_lines, _ = _section(lines, "## Implementation Notes")

    desc_parts: list[str] = []
    desc_parts.append("<h2>Context</h2>")
    desc_parts.append(_paragraphs(ctx_lines))

    desc_parts.append("<h2>Requirements</h2>")
    if any(line.strip().startswith("### ") for line in req_lines):
        desc_parts.append(_subblocks(req_lines))
    else:
        desc_parts.append(_paragraphs(req_lines))

    if feat_lines:
        desc_parts.append("<h2>Features</h2>")
        # relative markdown links as plain text
        items = []
        for line in feat_lines:
            s = line.strip()
            if s.startswith("- "):
                items.append(f"<li>{html.escape(s[2:].strip())}</li>")
        if items:
            desc_parts.append("<ul>" + "".join(items) + "</ul>")

    if dec_lines:
        desc_parts.append("<h2>Implementation Notes</h2>")
        desc_parts.append(_bullets_to_ul(dec_lines))

    if repo_spec_url:
        desc_parts.append(
            f"<p><strong>Source spec (repo):</strong> "
            f'<a href="{html.escape(repo_spec_url)}">{html.escape(repo_spec_url)}</a></p>'
        )

    description = "".join(desc_parts)

    ac_items = []
    for line in ac_lines:
        s = line.strip()
        if s.startswith("- "):
            ac_items.append(f"<li>{html.escape(s[2:].strip())}</li>")
    acceptance = "<ul>" + "".join(ac_items) + "</ul>" if ac_items else ""

    return description, acceptance


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: spec_to_ado_html.py <spec.md> [--repo-url URL]", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    repo_url = None
    if "--repo-url" in sys.argv:
        i = sys.argv.index("--repo-url")
        if i + 1 < len(sys.argv):
            repo_url = sys.argv[i + 1]
    desc, ac = spec_to_html(path, repo_url)
    print(json.dumps({"description": desc, "acceptanceCriteria": ac}, ensure_ascii=False))


if __name__ == "__main__":
    main()
