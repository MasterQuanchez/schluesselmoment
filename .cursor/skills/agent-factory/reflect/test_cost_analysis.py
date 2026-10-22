#!/usr/bin/env python3
"""Tests for cost_analysis. Run: python .cursor/skills/agent-factory/reflect/test_cost_analysis.py"""
from __future__ import annotations

import io
import json
import subprocess
import sys
import tempfile
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cost_analysis as ca  # noqa: E402

failures: list[str] = []


def check(label: str, got, want) -> None:
    if got == want:
        print(f"  ok   {label}")
    else:
        failures.append(f"{label}: got {got!r}, want {want!r}")
        print(f"  FAIL {label}: got {got!r}, want {want!r}")


CSV = """Date,User,Kind,Max Mode,Model,Cost,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cloud Agent ID
2026-07-25T16:28:00.000Z,Javier,Included,No,claude-opus-5-thinking-high,300.00,7000000,4000000,450000000,2000000,463000000,bc-aaa
2026-07-26T06:14:00.000Z,Javier,Included,No,claude-opus-5-thinking-high,10.00,150000,138000,10000000,60000,10348000,bc-aaa
2026-07-26T09:25:00.000Z,Javier,Included,No,claude-opus-5-thinking-high,7.88,200000,88,7500000,34000,7734088,bc-aaa
2026-07-25T18:44:00.000Z,Javier,Included,No,cursor-grok-4.5-high-fast,0.31,10000,500,150000,2000,162500,
2026-07-25T18:50:00.000Z,Javier,Included,No,composer-2.5-fast,0.09,5000,200,40000,900,46100,
2026-07-24T20:57:00.000Z,Javier,Included,No,claude-opus-5-thinking-high,25.70,600000,200000,22000000,130000,22930000,bc-bbb
"""


def write(directory: Path, name: str, text: str) -> Path:
    path = directory / name
    path.write_text(text, encoding="utf-8")
    return path


def git(repo: Path, *args: str, when: str | None = None) -> None:
    env = {"GIT_AUTHOR_DATE": when, "GIT_COMMITTER_DATE": when} if when else {}
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True,
                   env={**dict(__import__("os").environ), **env})


def make_repo(root: Path) -> tuple[Path, list[datetime]]:
    """A branch shaped like a real epic: unscoped setup work, then f001, then f002.

    The leading unscoped commit is the point — phase spans must tile from the
    branch's first commit, not from the first *scoped* one, or the orchestrator's
    pre-feature work falls out of the allocation entirely.
    """
    repo = root / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "t@example.com")
    git(repo, "config", "user.name", "t")

    base = datetime(2026, 7, 25, 12, 0, tzinfo=timezone.utc)
    stamps = [base + timedelta(hours=h) for h in range(6)]
    subjects = [
        "chore: base",
        "docs(plan): epic plan",
        "docs(f001): plan",
        "feat(f001): build",
        "fix: shared cleanup",
        "feat(f002): build",
    ]
    for i, (subject, when) in enumerate(zip(subjects, stamps)):
        write(repo, f"file{i}.txt", subject)
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", subject, when=when.isoformat())
    return repo, stamps


