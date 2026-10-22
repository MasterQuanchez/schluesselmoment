"""Generic document ingestion into per-source markdown output."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from markitdown import MarkItDown

from ingest_slides import process_pptx
from utils import build_azure_client, required_env

PPTX_EXT = {".pptx"}
FLAT_EXTENSIONS = {".docx", ".pdf", ".xlsx"}
ALL_EXTENSIONS = PPTX_EXT | FLAT_EXTENSIONS


def discover_files(input_dir: Path, extensions: set[str]) -> list[Path]:
    if not input_dir.exists():
        return []
    return sorted(path for path in input_dir.rglob("*") if path.is_file() and path.suffix.lower() in extensions)


def _frontmatter(fields: dict[str, object]) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if isinstance(value, bool):
            rendered = "true" if value else "false"
        elif isinstance(value, (int, float)):
            rendered = str(value)
        else:
            rendered = json.dumps(str(value))
        lines.append(f"{key}: {rendered}")
    lines.append("---\n")
    return "\n".join(lines)


def process_flat(file_path: Path, output_root: Path) -> dict[str, object]:
    doc_output_dir = output_root / file_path.stem
    doc_output_dir.mkdir(parents=True, exist_ok=True)
    md = MarkItDown()
    result = md.convert(str(file_path))
    body = (getattr(result, "markdown", None) or getattr(result, "text_content", "") or "").strip()
    if not body:
        body = "_No textual content extracted from this document._"
    extracted_at = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    fm = _frontmatter(
        {
            "source_file": file_path.name,
            "source_type": file_path.suffix.lstrip(".").lower(),
            "extracted_at": extracted_at,
        }
    )
    content_path = doc_output_dir / "content.md"
    content_path.write_text(fm + "\n" + body + "\n", encoding="utf-8")
    print(f"[ingest] {file_path.name}: wrote {content_path}")
    return {
        "source_file": file_path.name,
        "source_type": file_path.suffix.lstrip(".").lower(),
        "output_dir": str(doc_output_dir.relative_to(output_root.parent)),
        "files": ["content.md"],
        "extracted_at": extracted_at,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest documents into markdown output.")
    parser.add_argument("--input-dir", default="sourcing/raw", help="Input directory")
    parser.add_argument("--output-dir", default="sourcing/scratch", help="Output directory")
    parser.add_argument("--skip-mermaid", action="store_true", help="Skip Azure OpenAI diagram extraction for PPTX slides")
    return parser


def main() -> None:
    load_dotenv()
    args = build_parser().parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    files = discover_files(input_dir, ALL_EXTENSIONS)
    if not files:
        print(f"[ingest] no supported files found in {input_dir}")
        return
    print(f"[ingest] found {len(files)} file(s) in {input_dir}")
    include_mermaid = not args.skip_mermaid
    client = None
    deployment_name = None
    if include_mermaid:
        try:
            client = build_azure_client()
            deployment_name = required_env("AZURE_OPENAI_COMPLETION_DEPLOYMENT_NAME")
        except Exception as exc:
            print(f"[ingest] warning: disabling mermaid extraction: {exc}")
            include_mermaid = False
    manifest_entries: list[dict[str, object]] = []
    for file_path in files:
        if file_path.suffix.lower() in PPTX_EXT:
            process_pptx(file_path, output_dir, include_mermaid, client, deployment_name)
            deck_dir = output_dir / file_path.stem
            slide_files = sorted(path.name for path in deck_dir.glob("*") if path.is_file())
            extracted_at = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            manifest_entries.append(
                {
                    "source_file": file_path.name,
                    "source_type": "pptx",
                    "output_dir": str(deck_dir.relative_to(output_dir.parent)),
                    "files": slide_files,
                    "extracted_at": extracted_at,
                }
            )
        else:
            manifest_entries.append(process_flat(file_path, output_dir))
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps({"ingested": manifest_entries}, indent=2), encoding="utf-8")
    print(f"[ingest] manifest written to {manifest_path}")


if __name__ == "__main__":
    main()
