#!/usr/bin/env python3
"""reflect: turn a Cursor usage export into the retro's cost section.

Answers four questions a retro needs and a human cannot get from the dashboard:
what the run cost, where the money went per feature, what the cost *unit* is, and
whether model routing shows up on the invoice at all.

Three inputs, only the first required:

  --usage       Cursor usage CSV. Dashboard -> Usage -> export (browser session
                required; the endpoint is auth-gated, so the human must download it).
  --transcript  Session transcript.json, for tool-call volume and phase allocation.
                From the cursor-cloud MCP: batch-fetch-details include_transcripts.
  --app-runs    Directory of the app's own agent transcripts, if the product under
                test runs agents itself. Those bill separately and are easy to miss.

Phases come from conventional-commit scopes on the branch (`feat(f041): ...` ->
phase F041), so per-feature allocation needs no hand-maintained boundary list.

Stdlib only. Run from the bundle root:
    python .cursor/skills/agent-factory/reflect/cost_analysis.py --usage <csv> [options]
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

SCOPE_RE = re.compile(r"^[a-z]+\(([a-z]\d{2,4})\)", re.IGNORECASE)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def stamp(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%m-%d %H:%MZ")


def usd(value: float) -> str:
    return f"${value:,.2f}"


def mtok(value: float) -> str:
    return f"{value / 1e6:.2f} M"


@dataclass
class Event:
    when: datetime
    agent: str
    model: str
    cache_write: int
    plain_input: int
    cache_read: int
    output: int
    total: int
    cost: float


@dataclass
class Phase:
    name: str
    start: datetime
    end: datetime
    calls: int = 0
    terminal: int = 0
    exec_ms: int = 0
    rounds: int = 0


@dataclass
class Session:
    agent: str
    events: list[Event] = field(default_factory=list)

    @property
    def cost(self) -> float:
        return sum(e.cost for e in self.events)

    @property
    def total(self) -> int:
        return sum(e.total for e in self.events)

    @property
    def cache_read(self) -> int:
        return sum(e.cache_read for e in self.events)

    @property
    def output(self) -> int:
        return sum(e.output for e in self.events)

    @property
    def models(self) -> list[str]:
        return sorted({e.model for e in self.events})


def load_usage(path: Path) -> list[Event]:
    def num(row: dict, *names: str) -> int:
        for name in names:
            if row.get(name):
                return int(float(row[name]))
        return 0

    events = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            events.append(
                Event(
                    when=parse_iso(row["Date"]),
                    agent=(row.get("Cloud Agent ID") or "").strip(),
                    model=(row.get("Model") or "").strip(),
                    cache_write=num(row, "Input (w/ Cache Write)"),
                    plain_input=num(row, "Input (w/o Cache Write)"),
                    cache_read=num(row, "Cache Read"),
                    output=num(row, "Output Tokens"),
                    total=num(row, "Total Tokens"),
                    cost=float(row.get("Cost") or 0),
                )
            )
    return events


def load_tool_calls(path: Path) -> list[dict]:
    """Flatten every timestamped tool call out of a session transcript."""
    calls: list[dict] = []

    def walk(node) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return
        if node.get("tool_name") and node.get("started_at_ms"):
            calls.append(
                {
                    "when": datetime.fromtimestamp(node["started_at_ms"] / 1000, timezone.utc),
                    "name": node["tool_name"],
                    "ms": node.get("duration_ms") or 0,
                }
            )
        for value in node.values():
            walk(value)

    walk(json.loads(path.read_text(encoding="utf-8")))
    calls.sort(key=lambda c: c["when"])
    return calls


def load_subagents(path: Path) -> dict[str, dict]:
    """Group unique subagent invocations by requested model.

    Task calls appear twice (request and result), so dedupe on description+prompt
    length before counting.
    """
    seen: set[tuple[str, int]] = set()
    by_model: dict[str, dict] = defaultdict(lambda: {"n": 0, "chars": 0, "names": []})

    def walk(node) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return
        if str(node.get("tool_name", "")).startswith("task") and node.get("tool_args"):
            args = node["tool_args"]
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            prompt = (args or {}).get("prompt") or ""
            if prompt:
                key = ((args or {}).get("description", ""), len(prompt))
                if key not in seen:
                    seen.add(key)
                    bucket = by_model[(args or {}).get("model") or "(inherited)"]
                    bucket["n"] += 1
                    bucket["chars"] += len(prompt)
                    bucket["names"].append(key[0])
        for value in node.values():
            walk(value)

    walk(json.loads(path.read_text(encoding="utf-8")))
    return dict(by_model)


def derive_phases(repo: Path, base: str) -> list[Phase]:
    """Read contiguous phase spans off conventional-commit scopes on the branch."""
    out = subprocess.run(
        ["git", "log", "--reverse", "--format=%ct%x09%s", f"{base}..HEAD"],
        cwd=repo, capture_output=True, text=True, check=True,
    ).stdout.strip()
    if not out:
        return []

    rows = [
        (datetime.fromtimestamp(int(secs), timezone.utc), subject)
        for secs, _, subject in (line.partition("\t") for line in out.splitlines())
    ]

    order: list[str] = []
    first: dict[str, datetime] = {}
    for when, subject in rows:
        match = SCOPE_RE.match(subject)
        if not match:
            continue
        scope = match.group(1).upper()
        if scope not in first:
            first[scope] = when
            order.append(scope)
    if not order:
        return []

    # Phases tile the whole session, not just the committed part of it: each starts
    # where the previous ended, a leading `setup` phase catches the work done before
    # the first commit, and the last phase runs to the horizon so the closing gate
    # and the retro are priced instead of falling through the allocation.
    names = ["setup"] + order
    edges = (
        [datetime.min.replace(tzinfo=timezone.utc), rows[0][0]]
        + [first[scope] for scope in order[1:]]
        + [datetime.max.replace(tzinfo=timezone.utc)]
    )
    return [Phase(name=name, start=edges[i], end=edges[i + 1]) for i, name in enumerate(names)]


def allocate(phases: list[Phase], calls: list[dict]) -> int:
    for call in calls:
        for phase in phases:
            if phase.start <= call["when"] < phase.end:
                phase.calls += 1
                phase.exec_ms += call["ms"]
                if call["name"] == "run_terminal_cmd":
                    phase.terminal += 1
                break
    return sum(p.calls for p in phases)


def count_app_runs(directory: Path, start: datetime, end: datetime) -> list[datetime]:
    runs = []
    for path in directory.rglob("*.jsonl"):
        when = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        if start <= when <= end:
            runs.append(when)
    return sorted(runs)


def report(args: argparse.Namespace) -> int:
    events = load_usage(Path(args.usage))
    if not events:
        print("no usage events in the CSV", file=sys.stderr)
        return 1

    sessions: dict[str, Session] = {}
    for event in events:
        if event.agent:
            sessions.setdefault(event.agent, Session(event.agent)).events.append(event)

    if not args.agent:
        print("Sessions in this export (pass one to --agent):\n")
        for session in sorted(sessions.values(), key=lambda s: -s.cost):
            span = f"{stamp(min(e.when for e in session.events))} -> {stamp(max(e.when for e in session.events))}"
            print(f"  {session.agent}  {usd(session.cost):>10}  {mtok(session.total):>9}  {span}  {' '.join(session.models)}")
        print("\nRe-run with --agent <id> for the full report.")
        return 0

    session = sessions.get(args.agent)
    if session is None:
        print(f"no events for agent {args.agent}", file=sys.stderr)
        return 1

    # Events after --until belong to a later session on the same agent (a follow-up
    # turn), and would otherwise inflate the run being analysed.
    cutoff = parse_iso(args.until) if args.until else None
    epic = [e for e in session.events if cutoff is None or e.when <= cutoff]
    later = [e for e in session.events if cutoff is not None and e.when > cutoff]
    spend = sum(e.cost for e in epic)
    tokens = sum(e.total for e in epic)
    cache_read = sum(e.cache_read for e in epic)
    output = sum(e.output for e in epic)

    start = min(e.when for e in epic)
    end = cutoff or max(e.when for e in epic)

    calls: list[dict] = []
    subagents: dict[str, dict] = {}
    if args.transcript:
        calls = load_tool_calls(Path(args.transcript))
        subagents = load_subagents(Path(args.transcript))

    phases = derive_phases(Path(args.repo), args.base) if args.base else []
    for spec in args.rounds or []:
        name, _, count = spec.partition("=")
        for phase in phases:
            if phase.name.upper() == name.upper():
                phase.rounds = int(count)
    in_phase = allocate(phases, calls) if phases else 0

    app_runs: list[datetime] = []
    if args.app_runs:
        app_runs = count_app_runs(Path(args.app_runs), start, end)
    orphan = [e for e in events if not e.agent and start <= e.when <= end]
    orphan_cost = sum(e.cost for e in orphan)

    lines: list[str] = []
    add = lines.append

    add("### The invoice\n")
    add("| Line | Cost | Tokens |")
    add("|---|---|---|")
    add(f"| Cloud-agent session | **{usd(spend)}** | {mtok(tokens)} |")
    if orphan:
        label = f"The app's own {len(orphan)} agent runs" if app_runs else f"{len(orphan)} events with no agent id"
        add(f"| {label} | **{usd(orphan_cost)}** | {mtok(sum(e.total for e in orphan))} |")
    add(f"| **Total** | **{usd(spend + orphan_cost)}** | {mtok(tokens + sum(e.total for e in orphan))} |")
    if later:
        add(f"| *(Excluded: {len(later)} event(s) after --until)* | *{usd(sum(e.cost for e in later))}* | *{mtok(sum(e.total for e in later))}* |")
    add("")
    whole = sum(e.cost for e in events)
    add(f"Whole export: {usd(whole)} across {len(events)} events and {len(sessions)} sessions — "
        f"this run is **{(spend + orphan_cost) / whole * 100:.0f}%** of it.\n")

    add("### Billing lines by model\n")
    add("| Model | Events | Cost | Tokens |")
    add("|---|---|---|---|")
    by_model: dict[str, list[Event]] = defaultdict(list)
    for event in epic:
        by_model[event.model].append(event)
    for model, rows in sorted(by_model.items(), key=lambda kv: -sum(e.cost for e in kv[1])):
        add(f"| `{model}` | {len(rows)} | {usd(sum(e.cost for e in rows))} | {mtok(sum(e.total for e in rows))} |")
    add("")

    if subagents:
        add("### Subagents requested, versus billed\n")
        add("| Requested model | Invocations | Prompt chars | Own billing line? |")
        add("|---|---|---|---|")
        for model, bucket in sorted(subagents.items(), key=lambda kv: -kv[1]["n"]):
            billed = "yes" if model in by_model else "**no**"
            add(f"| `{model}` | {bucket['n']} | {bucket['chars']:,} | {billed} |")
        add("")
        missing = [m for m in subagents if m not in by_model]
        if missing:
            add(f"**{len(missing)} requested model(s) have no billing line of their own.** Subagent spend is "
                "rolled into the session's headline model, so builder-model routing does not appear on the "
                "invoice as a separate cost. Judge routing on rounds, not on price.\n")

    add("### The cost unit\n")
    add("| | |")
    add("|---|---|")
    add(f"| Cache-read share of tokens | **{cache_read / tokens * 100:.1f}%** |")
    add(f"| Output share of tokens | **{output / tokens * 100:.2f}%** |")
    add(f"| Blended rate | {usd(spend / (tokens / 1e6))} / M tokens |")
    if calls:
        window = [c for c in calls if start <= c["when"] <= end]
        terminal = [c for c in window if c["name"] == "run_terminal_cmd"]
        per_call = spend / len(window) if window else 0
        add(f"| Orchestrator tool calls | **{len(window):,}** |")
        add(f"| **Cost per tool call** | **${per_call:.3f}** |")
        add(f"| Cache-read tokens per call | {cache_read / len(window) / 1000:.0f} k |")
        add(f"| `run_terminal_cmd` calls | {len(terminal):,} → **≈{usd(len(terminal) * per_call)}, "
            f"{len(terminal) * per_call / spend * 100:.0f}% of the session** |")
        exec_h = sum(c["ms"] for c in window) / 3_600_000
        add(f"| Measured command execution | {exec_h:.2f} h |")
    add("")
    add("> cost ≈ (number of tool calls) × (context size at each call)\n")
    add(f"{cache_read / tokens * 100:.0f}% of this run was paid for **re-reading the same context**, once per "
        "tool call. Generation was under half a percent. Standing instruction is therefore billed on every "
        "call — trimming it is a cost measure, and so is batching probes instead of issuing one-line commands.\n")

    if phases and in_phase:
        add("### Where the money went\n")
        header = "| Phase | Tool calls | Share | Terminal | Exec h | Cost |"
        divider = "|---|---|---|---|---|---|"
        if any(p.rounds for p in phases):
            header += " Rounds | $/round |"
            divider += "---|---|"
        add(header)
        add(divider)
        for phase in phases:
            if not phase.calls:
                continue
            share = phase.calls / in_phase
            cost = share * spend
            row = (f"| {phase.name} | {phase.calls:,} | {share * 100:.1f}% | {phase.terminal:,} "
                   f"| {phase.exec_ms / 3_600_000:.2f} | {usd(cost)} |")
            if any(p.rounds for p in phases):
                row += f" {phase.rounds or '—'} | {usd(cost / phase.rounds) if phase.rounds else '—'} |"
            add(row)
        add("")
        add(f"Allocated by timestamped tool-call volume over contiguous, non-overlapping phase spans "
            f"({in_phase:,} of {len(calls):,} calls fell inside a phase).\n")

        scored = [p for p in phases if p.rounds]
        if scored:
            once = sum((p.calls / in_phase) * spend / p.rounds for p in scored)
            actual = sum((p.calls / in_phase) * spend for p in scored)
            add(f"Charging each phase's own per-round rate a single time, the {len(scored)} phases would have "
                f"cost ~{usd(once)} instead of {usd(actual)}. **Re-rounds account for roughly "
                f"{usd(actual - once)} — {(actual - once) / spend * 100:.0f}% of the session.**\n")
            worst = max(scored, key=lambda p: p.calls)
            add(f"{worst.name} alone is {worst.calls / in_phase * 100:.0f}% of the spend "
                f"({usd(worst.calls / in_phase * spend)}) across {worst.rounds} round(s).\n")

    if app_runs:
        add("### The app's own agent runs\n")
        verdict = "matches exactly" if len(app_runs) == len(orphan) else f"does not match ({len(orphan)} events)"
        add(f"The product under test ran **{len(app_runs)} agents** of its own during this window, and the "
            f"export carries **{len(orphan)} events with no agent id** — {verdict}. Those bill against the "
            f"API key rather than the session, so they are invisible in the agent view.\n")
        add("| Model | Events | Cost |")
        add("|---|---|---|")
        orphan_models: dict[str, list[Event]] = defaultdict(list)
        for event in orphan:
            orphan_models[event.model].append(event)
        for model, rows in sorted(orphan_models.items(), key=lambda kv: -sum(e.cost for e in kv[1])):
            add(f"| `{model}` | {len(rows)} | {usd(sum(e.cost for e in rows))} |")
        add("")

    text = "\n".join(lines)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(text)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a retro cost section from a Cursor usage export.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--usage", required=True, help="Cursor usage CSV exported from the dashboard")
    parser.add_argument("--agent", help="cloud agent id to analyse; omit to list the sessions in the export")
    parser.add_argument("--transcript", help="session transcript.json, for tool-call volume and allocation")
    parser.add_argument("--app-runs", help="directory of the product's own agent transcripts (*.jsonl)")
    parser.add_argument("--repo", default=os.getcwd(), help="repo root for phase derivation (default: cwd)")
    parser.add_argument("--base", help="base ref; phases come from commit scopes in <base>..HEAD")
    parser.add_argument("--rounds", nargs="*", metavar="PHASE=N",
                        help="build rounds per phase, e.g. f041=3, to price re-rounds")
    parser.add_argument("--until", metavar="ISO8601",
                        help="ignore session events after this instant (excludes later follow-up turns)")
    parser.add_argument("--out", help="write the markdown section here instead of stdout")
    return report(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
