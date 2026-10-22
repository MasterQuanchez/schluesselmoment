#!/usr/bin/env python3
"""Stdlib-only DOCX text extraction (ZIP + word/document.xml).

Used by prepare_transcript.py and check-raw-transcript.py. No python-docx.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_docx_paragraphs(path: Path | str) -> list[str]:
    """Return non-empty paragraph texts from a .docx file."""
    path = Path(path)
    with zipfile.ZipFile(path) as zf:
        with zf.open("word/document.xml") as handle:
            root = ET.parse(handle).getroot()
    paragraphs: list[str] = []
    for para in root.iter(f"{W_NS}p"):
        parts: list[str] = []
        for node in para.iter(f"{W_NS}t"):
            if node.text:
                parts.append(node.text)
            if node.tail:
                parts.append(node.tail)
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def extract_docx_text(path: Path | str, max_chars: int | None = None) -> str:
    """Flatten paragraph texts to newline-separated plain text."""
    text = "\n".join(extract_docx_paragraphs(path))
    if max_chars is not None:
        return text[:max_chars]
    return text
