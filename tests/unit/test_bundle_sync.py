from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _load_bundle_sync():
    path = Path(__file__).resolve().parents[2] / ".cursor" / "skills" / "bundle-sync" / "bundle_sync.py"
    spec = importlib.util.spec_from_file_location("bundle_sync", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["bundle_sync"] = module
    spec.loader.exec_module(module)
    return module


def _write_skill(root: Path, name: str, body: str = "# Skill\n") -> Path:
    skill = root / ".cursor" / "skills" / name
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: Test skill\n---\n\n{body}",
        encoding="utf-8",
    )
    return skill


def test_install_writes_lock_agents_and_dependency_group(tmp_path: Path) -> None:
    bundle_sync = _load_bundle_sync()
    source_repo = tmp_path / "source"
    source_skill = _write_skill(source_repo, "okf")

    target = tmp_path / "target"
    target.mkdir()
    (target / "AGENTS.md").write_text("# Target\n", encoding="utf-8")
    (target / "pyproject.toml").write_text(
        "[project]\nname = \"target\"\n\n[project.optional-dependencies]\ndev = []\n",
        encoding="utf-8",
    )
    (target / "bundle.toml").write_text(
        f"""
[identity]
name = "target"

[skills.okf]
source = "{source_skill.as_posix()}"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = ["pytest>=8"]
""".lstrip(),
        encoding="utf-8",
    )

    assert bundle_sync.install(target) == 0

    assert (target / ".cursor" / "skills" / "okf" / "SKILL.md").exists()
    lock = (target / "bundle.lock.json").read_text(encoding="utf-8")
    assert '"name": "okf"' in lock
    assert '"dependency_group": "skill-okf"' in lock
    agents = (target / "AGENTS.md").read_text(encoding="utf-8")
    assert "<!-- bundle-sync:skills:begin -->" not in agents
    pyproject = (target / "pyproject.toml").read_text(encoding="utf-8")
    assert "skill-okf = [" in pyproject
    assert '"pytest>=8",' in pyproject


def test_install_can_refresh_agents_when_requested(tmp_path: Path) -> None:
    bundle_sync = _load_bundle_sync()
    source_repo = tmp_path / "source"
    source_skill = _write_skill(source_repo, "okf")
    target = tmp_path / "target"
    target.mkdir()
    (target / "AGENTS.md").write_text("# Target\n", encoding="utf-8")
    (target / "bundle.toml").write_text(
        f"""
[skills.okf]
source = "{source_skill.as_posix()}"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = []
""".lstrip(),
        encoding="utf-8",
    )

    assert bundle_sync.install(target, refresh_agents=True) == 0

    agents = (target / "AGENTS.md").read_text(encoding="utf-8")
    assert "<!-- bundle-sync:skills:begin -->" in agents
    assert "| `okf` | installed |" in agents


def test_status_detects_drift(tmp_path: Path) -> None:
    bundle_sync = _load_bundle_sync()
    source_repo = tmp_path / "source"
    source_skill = _write_skill(source_repo, "okf")
    target = tmp_path / "target"
    target.mkdir()
    (target / "bundle.toml").write_text(
        f"""
[skills.okf]
source = "{source_skill.as_posix()}"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = []
""".lstrip(),
        encoding="utf-8",
    )

    assert bundle_sync.install(target) == 0
    installed = target / ".cursor" / "skills" / "okf" / "SKILL.md"
    installed.write_text(installed.read_text(encoding="utf-8") + "\nchanged\n", encoding="utf-8")

    rows, exit_code = bundle_sync._status_rows(target)
    assert exit_code == 1
    assert rows == ["DRIFT okf: installed hash changed"]


def test_status_detects_manifest_change(tmp_path: Path) -> None:
    bundle_sync = _load_bundle_sync()
    source_repo = tmp_path / "source"
    source_skill = _write_skill(source_repo, "okf")
    target = tmp_path / "target"
    target.mkdir()
    manifest = target / "bundle.toml"
    manifest.write_text(
        f"""
[skills.okf]
source = "{source_skill.as_posix()}"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = []
""".lstrip(),
        encoding="utf-8",
    )
    assert bundle_sync.install(target) == 0
    manifest.write_text(manifest.read_text(encoding="utf-8").replace("working-tree", "main"), encoding="utf-8")

    rows, exit_code = bundle_sync._status_rows(target)

    assert exit_code == 1
    assert rows == ["DRIFT okf: manifest changed since lockfile"]


def test_status_can_check_source_hash(tmp_path: Path) -> None:
    bundle_sync = _load_bundle_sync()
    source_repo = tmp_path / "source"
    source_skill = _write_skill(source_repo, "okf")
    target = tmp_path / "target"
    target.mkdir()
    (target / "bundle.toml").write_text(
        f"""
[skills.okf]
source = "{source_skill.as_posix()}"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = []
""".lstrip(),
        encoding="utf-8",
    )
    assert bundle_sync.install(target) == 0
    (source_skill / "extra.txt").write_text("changed upstream\n", encoding="utf-8")

    rows, exit_code = bundle_sync._status_rows(target, check_source=True)

    assert exit_code == 1
    assert rows == ["DRIFT okf: source hash changed"]


def test_doctor_fails_when_dependency_environment_is_not_ready(tmp_path: Path) -> None:
    bundle_sync = _load_bundle_sync()
    source_repo = tmp_path / "source"
    source_skill = _write_skill(source_repo, "demo")
    target = tmp_path / "target"
    target.mkdir()
    (target / "bundle.toml").write_text(
        f"""
[skills.demo]
source = "{source_skill.as_posix()}"
source_kind = "sibling-path"
ref = "working-tree"
dependencies = ["definitely-missing-bundle-sync-test-package>=1"]
""".lstrip(),
        encoding="utf-8",
    )

    rows, exit_code = bundle_sync._doctor_rows(target)

    assert exit_code == 1
    assert "FAIL demo: pyproject.toml missing for declared dependencies" in rows
    assert "FAIL demo: dependency definitely-missing-bundle-sync-test-package not installed" in rows
