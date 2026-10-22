#!/usr/bin/env python3
"""Normalize a meeting transcript into clean, speaker-attributed text.

Handles WebVTT (.vtt), SubRip (.srt), Microsoft Word (.docx), and plain text/markdown (.txt/.md).
Strips cue ids, timestamps, and markup; merges consecutive turns by the same
speaker; and prints meeting stats (speakers, duration, word count) to stderr.

By default, applies local PII redaction so you can run this script in a terminal
without involving an AI agent. Speaker surnames are reduced to a first initial
(e.g. "Smith, Anna" -> "Anna S."), which still de-identifies the person while
keeping enough signal to distinguish people who share a first name (e.g.
"Niklas R." vs "Niklas S."). Emails, phone numbers, file paths with usernames,
and corporate IDs are stripped entirely. Use --keep-pii only when archiving the
raw transcript under .sensitive/ (gitignored).

Project-specific identifiers (company names, org codes, participant surnames)
are NOT hardcoded here. Supply them via a local, gitignored
`redaction-config.local.json` (see redaction-config.example.json). The script
auto-discovers it by searching upward from the input file and CWD, or you can
pass --config. Without a config, only the built-in generic patterns run.

Usage:
    python scripts/prepare_transcript.py INPUT [--output FILE] [--config FILE]

    INPUT              Path to the transcript (.vtt | .srt | .docx | .txt | .md).
    --output FILE      Write cleaned text to FILE. If omitted, writes to
                       .sensitive/meetings/{slug}-redacted.txt (from input name).
    --detect-docs ROOT Print candidate summary output dirs under ROOT and exit.
    --keep-pii         Skip local redaction (vault / audit copies only).
    --config FILE      Path to redaction-config.local.json (else auto-discovered).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from docx_extract import extract_docx_paragraphs

VOICE_TAG = re.compile(r"<v\s+([^>]+?)>", re.IGNORECASE)
ANY_TAG = re.compile(r"<[^>]+>")
TIMESTAMP = re.compile(r"\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{3}")
TS_VALUE = re.compile(r"(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})")
TEAMS_SPEAKER_CUE = re.compile(r"^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$")
# DOCX exports glue speech to the timestamp (0:03Sorry…); exclude 2:18PM meeting headers.
TEAMS_SPEAKER_CUE_INLINE = re.compile(
    r"^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)(?![AP]M)(.*)$"
)
TEAMS_TS = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")
DOC_CANDIDATES = ["meetings", "docs", ".cursor/docs", "documentation", "doc", "notes"]

EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
# Require phone-LIKE formatting: international (+…) or groups separated by
# spaces/dots/parens — NOT hyphen-only digit chains (warehouse bins: 01-02-03).
PHONE = re.compile(
    r"(?<!\w)(?:"
    r"\+\d[\d\s.\-/()]{6,}\d"
    r"|\(?\d{2,4}\)?[\s.]\d{2,4}(?:[\s.]\d{2,4}){0,2}"
    r")(?!\w)"
)
WIN_PATH = re.compile(
    r"(?i)(?:[A-Z]:\\|\\\\)Users\\[A-Za-z0-9._-]+(?:\\[^\s<>\"']+)?"
)
UNIX_HOME_PATH = re.compile(r"(?i)/(?:home|Users)/[A-Za-z0-9._-]+/[^\s<>\"']*")
# Corporate IDs in two common shapes:
#   - letter + 6+ digits (+ trailing alnum), e.g. employee/asset numbers
#   - letter + 3+ digits + 2+ letters (+ trailing alnum) — employee-style IDs
CORP_ID = re.compile(
    r"\b(?:[A-Z]\d{6,}[A-Z0-9]*|[A-Z]\d{3,}[A-Z]{2,}[A-Z0-9]*)\b"
)
# Pilot site / geography tokens — skip LAST_FIRST (not a person).
KNOWN_PLACES = frozenset({
    "berlin", "mülheim", "muhlheim", "wittenburg", "germany", "europe",
    "italy", "site-a", "site-b",
})
# Skip LAST_FIRST on conversational "Last, first" false positives (e.g. "Yeah, OK"
# or greetings like "Hi, Maria" that would otherwise become "Maria H.").
LAST_FIRST_SKIP = frozenset({
    "ok", "yeah", "yes", "no", "wow", "mm", "mhm", "uh", "travel", "csv",
    "sorry", "okay", "right", "well", "so", "and", "but", "the", "pattern",
    "hi", "hey", "hello", "hallo", "morning", "afternoon", "evening",
    "thanks", "thank", "bye", "cheers", "dear", "oh", "hmm", "yep", "nope",
    "please", "welcome", "goodbye", "hola",
})
TRANSCRIPT_START = re.compile(r"^(.+?)\s+started transcription\s*$", re.IGNORECASE)
TRANSCRIPT_STOP = re.compile(r"^(.+?)\s+stopped transcription\s*$", re.IGNORECASE)
LAST_FIRST = re.compile(
    r"\b([A-Z][\w'.-]+),\s+([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]*)?)\b"
)
ROLE_SUFFIX = re.compile(r"^(.+?)(\s*\([^)]+\))\s*$")

CONFIG_FILENAME = "redaction-config.local.json"


@dataclass
class RedactionStats:
    speaker_labels: int = 0
    last_first_in_text: int = 0
    emails: int = 0
    phones: int = 0
    paths: int = 0
    corp_ids: int = 0
    names: int = 0
    terms: int = 0
    org_codes: int = 0
    extra: int = 0


@dataclass
class RedactionConfig:
    """Project-specific redaction rules loaded from a local (gitignored) JSON.

    Real company names, org codes, and participant names live ONLY in the local
    config so they never get committed. Ship the *.example.json, not this file.
    """

    name_subs: list[tuple[re.Pattern[str], str]] = field(default_factory=list)
    literal_terms: list[re.Pattern[str]] = field(default_factory=list)
    org_patterns: list[re.Pattern[str]] = field(default_factory=list)
    extra_patterns: list[tuple[re.Pattern[str], str]] = field(default_factory=list)
    term_replacement: str = "[redacted]"
    org_replacement: str = "[org-unit redacted]"

    @property
    def is_empty(self) -> bool:
        return not (
            self.name_subs or self.literal_terms or self.org_patterns or self.extra_patterns
        )


def _name_subs(name: str) -> list[tuple[re.Pattern[str], str]]:
    """Build regex replacements for a config full_names entry."""
    name = name.strip()
    if "," in name:
        last_part, first_part = [p.strip() for p in name.split(",", 1)]
        first_word = first_part.split()[0] if first_part else ""
        if not last_part or not first_word:
            return []
        repl = f"{first_word} {_surname_initial(last_part)}".strip()
        return [
            (re.compile(rf"\b{re.escape(name)}\b"), repl),
            (re.compile(rf"\b{re.escape(last_part)},\s*{re.escape(first_part)}\b"), repl),
        ]
    parts = name.split()
    if len(parts) < 2:
        return []
    first, last = parts[0], parts[-1]
    repl = f"{first} {_surname_initial(last)}".strip()
    patterns: list[tuple[re.Pattern[str], str]] = [
        (re.compile(rf"\b{re.escape(name)}\b"), repl),
        (re.compile(rf"\b{re.escape(last)},\s*{re.escape(first)}\b"), repl),
    ]
    if len(parts) > 2:
        compound_last = " ".join(parts[1:])
        patterns.append(
            (re.compile(rf"\b{re.escape(compound_last)},\s*{re.escape(first)}\b"), repl)
        )
    return patterns


def _compile(pattern: str, where: str) -> re.Pattern[str] | None:
    try:
        return re.compile(pattern)
    except re.error as exc:
        print(f"warning: bad regex in config ({where}): {exc}", file=sys.stderr)
        return None


def parse_config(data: dict, source: Path) -> RedactionConfig:
    cfg = RedactionConfig(
        term_replacement=data.get("term_replacement", "[redacted]"),
        org_replacement=data.get("org_replacement", "[org-unit redacted]"),
    )
    for name in data.get("full_names", []) or []:
        if isinstance(name, str) and name.strip():
            cfg.name_subs.extend(_name_subs(name.strip()))
    for term in data.get("literal_terms", []) or []:
        if isinstance(term, str) and term.strip():
            t = term.strip()
            # Word boundaries so short tokens like "SE" don't match inside "These".
            cfg.literal_terms.append(
                re.compile(rf"\b{re.escape(t)}\b", re.IGNORECASE)
            )
    for pat in data.get("org_code_patterns", []) or []:
        c = _compile(pat, "org_code_patterns")
        if c:
            cfg.org_patterns.append(c)
    for item in data.get("extra_patterns", []) or []:
        if isinstance(item, dict) and item.get("regex"):
            c = _compile(item["regex"], "extra_patterns")
            if c:
                cfg.extra_patterns.append((c, item.get("replacement", "[redacted]")))
    print(
        f"config:    {source.name} "
        f"(names={len(data.get('full_names', []) or [])}, "
        f"terms={len(cfg.literal_terms)}, org={len(cfg.org_patterns)}, "
        f"extra={len(cfg.extra_patterns)})",
        file=sys.stderr,
    )
    return cfg


def load_redaction_config(explicit: str | None, start: Path | None) -> RedactionConfig:
    """Find the local redaction config: explicit path > env > upward search."""
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    env = os.environ.get("PII_REDACTION_CONFIG")
    if env:
        candidates.append(Path(env).expanduser())
    bases = [b for b in (start, Path.cwd()) if b is not None]
    for base in bases:
        for parent in [base, *base.parents]:
            candidates.append(parent / CONFIG_FILENAME)
            candidates.append(parent / ".sensitive" / CONFIG_FILENAME)
    seen: set[Path] = set()
    for cand in candidates:
        if cand in seen:
            continue
        seen.add(cand)
        try:
            if cand.is_file():
                return parse_config(json.loads(cand.read_text(encoding="utf-8")), cand)
        except Exception as exc:  # noqa: BLE001 - never let config break redaction
            print(f"warning: could not read config {cand}: {exc}", file=sys.stderr)
    return RedactionConfig()


class Turn:
    __slots__ = ("speaker", "text", "ts", "body_lines", "meta")

    def __init__(
        self,
        speaker: str,
        text: str,
        *,
        ts: str = "",
        body_lines: list[str] | None = None,
        meta: str = "",
    ) -> None:
        self.speaker = speaker
        self.text = text
        self.ts = ts
        self.body_lines = body_lines if body_lines is not None else []
        self.meta = meta  # "started" | "stopped" for Teams bookends


def _clean(text: str) -> str:
    text = ANY_TAG.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _surname_initial(surname: str) -> str:
    """Return "X." from the last surname token (handles compound surnames)."""
    parts = surname.split()
    token = parts[-1] if parts else surname
    for ch in token:
        if ch.isalpha():
            return f"{ch.upper()}."
    return ""


def _is_initial(token: str) -> bool:
    """True for an already-abbreviated surname token like "R" or "R."."""
    core = token.rstrip(".")
    return len(core) == 1 and core.isalpha()


def redact_speaker_label(label: str) -> str:
    """Reduce a speaker label to first name + surname initial (or role).

    Examples: "Smith, Anna" -> "Anna S.", "Anna Smith" -> "Anna S.",
    "Niklas R." -> "Niklas R." (already abbreviated), "Anna" -> "Anna".
    """
    label = label.strip()
    if not label or label == "Unknown":
        return label

    role = ""
    m = ROLE_SUFFIX.match(label)
    if m:
        label, role = m.group(1).strip(), m.group(2)

    if "," in label:
        last, first_part = [p.strip() for p in label.split(",", 1)]
        first_words = first_part.split()
        if not first_words:
            return label + role
        first = first_words[0]
        initial = _surname_initial(last)
        return f"{first} {initial}".strip() + role

    words = label.split()
    if len(words) >= 2:
        if _is_initial(words[-1]):
            return label + role
        first, last = words[0], words[-1]
        initial = _surname_initial(last)
        return f"{first} {initial}".strip() + role

    return label + role


def _subn(pattern: re.Pattern[str], repl: str, text: str, stats: RedactionStats, attr: str) -> str:
    new_text, count = pattern.subn(repl, text)
    if count:
        setattr(stats, attr, getattr(stats, attr) + count)
    return new_text


def redact_text(
    text: str,
    speaker_map: dict[str, str],
    stats: RedactionStats,
    cfg: RedactionConfig,
) -> str:
    for original, anonymized in sorted(speaker_map.items(), key=lambda item: -len(item[0])):
        if original != anonymized and original in text:
            occurrences = text.count(original)
            if occurrences:
                stats.speaker_labels += occurrences
                text = text.replace(original, anonymized)

    for pattern, repl in cfg.name_subs:
        text = _subn(pattern, repl, text, stats, "names")

    def _last_first(match: re.Match[str]) -> str:
        last = match.group(1)
        first = match.group(2).split()[0]
        last_l, first_l = last.lower(), first.lower()
        if (
            last_l in KNOWN_PLACES
            or first_l in KNOWN_PLACES
            or last_l in LAST_FIRST_SKIP
            or first_l in LAST_FIRST_SKIP
        ):
            return match.group(0)
        stats.last_first_in_text += 1
        initial = _surname_initial(last)
        return f"{first} {initial}".strip()

    text = LAST_FIRST.sub(_last_first, text)
    for pattern in cfg.literal_terms:
        text = _subn(pattern, cfg.term_replacement, text, stats, "terms")
    for pattern in cfg.org_patterns:
        text = _subn(pattern, cfg.org_replacement, text, stats, "org_codes")
    for pattern, repl in cfg.extra_patterns:
        text = _subn(pattern, repl, text, stats, "extra")
    text = _subn(EMAIL, "[email redacted]", text, stats, "emails")
    text = _subn(WIN_PATH, "[path redacted]", text, stats, "paths")
    text = _subn(UNIX_HOME_PATH, "[path redacted]", text, stats, "paths")
    text = _subn(CORP_ID, "[corp-id redacted]", text, stats, "corp_ids")
    text = _subn(PHONE, "[phone redacted]", text, stats, "phones")
    return text


def apply_redaction(
    turns: list[Turn], cfg: RedactionConfig | None = None
) -> tuple[list[Turn], RedactionStats]:
    cfg = cfg or RedactionConfig()
    stats = RedactionStats()
    speakers = sorted({t.speaker for t in turns if t.speaker != "Unknown"})
    speaker_map = {name: redact_speaker_label(name) for name in speakers}

    redacted: list[Turn] = []
    for turn in turns:
        speaker = speaker_map.get(turn.speaker, turn.speaker)
        if turn.speaker in speaker_map and speaker != turn.speaker:
            stats.speaker_labels += 1
        if turn.body_lines:
            redacted_lines = [
                redact_text(line, speaker_map, stats, cfg) for line in turn.body_lines
            ]
            text = _clean(" ".join(redacted_lines))
            redacted.append(
                Turn(
                    speaker,
                    text,
                    ts=turn.ts,
                    body_lines=redacted_lines,
                    meta=turn.meta,
                )
            )
        else:
            text = redact_text(turn.text, speaker_map, stats, cfg)
            redacted.append(
                Turn(speaker, text, ts=turn.ts, body_lines=turn.body_lines, meta=turn.meta)
            )
    return redacted, stats


def format_redaction_report(stats: RedactionStats) -> str:
    parts = [
        f"speaker labels: {stats.speaker_labels}",
        f"names: {stats.names}",
        f"Last, First in text: {stats.last_first_in_text}",
        f"terms: {stats.terms}",
        f"org codes: {stats.org_codes}",
        f"emails: {stats.emails}",
        f"phones: {stats.phones}",
        f"paths: {stats.paths}",
        f"corp ids: {stats.corp_ids}",
        f"extra: {stats.extra}",
    ]
    return "redaction:  " + ", ".join(parts)


def parse_vtt_srt(raw: str) -> tuple[list[Turn], list[str]]:
    """Parse cue-based formats (VTT/SRT). Returns (turns, timestamp_strings)."""
    lines = raw.splitlines()
    turns: list[Turn] = []
    timestamps: list[str] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if TIMESTAMP.search(line):
            timestamps.append(line.strip())
            i += 1
            cue: list[str] = []
            while i < n and lines[i].strip() != "":
                cue.append(lines[i])
                i += 1
            block = " ".join(cue)
            m = VOICE_TAG.search(block)
            speaker = m.group(1).strip() if m else "Unknown"
            text = _clean(block)
            if text:
                turns.append(Turn(speaker, text))
        else:
            i += 1
    return turns, timestamps


def parse_plain(raw: str) -> tuple[list[Turn], list[str]]:
    """Plain text: keep non-empty lines as a single 'Unknown' speaker block."""
    text = "\n".join(l.rstrip() for l in raw.splitlines() if l.strip())
    return ([Turn("Unknown", text)] if text else []), []


def _is_teams_speaker_label(label: str) -> bool:
    """Heuristic: Teams exports use 'Last, First' or 'First Last' before a timestamp."""
    label = label.strip()
    if not label or label == "Unknown":
        return False
    if "," in label:
        last, first_part = [p.strip() for p in label.split(",", 1)]
        return bool(last and first_part and first_part.split())
    words = label.split()
    return len(words) >= 2 and words[0][:1].isupper()


def _teams_bookend(line: str) -> Turn | None:
    m = TRANSCRIPT_START.match(line)
    if m:
        return Turn(m.group(1).strip(), "", meta="started")
    m = TRANSCRIPT_STOP.match(line)
    if m:
        return Turn(m.group(1).strip(), "", meta="stopped")
    return None


def _match_teams_speaker_cue(line: str) -> tuple[str, str, str] | None:
    """Return (speaker, timestamp, inline_speech) for a Teams cue line.

    inline_speech is non-empty when DOCX glues utterance text to the timestamp;
    empty when the timestamp ends the line (TXT export with body on next lines).
    """
    m = TEAMS_SPEAKER_CUE.match(line)
    if m and _is_teams_speaker_label(m.group(1)):
        return m.group(1).strip(), m.group(2), ""
    m = TEAMS_SPEAKER_CUE_INLINE.match(line)
    if m and _is_teams_speaker_label(m.group(1)):
        return m.group(1).strip(), m.group(2), m.group(3).strip()
    return None


def parse_teams(paragraphs: list[str]) -> tuple[list[Turn], list[str], list[str]]:
    """Parse Teams export (.docx paragraphs or .txt lines).

    Returns (turns, timestamps, preamble_header_lines).
    """
    turns: list[Turn] = []
    timestamps: list[str] = []
    preamble: list[str] = []
    i = 0
    n = len(paragraphs)
    while i < n:
        line = paragraphs[i]
        bookend = _teams_bookend(line)
        if bookend:
            turns.append(bookend)
            i += 1
            continue
        cue = _match_teams_speaker_cue(line)
        if cue:
            speaker, ts, inline_speech = cue
            timestamps.append(ts)
            i += 1
            body: list[str] = []
            if inline_speech:
                body.append(inline_speech)
            else:
                while i < n:
                    nxt = paragraphs[i]
                    if _teams_bookend(nxt) or _match_teams_speaker_cue(nxt):
                        break
                    body.append(nxt)
                    i += 1
            text = _clean(" ".join(body))
            turns.append(Turn(speaker, text, ts=ts, body_lines=body))
        else:
            if not turns:
                preamble.append(line)
            i += 1
    return turns, timestamps, preamble


def parse_docx_teams(paragraphs: list[str]) -> tuple[list[Turn], list[str]]:
    """Parse Teams Word export (legacy wrapper)."""
    turns, timestamps, _ = parse_teams(paragraphs)
    return turns, timestamps


def merge_turns(turns: list[Turn]) -> list[Turn]:
    merged: list[Turn] = []
    for t in turns:
        if (
            merged
            and not t.meta
            and not merged[-1].meta
            and merged[-1].speaker == t.speaker
            and merged[-1].ts
            and t.ts
        ):
            merged[-1].text = f"{merged[-1].text} {t.text}".strip()
            merged[-1].body_lines.extend(t.body_lines)
            merged[-1].ts = t.ts
        else:
            merged.append(
                Turn(
                    t.speaker,
                    t.text,
                    ts=t.ts,
                    body_lines=list(t.body_lines),
                    meta=t.meta,
                )
            )
    return merged


def format_teams_output(turns: list[Turn], preamble: list[str]) -> str:
    lines: list[str] = list(preamble)
    if preamble:
        lines.append("")
    for t in turns:
        if t.meta == "started":
            lines.append(f"{t.speaker} started transcription")
        elif t.meta == "stopped":
            lines.append(f"{t.speaker} stopped transcription")
        elif t.ts:
            lines.append(f"{t.speaker}   {t.ts}")
            lines.extend(t.body_lines if t.body_lines else ([t.text] if t.text else []))
        elif t.text:
            lines.append(t.text)
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _seconds(ts: str) -> float | None:
    m = TS_VALUE.search(ts)
    if not m:
        return None
    h, mi, s, ms = (int(x) for x in m.groups())
    return h * 3600 + mi * 60 + s + ms / 1000.0


def _teams_seconds(ts: str) -> float | None:
    m = TEAMS_TS.match(ts.strip())
    if not m:
        return None
    if m.group(3) is not None:
        h, mi, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        h, mi, s = 0, int(m.group(1)), int(m.group(2))
    return h * 3600 + mi * 60 + s


def duration(timestamps: list[str], *, teams: bool = False) -> str:
    if not timestamps:
        return "unknown"
    if teams:
        secs = [_teams_seconds(t) for t in timestamps]
        secs = [x for x in secs if x is not None]
        if not secs:
            return "unknown"
        total = max(secs) - min(secs)
    else:
        starts = [_seconds(t.split("-->")[0]) for t in timestamps]
        ends = [_seconds(t.split("-->")[-1]) for t in timestamps]
        starts = [x for x in starts if x is not None]
        ends = [x for x in ends if x is not None]
        if not starts or not ends:
            return "unknown"
        total = max(ends) - min(starts)
    mins, secs = divmod(int(total), 60)
    hrs, mins = divmod(mins, 60)
    return f"{hrs:d}h{mins:02d}m{secs:02d}s" if hrs else f"{mins:d}m{secs:02d}s"


def detect_format(path: Path, raw: str | None = None) -> str:
    ext = path.suffix.lower()
    if ext == ".docx":
        return "docx"
    if raw is None:
        return "plain"
    if ext == ".vtt" or raw.lstrip().upper().startswith("WEBVTT"):
        return "vtt"
    if ext == ".srt":
        return "srt"
    if TIMESTAMP.search(raw):
        return "srt"
    return "plain"


def detect_docs(root: Path) -> list[Path]:
    found = [root / c for c in DOC_CANDIDATES if (root / c).is_dir()]
    return found


_VAULT_MEETINGS_DIR = Path(".sensitive/meetings")


def slugify_input_stem(path: Path | str) -> str:
    """Build a kebab-case slug from the input filename (stem only)."""
    stem = Path(path).stem
    slug = re.sub(r"[\s_]+", "-", stem.lower())
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "transcript"


def default_redacted_output_path(input_path: Path) -> Path:
    return _VAULT_MEETINGS_DIR / f"{slugify_input_stem(input_path)}-redacted.txt"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Normalize a meeting transcript.")
    ap.add_argument("input", nargs="?", help="transcript path (.vtt/.srt/.docx/.txt/.md)")
    ap.add_argument(
        "--output",
        help="write cleaned text to this file (default: .sensitive/meetings/{slug}-redacted.txt)",
    )
    ap.add_argument("--detect-docs", metavar="ROOT", help="list candidate output dirs and exit")
    ap.add_argument(
        "--keep-pii",
        action="store_true",
        help="skip local redaction (vault copies only; never feed to AI)",
    )
    ap.add_argument(
        "--config",
        metavar="FILE",
        help="path to redaction-config.local.json (else auto-discovered)",
    )
    args = ap.parse_args(argv)

    if args.detect_docs:
        root = Path(args.detect_docs).expanduser().resolve()
        cands = detect_docs(root)
        if cands:
            for c in cands:
                print(c)
        else:
            print(f"(no docs dir found under {root}; ask the user where to write)", file=sys.stderr)
        return 0

    if not args.input:
        ap.error("INPUT is required unless --detect-docs is used")

    path = Path(args.input).expanduser()
    if not path.is_file():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    fmt = detect_format(path)
    teams_ts = False
    teams_preamble: list[str] = []
    teams_layout = False
    if fmt == "docx":
        paragraphs = extract_docx_paragraphs(path)
        turns, timestamps, teams_preamble = parse_teams(paragraphs)
        if not turns:
            turns, timestamps = parse_plain("\n".join(paragraphs))
        else:
            teams_ts = True
            teams_layout = True
    else:
        raw = path.read_text(encoding="utf-8", errors="replace")
        fmt = detect_format(path, raw)
        if fmt in ("vtt", "srt"):
            turns, timestamps = parse_vtt_srt(raw)
        else:
            lines = [ln for ln in raw.splitlines()]
            turns, timestamps, teams_preamble = parse_teams(lines)
            if turns:
                fmt = "teams"
                teams_ts = True
                teams_layout = True
            else:
                turns, timestamps = parse_plain(raw)

    turns = merge_turns(turns)
    redact = not args.keep_pii
    stats: RedactionStats | None = None
    if redact:
        cfg = load_redaction_config(args.config, path.resolve().parent)
        if cfg.is_empty:
            print(
                "config:    none found (built-in patterns only; company names / "
                "org codes / participant surnames will NOT be stripped)",
                file=sys.stderr,
            )
        turns, stats = apply_redaction(turns, cfg)

    speakers = sorted({t.speaker for t in turns if t.speaker != "Unknown"})
    if teams_layout:
        body = format_teams_output(turns, teams_preamble)
    else:
        body = "\n\n".join(f"{t.speaker}: {t.text}" for t in turns) + "\n"
    word_count = len(body.split())

    print(f"format:    {fmt}", file=sys.stderr)
    print(f"turns:     {len(turns)}", file=sys.stderr)
    print(f"speakers:  {len(speakers)} ({', '.join(speakers) if speakers else 'none detected'})", file=sys.stderr)
    print(f"duration:  {duration(timestamps, teams=teams_ts)}", file=sys.stderr)
    print(f"words:     {word_count}", file=sys.stderr)
    if redact and stats is not None:
        print(format_redaction_report(stats), file=sys.stderr)
    elif args.keep_pii:
        print("redaction: skipped (--keep-pii; vault use only)", file=sys.stderr)

    # When redaction is skipped (--keep-pii), the body still contains full names and
    # other PII. Never emit it to a default location: require an explicit --output so
    # a stale or misconfigured run can't silently write unredacted names anywhere.
    if not redact and not args.output:
        print(
            "error: --keep-pii produces an UNREDACTED copy with PII; refusing to write "
            "to a default path. Pass --output pointing into the gitignored vault "
            "(e.g. .sensitive/meetings/{slug}-raw.txt). Nothing was written.",
            file=sys.stderr,
        )
        return 2

    out = Path(args.output).expanduser() if args.output else default_redacted_output_path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(body if body.endswith("\n") else body + "\n", encoding="utf-8")
    print(f"output:    {out}", file=sys.stderr)
    if not redact:
        print("warning:   output is UNREDACTED (--keep-pii); keep it in .sensitive/ and never feed it to an AI.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
