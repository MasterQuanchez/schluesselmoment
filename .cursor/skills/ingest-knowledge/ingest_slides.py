"""Filesystem-first PPTX ingestion into markdown + PNG slide pairs."""

from __future__ import annotations

import argparse
import base64
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from markitdown import MarkItDown
from openai import AzureOpenAI
import pptx2png

from utils import build_azure_client, dump_yaml, required_env

SUPPORTED_EXTENSIONS = {".pptx"}


@dataclass
class MermaidResult:
    mermaid_code: str
    description: str


def discover_files(input_dir: Path, extensions: set[str]) -> list[Path]:
    if not input_dir.exists():
        return []
    return sorted(path for path in input_dir.rglob("*") if path.is_file() and path.suffix.lower() in extensions)


def _slide_index_from_name(path: Path) -> tuple[int, str]:
    match = re.search(r"(\d+)", path.stem)
    if not match:
        return (10**9, path.name.lower())
    return (int(match.group(1)), path.name.lower())


def render_slides_to_png(pptx_path: Path, output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    pptx2png.topng(pptx=str(pptx_path), output_dir=str(output_dir), scale=2)
    generated = sorted(output_dir.glob("*.png"), key=_slide_index_from_name)
    canonical_paths: list[Path] = []
    for idx, image_path in enumerate(generated, start=1):
        canonical_name = f"slide_{idx:03d}.png"
        canonical_path = output_dir / canonical_name
        if image_path.resolve() != canonical_path.resolve():
            shutil.move(str(image_path), str(canonical_path))
        canonical_paths.append(canonical_path)
    return canonical_paths


def extract_slide_markdown(pptx_path: Path) -> dict[int, str]:
    md = MarkItDown()
    result = md.convert(pptx_path, extract_pages=True)
    pages = getattr(result, "pages", None)
    if pages:
        extracted: dict[int, str] = {}
        for page in pages:
            number = int(getattr(page, "page_number", 0) or 0)
            content = str(getattr(page, "content", "") or "").strip()
            if number > 0:
                extracted[number] = content
        return extracted
    markdown = getattr(result, "markdown", None) or getattr(result, "text_content", "")
    markdown = str(markdown or "")
    if not markdown.strip():
        return {}
    slide_map: dict[int, str] = {}
    parts = re.split(r"<!--\s*Slide number:\s*(\d+)\s*-->", markdown)
    if len(parts) > 1:
        for index in range(1, len(parts), 2):
            try:
                slide_number = int(parts[index])
            except (TypeError, ValueError):
                continue
            slide_text = parts[index + 1].strip() if index + 1 < len(parts) else ""
            slide_map[slide_number] = slide_text
        return slide_map
    return {1: markdown.strip()}


def extract_mermaid_from_image(
    png_path: Path,
    client: AzureOpenAI,
    deployment_name: str,
) -> MermaidResult | None:
    image_b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    prompt = (
        "You are analyzing one PowerPoint slide image. If it contains a diagram, "
        "return HAS_DIAGRAM: yes, DESCRIPTION, and a mermaid code block. "
        "If not, return exactly HAS_DIAGRAM: no."
    )
    response = client.chat.completions.create(
        model=deployment_name,
        messages=[
            {"role": "system", "content": "You detect and transcribe slide diagrams."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                ],
            },
        ],
        temperature=0,
    )
    content = (response.choices[0].message.content or "").strip()
    if "HAS_DIAGRAM: no" in content:
        return None
    mermaid_match = re.search(r"```mermaid\s*(.*?)```", content, re.DOTALL | re.IGNORECASE)
    if not mermaid_match:
        return None
    description_match = re.search(r"DESCRIPTION:\s*(.*)", content)
    description = description_match.group(1).strip() if description_match else ""
    mermaid_code = mermaid_match.group(1).strip()
    if not mermaid_code:
        return None
    return MermaidResult(mermaid_code=mermaid_code, description=description)


def write_slide_pair(
    output_dir: Path,
    slide_number: int,
    markdown_text: str,
    source_file: str,
    mermaid_result: MermaidResult | None,
) -> None:
    slide_id = f"slide_{slide_number:03d}"
    image_name = f"{slide_id}.png"
    md_path = output_dir / f"{slide_id}.md"
    mermaid_path = output_dir / f"{slide_id}_mermaid.md"
    frontmatter = {
        "source_file": source_file,
        "slide_number": slide_number,
        "image": image_name,
        "has_mermaid": bool(mermaid_result),
    }
    body = markdown_text.strip() or "_No textual content extracted from this slide._"
    md_path.write_text("---\n" + dump_yaml(frontmatter) + "---\n\n" + body + "\n", encoding="utf-8")
    if mermaid_result:
        mermaid_path.write_text(
            f"# Mermaid extraction for {slide_id}\n\n"
            f"Source image: `{image_name}`\n\n"
            f"Description: {mermaid_result.description or 'N/A'}\n\n"
            "```mermaid\n"
            f"{mermaid_result.mermaid_code}\n"
            "```\n",
            encoding="utf-8",
        )
    elif mermaid_path.exists():
        mermaid_path.unlink()


def process_pptx(
    pptx_path: Path,
    output_root: Path,
    include_mermaid: bool,
    client: AzureOpenAI | None,
    deployment_name: str | None,
) -> None:
    deck_output_dir = output_root / pptx_path.stem
    if deck_output_dir.exists():
        shutil.rmtree(deck_output_dir)
    deck_output_dir.mkdir(parents=True, exist_ok=True)
    png_paths = render_slides_to_png(pptx_path, deck_output_dir)
    slide_markdown = extract_slide_markdown(pptx_path)
    print(f"[ingest] {pptx_path.name}: rendered {len(png_paths)} slide images")
    for slide_number, png_path in enumerate(png_paths, start=1):
        mermaid_result = None
        if include_mermaid and client and deployment_name:
            try:
                mermaid_result = extract_mermaid_from_image(png_path, client, deployment_name)
            except Exception as exc:
                print(f"[ingest] warning: mermaid extraction failed for {png_path.name}: {exc}")
        write_slide_pair(deck_output_dir, slide_number, slide_markdown.get(slide_number, ""), pptx_path.name, mermaid_result)
    print(f"[ingest] {pptx_path.name}: wrote {len(png_paths)} markdown/png pairs")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest PPTX files into filesystem markdown+png pairs.")
    parser.add_argument("--input-dir", default="sourcing/raw", help="Input directory")
    parser.add_argument("--output-dir", default="sourcing/scratch", help="Output directory")
    parser.add_argument("--skip-mermaid", action="store_true", help="Skip Azure OpenAI diagram extraction step")
    return parser


def main() -> None:
    load_dotenv()
    args = build_parser().parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    files = discover_files(input_dir, SUPPORTED_EXTENSIONS)
    if not files:
        print(f"[ingest] no supported files found in {input_dir}")
        return
    include_mermaid = not args.skip_mermaid
    client: AzureOpenAI | None = None
    deployment_name: str | None = None
    if include_mermaid:
        try:
            client = build_azure_client()
            deployment_name = required_env("AZURE_OPENAI_COMPLETION_DEPLOYMENT_NAME")
        except Exception as exc:
            print(f"[ingest] warning: disabling mermaid extraction: {exc}")
            include_mermaid = False
    print(f"[ingest] found {len(files)} file(s) in {input_dir}")
    for file_path in files:
        process_pptx(file_path, output_dir, include_mermaid, client, deployment_name)


if __name__ == "__main__":
    main()
