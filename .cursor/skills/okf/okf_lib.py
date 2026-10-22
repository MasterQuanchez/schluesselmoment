"""Shared helpers for the OKF skill."""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass, field
from pathlib import Path

CONCEPT_ROOTS = ["knowledge", "memory", "data-products"]
RESERVED = {"index.md", "log.md"}
OKF_VERSION = "0.1"
TYPE_VOCAB = {
    "Strategy",
    "Product",
    "Process",
    "Team",
    "Reference",
    "Decision",
    "Meeting Summary",
    "Skill",
    "Data Product",
}
SECTION_TYPE = {
    "strategy": "Strategy",
    "products": "Product",
    "processes": "Process",
    "team": "Team",
    "reference": "Reference",
    "decisions": "Decision",
}

_FRONTMATTER_RE = re.compile(r"^---\s*\n(?P<fm>.*?)\n---\s*\n?", re.DOTALL)
_LINK_RE = re.compile(r"\[(?P<text>[^\]]*)\]\((?P<href>[^)]+)\)")


@dataclass
class Concept:
    path: Path
    rel: str
    concept_id: str
    frontmatter: dict | None
    body: str
    bundle: str = ""
    links: list[str] = field(default_factory=list)

    @property
    def type(self) -> str | None:
        if not self.frontmatter:
            return None
        value = self.frontmatter.get("type")
        return str(value).strip() if value else None

    @property
    def title(self) -> str:
        if self.frontmatter and self.frontmatter.get("title"):
            return str(self.frontmatter["title"]).strip()
        return humanize(self.path.stem)

    @property
    def description(self) -> str:
        if self.frontmatter and self.frontmatter.get("description"):
            return str(self.frontmatter["description"]).strip()
        return ""


def find_bundle_root(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    here = Path(__file__).resolve()
    candidate = here.parents[3]
    if (candidate / "AGENTS.md").exists():
        return candidate
    return Path.cwd().resolve()


def find_workspace_root(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    return find_bundle_root().parent


def parse_frontmatter(text: str) -> tuple[dict | None, str]:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return None, text
    fm_text = match.group("fm")
    body = text[match.end() :]
    try:
        import yaml  # type: ignore

        parsed = yaml.safe_load(fm_text)
        if isinstance(parsed, dict):
            return parsed, body
    except Exception:
        pass
    return _minimal_parse(fm_text), body


def _minimal_parse(fm_text: str) -> dict:
    data: dict = {}
    lines = fm_text.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip() or line[:1].isspace():
            index += 1
            continue
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not match:
            index += 1
            continue
        key, raw = match.group(1), match.group(2).strip()
        if raw == "":
            block: list[str] = []
            cursor = index + 1
            while cursor < len(lines) and (
                not lines[cursor].strip() or lines[cursor][:1].isspace()
            ):
                block.append(lines[cursor])
                cursor += 1
            data[key] = "\n".join(block).strip() or None
            index = cursor
        else:
            data[key] = _coerce(raw)
            index += 1
    return data


def _coerce(raw: str):
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1].strip()
        if not inner:
            return []
        return [_strip_quotes(part.strip()) for part in inner.split(",")]
    return _strip_quotes(raw)


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def load_okfignore(root: Path) -> list[str]:
    path = root / ".okfignore"
    if not path.exists():
        return []
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def is_ignored(rel: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel, pattern) for pattern in patterns)


def iter_concepts(root: Path, *, bundle_name: str | None = None, namespace: bool = False) -> list[Concept]:
    patterns = load_okfignore(root)
    concepts: list[Concept] = []
    bundle = bundle_name or root.name
    for top in CONCEPT_ROOTS:
        base = root / top
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.md")):
            rel = path.relative_to(root).as_posix()
            if path.name in RESERVED or is_ignored(rel, patterns):
                continue
            text = path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(text)
            concept_id = rel[:-3]
            namespaced_id = f"{bundle}/{concept_id}" if namespace else concept_id
            concepts.append(
                Concept(
                    path=path,
                    rel=rel,
                    concept_id=namespaced_id,
                    frontmatter=fm,
                    body=body,
                    bundle=bundle,
                    links=extract_internal_links(body, rel, bundle=bundle, namespace=namespace),
                )
            )
    return concepts


def iter_workspace_concepts(workspace_root: Path) -> list[Concept]:
    concepts: list[Concept] = []
    for child in sorted(path for path in workspace_root.iterdir() if path.is_dir()):
        if not _looks_like_bundle(child):
            continue
        concepts.extend(iter_concepts(child, bundle_name=child.name, namespace=True))
    return concepts


def _looks_like_bundle(path: Path) -> bool:
    return any((path / root).exists() for root in CONCEPT_ROOTS) and (
        (path / "AGENTS.md").exists() or (path / "bundle.toml").exists()
    )


def extract_internal_links(
    body: str,
    source_rel: str,
    *,
    bundle: str = "",
    namespace: bool = False,
) -> list[str]:
    ids: list[str] = []
    link_text = _strip_fenced_code(body)
    for match in _LINK_RE.finditer(link_text):
        link_id = _link_to_concept_id(
            match.group("href"),
            source_rel,
            bundle=bundle,
            namespace=namespace,
        )
        if link_id:
            ids.append(link_id)
    return ids


def _strip_fenced_code(body: str) -> str:
    without_fences = re.sub(r"```.*?```", "", body, flags=re.DOTALL)
    return re.sub(r"`[^`\n]+`", "", without_fences)


def _link_to_concept_id(
    raw_href: str,
    source_rel: str,
    *,
    bundle: str,
    namespace: bool,
) -> str | None:
    href = raw_href.split("#", 1)[0].strip()
    if not href or href.startswith(("http://", "https://", "mailto:")):
        return None
    if href.startswith("<") and href.endswith(">"):
        href = href[1:-1].strip()
    path = Path(href)
    if path.name == "AGENTS.md":
        return None
    if path.suffix and path.suffix != ".md":
        return None
    if not path.suffix:
        return None
    if href.startswith("/"):
        return None

    return _relative_link_to_concept_id(
        href,
        source_rel,
        bundle=bundle,
        namespace=namespace,
    )


def _relative_link_to_concept_id(
    href: str,
    source_rel: str,
    *,
    bundle: str,
    namespace: bool,
) -> str | None:
    resolved = (Path(source_rel).parent / href).as_posix()
    parts: list[str] = []
    escaped_segments: list[str] = []
    escaped = False
    for segment in resolved.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            if not parts:
                escaped = True
                continue
            parts.pop()
        elif escaped:
            escaped_segments.append(segment)
        else:
            parts.append(segment)
    if escaped:
        if namespace and len(escaped_segments) >= 2:
            sibling = escaped_segments[0]
            target = "/".join(escaped_segments[1:])[:-3]
            return f"{sibling}/{target}"
        return None
    if not parts:
        return None
    if _looks_like_sibling_bundle(parts[0]):
        if namespace and len(parts) >= 2:
            return "/".join(parts)[:-3]
        return None
    if parts[0] not in CONCEPT_ROOTS:
        return None
    target = "/".join(parts)[:-3]
    return f"{bundle}/{target}" if namespace else target


def _looks_like_sibling_bundle(segment: str) -> bool:
    return segment.endswith("-bundle") or bool(re.match(r"^a-\d+-.*-bundle$", segment))


def humanize(name: str) -> str:
    return re.sub(r"[-_]+", " ", name).strip().title()
