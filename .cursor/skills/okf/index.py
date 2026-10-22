"""Regenerate OKF index.md files from child concept frontmatter."""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

from okf_lib import CONCEPT_ROOTS, OKF_VERSION, Concept, find_bundle_root, humanize, iter_concepts


def _entry_for(concept: Concept, from_dir: Path) -> str:
    target = concept.path.relative_to(from_dir).as_posix()
    description = f" - {concept.description}" if concept.description else ""
    return f"* [{concept.title}]({target}){description}"


def _subdir_entry(path: Path, from_dir: Path) -> str:
    return f"* [{humanize(path.name)}]({path.relative_to(from_dir).as_posix()}/)"


def build_root_index(root: Path, concepts: list[Concept]) -> str:
    sections = [
        ("Knowledge", "knowledge", "Curated strategy, product, process, reference, skill and team concepts."),
        ("Memory", "memory", "Meeting summaries and decisions captured as reusable memory."),
        ("Data Products", "data-products", "Data product concepts when this bundle owns data assets."),
    ]
    lines = ["---", f"okf_version: \"{OKF_VERSION}\"", "---", "", f"# {humanize(root.name)} OKF Bundle", ""]
    lines.append("This repository is one OKF bundle. The concept area is `knowledge/`, `memory/`, and `data-products/`.")
    lines.append("")
    lines.append("## Sections")
    lines.append("")
    for title, dirname, description in sections:
        if (root / dirname).exists():
            lines.append(f"* [{title}]({dirname}/index.md) - {description}")
    lines.append("")
    lines.append("## Concept Counts")
    lines.append("")
    by_type: dict[str, int] = defaultdict(int)
    for concept in concepts:
        by_type[concept.type or "Unknown"] += 1
    for type_name, count in sorted(by_type.items()):
        lines.append(f"* **{type_name}**: {count}")
    lines.append("")
    return "\n".join(lines)


def build_dir_index(directory: Path, concepts: list[Concept]) -> str:
    direct_concepts = [concept for concept in concepts if concept.path.parent == directory]
    subdirs = [
        path
        for path in sorted(directory.iterdir())
        if path.is_dir() and any(concept.path.is_relative_to(path) for concept in concepts)
    ]
    lines = [f"# {humanize(directory.name)}", ""]
    if subdirs:
        lines.append("## Sections")
        lines.append("")
        for subdir in subdirs:
            lines.append(_subdir_entry(subdir, directory))
        lines.append("")
    if direct_concepts:
        grouped: dict[str, list[Concept]] = defaultdict(list)
        for concept in direct_concepts:
            grouped[concept.type or "Concept"].append(concept)
        for group, items in sorted(grouped.items()):
            lines.append(f"## {group}")
            lines.append("")
            for concept in sorted(items, key=lambda item: item.title.lower()):
                lines.append(_entry_for(concept, directory))
            lines.append("")
    if len(lines) == 2:
        lines.extend(["No concepts yet.", ""])
    return "\n".join(lines)


def regenerate(root: Path) -> None:
    concepts = iter_concepts(root)
    (root / "index.md").write_text(build_root_index(root, concepts), encoding="utf-8")
    for top in CONCEPT_ROOTS:
        base = root / top
        if not base.exists():
            continue
        dirs = {base}
        for concept in concepts:
            if concept.path.is_relative_to(base):
                dirs.add(concept.path.parent)
        for directory in sorted(dirs):
            (directory / "index.md").write_text(build_dir_index(directory, concepts), encoding="utf-8")
    print(f"Regenerated indexes for {len(concepts)} concepts.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", help="Bundle root. Defaults to this skill's repository root.")
    args = parser.parse_args()
    regenerate(find_bundle_root(args.root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
