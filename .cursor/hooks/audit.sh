#!/bin/bash

# audit.sh - Log all hook payloads for debugging and compliance
# This hook should be attached to all events for full audit trail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
json_input=$(cat)

# Determine the event type from the JSON structure
event_type="UNKNOWN"
if echo "$json_input" | grep -q '"command"'; then
    event_type="SHELL_EXECUTION"
elif echo "$json_input" | grep -q '"file_path"'; then
    if echo "$json_input" | grep -q '"content"'; then
        event_type="FILE_READ"
    else
        event_type="FILE_EDIT"
    fi
elif echo "$json_input" | grep -q '"prompt"'; then
    event_type="PROMPT_SUBMIT"
elif echo "$json_input" | grep -q '"tool"'; then
    event_type="MCP_EXECUTION"
fi

# Log the audit entry
log_audit "$event_type" "$json_input"
log_debug "Audit logged: $event_type"

# Audit hook always allows - it's just for logging
exit 0
