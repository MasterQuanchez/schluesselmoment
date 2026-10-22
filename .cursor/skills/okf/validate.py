"""Validate OKF conformance for one bundle."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from okf_lib import OKF_VERSION, RESERVED, TYPE_VOCAB, find_bundle_root, iter_concepts, parse_frontmatter


def validate(root: Path) -> int:
    errors: list[str] = []
    warnings: list[str] = []

    root_index = root / "index.md"
    if not root_index.exists():
        errors.append("missing root index.md")
    else:
        fm, _ = parse_frontmatter(root_index.read_text(encoding="utf-8"))
        if not fm or fm.get("okf_version") != OKF_VERSION:
            errors.append(f"root index.md must declare okf_version: \"{OKF_VERSION}\"")

    log = root / "log.md"
    if log.exists():
        text = log.read_text(encoding="utf-8")
        for heading in re.findall(r"^##\s+(.+)$", text, flags=re.MULTILINE):
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", heading.strip()):
                errors.append(f"log.md has non-ISO date heading: {heading}")

    concepts = iter_concepts(root)
    concept_ids = {concept.concept_id for concept in concepts}
    for concept in concepts:
        if concept.frontmatter is None:
            errors.append(f"{concept.rel}: missing parseable YAML frontmatter")
            continue
        if not concept.type:
            errors.append(f"{concept.rel}: missing required type")
        elif concept.type not in TYPE_VOCAB:
            warnings.append(f"{concept.rel}: unknown bundle type '{concept.type}'")
        if not concept.frontmatter.get("description"):
            warnings.append(f"{concept.rel}: missing recommended description")
        if not concept.frontmatter.get("timestamp"):
            warnings.append(f"{concept.rel}: missing recommended timestamp")
        for link_id in concept.links:
            if link_id not in concept_ids and not link_id.endswith("/index"):
                warnings.append(f"{concept.rel}: broken in-bundle link -> /{link_id}.md")

    for top in ("knowledge", "memory", "data-products"):
        base = root / top
        if base.exists() and not (base / "index.md").exists():
            warnings.append(f"{top}/ has no index.md")

    for path in root.rglob("*.md"):
        if path.name in RESERVED:
            fm, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
            if path.name == "index.md" and path != root_index and fm:
                errors.append(f"{path.relative_to(root).as_posix()}: non-root index.md must not have frontmatter")

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"  WARN {warning}")
    if errors:
        print("Errors:")
        for error in errors:
            print(f"  ERROR {error}")
        return 1
    print(f"OKF validation passed ({len(concepts)} concepts, {len(warnings)} warnings).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", help="Bundle root. Defaults to this skill's repository root.")
    args = parser.parse_args()
    return validate(find_bundle_root(args.root))


if __name__ == "__main__":
    sys.exit(main())
