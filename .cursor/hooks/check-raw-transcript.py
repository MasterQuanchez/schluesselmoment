#!/usr/bin/env python3
"""beforeSubmitPrompt hook: warn before a RAW transcript reaches the LLM.

The ingest-transcript skill's safety model is "no raw PII reaches the LLM via a
file". That only holds if a transcript is sanitized *before* it is attached. This
hook closes the discoverability gap: when a prompt attaches or references a raw
transcript, it blocks submission and points the user to the local pre-pass.

Detection is both NAME-based (extension / filename) and CONTENT-based (it sniffs
readable attachments for caption markers, timestamp cues, dense speaker labels,
emails and corp-IDs), so a raw transcript with an innocuous name is still caught.

Cursor `beforeSubmitPrompt` contract:
  stdin  -> { "prompt": str, "attachments": [{"type","file_path"}], ... }
  stdout -> { "continue": bool, "user_message": str }

Limits (be honest): images aren't in the payload, and pasting raw text directly
into chat bypasses this hook (that text is already transmitted). Layer 1 (local
redaction) and the commit scanner are the mitigations there.

Fails OPEN. Escape hatch: put [allow-raw] in the prompt to send a known-safe file.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_SKILL_SCRIPTS = _SCRIPT_DIR.parent / "skills" / "ingest-transcript" / "scripts"
if str(_SKILL_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SKILL_SCRIPTS))
from docx_extract import extract_docx_text  # noqa: E402

RAW_EXT = (".vtt", ".srt")
# Formats that often carry raw meeting content but need a name/content signal.
SOFT_EXT = (".txt", ".md", ".docx", ".pdf", ".eml", ".json", ".csv", ".rtf")
SAFE_MARKERS = ("redact", "sanitiz", "sanitis", "anonym", "cleaned", "clean-")
# Filename keywords only (not path segments — avoids false positives on meetings/ folder).
TRANSCRIPTY_BASENAME = ("transcript", "recording", "minutes", "teams", "call-", "vtt", "webvtt")
# Tracked summary dirs: .md files here are structured notes — block on content only, not path name.
TRACKED_SUMMARY_PREFIXES = ("meetings/", "deliverables/")
OVERRIDE = "[allow-raw]"

PATH_IN_TEXT = re.compile(r"[^\s\"'<>|]+\.(?:vtt|srt|txt|md|docx|pdf|eml|json|csv|rtf)\b", re.IGNORECASE)

# Content signals of a raw transcript.
SIG_WEBVTT = re.compile(r"^\s*WEBVTT", re.IGNORECASE | re.MULTILINE)
SIG_CUE = re.compile(r"\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->")
SIG_VOICE = re.compile(r"<v\s+[^>]+>", re.IGNORECASE)
SIG_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
SIG_CORPID = re.compile(r"\b(?:[A-Z]\d{6,}[A-Z0-9]*|[A-Z]\d{3,}[A-Z]{2,}[A-Z0-9]*)\b")
SIG_SPEAKER = re.compile(
    r"^\s*(?:[A-Z][\w'.-]+,\s+[A-Z][\w'.-]+|[A-Z][a-z][\w .,'-]{0,38})\s*:\s+\S",
    re.MULTILINE,
)
SIG_TEAMS_SPEAKER = re.compile(
    r"^\s*[A-Z][\w'.-]+,\s+[A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]*)?\s+\d{1,2}:\d{2}(?::\d{2})?\s*$",
    re.MULTILINE,
)
# Labels common in markdown/API docs — not transcript speakers.
NOT_SPEAKER_LABELS = frozenset({
    "note", "todo", "fixme", "get", "post", "put", "patch", "delete", "http",
    "https", "warning", "caution", "important", "example", "see", "ref",
})
SNIFF_BYTES = 65536


def _is_safe_name(path: str) -> bool:
    low = path.lower()
    return any(m in low for m in SAFE_MARKERS)


def _norm_path(path: str) -> str:
    return path.replace("\\", "/").lower().strip().strip("\"'")


def _is_tracked_summary(path: str) -> bool:
    """Structured meeting/deliverable summaries — not raw transcripts by default."""
    norm = _norm_path(path)
    if not norm.endswith(".md"):
        return False
    return any(norm.startswith(p) or f"/{p}" in norm for p in TRACKED_SUMMARY_PREFIXES)


def _basename_transcripty(path: str) -> bool:
    name = Path(path).name.lower()
    return any(k in name for k in TRANSCRIPTY_BASENAME)


def _read_snippet(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".docx":
        return extract_docx_text(path, max_chars=SNIFF_BYTES)
    if ext in RAW_EXT + (".txt", ".md", ".eml", ".json", ".csv", ".rtf"):
        return path.read_text(encoding="utf-8", errors="replace")[:SNIFF_BYTES]
    return ""


def _sniff_raw(path: str) -> bool:
    """Read a bit of the file and decide whether it looks like a raw transcript."""
    try:
        p = Path(path)
        if not p.is_file():
            return False
        text = _read_snippet(p)
        if not text:
            return False
    except Exception:
        return False
    if SIG_WEBVTT.search(text) or SIG_CUE.search(text) or SIG_VOICE.search(text):
        return True
    if len(SIG_TEAMS_SPEAKER.findall(text)) >= 3:
        return True
    speaker_lines = [
        m.group(0) for m in SIG_SPEAKER.finditer(text)
        if m.group(0).split(":", 1)[0].strip().lower() not in NOT_SPEAKER_LABELS
    ]
    score = 0
    if len(speaker_lines) >= 5:
        score += 1
    if SIG_EMAIL.search(text):
        score += 1
    if SIG_CORPID.search(text):
        score += 1
    return score >= 2


def _classify(path: str) -> str | None:
    low = path.lower().strip().strip("\"'")
    if not low:
        return None
    if low.endswith(RAW_EXT):
        return None if _is_safe_name(low) else "raw"
    if low.endswith(SOFT_EXT):
        if _is_safe_name(low):
            return None
        if _is_tracked_summary(low):
            return "content" if _sniff_raw(path) else None
        if _basename_transcripty(low):
            return "soft"
        if _sniff_raw(path):
            return "content"
    return None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        print(json.dumps({"continue": True}))
        return 0

    prompt = data.get("prompt") or ""
    if OVERRIDE.lower() in prompt.lower():
        print(json.dumps({"continue": True}))
        return 0

    candidates: list[str] = []
    for att in data.get("attachments") or []:
        if isinstance(att, dict) and att.get("type") == "file" and att.get("file_path"):
            candidates.append(str(att["file_path"]))
    candidates.extend(PATH_IN_TEXT.findall(prompt))

    hits: list[tuple[str, str]] = []
    seen: set[str] = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        kind = _classify(c)
        if kind:
            hits.append((c, kind))

    if not hits:
        print(json.dumps({"continue": True}))
        return 0

    listed = "\n".join(f"  - {p}  ({why})" for p, why in hits[:8])
    example = hits[0][0]
    msg = (
        "Possible RAW transcript / sensitive file in this prompt:\n"
        f"{listed}\n\n"
        "Sending an unredacted transcript transmits full names and other PII to "
        "the LLM. Run the local, no-AI pre-pass first, then attach the redacted "
        "output instead:\n\n"
        f'  py .cursor/skills/ingest-transcript/scripts/prepare_transcript.py "{example}" '
        '--output ".sensitive/meetings/redacted.txt"\n\n'
        "(Also ensure Cursor Privacy Mode is on.) If this file is already "
        f"redacted/safe and you want to send it anyway, add {OVERRIDE} and resubmit."
    )
    print(json.dumps({"continue": False, "user_message": msg}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
