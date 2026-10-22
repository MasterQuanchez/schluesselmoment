"""One-command bundle health gate.

Runs the three checks a bundle must pass before a PR or demo, against the
bundle's own vendored skills:

  1. bundle-sync status --check-source  (skill freshness vs canonical source)
  2. okf validate                       (OKF structure)
  3. knowledge-audit                    (date drift, dangling refs, PII)

Usage (from a bundle root):
    python ../ai-first-dis/scripts/check.py --root .

Exit code is non-zero if any check fails, so it is CI/pre-commit friendly.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def _run(label: str, args: list[str], cwd: Path) -> int:
    print(f"\n=== {label} ===")
    proc = subprocess.run([sys.executable, *args], cwd=cwd)
    return proc.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the bundle health gate.")
    parser.add_argument("--root", default=".", help="Bundle root (default: cwd).")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    skills = root / ".cursor" / "skills"

    checks = [
        ("bundle-sync (skill freshness)", [str(skills / "bundle-sync" / "bundle_sync.py"), "status", "--check-source"]),
        ("okf validate (structure)", [str(skills / "okf" / "validate.py")]),
        ("knowledge-audit (drift + PII)", [str(skills / "knowledge-audit" / "audit.py"), "--root", str(root)]),
    ]

    failed: list[str] = []
    for label, cmd in checks:
        script = Path(cmd[0])
        if not script.exists():
            print(f"\n=== {label} ===\n  SKIP: {script} not found in this bundle")
            continue
        if _run(label, cmd, root) != 0:
            failed.append(label)

    print("\n" + "=" * 40)
    if failed:
        print("GATE FAILED: " + "; ".join(failed))
        return 1
    print("GATE PASSED: bundle is ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
