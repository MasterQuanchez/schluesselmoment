#!/usr/bin/env python3
"""Deterministic PII scanner — the commit-time backstop for the data-safety kit.

Unlike the model-advisory `sensitive-data-protection` rule, this is a hard,
deterministic check. It scans files (or git-staged content) for high-precision
PII signals and exits non-zero when it finds any, so a git pre-commit hook (or
the Cursor commit-gate hook) can block the commit.

What it flags:
  - Emails (excluding example/test domains)
  - Corporate IDs (letter+digits / "Z00XXXXX" shapes)
  - Windows / Unix user-home paths (embed corp usernames)
  - Project-specific company names, org codes, participant full names and extra
    patterns, loaded from a local (gitignored) redaction-config.local.json

What it deliberately skips (to stay low-false-positive enough to be a gate):
  - Generic phone numbers and generic "Last, First" (too noisy for a hard gate)
  - The vault (.sensitive/), node_modules, .git, *.example.json, and meta files
    that intentionally discuss patterns (rule, lexicon, this scanner, kit doc)
  - Any file containing the marker `pii-scan: allow-file`
  - Any single line containing the marker `pii-scan: ignore`

Usage:
    python scripts/pii_scan.py --staged          # scan git-staged content
    python scripts/pii_scan.py PATH [PATH ...]   # scan specific files/dirs
    python scripts/pii_scan.py --config FILE ...  # explicit config path

Exit codes: 0 = clean, 1 = findings, 2 = usage/internal error.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

CONFIG_FILENAME = "redaction-config.local.json"

EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
CORP_ID = re.compile(r"\b(?:[A-Z]\d{6,}[A-Z0-9]*|[A-Z]\d{3,}[A-Z]{2,}[A-Z0-9]*)\b")
WIN_PATH = re.compile(r"(?i)(?:[A-Z]:\\|\\\\)Users\\[A-Za-z0-9._-]+(?:\\[^\s<>\"']+)?")
UNIX_HOME_PATH = re.compile(r"(?i)/(?:home|Users)/[A-Za-z0-9._-]+/[^\s<>\"']*")
LAST_FIRST = re.compile(r"\b([A-Z][\w'.-]+),\s+([A-Z][\w'.-]+)\b")

SAFE_EMAIL_DOMAINS = ("example.com", "example.org", "example.net", "example.internal")
ALLOW_FILE_MARKER = "pii-scan: allow-file"
ALLOW_LINE_MARKER = "pii-scan: ignore"

DEFAULT_SKIP_SUBSTR = (
    "/.git/",
    "/.sensitive/",
    "/node_modules/",
    "/.venv/",
    "/__pycache__/",
)
DEFAULT_SKIP_NAMES = {
    "pii_scan.py",
    "pseudonym-lexicon.md",
    "sensitive-data-protection.mdc",
    "cursor-data-safety-kit.md",
    # data-safety skill meta-files: these intentionally document the patterns and
    # the canonical company/org abbreviation lookup table.
    "anonymization-rules.md",
    "abbreviations.md",
}
TEXT_EXT = {
    ".md", ".txt", ".json", ".py", ".js", ".ts", ".tsx", ".jsx", ".mdc",
    ".csv", ".yml", ".yaml", ".html", ".xml", ".ini", ".cfg", ".toml", ".vtt", ".srt",
}


@dataclass
class Config:
    literal_terms: list[re.Pattern[str]] = field(default_factory=list)
    org_patterns: list[re.Pattern[str]] = field(default_factory=list)
    name_patterns: list[re.Pattern[str]] = field(default_factory=list)
    extra_patterns: list[re.Pattern[str]] = field(default_factory=list)


@dataclass
class Finding:
    path: str
    line: int
    category: str
    snippet: str


def _compile(pattern: str) -> re.Pattern[str] | None:
    try:
        return re.compile(pattern)
    except re.error as exc:
        print(f"warning: bad regex in config: {exc}", file=sys.stderr)
        return None


def load_config(explicit: str | None, start: Path) -> Config:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    env = os.environ.get("PII_REDACTION_CONFIG")
    if env:
        candidates.append(Path(env).expanduser())
    for parent in [start, *start.parents]:
        candidates.append(parent / CONFIG_FILENAME)
        candidates.append(parent / ".sensitive" / CONFIG_FILENAME)
    seen: set[Path] = set()
    for cand in candidates:
        if cand in seen:
            continue
        seen.add(cand)
        try:
            if cand.is_file():
                return _parse(json.loads(cand.read_text(encoding="utf-8")))
        except Exception as exc:  # noqa: BLE001
            print(f"warning: could not read config {cand}: {exc}", file=sys.stderr)
    return Config()


def _parse(data: dict) -> Config:
    cfg = Config()
    for term in data.get("literal_terms", []) or []:
        if isinstance(term, str) and term.strip():
            t = term.strip()
            cfg.literal_terms.append(re.compile(rf"\b{re.escape(t)}\b", re.IGNORECASE))
    for pat in data.get("org_code_patterns", []) or []:
        c = _compile(pat)
        if c:
            cfg.org_patterns.append(c)
    for name in data.get("full_names", []) or []:
        if isinstance(name, str) and len(name.split()) >= 2:
            first, last = name.split()[0], name.split()[-1]
            cfg.name_patterns.append(re.compile(rf"\b{re.escape(name)}\b"))
            cfg.name_patterns.append(re.compile(rf"\b{re.escape(last)},\s*{re.escape(first)}\b"))
    for item in data.get("extra_patterns", []) or []:
        if isinstance(item, dict) and item.get("regex"):
            c = _compile(item["regex"])
            if c:
                cfg.extra_patterns.append(c)
    return cfg


def _email_findings(line: str) -> list[str]:
    hits = []
    for m in EMAIL.findall(line):
        if not any(m.lower().endswith("@" + d) or m.lower().endswith("." + d) for d in SAFE_EMAIL_DOMAINS):
            hits.append(m)
    return hits


def scan_text(text: str, path: str, cfg: Config) -> list[Finding]:
    if ALLOW_FILE_MARKER in text:
        return []
    findings: list[Finding] = []
    for i, line in enumerate(text.splitlines(), start=1):
        if ALLOW_LINE_MARKER in line:
            continue
        for cat, hits in (
            ("email", _email_findings(line)),
            ("corp-id", CORP_ID.findall(line)),
            ("user-path", WIN_PATH.findall(line) + UNIX_HOME_PATH.findall(line)),
        ):
            for h in hits:
                findings.append(Finding(path, i, cat, str(h)[:80]))
        for cat, patterns in (
            ("company-term", cfg.literal_terms),
            ("org-code", cfg.org_patterns),
            ("full-name", cfg.name_patterns),
            ("config-pattern", cfg.extra_patterns),
        ):
            for pat in patterns:
                m = pat.search(line)
                if m:
                    findings.append(Finding(path, i, cat, m.group(0)[:80]))
    return findings


def _should_skip(rel: str) -> bool:
    norm = "/" + rel.replace("\\", "/").lstrip("/")
    if any(s in norm for s in DEFAULT_SKIP_SUBSTR):
        return True
    name = Path(rel).name
    if name in DEFAULT_SKIP_NAMES:
        return True
    if name.endswith(".example.json"):
        return True
    if Path(rel).suffix.lower() not in TEXT_EXT:
        return True
    return False


def _staged_files() -> list[str]:
    out = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        check=False,
    )
    return [l.strip() for l in out.stdout.splitlines() if l.strip()]


def _staged_content(path: str) -> str | None:
    # Force UTF-8 decoding: on Windows, text=True defaults to the locale
    # codepage (cp1252) and raises UnicodeDecodeError on any UTF-8 byte
    # (em dash, umlaut, smart quote), which would silently skip the file.
    out = subprocess.run(
        ["git", "show", f":{path}"], capture_output=True, text=True,
        encoding="utf-8", errors="replace", check=False,
    )
    return out.stdout if out.returncode == 0 else None


def _iter_paths(paths: list[str]) -> list[str]:
    files: list[str] = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            files.extend(str(f) for f in pp.rglob("*") if f.is_file())
        elif pp.is_file():
            files.append(str(pp))
    return files


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Deterministic PII scanner.")
    ap.add_argument("paths", nargs="*", help="files/dirs to scan")
    ap.add_argument("--staged", action="store_true", help="scan git-staged content")
    ap.add_argument("--config", help="path to redaction-config.local.json")
    ap.add_argument("--quiet", action="store_true", help="only print on findings")
    args = ap.parse_args(argv)

    cfg = load_config(args.config, Path.cwd())
    findings: list[Finding] = []

    if args.staged:
        for rel in _staged_files():
            if _should_skip(rel):
                continue
            content = _staged_content(rel)
            if content is None:
                continue
            findings.extend(scan_text(content, rel, cfg))
    else:
        if not args.paths:
            ap.error("provide paths or --staged")
        for f in _iter_paths(args.paths):
            if _should_skip(f):
                continue
            try:
                content = Path(f).read_text(encoding="utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                continue
            findings.extend(scan_text(content, f, cfg))

    if findings:
        print("PII scan: FAILED — potential sensitive data found:\n", file=sys.stderr)
        for fnd in findings:
            print(f"  {fnd.path}:{fnd.line}  [{fnd.category}]  {fnd.snippet}", file=sys.stderr)
        print(
            "\nRedact these before committing. To intentionally allow a line add "
            f"'{ALLOW_LINE_MARKER}', or for a whole file add '{ALLOW_FILE_MARKER}'.",
            file=sys.stderr,
        )
        if not cfg.literal_terms and not cfg.name_patterns:
            print(
                "note: no redaction-config.local.json found — company names and "
                "participant names are NOT being checked (built-in patterns only).",
                file=sys.stderr,
            )
        return 1

    if not args.quiet:
        print("PII scan: clean", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
