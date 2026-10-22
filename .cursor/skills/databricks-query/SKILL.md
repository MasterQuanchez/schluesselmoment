---
name: databricks-query
description: Run read-only SQL via `.cursor/skills/databricks-query/sql_runner.py` against the configured warehouse. Use for live data, catalog/schema discovery, table listing, or JSON SQL results. Prefer Databricks MCP when credentials are already configured there and the task is exploratory.
---

# Warehouse SQL Query

All scripted warehouse access goes through `.cursor/skills/databricks-query/sql_runner.py`.
The script POSTs to the Databricks SQL Statements API, validates read-only SQL,
normalizes the workspace host, polls until completion, and prints JSON.

## Credentials

| Variable | Purpose |
|---|---|
| `DATABRICKS_HOST` | Workspace URL |
| `DATABRICKS_TOKEN` | Personal access token or OAuth token |
| `DATABRICKS_WAREHOUSE_ID` | SQL warehouse ID |

Set these in the process environment or in a gitignored `.env`.

## Commands

```bash
python .cursor/skills/databricks-query/sql_runner.py --dry-run "SELECT 1 AS one"
python .cursor/skills/databricks-query/sql_runner.py --rows-only "SELECT 1 AS one"
```

Allowed statement shapes: `SELECT`, `SHOW`, `DESCRIBE` / `DESC`, `EXPLAIN`,
and `WITH` leading into those. Do not run mutating SQL.
