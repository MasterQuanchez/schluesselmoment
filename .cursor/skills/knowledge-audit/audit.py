"""Knowledge-audit: deterministic drift and data-safety checks for OKF bundles.

Catches the failure modes a structural OKF validator misses: date drift,
future-dated entries, dangling frontmatter sources, broken cross-bundle links,
PII leakage, and stale reviews. Run per-bundle (default) or across every sibling
bundle in the workspace with --workspace.

Exit code 1 if any ERROR-level finding is reported; 0 otherwise.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

CONCEPT_ROOTS = ["knowledge", "memory", "data-products"]
RESERVED = {"index.md", "log.md"}
STALE_DAYS_DEFAULT = 90

_FRONTMATTER_RE = re.compile(r"^---\s*\n(?P<fm>.*?)\n---\s*\n?", re.DOTALL)
_LINK_RE = re.compile(r"\[(?P<text>[^\]]*)\]\((?P<href>[^)]+)\)")
_DATE_RE = re.compile(r"(\d{4})-?(\d{2})-?(\d{2})")

# Data-safety patterns (high-precision subset of the AGENTS.md PII signal table).
# The "Last, First" surname heuristic is intentionally left to the semantic pass /
# data-safety skill: in knowledge prose it produces too many false positives
# ("Vision, Method", "Defect Dojo, Dependency Track") to gate a build on.
_PII_PATTERNS = [
    ("email address", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("corporate user/badge ID", re.compile(r"\b[A-Z]\d{6,}\b")),
    ("windows user path", re.compile(r"[Cc]:\\Users\\[^\\\s]+")),
]


@dataclass
class Finding:
    level: str  # ERROR or WARN
    rel: str
    message: str


@dataclass
class Concept:
    path: Path
    rel: str
    frontmatter: dict
    body: str
    raw: str
    sources: list[str] = field(default_factory=list)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    fm_text = match.group("fm")
    body = text[match.end():]
    try:
        import yaml  # type: ignore

        parsed = yaml.safe_load(fm_text)
        if isinstance(parsed, dict):
            return parsed, body
    except Exception:
        pass
    return _minimal_parse(fm_text), body


def _minimal_parse(fm_text: str) -> dict:
    data: dict = {}
    key = None
    for line in fm_text.splitlines():
        if not line.strip():
            continue
        if line[:1].isspace():
            item = line.strip().lstrip("-").strip()
            if key and item:
                data.setdefault(key, [])
                if isinstance(data[key], list):
                    data[key].append(item)
            continue
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not match:
            continue
        key, raw = match.group(1), match.group(2).strip()
        data[key] = raw.strip("\"'") if raw else []
    return data


def _frontmatter_source_paths(fm: dict) -> list[str]:
    """Extract .md path-like references from the sources block."""
    raw = fm.get("sources")
    items: list[str] = []
    if isinstance(raw, list):
        for entry in raw:
            items.append(str(entry))
    elif raw:
        items.append(str(raw))
    paths: list[str] = []
    for item in items:
        # entries look like "meeting: memory/x.md" or {"meeting": "memory/x.md"}
        value = item.split(":", 1)[-1].strip().strip("{}").strip().strip("\"'")
        value = value.split(":")[-1].strip().strip("\"'") if value.count(":") else value
        if value.endswith(".md") and "/" in value:
            paths.append(value)
    return paths


def iter_concepts(root: Path) -> list[Concept]:
    concepts: list[Concept] = []
    for top in CONCEPT_ROOTS:
        base = root / top
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.md")):
            if path.name in RESERVED:
                continue
            raw = path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(raw)
            concepts.append(
                Concept(
                    path=path,
                    rel=path.relative_to(root).as_posix(),
                    frontmatter=fm,
                    body=body,
                    raw=raw,
                    sources=_frontmatter_source_paths(fm),
                )
            )
    return concepts


def _parse_date(value: str) -> date | None:
    if not value:
        return None
    match = _DATE_RE.search(str(value))
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _filename_date(name: str) -> date | None:
    match = re.match(r"^(\d{4})-?(\d{2})-?(\d{2})[_-]", name)
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _strip_code(body: str) -> str:
    no_fence = re.sub(r"```.*?```", "", body, flags=re.DOTALL)
    return re.sub(r"`[^`\n]+`", "", no_fence)


def audit_bundle(root: Path, today: date, stale_days: int) -> list[Finding]:
    findings: list[Finding] = []
    workspace = root.parent
    for concept in iter_concepts(root):
        fm = concept.frontmatter
        rel = concept.rel

        ts = _parse_date(fm.get("timestamp", ""))
        fname_date = _filename_date(concept.path.name)

        if ts and fname_date and ts != fname_date:
            findings.append(Finding("ERROR", rel,
                f"filename date {fname_date.isoformat()} != frontmatter timestamp {ts.isoformat()}"))
        if ts and ts > today:
            findings.append(Finding("ERROR", rel,
                f"future-dated timestamp {ts.isoformat()} (today is {today.isoformat()})"))

        reviewed = _parse_date(fm.get("last_reviewed", ""))
        if reviewed and reviewed > today:
            findings.append(Finding("ERROR", rel,
                f"future-dated last_reviewed {reviewed.isoformat()}"))
        elif reviewed and (today - reviewed).days > stale_days:
            findings.append(Finding("WARN", rel,
                f"stale: last_reviewed {reviewed.isoformat()} is {(today - reviewed).days} days ago (>{stale_days})"))

        for src in concept.sources:
            if (root / src).exists() or (workspace / src).exists():
                continue
            # In-bundle provenance (knowledge/ memory/ data-products/) must resolve.
            # Cross-bundle/external refs may be unresolved due to clone naming or
            # co-location, so they only warn.
            internal = src.split("/", 1)[0] in CONCEPT_ROOTS
            level = "ERROR" if internal else "WARN"
            kind = "dangling" if internal else "unresolved cross-repo"
            findings.append(Finding(level, rel, f"{kind} source reference -> {src}"))

        for match in _LINK_RE.finditer(_strip_code(concept.body)):
            href = match.group("href")
            target = _resolve_link(href, concept.path, root)
            if target is None or target.exists():
                continue
            internal = target.is_relative_to(root) if hasattr(target, "is_relative_to") else str(target).startswith(str(root))
            level = "ERROR" if internal else "WARN"
            kind = "broken" if internal else "unresolved cross-repo"
            findings.append(Finding(level, rel, f"{kind} link -> {href}"))

        for label, pattern in _PII_PATTERNS:
            hit = pattern.search(concept.raw)
            if hit:
                findings.append(Finding("ERROR", rel,
                    f"possible PII ({label}): '{hit.group(0)}'"))
    return findings


def _resolve_link(href: str, source: Path, root: Path) -> Path | None:
    href = href.split("#", 1)[0].strip()
    if not href or href.startswith(("http://", "https://", "mailto:")):
        return None
    if href.startswith("<") and href.endswith(">"):
        href = href[1:-1].strip()
    if not href.endswith(".md"):
        return None
    if href.startswith("/"):
        return root / href.lstrip("/")
    return (source.parent / href).resolve()


def _looks_like_bundle(path: Path) -> bool:
    if not path.is_dir():
        return False
    has_root = any((path / top).exists() for top in CONCEPT_ROOTS)
    return has_root and ((path / "AGENTS.md").exists() or (path / "bundle.toml").exists())


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit OKF bundle knowledge for drift and PII.")
    parser.add_argument("--root", help="Bundle root. Defaults to this skill's bundle.")
    parser.add_argument("--workspace", action="store_true",
                        help="Audit every sibling bundle in the parent workspace.")
    parser.add_argument("--stale-days", type=int, default=STALE_DAYS_DEFAULT,
                        help=f"Warn when last_reviewed is older than this (default {STALE_DAYS_DEFAULT}).")
    parser.add_argument("--today", help="Override today's date (YYYY-MM-DD), for tests.")
    args = parser.parse_args()

    today = _parse_date(args.today) if args.today else date.today()
    if today is None:
        print("ERROR: --today must be YYYY-MM-DD")
        return 2

    if args.root:
        root = Path(args.root).resolve()
    else:
        here = Path(__file__).resolve()
        root = here.parents[3]

    roots = []
    if args.workspace:
        roots = [p for p in sorted(root.parent.iterdir()) if _looks_like_bundle(p)]
    else:
        roots = [root]

    total_errors = 0
    total_warns = 0
    for bundle_root in roots:
        findings = audit_bundle(bundle_root, today, args.stale_days)
        errors = [f for f in findings if f.level == "ERROR"]
        warns = [f for f in findings if f.level == "WARN"]
        total_errors += len(errors)
        total_warns += len(warns)
        header = bundle_root.name if len(roots) > 1 else "knowledge-audit"
        if findings:
            print(f"== {header} ==")
            for f in findings:
                print(f"  {f.level} {f.rel}: {f.message}")
        else:
            print(f"== {header} == clean")

    print(f"\nknowledge-audit: {total_errors} error(s), {total_warns} warning(s).")
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main())
