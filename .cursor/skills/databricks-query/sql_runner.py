#!/usr/bin/env python3
"""Read-only SQL against a Databricks SQL warehouse."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

READ_ONLY_BLOCKLIST = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|MERGE|INTO\s+\w+\.|CREATE|ALTER|DROP|TRUNCATE|REPLACE|"
    r"VACUUM|OPTIMIZE|ANALYZE|CACHE\s+TABLE|UNCACHE\s+TABLE|MSCK|CALL"
    r")\b",
    re.IGNORECASE | re.DOTALL,
)

ENV_HOST = "DATABRICKS_HOST"
ENV_TOKEN = "DATABRICKS_TOKEN"
ENV_WAREHOUSE_ID = "DATABRICKS_WAREHOUSE_ID"


def _env_keys() -> tuple[str, str, str]:
    return ENV_HOST, ENV_TOKEN, ENV_WAREHOUSE_ID


def _load_dotenv_if_available() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    repo_root = Path(__file__).resolve().parents[3]
    load_dotenv(repo_root / ".env")


def normalize_host(raw: str | None) -> str:
    if not raw:
        raise ValueError(f"{ENV_HOST} is not set")
    host = raw.strip().rstrip("/")
    if not host.startswith(("http://", "https://")):
        host = "https://" + host
    return host


def _strip_sql_comments(sql: str) -> str:
    stripped = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    lines = []
    for line in stripped.splitlines():
        if "--" in line:
            line = line.split("--", 1)[0]
        lines.append(line)
    return "\n".join(lines)


def validate_read_only_sql(sql: str) -> None:
    cleaned = _strip_sql_comments(sql).strip()
    if not cleaned:
        raise ValueError("SQL is empty")
    if READ_ONLY_BLOCKLIST.search(cleaned):
        raise ValueError("Rejected: statement contains disallowed keywords for read-only execution")
    opener = cleaned.lstrip().split()[0].upper() if cleaned.lstrip().split() else ""
    allowed = {"SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"}
    if opener not in allowed:
        raise ValueError(f"Rejected: read-only execution allows {', '.join(sorted(allowed))}; got {opener or '(empty)'}")


def env_config() -> tuple[str, str, str]:
    host_key, token_key, warehouse_key = _env_keys()
    host = normalize_host(os.environ.get(host_key))
    token = os.environ.get(token_key)
    warehouse = os.environ.get(warehouse_key)
    if not token:
        raise ValueError(f"{token_key} is not set")
    if not warehouse:
        raise ValueError(f"{warehouse_key} is not set")
    return host, token, warehouse


def execute_statement(
    sql: str,
    *,
    wait_timeout: str = "30s",
    host: str | None = None,
    token: str | None = None,
    warehouse_id: str | None = None,
) -> dict[str, Any]:
    validate_read_only_sql(sql)
    if host is None or token is None or warehouse_id is None:
        env_host, env_token, env_warehouse = env_config()
        host = host or env_host
        token = token or env_token
        warehouse_id = warehouse_id or env_warehouse
    payload = {
        "warehouse_id": warehouse_id,
        "statement": sql,
        "wait_timeout": wait_timeout,
        "on_wait_timeout": "CONTINUE",
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(host + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise RuntimeError(f"HTTP {exc.code} on {path}: {detail}") from exc

    created = request("POST", "/api/2.0/sql/statements", payload)
    statement_id = created["statement_id"]
    state = created.get("status", {}).get("state")
    output = created
    while state in ("PENDING", "RUNNING"):
        time.sleep(1.5)
        output = request("GET", f"/api/2.0/sql/statements/{statement_id}")
        state = output.get("status", {}).get("state")
    if state != "SUCCEEDED":
        error = output.get("status", {}).get("error")
        raise RuntimeError(json.dumps({"state": state, "error": error, "statement_id": statement_id}, indent=2))
    return output


def rows_from_statement_response(response: dict[str, Any]) -> list[dict[str, Any]]:
    columns_meta = response.get("manifest", {}).get("schema", {}).get("columns", [])
    columns = [column["name"] for column in columns_meta]
    data = response.get("result", {}).get("data_array") or []
    return [dict(zip(columns, row)) for row in data]


def main(argv: list[str] | None = None) -> int:
    _load_dotenv_if_available()
    parser = argparse.ArgumentParser(description="Execute read-only SQL against the configured SQL warehouse.")
    parser.add_argument("sql", nargs="?", help="SQL text, optional if --file is set")
    parser.add_argument("--file", "-f", help="Read SQL from file")
    parser.add_argument("--rows-only", action="store_true", help="Print JSON array of row objects")
    parser.add_argument("--raw", action="store_true", help="Print full statement API JSON response")
    parser.add_argument("--dry-run", action="store_true", help="Validate SQL only")
    parser.add_argument("--wait-timeout", default="30s", help="Statement wait_timeout")
    args = parser.parse_args(argv)
    if args.file:
        sql = Path(args.file).read_text(encoding="utf-8")
    elif args.sql is not None:
        sql = args.sql
    else:
        sql = sys.stdin.read()
    validate_read_only_sql(sql)
    if args.dry_run:
        print("OK: read-only SQL validated", file=sys.stderr)
        return 0
    try:
        response = execute_statement(sql, wait_timeout=args.wait_timeout)
    except (ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if args.raw:
        print(json.dumps(response, indent=2, default=str))
        return 0
    if args.rows_only:
        print(json.dumps(rows_from_statement_response(response), indent=2, default=str))
        return 0
    summary = {
        "statement_id": response.get("statement_id"),
        "state": response.get("status", {}).get("state"),
        "row_count": response.get("manifest", {}).get("total_row_count"),
        "columns": [column["name"] for column in response.get("manifest", {}).get("schema", {}).get("columns", [])],
        "rows": rows_from_statement_response(response),
    }
    print(json.dumps(summary, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
