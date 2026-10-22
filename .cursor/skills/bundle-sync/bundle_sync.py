#!/usr/bin/env python3
"""Bundle skill vendoring CLI.

Standard-library only. Reads bundle.toml, installs declared skills into
.cursor/skills, writes bundle.lock.json, checks drift, and checks runtime
readiness.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
import tempfile
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0"
MANIFEST = "bundle.toml"
LOCKFILE = "bundle.lock.json"
SKILLS_DIR = Path(".cursor") / "skills"
AGENTS_START = "<!-- bundle-sync:skills:begin -->"
AGENTS_END = "<!-- bundle-sync:skills:end -->"
IGNORED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "node_modules",
}


@dataclass(frozen=True)
class SkillSpec:
    name: str
    source: str
    source_kind: str
    ref: str
    source_path: str
    dependencies: tuple[str, ...]
    dependency_group: str
    environment: tuple[str, ...]
    tools: tuple[str, ...]


@dataclass(frozen=True)
class ResolvedSource:
    path: Path
    resolved_ref: str


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _repo_root(explicit: str | None = None) -> Path:
    return Path(explicit).expanduser().resolve() if explicit else Path.cwd().resolve()


def _read_manifest(root: Path) -> dict[str, Any]:
    path = root / MANIFEST
    if not path.exists():
        raise SystemExit(f"error: {MANIFEST} not found in {root}")
    return tomllib.loads(path.read_text(encoding="utf-8"))


def _string_tuple(value: Any, *, label: str) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list):
        raise SystemExit(f"error: {label} must be a list")
    return tuple(str(item) for item in value)


def _skill_specs(manifest: dict[str, Any]) -> list[SkillSpec]:
    raw = manifest.get("skills") or {}
    if not isinstance(raw, dict):
        raise SystemExit("error: [skills] must be a TOML table")

    specs: list[SkillSpec] = []
    for name, values in sorted(raw.items()):
        if not isinstance(values, dict):
            raise SystemExit(f"error: [skills.{name}] must be a TOML table")
        source = str(values.get("source") or "").strip()
        if not source:
            raise SystemExit(f"error: [skills.{name}] missing source")
        source_kind = str(
            values.get("source_kind")
            or values.get("source-kind")
            or ("git-url" if _looks_like_git_url(source) else "sibling-path")
        )
        ref = str(values.get("ref") or "working-tree")
        source_path = str(values.get("path") or ".")
        dependency_group = str(values.get("dependency_group") or f"skill-{name}")
        specs.append(
            SkillSpec(
                name=name,
                source=source,
                source_kind=source_kind,
                ref=ref,
                source_path=source_path,
                dependencies=_string_tuple(
                    values.get("dependencies") or [],
                    label=f"[skills.{name}].dependencies",
                ),
                dependency_group=dependency_group,
                environment=_string_tuple(
                    values.get("environment") or values.get("env") or [],
                    label=f"[skills.{name}].environment",
                ),
                tools=_string_tuple(
                    values.get("tools") or [],
                    label=f"[skills.{name}].tools",
                ),
            )
        )
    return specs


def _sha256_tree(path: Path) -> str:
    digest = hashlib.sha256()
    for file_path in sorted(p for p in path.rglob("*") if p.is_file()):
        if any(part in IGNORED_DIRS for part in file_path.parts):
            continue
        rel = file_path.relative_to(path).as_posix()
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _copy_tree(src: Path, dest: Path) -> None:
    if not (src / "SKILL.md").exists():
        raise SystemExit(f"error: source skill has no SKILL.md: {src}")
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns(*IGNORED_DIRS))


def _looks_like_git_url(value: str) -> bool:
    return value.startswith(("http://", "https://", "ssh://", "git@")) or value.endswith(".git")


def _git(args: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise SystemExit("error: git is required for git-url sources") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise SystemExit(f"error: git command failed: {detail}") from exc


def _clone_git_source(spec: SkillSpec, temp_dirs: list[Path]) -> tuple[Path, str]:
    tmp = Path(tempfile.mkdtemp(prefix="bundle-sync-"))
    temp_dirs.append(tmp)
    cmd = ["git", "clone", "--depth", "1"]
    if spec.ref and spec.ref != "working-tree":
        cmd.extend(["--branch", spec.ref])
    cmd.extend([spec.source, str(tmp)])
    try:
        _git(cmd)
    except SystemExit:
        if not spec.ref or spec.ref == "working-tree":
            raise
        shutil.rmtree(tmp, ignore_errors=True)
        temp_dirs.remove(tmp)
        tmp = Path(tempfile.mkdtemp(prefix="bundle-sync-"))
        temp_dirs.append(tmp)
        _git(["git", "clone", "--depth", "1", spec.source, str(tmp)])
        _git(["git", "fetch", "--depth", "1", "origin", spec.ref], cwd=tmp)
        _git(["git", "checkout", "--detach", "FETCH_HEAD"], cwd=tmp)
    resolved = _git(["git", "rev-parse", "HEAD"], cwd=tmp).stdout.strip()
    return tmp, resolved


def _resolve_source(root: Path, spec: SkillSpec, temp_dirs: list[Path]) -> ResolvedSource:
    if spec.source_kind in {"git-url", "public-repo"}:
        base, resolved_ref = _clone_git_source(spec, temp_dirs)
    elif spec.source_kind == "npm-package":
        package_root = root / "node_modules" / spec.source
        base = package_root.resolve()
        resolved_ref = spec.ref
    else:
        base = (root / spec.source).resolve()
        resolved_ref = spec.ref

    src = (base / spec.source_path).resolve()
    if not src.exists():
        raise SystemExit(f"error: source path for {spec.name} does not exist: {src}")
    return ResolvedSource(path=src, resolved_ref=resolved_ref)


def _lock_entry(
    spec: SkillSpec,
    source: ResolvedSource,
    installed_path: Path,
    root: Path,
) -> dict[str, Any]:
    return {
        "name": spec.name,
        "source": spec.source,
        "source_kind": spec.source_kind,
        "source_path": spec.source_path,
        "ref": spec.ref,
        "resolved_ref": source.resolved_ref,
        "content_hash": _sha256_tree(installed_path),
        "dependency_group": spec.dependency_group,
        "dependencies": list(spec.dependencies),
        "environment": list(spec.environment),
        "tools": list(spec.tools),
        "install_path": installed_path.relative_to(root).as_posix(),
        "source_hash": _sha256_tree(source.path),
    }


def _read_lock(root: Path) -> dict[str, Any] | None:
    path = root / LOCKFILE
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _write_lock(root: Path, entries: list[dict[str, Any]]) -> None:
    lock = {
        "schema_version": SCHEMA_VERSION,
        "updated_at": _now(),
        "skills": entries,
    }
    (root / LOCKFILE).write_text(
        json.dumps(lock, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _format_dependency_group(name: str, dependencies: tuple[str, ...]) -> str:
    lines = [f"{name} = ["]
    for dep in dependencies:
        lines.append(f'    "{dep}",')
    lines.append("]")
    return "\n".join(lines)


def _merge_pyproject_groups(root: Path, specs: list[SkillSpec]) -> None:
    path = root / "pyproject.toml"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    header = "[project.optional-dependencies]"
    if header not in text:
        text = text.rstrip() + f"\n\n{header}\n"

    for spec in specs:
        block = _format_dependency_group(spec.dependency_group, spec.dependencies)
        lines = text.splitlines()
        start = next(
            (
                i
                for i, line in enumerate(lines)
                if line.strip() == f"{spec.dependency_group} = ["
            ),
            None,
        )
        if start is not None:
            end = start + 1
            while end < len(lines) and lines[end].strip() != "]":
                end += 1
            if end < len(lines):
                lines = lines[:start] + block.splitlines() + lines[end + 1 :]
                text = "\n".join(lines) + "\n"
                continue

        section = text.index(header) + len(header)
        insert_at = text.find("\n[", section)
        if insert_at == -1:
            text = text.rstrip() + "\n" + block + "\n"
        else:
            text = (
                text[:insert_at].rstrip()
                + "\n"
                + block
                + "\n\n"
                + text[insert_at + 1 :]
            )

    path.write_text(text, encoding="utf-8")


def _owned_skills(root: Path, installed: set[str]) -> list[str]:
    base = root / SKILLS_DIR
    if not base.exists():
        return []
    return sorted(
        path.name
        for path in base.iterdir()
        if path.is_dir() and (path / "SKILL.md").exists() and path.name not in installed
    )


def _agents_block(entries: list[dict[str, Any]], owned: list[str]) -> str:
    rows = [
        "## Skills",
        "",
        "| Skill | Status | Source |",
        "|---|---|---|",
    ]
    for entry in sorted(entries, key=lambda item: str(item["name"])):
        source = f"{entry['source_kind']}:{entry['source']}@{entry['resolved_ref']}"
        rows.append(f"| `{entry['name']}` | installed | `{source}` |")
    for name in owned:
        rows.append(f"| `{name}` | owned-in-place | local |")
    return AGENTS_START + "\n" + "\n".join(rows) + "\n" + AGENTS_END


def _refresh_agents(root: Path, entries: list[dict[str, Any]]) -> None:
    agents = root / "AGENTS.md"
    owned = _owned_skills(root, {str(entry["name"]) for entry in entries})
    block = _agents_block(entries, owned)
    if agents.exists():
        text = agents.read_text(encoding="utf-8")
        if AGENTS_START in text and AGENTS_END in text:
            before, rest = text.split(AGENTS_START, 1)
            _, after = rest.split(AGENTS_END, 1)
            agents.write_text(before.rstrip() + "\n\n" + block + after, encoding="utf-8")
            return
        separator = "" if text.endswith("\n\n") else "\n\n"
        agents.write_text(text.rstrip() + separator + block + "\n", encoding="utf-8")
        return
    agents.write_text(block + "\n", encoding="utf-8")


def install(root: Path, *, refresh_agents: bool = False) -> int:
    manifest = _read_manifest(root)
    specs = _skill_specs(manifest)
    temp_dirs: list[Path] = []
    entries: list[dict[str, Any]] = []
    try:
        for spec in specs:
            source = _resolve_source(root, spec, temp_dirs)
            installed_path = root / SKILLS_DIR / spec.name
            _copy_tree(source.path, installed_path)
            entries.append(_lock_entry(spec, source, installed_path, root))
        _merge_pyproject_groups(root, specs)
        _write_lock(root, entries)
        if refresh_agents:
            _refresh_agents(root, entries)
        print(f"installed {len(entries)} skill(s) into {root / SKILLS_DIR}")
        return 0
    finally:
        for temp_dir in temp_dirs:
            shutil.rmtree(temp_dir, ignore_errors=True)


def _manifest_matches_lock(spec: SkillSpec, entry: dict[str, Any]) -> bool:
    return (
        entry.get("source") == spec.source
        and entry.get("source_kind") == spec.source_kind
        and entry.get("source_path") == spec.source_path
        and entry.get("ref") == spec.ref
        and entry.get("dependency_group") == spec.dependency_group
        and entry.get("dependencies") == list(spec.dependencies)
        and entry.get("environment", []) == list(spec.environment)
        and entry.get("tools", []) == list(spec.tools)
    )


def _status_rows(root: Path, *, check_source: bool = False) -> tuple[list[str], int]:
    manifest = _read_manifest(root)
    specs = {spec.name: spec for spec in _skill_specs(manifest)}
    lock = _read_lock(root)
    if not lock:
        return ["missing lockfile"], 1
    lock_entries = {str(entry["name"]): entry for entry in lock.get("skills", [])}
    rows: list[str] = []
    exit_code = 0
    temp_dirs: list[Path] = []
    try:
        for name, spec in sorted(specs.items()):
            installed = root / SKILLS_DIR / name
            entry = lock_entries.get(name)
            if not entry:
                rows.append(f"DRIFT {name}: missing lock entry")
                exit_code = 1
                continue
            if not installed.exists():
                rows.append(f"DRIFT {name}: missing installed skill")
                exit_code = 1
                continue
            if not _manifest_matches_lock(spec, entry):
                rows.append(f"DRIFT {name}: manifest changed since lockfile")
                exit_code = 1
                continue
            current_hash = _sha256_tree(installed)
            locked_hash = str(entry.get("content_hash"))
            if current_hash != locked_hash:
                rows.append(f"DRIFT {name}: installed hash changed")
                exit_code = 1
                continue
            if check_source:
                source = _resolve_source(root, spec, temp_dirs)
                if _sha256_tree(source.path) != str(entry.get("source_hash")):
                    rows.append(f"DRIFT {name}: source hash changed")
                    exit_code = 1
                    continue
            rows.append(f"OK {name}: no drift")
        extra = sorted(set(lock_entries) - set(specs))
        for name in extra:
            rows.append(f"DRIFT {name}: in lockfile but not manifest")
            exit_code = 1
        return rows, exit_code
    finally:
        for temp_dir in temp_dirs:
            shutil.rmtree(temp_dir, ignore_errors=True)


def status(root: Path, *, check_source: bool = False) -> int:
    rows, exit_code = _status_rows(root, check_source=check_source)
    for row in rows:
        print(row)
    return exit_code


ENV_BY_SKILL = {
    "databricks-query": ("DATABRICKS_HOST", "DATABRICKS_TOKEN", "DATABRICKS_WAREHOUSE_ID"),
    "ingest-knowledge": (
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "OPENAI_API_VERSION",
        "AZURE_OPENAI_COMPLETION_DEPLOYMENT_NAME",
    ),
}


def _dependency_distribution(dependency: str) -> str:
    name = dependency.split(";", 1)[0].strip()
    for marker in ("[", "<", ">", "=", "!", "~"):
        name = name.split(marker, 1)[0].strip()
    return name


def _doctor_rows(root: Path) -> tuple[list[str], int]:
    manifest = _read_manifest(root)
    specs = _skill_specs(manifest)
    rows: list[str] = []
    exit_code = 0
    pyproject = root / "pyproject.toml"
    temp_dirs: list[Path] = []
    try:
        for spec in specs:
            try:
                source = _resolve_source(root, spec, temp_dirs)
                if not (source.path / "SKILL.md").exists():
                    rows.append(f"FAIL {spec.name}: source has no SKILL.md")
                    exit_code = 1
                else:
                    rows.append(f"OK {spec.name}: source available")
            except SystemExit as exc:
                rows.append(f"FAIL {spec.name}: {exc}")
                exit_code = 1

            for tool in spec.tools:
                if shutil.which(tool):
                    rows.append(f"OK {spec.name}: tool {tool} found")
                else:
                    rows.append(f"FAIL {spec.name}: tool {tool} not found")
                    exit_code = 1

            if spec.source_kind in {"git-url", "public-repo"}:
                if shutil.which("git"):
                    rows.append(f"OK {spec.name}: git available")
                else:
                    rows.append(f"FAIL {spec.name}: git not found")
                    exit_code = 1

            if spec.dependencies and not pyproject.exists():
                rows.append(f"FAIL {spec.name}: pyproject.toml missing for declared dependencies")
                exit_code = 1
            for dependency in spec.dependencies:
                distribution = _dependency_distribution(dependency)
                try:
                    importlib.metadata.version(distribution)
                    rows.append(f"OK {spec.name}: dependency {distribution} installed")
                except importlib.metadata.PackageNotFoundError:
                    rows.append(f"FAIL {spec.name}: dependency {distribution} not installed")
                    exit_code = 1

            env_keys = tuple(
                dict.fromkeys((*ENV_BY_SKILL.get(spec.name, ()), *spec.environment))
            )
            for key in env_keys:
                if os.environ.get(key):
                    rows.append(f"OK {spec.name}: env {key} set")
                else:
                    rows.append(f"WARN {spec.name}: env {key} not set")
    finally:
        for temp_dir in temp_dirs:
            shutil.rmtree(temp_dir, ignore_errors=True)
    return rows, exit_code


def doctor(root: Path) -> int:
    rows, exit_code = _doctor_rows(root)
    for row in rows:
        print(row)
    return exit_code


def list_skills(root: Path) -> int:
    manifest = _read_manifest(root)
    specs = _skill_specs(manifest)
    for spec in specs:
        print(f"{spec.name}\t{spec.source_kind}\t{spec.source}\t{spec.ref}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bundle-sync")
    parser.add_argument("--target", help="Bundle root. Defaults to current directory.")
    sub = parser.add_subparsers(dest="command", required=True)
    install_parser = sub.add_parser(
        "install",
        help="Install declared skills and write lockfile",
    )
    install_parser.add_argument(
        "--refresh-agents",
        action="store_true",
        help="Refresh generated AGENTS.md skills block",
    )
    update_parser = sub.add_parser("update", help="Alias for install")
    update_parser.add_argument(
        "--refresh-agents",
        action="store_true",
        help="Refresh generated AGENTS.md skills block",
    )
    status_parser = sub.add_parser("status", help="Check installed skills against lockfile")
    status_parser.add_argument(
        "--check-source",
        action="store_true",
        help="Also compare current source tree hashes",
    )
    sub.add_parser("list", help="List manifest-declared skills")
    sub.add_parser("doctor", help="Check source, dependency, tool, and environment readiness")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = _repo_root(args.target)
    try:
        if args.command in {"install", "update"}:
            return install(root, refresh_agents=args.refresh_agents)
        if args.command == "status":
            return status(root, check_source=args.check_source)
        if args.command == "list":
            return list_skills(root)
        if args.command == "doctor":
            return doctor(root)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
