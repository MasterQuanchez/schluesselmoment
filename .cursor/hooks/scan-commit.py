#!/usr/bin/env python3
"""beforeShellExecution hook: PII-gate `git commit` run via the Cursor agent.

The git pre-commit hook (.githooks/pre-commit) only fires for users who have
enabled `core.hooksPath`. This hook adds a second, zero-setup gate for commits
the agent runs through the shell: if a `git commit` is about to execute and the
staged content trips scripts/pii_scan.py, it asks the user to confirm.

`--no-verify` is explicitly denied here — it must not bypass the PII scan on
agent-driven commits.

Cursor `beforeShellExecution` contract:
  stdin  -> { "command": str, ... }
  stdout -> { "permission": "allow"|"deny"|"ask", "user_message": str, "agent_message": str }

Fails OPEN on internal errors only (missing Python, bad JSON). Scanner failures
that find PII return ask/deny, not allow.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

IS_GIT_COMMIT = re.compile(r"\bgit\b[^\n]*\bcommit\b", re.IGNORECASE)
# Only skip non-mutating / help invocations — NOT --no-verify or amend shortcuts.
SKIP = re.compile(r"--dry-run|-h\b|--help\b", re.IGNORECASE)
NO_VERIFY = re.compile(r"--no-verify\b", re.IGNORECASE)


def _uses_no_verify(command: str) -> bool:
    """True if git commit uses --no-verify or -n (incl. bundled -nm, -an)."""
    if NO_VERIFY.search(command):
        return True
    m = re.search(r"\bcommit\b(.*)$", command, re.IGNORECASE | re.DOTALL)
    if not m:
        return False
    rest = m.group(1).strip()
    for token in re.split(r"\s+", rest):
        if not token:
            continue
        if token.startswith("--"):
            name = token.split("=", 1)[0].lower()
            if name == "--no-verify":
                return True
            continue
        if token.startswith("-") and len(token) > 1:
            if "n" in token[1:].lower():
                return True
            continue
        break
    return False


def _allow() -> None:
    print(json.dumps({"permission": "allow"}))


def _deny(user_message: str, agent_message: str) -> None:
    print(json.dumps({
        "permission": "deny",
        "user_message": user_message,
        "agent_message": agent_message,
    }))


def _repo_root() -> Path | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=False, timeout=10,
        )
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip())
    except Exception:
        pass
    return None


def _find_scanner() -> Path | None:
    for base in (_repo_root(), Path.cwd()):
        if base is None:
            continue
        candidate = base / "scripts" / "pii_scan.py"
        if candidate.is_file():
            return candidate
    return None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        _allow()
        return 0

    command = data.get("command") or ""
    if not IS_GIT_COMMIT.search(command):
        _allow()
        return 0

    if _uses_no_verify(command):
        _deny(
            "git commit --no-verify is blocked for agent commits in this repo. "
            "It would skip the PII pre-commit scan. Redact staged files first, "
            "or run the commit yourself from a terminal after review.",
            "Do not use --no-verify for commits. Run scripts/pii_scan.py --staged "
            "and fix findings, or ask the user to commit manually.",
        )
        return 0

    if SKIP.search(command):
        _allow()
        return 0

    scanner = _find_scanner()
    if scanner is None:
        _allow()
        return 0

    try:
        result = subprocess.run(
            [sys.executable, str(scanner), "--staged", "--quiet"],
            capture_output=True, text=True, check=False, timeout=30,
            cwd=str(scanner.parent.parent),
        )
    except Exception:
        _allow()
        return 0

    if result.returncode == 0:
        _allow()
        return 0

    detail = (result.stderr or result.stdout or "").strip()
    print(json.dumps({
        "permission": "ask",
        "user_message": (
            "PII scan flagged staged files for this commit:\n\n"
            f"{detail}\n\n"
            "Review and redact before committing, or approve to commit anyway."
        ),
        "agent_message": (
            "A pre-commit PII scan (scripts/pii_scan.py) found potential sensitive "
            "data in the staged files. Do not bypass without the user's confirmation."
        ),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
