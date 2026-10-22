"""Append entries to the root OKF log.md."""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from okf_lib import find_bundle_root


def append_log(root: Path, kind: str, message: str, day: str | None = None) -> None:
    day = day or date.today().isoformat()
    path = root / "log.md"
    if not path.exists():
        path.write_text("# Bundle Update Log\n\n", encoding="utf-8")

    text = path.read_text(encoding="utf-8")
    entry = f"* **{kind}**: {message}"
    heading = f"## {day}"

    if heading in text:
        text = text.replace(heading, f"{heading}\n{entry}", 1)
    else:
        text = text.rstrip() + f"\n\n{heading}\n{entry}\n"
    path.write_text(text, encoding="utf-8")
    print(f"Appended {kind} entry to log.md.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", help="Entry kind, e.g. Creation, Update, Deprecation")
    parser.add_argument("message", help="Entry text")
    parser.add_argument("--date", help="ISO date YYYY-MM-DD")
    parser.add_argument("--root", help="Bundle root. Defaults to this skill's repository root.")
    args = parser.parse_args()
    append_log(find_bundle_root(args.root), args.kind, args.message, args.date)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
