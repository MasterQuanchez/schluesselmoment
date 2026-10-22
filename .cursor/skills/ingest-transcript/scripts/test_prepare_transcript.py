#!/usr/bin/env python3
# pii-scan: allow-file — intentional fixture strings for redaction unit tests.
"""Tests for prepare_transcript redaction and DOCX ingestion. Run: py test_prepare_transcript.py"""
from __future__ import annotations

import sys
import tempfile
import zipfile
from pathlib import Path

import prepare_transcript as pt
from docx_extract import extract_docx_paragraphs, extract_docx_text


def _make_minimal_docx(paragraphs: list[str]) -> Path:
    """Build a tiny valid-enough .docx zip for unit tests."""
    body = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{_xml_escape(p)}</w:t></w:r></w:p>'
        for p in paragraphs
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
        ' xmlns:xml="http://www.w3.org/XML/1998/namespace">'
        f"<w:body>{body}</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml"'
        ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1"'
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
        ' Target="word/document.xml"/>'
        "</Relationships>"
    )
    tmp = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
    tmp.close()
    path = Path(tmp.name)
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
    return path


def _xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _redact(text: str, cfg: pt.RedactionConfig | None = None) -> str:
    cfg = cfg or pt.RedactionConfig()
    stats = pt.RedactionStats()
    return pt.redact_text(text, {}, stats, cfg)


