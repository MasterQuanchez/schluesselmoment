#!/bin/bash

# block-secret-reads.sh - Block shell commands that read sensitive files
# Purpose: Prevent AI agent from bypassing file read protections via shell commands

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-secret-reads.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for case-insensitive matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# BLOCKED - Commands that read sensitive files
# =============================================================================

# Pattern: cat/type/Get-Content on .env files
if [[ "$command" =~ (cat|type|Get-Content|gc)[[:space:]]+.*\.env($|[[:space:]]) ]] || \
   [[ "$command" =~ (cat|type|Get-Content|gc)[[:space:]]+.*\.env\.(local|production|development|staging) ]]; then
    log_security "BLOCKED" "block-secret-reads" "Blocked shell command reading .env file: $command"
    respond_deny \
        "BLOCKED: Reading .env files via shell commands is not allowed." \
        "The command '$command' attempts to read an environment file that may contain secrets. Use .env.example with placeholder values instead."
    exit 0
fi

# Pattern: cat/type/Get-Content on credential files
if [[ "$command" =~ (cat|type|Get-Content|gc)[[:space:]]+.*(credentials|secrets|passwords|\.key$|\.pem$|\.pfx$|\.p12$|id_rsa|id_ed25519|\.keystore) ]]; then
    log_security "BLOCKED" "block-secret-reads" "Blocked shell command reading credential file: $command"
    respond_deny \
        "BLOCKED: Reading credential/key files via shell commands is not allowed." \
        "The command '$command' attempts to read a file that contains credentials or cryptographic keys. These should never be exposed to AI agents."
    exit 0
fi

# Pattern: cat/type/Get-Content on Azure config files
if [[ "$command" =~ (cat|type|Get-Content|gc)[[:space:]]+.*(local\.settings\.json|appsettings\.(Development|Production|Staging)\.json) ]]; then
    log_security "BLOCKED" "block-secret-reads" "Blocked shell command reading Azure config file: $command"
    respond_deny \
        "BLOCKED: Reading environment-specific config files via shell commands is not allowed." \
        "The command '$command' attempts to read an Azure config file that may contain environment-specific secrets."
    exit 0
fi

# Pattern: grep/search operations on .env files
if [[ "$command" =~ (grep|findstr|Select-String)[[:space:]]+.*\.env ]]; then
    log_security "BLOCKED" "block-secret-reads" "Blocked shell command searching .env file: $command"
    respond_deny \
        "BLOCKED: Searching .env files via shell commands is not allowed." \
        "The command '$command' attempts to search an environment file that may contain secrets."
    exit 0
fi

# Pattern: less/more/view on sensitive files
if [[ "$command" =~ (less|more|view|vim|vi|nano|code|notepad)[[:space:]]+.*(\.env|credentials|secrets|passwords|\.key$|\.pem$) ]]; then
    log_security "BLOCKED" "block-secret-reads" "Blocked shell command viewing sensitive file: $command"
    respond_deny \
        "BLOCKED: Viewing sensitive files via shell commands is not allowed." \
        "The command '$command' attempts to open a file that may contain secrets."
    exit 0
fi

# Pattern: redirect from sensitive files (< .env)
if echo "$command" | grep -qE '<[[:space:]]*.*\.env' || \
   echo "$command" | grep -qE '<[[:space:]]*.*(credentials|secrets|passwords|\.key|\.pem)'; then
    log_security "BLOCKED" "block-secret-reads" "Blocked shell command redirecting from sensitive file: $command"
    respond_deny \
        "BLOCKED: Redirecting input from sensitive files is not allowed." \
        "The command '$command' attempts to read from a file that may contain secrets via input redirection."
    exit 0
fi

# =============================================================================
# ALLOW - No sensitive file reads detected
# =============================================================================

log_debug "No sensitive file reads detected in: $command"
respond_allow

