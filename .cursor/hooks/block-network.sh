#!/bin/bash

# block-network.sh - Block network egress commands that could exfiltrate data
# Purpose: Prevent AI agents from sending workspace data to external endpoints

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-network.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# BLOCKED - Network egress with data payloads
# =============================================================================

# Pattern: curl/wget with POST/PUT/PATCH data to external URLs
# Allow: curl/wget to known safe domains (package registries, internal APIs)
if [[ "$command_lower" =~ (curl|wget)[[:space:]] ]]; then
    # Block POST/PUT/PATCH with data payloads (data exfiltration risk)
    if [[ "$command_lower" =~ (curl|wget).*(-x[[:space:]]*(post|put|patch)|--request[[:space:]]*(post|put|patch)|-d[[:space:]]|--data|data-binary|--data-raw|--form|-f[[:space:]]d|---data-urlencode) ]]; then
        log_security "BLOCKED" "block-network" "Network upload command blocked: $command"
        respond_deny \
            "BLOCKED: Sending data to external endpoints is not allowed." \
            "The command '$command' attempts to send data to an external endpoint, which could exfiltrate workspace content. If you need to download packages, use 'npm install' or 'uv sync' instead."
        exit 0
    fi

    # Block piping file contents to network
    if echo "$command" | grep -qE '(\|[[:space:]]*curl|\|[[:space:]]*wget|<[[:space:]]*.*\b(curl|wget))'; then
        log_security "BLOCKED" "block-network" "Pipe to network command blocked: $command"
        respond_deny \
            "BLOCKED: Piping data to network commands is not allowed." \
            "The command '$command' pipes file contents to a network command, which could exfiltrate data."
        exit 0
    fi

    # Block curl/wget to suspicious patterns (internal IPs for recon, unusual ports)
    if [[ "$command_lower" =~ (curl|wget).*:(8443|9090|5000|3000|8080|8888)[[:space:]/] ]]; then
        log_security "WARNING" "block-network" "Network request to unusual port requires confirmation: $command"
        respond_ask \
            "⚠️ Network request to non-standard port detected. Confirm: $command" \
            "This command accesses a non-standard port. Please verify this is intentional."
        exit 0
    fi
fi

# Pattern: nc (netcat) with connection attempts
if [[ "$command_lower" =~ ^[[:space:]]*nc[[:space:]] ]] || \
   [[ "$command_lower" =~ ^[[:space:]]*ncat[[:space:]] ]] || \
   [[ "$command_lower" =~ ^[[:space:]]*netcat[[:space:]] ]]; then
    log_security "BLOCKED" "block-network" "Netcat command blocked: $command"
    respond_deny \
        "BLOCKED: Netcat commands are not allowed." \
        "Netcat can establish arbitrary network connections and transfer data. Use proper HTTP clients or package managers instead."
    exit 0
fi

# Pattern: scp/sftp/ftp data transfer
if [[ "$command_lower" =~ ^[[:space:]]*(scp|sftp|ftp|rsync)[[:space:]] ]]; then
    log_security "BLOCKED" "block-network" "File transfer command blocked: $command"
    respond_deny \
        "BLOCKED: File transfer commands are not allowed." \
        "The command '$command' transfers files to/from a remote host. Use git push/pull for code synchronization instead."
    exit 0
fi

# Pattern: ssh with remote command execution
if [[ "$command_lower" =~ ^[[:space:]]*ssh[[:space:]] ]] && [[ "$command_lower" =~ --[[:space:]] ]]; then
    log_security "BLOCKED" "block-network" "SSH remote command blocked: $command"
    respond_deny \
        "BLOCKED: SSH with remote commands is not allowed." \
        "The command '$command' executes commands on a remote host via SSH. This could be used to exfiltrate data."
    exit 0
fi

# Pattern: Python/Node HTTP servers (data exfiltration via serving files)
if [[ "$command_lower" =~ python[[:space:]].*http\.server ]] || \
   [[ "$command_lower" =~ python[[:space:]].*SimpleHTTPServer ]] || \
   [[ "$command_lower" =~ npx[[:space:]]+http-server ]]; then
    log_security "WARNING" "block-network" "HTTP server startup requires confirmation: $command"
    respond_ask \
        "⚠️ Starting an HTTP server. Confirm: $command" \
        "Starting an HTTP server exposes workspace files on the network. Only start if you have a specific reason."
    exit 0
fi

# =============================================================================
# ALLOW - Safe network operations
# =============================================================================

# curl/wget GET requests (package downloads, API queries) are allowed
# npm install, uv sync, pip install are allowed
# git operations are handled by block-git.sh

log_debug "Command allowed: $command"
respond_allow