def run() -> int:
    failures: list[str] = []

    def check(name: str, got, want) -> None:
        if got != want:
            failures.append(f"{name}\n   got:  {got!r}\n   want: {want!r}")

    # Speaker label redaction
    check("label Last, First", pt.redact_speaker_label("Smith, Anna"), "Anna S.")
    check("label First Last", pt.redact_speaker_label("Anna Smith"), "Anna S.")
    check("label already-abbrev", pt.redact_speaker_label("Niklas R."), "Niklas R.")
    check("label single name", pt.redact_speaker_label("Anna"), "Anna")
    check("label with role", pt.redact_speaker_label("Smith, Anna (PO)"), "Anna S. (PO)")
    check(
        "label compound surname",
        pt.redact_speaker_label("Tellez Delgado, Marta"),
        "Marta D.",
    )
    check(
        "surname initial uses last token",
        pt._surname_initial("Tellez Delgado"),
        "D.",
    )

    # Built-in patterns
    check("email", _redact("ping anna.smith@corp.com please"), "ping [email redacted] please")
    check("win path", _redact(r"see C:\Users\Z004WYAM\Documents\x.pdf"), "see [path redacted]")
    check("corp-id classic", _redact("id A1234567 ok"), "id [corp-id redacted] ok")
    check("corp-id Z-shape", _redact("user Z004WYAM here"), "user [corp-id redacted] here")
    check("last,first in text", _redact("met Mueller, Maria today"), "met Maria M. today")
    check("phone formatted", _redact("call +49 555 0100 now"), "call [phone redacted] now")
    check("phone national", _redact("ring 555 0100 ok"), "ring [phone redacted] ok")
    check("bin code preserved", _redact("bin 01-02-03-A failed"), "bin 01-02-03-A failed")
    check("place comma preserved", _redact("pilot in Berlin, Germany"), "pilot in Berlin, Germany")
    check("yeah ok preserved", _redact("Yeah, OK."), "Yeah, OK.")
    check("italy bruhn preserved", _redact("on Pattern Italy, Bruhn today"), "on Pattern Italy, Bruhn today")
    # Greetings before a name must not be read as "Surname, First" (e.g. "Hi, Maria").
    check("greeting hi preserved", _redact("Hi, Maria. Today we start"), "Hi, Maria. Today we start")
    check("greeting hey preserved", _redact("Hey, Andreas"), "Hey, Andreas")
    check("greeting thanks preserved", _redact("Thanks, Javier"), "Thanks, Javier")

    # Slugify input stem for default vault output names
    check(
        "slugify teams docx",
        pt.slugify_input_stem("Orbis Observation_ Lina x Anna.docx"),
        "orbis-observation-lina-x-anna",
    )
    check("slugify simple", pt.slugify_input_stem("Meeting Notes.vtt"), "meeting-notes")
    check("slugify unsafe chars", pt.slugify_input_stem("Demo #2 (Sprint).docx"), "demo-2-sprint")
    check(
        "default redacted path",
        pt.default_redacted_output_path(Path("Orbis Observation_ Lina x Anna.docx")).as_posix(),
        ".sensitive/meetings/orbis-observation-lina-x-anna-redacted.txt",
    )

    # Config-driven redaction
    cfg = pt.parse_config(
        {
            "term_replacement": "[redacted]",
            "org_replacement": "[org-unit redacted]",
            "full_names": ["John Roe"],
            "literal_terms": ["Acme Corp"],
            "org_code_patterns": [r"\bZZ WP(?: [A-Z0-9]+){0,5}\b"],
            "extra_patterns": [{"regex": r"\bPIN\s*\d{4}\b", "replacement": "[pin redacted]"}],
        },
        pt.Path("test-config.json"),
    )
    check("config full name (First Last)", _redact("spoke to John Roe", cfg), "spoke to John R.")
    check("config full name (Last, First)", _redact("Roe, John spoke", cfg), "John R. spoke")
    check("config literal term", _redact("at Acme Corp today", cfg), "at [redacted] today")
    check("config org pattern", _redact("team ZZ WP DS BP rocks", cfg), "team [org-unit redacted] rocks")
    check("config extra pattern", _redact("code PIN 1234 now", cfg), "code [pin redacted] now")

    # Safe content untouched
    check("safe text", _redact("the bin S820 had WT 7012345"), "the bin S820 had WT 7012345")

    # DOCX extraction + Teams paragraph parsing
    docx_path = _make_minimal_docx(
        [
            "Smith, Anna 0:07",
            "Hello everyone, welcome to the kickoff.",
            "Mueller, Maria 0:15",
            "Thanks Anna. Let's review the survey plan.",
        ]
    )
    try:
        check(
            "docx paragraphs",
            extract_docx_paragraphs(docx_path),
            [
                "Smith, Anna 0:07",
                "Hello everyone, welcome to the kickoff.",
                "Mueller, Maria 0:15",
                "Thanks Anna. Let's review the survey plan.",
            ],
        )
        turns, ts = pt.parse_docx_teams(extract_docx_paragraphs(docx_path))
        check("docx teams turns", len(turns), 2)
        check("docx teams speaker 1", turns[0].speaker, "Smith, Anna")
        check("docx teams text 1", turns[0].text, "Hello everyone, welcome to the kickoff.")
        check("docx teams timestamps", ts, ["0:07", "0:15"])
        check("docx teams duration", pt.duration(ts, teams=True), "0m08s")
        check(
            "docx extract text snippet",
            extract_docx_text(docx_path, max_chars=40),
            "Smith, Anna 0:07\nHello everyone, welcome",
        )
    finally:
        docx_path.unlink(missing_ok=True)

    # Teams DOCX: speaker, timestamp, and speech on one paragraph (no newline break).
    inline_docx = _make_minimal_docx(
        [
            "Meeting title",
            "June 25, 2026, 2:18PM",
            "Smith, Anna started transcription",
            "Smith, Anna   0:03Sorry, you need to unmute again.",
            "Mueller, Maria   0:09Ah yes, the camera too.",
            "Smith, Anna stopped transcription",
        ]
    )
    try:
        turns, ts, preamble = pt.parse_teams(extract_docx_paragraphs(inline_docx))
        check("inline docx preamble", preamble, ["Meeting title", "June 25, 2026, 2:18PM"])
        check("inline docx turn count", len([t for t in turns if not t.meta]), 2)
        check("inline docx speaker 1", turns[1].speaker, "Smith, Anna")
        check(
            "inline docx text 1",
            turns[1].text,
            "Sorry, you need to unmute again.",
        )
        check("inline docx timestamps", ts, ["0:03", "0:09"])
    finally:
        inline_docx.unlink(missing_ok=True)

    # --keep-pii must refuse to write anywhere without an explicit --output.
    vtt = tempfile.NamedTemporaryFile(suffix=".vtt", delete=False, mode="w", encoding="utf-8")
    vtt.write("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<v Mueller, Maria>Hello.\n")
    vtt.close()
    vtt_path = Path(vtt.name)
    out_path = Path(tempfile.gettempdir()) / "keep-pii-raw.txt"
    out_path.unlink(missing_ok=True)
    try:
        check("keep-pii without output exits 2", pt.main([str(vtt_path), "--keep-pii"]), 2)
        check("keep-pii wrote nothing to default", out_path.exists(), False)
        check(
            "keep-pii with output writes raw name",
            pt.main([str(vtt_path), "--keep-pii", "--output", str(out_path)]),
            0,
        )
        check("keep-pii output preserves surname", "Mueller, Maria" in out_path.read_text(encoding="utf-8"), True)
    finally:
        vtt_path.unlink(missing_ok=True)
        out_path.unlink(missing_ok=True)

    if failures:
        print(f"FAILED ({len(failures)}):", file=sys.stderr)
        for f in failures:
            print(" - " + f, file=sys.stderr)
        return 1
    print("all redaction tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
