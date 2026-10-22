#!/usr/bin/env python3
"""Fix common ASR errors in sanitized transcripts (handling unit vs Henning, etc.)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REGEX_REPLACEMENTS: list[tuple[str, str]] = [
    (r"\bHenning units\b", "handling units"),
    (r"\bHenning unit\b", "handling unit"),
    (r"\bhandy units\b", "handling units"),
    (r"\bhandy unit\b", "handling unit"),
    (r"\bhand units\b", "handling units"),
    (r"\bhand unit\b", "handling unit"),
    (r"Write any handling in it", "Enter any handling unit"),
    (r"I handling unit\. I'm looking", "A handling unit. I'm looking"),
]

LITERAL_REPLACEMENTS: list[tuple[str, str]] = [
    ("Simanchal", "Sim"),
]


def fix_transcript(text: str) -> str:
    for pattern, repl in REGEX_REPLACEMENTS:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    for old, new in LITERAL_REPLACEMENTS:
        text = text.replace(old, new)
    return text


def audit(text: str) -> dict[str, int]:
    return {
        "henning_unit_asr": len(re.findall(r"Henning units?", text, re.I)),
        "handy_unit_asr": len(re.findall(r"handy units?", text, re.I)),
        "hand_unit_asr": len(re.findall(r"\bhand units?\b", text, re.I)),
        "handling_unit": len(re.findall(r"handling units?", text, re.I)),
        "henning_p_person": len(re.findall(r"Henning P\.", text)),
        "henning_addressed": len(re.findall(r"\bHenning,", text)),
        "simanchal": text.count("Simanchal"),
        "niklas_s": text.count("Niklas S."),
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: fix_transcript_asr.py INPUT [OUTPUT]", file=sys.stderr)
        return 1
    src = Path(argv[1]).expanduser()
    dst = Path(argv[2]).expanduser() if len(argv) > 2 else src
    raw = src.read_text(encoding="utf-8")
    print("before:", audit(raw), file=sys.stderr)
    fixed = fix_transcript(raw)
    print("after:", audit(fixed), file=sys.stderr)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(fixed, encoding="utf-8")
    print(f"written: {dst}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
