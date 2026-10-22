#!/bin/sh
# beforeShellExecution gate (data-safety kit): PII-scan agent-run `git commit`
# commands and deny `--no-verify`, which would bypass the pii_scan pre-commit
# gate. Logic lives in scan-commit.py (stdlib Python). Fails open by design.
DIR=$(dirname "$0")
if command -v py >/dev/null 2>&1; then
  PY=py
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi
exec "$PY" "$DIR/scan-commit.py"
