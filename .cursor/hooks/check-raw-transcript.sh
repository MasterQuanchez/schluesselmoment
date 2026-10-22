#!/bin/sh
# beforeSubmitPrompt gate (data-safety kit): block prompts that attach or
# reference a raw, un-redacted meeting transcript and point to the local
# redaction pre-pass. Logic lives in check-raw-transcript.py (stdlib Python).
# Add "[allow-raw]" to a prompt to override. Fails open by design.
DIR=$(dirname "$0")
if command -v py >/dev/null 2>&1; then
  PY=py
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi
exec "$PY" "$DIR/check-raw-transcript.py"