def run() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        print("\nload_usage")
        events = ca.load_usage(write(root, "usage.csv", CSV))
        check("every row parsed", len(events), 6)
        check("cost coerced to float", events[0].cost, 300.00)
        check("cache read coerced to int", events[0].cache_read, 450000000)
        check("blank agent id stays blank", events[3].agent, "")
        check("timestamps are tz-aware", events[0].when.tzinfo is not None, True)

        print("\nderive_phases tiles the branch")
        repo, stamps = make_repo(root)
        phases = ca.derive_phases(repo, "HEAD~5")
        check("a setup phase leads the scopes", [p.name for p in phases], ["setup", "F001", "F002"])
        check("setup ends at the branch's first commit, not its first scoped one",
              phases[0].end, stamps[1])
        check("phases are contiguous", [phases[0].end, phases[1].end],
              [phases[1].start, phases[2].start])
        check("the last phase runs to the horizon", phases[-1].end.year, 9999)
        check("an empty range means no phases", ca.derive_phases(repo, "HEAD"), [])

        unscoped = root / "unscoped"
        unscoped.mkdir()
        git(unscoped, "init", "-q", "-b", "main")
        git(unscoped, "config", "user.email", "t@example.com")
        git(unscoped, "config", "user.name", "t")
        for i, subject in enumerate(["chore: base", "fix: no scope here"]):
            write(unscoped, f"f{i}.txt", subject)
            git(unscoped, "add", "-A")
            git(unscoped, "commit", "-q", "-m", subject)
        check("no scoped commits means no phases", ca.derive_phases(unscoped, "HEAD~1"), [])

        print("\nallocate")
        calls = [
            # Before any commit — the session's setup work.
            {"when": stamps[0], "name": "read_file", "ms": 50},
            # Before the first *scoped* commit — must still land in F001.
            {"when": stamps[1] + timedelta(minutes=1), "name": "read_file", "ms": 100},
            {"when": stamps[3] + timedelta(minutes=1), "name": "run_terminal_cmd", "ms": 200},
            # Inside the unscoped shared-cleanup commit's window — also F001.
            {"when": stamps[4] + timedelta(minutes=1), "name": "run_terminal_cmd", "ms": 300},
            # After the last commit — the closing gate, priced against F002.
            {"when": stamps[5] + timedelta(hours=9), "name": "read_file", "ms": 400},
        ]
        in_phase = ca.allocate(phases, calls)
        check("every call is allocated", in_phase, len(calls))
        check("pre-commit work is its own phase", phases[0].calls, 1)
        check("F001 absorbs pre-scope and unscoped-commit calls", phases[1].calls, 3)
        check("terminal calls counted separately", phases[1].terminal, 2)
        check("durations summed", phases[1].exec_ms, 600)
        check("work after the last commit lands in the last phase", phases[2].calls, 1)

        print("\nload_subagents dedupes the request/result pair")
        transcript = write(root, "t.json", json.dumps([
            {"tool_name": "task", "tool_args": {"description": "F001", "prompt": "x" * 50,
                                                "model": "cursor-grok-4.5-high"}},
            {"tool_name": "task", "tool_args": {"description": "F001", "prompt": "x" * 50,
                                                "model": "cursor-grok-4.5-high"}},
            {"nested": [{"tool_name": "task", "tool_args": json.dumps(
                {"description": "F002", "prompt": "y" * 20, "model": "claude-4.6-sonnet-high-thinking"})}]},
            {"tool_name": "read_file", "tool_args": {"prompt": "not a subagent"}},
        ]))
        agents = ca.load_subagents(transcript)
        check("one entry per distinct invocation", agents["cursor-grok-4.5-high"]["n"], 1)
        check("stringified tool_args parsed", agents["claude-4.6-sonnet-high-thinking"]["n"], 1)
        check("prompt size recorded", agents["cursor-grok-4.5-high"]["chars"], 50)
        check("non-task calls ignored", len(agents), 2)

        print("\nreport")
        args = ca.argparse.Namespace(
            usage=str(root / "usage.csv"), agent="bc-aaa", transcript=None, app_runs=None,
            repo=str(repo), base=None, rounds=None, until="2026-07-26T06:45:00Z", out=None,
        )
        out = io.StringIO()
        with redirect_stdout(out):
            check("report succeeds", ca.report(args), 0)
        text = out.getvalue()
        check("--until excludes the later turn", "**$310.00**" in text, True)
        check("the excluded turn is disclosed, not dropped", "$7.88" in text, True)
        check("blank-agent rows are a separate line", "**$0.40**" in text, True)
        check("cache-read share reported", "97.2%" in text, True)
        check("unknown agent id is an error", ca.report(
            ca.argparse.Namespace(**{**vars(args), "agent": "bc-zzz"})), 1)

    if failures:
        print(f"\nFAILED ({len(failures)}):", file=sys.stderr)
        for failure in failures:
            print(" - " + failure, file=sys.stderr)
        return 1
    print("\nall cost_analysis tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
