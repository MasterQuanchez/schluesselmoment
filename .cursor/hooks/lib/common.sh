#!/bin/bash

# common.sh - Shared utilities for Cursor hooks (Windows-compatible, no jq dependency)

# =============================================================================
# LOGGING SETUP
# =============================================================================

# Windows-compatible log directory using $USERPROFILE
if [[ -n "$USERPROFILE" ]]; then
    # Windows (Git Bash) - convert backslashes to forward slashes
    LOG_DIR="${USERPROFILE//\\//}/.cursor/logs"
else
    # Fallback for Unix-like systems
    LOG_DIR="$HOME/.cursor/logs"
fi

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log file paths
AUDIT_LOG="$LOG_DIR/agent-audit.log"
HOOKS_LOG="$LOG_DIR/hooks-debug.log"
SECURITY_LOG="$LOG_DIR/security-events.log"

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================

# Get ISO 8601 timestamp
get_timestamp() {
    date '+%Y-%m-%dT%H:%M:%S%z'
}

# Log to debug file
log_debug() {
    local message="$1"
    echo "[$(get_timestamp)] [DEBUG] $message" >> "$HOOKS_LOG"
}

# Log to audit file
log_audit() {
    local event_type="$1"
    local payload="$2"
    echo "[$(get_timestamp)] [$event_type] $payload" >> "$AUDIT_LOG"
}

# Log security event
log_security() {
    local severity="$1"  # BLOCKED, WARNING, ALLOWED
    local hook_name="$2"
    local details="$3"
    echo "[$(get_timestamp)] [$severity] [$hook_name] $details" >> "$SECURITY_LOG"
}

# =============================================================================
# JSON PARSING (Pure Bash - no jq required)
# =============================================================================

# Extract a simple string value from JSON using grep/sed
# Usage: json_get_string "$json" "fieldname"
# Works for: {"fieldname": "value"} or {"fieldname":"value"}
json_get_string() {
    local json="$1"
    local field="$2"
    # Match "field": "value" or "field":"value" and extract value
    echo "$json" | grep -oE "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/' | head -1
}

# Extract the command field specifically (handles special characters better)
# Usage: json_get_command "$json"
json_get_command() {
    local json="$1"
    # Extract command value, handling escaped quotes
    echo "$json" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/"command"[[:space:]]*:[[:space:]]*"(.*)"/\1/' | head -1
}

# Extract file_path field
json_get_file_path() {
    local json="$1"
    echo "$json" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/"file_path"[[:space:]]*:[[:space:]]*"(.*)"/\1/' | head -1
}

# Extract content field (for file reads - may be multiline, get first 1000 chars)
json_get_content() {
    local json="$1"
    # This is a simplified extraction - works for basic cases
    echo "$json" | grep -oE '"content"[[:space:]]*:[[:space:]]*"[^"]{0,1000}' | sed -E 's/"content"[[:space:]]*:[[:space:]]*"//' | head -1
}

# =============================================================================
# RESPONSE GENERATORS
# =============================================================================

# Generate ALLOW response
respond_allow() {
    cat <<'EOF'
{
  "continue": true,
  "permission": "allow"
}
EOF
}

# Generate DENY response with messages
respond_deny() {
    local user_message="$1"
    local agent_message="$2"
    cat <<EOF
{
  "continue": true,
  "permission": "deny",
  "user_message": "$user_message",
  "agent_message": "$agent_message"
}
EOF
}

# Generate ASK response (requires user approval)
respond_ask() {
    local user_message="$1"
    local agent_message="$2"
    cat <<EOF
{
  "continue": true,
  "permission": "ask",
  "user_message": "$user_message",
  "agent_message": "$agent_message"
}
EOF
}

# =============================================================================
# PATTERN MATCHING HELPERS
# =============================================================================

# Check if command matches any pattern in a list
# Usage: matches_any "$command" "pattern1|pattern2|pattern3"
matches_any() {
    local text="$1"
    local patterns="$2"
    echo "$text" | grep -qiE "$patterns"
}

# Check if text contains potential secrets
contains_secrets() {
    local text="$1"
    # Common secret patterns
    local patterns=(
        'gh[ps]_[A-Za-z0-9]{36}'                    # GitHub tokens
        'gh_api_[A-Za-z0-9]+'                       # GitHub API tokens
        'AKIA[0-9A-Z]{16}'                          # AWS Access Key ID
        'DefaultEndpointsProtocol=https;'          # Azure Storage connection string
        'AccountKey=[A-Za-z0-9+/=]{44,}'           # Azure Storage account key
        'SharedAccessSignature='                    # Azure SAS token
        'Password=[^;]+'                           # Generic password in connection string
        'api[_-]?key[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_-]{20,}' # API keys
        'secret[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_-]{20,}'      # Secrets
        'Bearer [A-Za-z0-9_-]{20,}'                # Bearer tokens
        'sk-[A-Za-z0-9]{48}'                       # OpenAI API keys
        'xox[baprs]-[A-Za-z0-9-]+'                 # Slack tokens
    )
    
    for pattern in "${patterns[@]}"; do
        if echo "$text" | grep -qE "$pattern"; then
            return 0  # Found a secret
        fi
    done
    return 1  # No secrets found
}

