#!/bin/bash

# format.sh - Post-edit formatting hook
# Purpose: Run code formatters after file edits to maintain consistent style

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)

# Log the edit event for audit
log_audit "FILE_EDIT" "$input"

# Extract file path
file_path=$(json_get_file_path "$input")

# Only format known file types
# For now: log and allow through — add formatter invocations as the team adopts them
# Example future additions:
#   - python: black, ruff format
#   - javascript/typescript: prettier
#   - shell: shfmt
#
# To enable formatting, uncomment and adjust the block below:
#
# if [[ "$file_path" == *.py ]]; then
#     # Run ruff format on the edited file
#     ruff format "$file_path" 2>/dev/null || true
# fi
#
# if [[ "$file_path" == *.ts || "$file_path" == *.tsx || "$file_path" == *.js || "$file_path" == *.jsx ]]; then
#     # Run prettier on the edited file
#     npx prettier --write "$file_path" 2>/dev/null || true
# fi

log_debug "format.sh: file edit logged for $file_path"
exit 0