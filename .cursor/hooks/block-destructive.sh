#!/bin/bash

# block-destructive.sh - Block dangerous/destructive shell commands
# Purpose: Prevent accidental data loss from YOLO mode operations

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-destructive.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for case-insensitive matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# DANGEROUS PATTERNS - These are BLOCKED completely
# =============================================================================

# Pattern: rm -rf / or rm -rf /* (catastrophic)
if [[ "$command_lower" =~ rm[[:space:]]+-[a-z]*r[a-z]*f[[:space:]]+[/\\] ]] || \
   [[ "$command_lower" =~ rm[[:space:]]+-[a-z]*f[a-z]*r[[:space:]]+[/\\] ]]; then
    log_security "BLOCKED" "block-destructive" "Catastrophic rm command blocked: $command"
    respond_deny \
        "BLOCKED: Catastrophic delete command detected. This could delete critical system files." \
        "This rm command targets root or system directories and has been blocked for safety. Never run rm -rf on root paths."
    exit 0
fi

# Pattern: Windows format command
if [[ "$command_lower" =~ ^[[:space:]]*format[[:space:]] ]]; then
    log_security "BLOCKED" "block-destructive" "Format command blocked: $command"
    respond_deny \
        "BLOCKED: Disk format command detected." \
        "The format command has been blocked. This command can cause irreversible data loss."
    exit 0
fi

# Pattern: Windows del /s /q on root or system paths
if [[ "$command_lower" =~ del[[:space:]]+.*(/s|/q).*[[:space:]][a-z]:[/\\]$ ]] || \
   [[ "$command_lower" =~ del[[:space:]]+.*(/s|/q).*[[:space:]][/\\]$ ]]; then
    log_security "BLOCKED" "block-destructive" "Catastrophic del command blocked: $command"
    respond_deny \
        "BLOCKED: Catastrophic delete command detected on root path." \
        "This del command targets root directories and has been blocked for safety."
    exit 0
fi

# Pattern: rmdir /s /q on dangerous paths
if [[ "$command_lower" =~ rmdir[[:space:]]+.*(/s|/q).*[[:space:]][a-z]:[/\\]$ ]] || \
   [[ "$command_lower" =~ rmdir[[:space:]]+.*(/s|/q).*[[:space:]][/\\]windows ]] || \
   [[ "$command_lower" =~ rmdir[[:space:]]+.*(/s|/q).*[[:space:]][/\\]system ]]; then
    log_security "BLOCKED" "block-destructive" "Catastrophic rmdir command blocked: $command"
    respond_deny \
        "BLOCKED: Dangerous rmdir command detected." \
        "This rmdir command targets critical directories and has been blocked for safety."
    exit 0
fi

# Pattern: chmod 777 (security risk)
if [[ "$command_lower" =~ chmod[[:space:]]+777 ]]; then
    log_security "BLOCKED" "block-destructive" "chmod 777 blocked: $command"
    respond_deny \
        "BLOCKED: chmod 777 is a security risk." \
        "Setting permissions to 777 makes files world-writable and is a security vulnerability. Use more restrictive permissions."
    exit 0
fi

# Pattern: mkfs (filesystem creation - destructive)
if [[ "$command_lower" =~ ^[[:space:]]*mkfs ]]; then
    log_security "BLOCKED" "block-destructive" "mkfs command blocked: $command"
    respond_deny \
        "BLOCKED: Filesystem creation command detected." \
        "The mkfs command can destroy all data on a partition. This has been blocked for safety."
    exit 0
fi

# Pattern: dd with of=/dev (direct disk write)
if [[ "$command_lower" =~ dd[[:space:]]+.*of=/dev ]]; then
    log_security "BLOCKED" "block-destructive" "dd to device blocked: $command"
    respond_deny \
        "BLOCKED: Direct disk write command detected." \
        "Writing directly to device files with dd can cause irreversible data loss. This has been blocked."
    exit 0
fi

# =============================================================================
# WARNING PATTERNS - These require user confirmation
# =============================================================================

# Pattern: rm -rf (not on root, but still dangerous)
if [[ "$command_lower" =~ rm[[:space:]]+-[a-z]*r[a-z]*f ]] || \
   [[ "$command_lower" =~ rm[[:space:]]+-[a-z]*f[a-z]*r ]]; then
    log_security "WARNING" "block-destructive" "rm -rf requires confirmation: $command"
    respond_ask \
        "⚠️ Recursive force delete detected. Please confirm: $command" \
        "This rm command uses recursive force delete (-rf). Please verify the target path is correct before approving."
    exit 0
fi

# Pattern: del with /s (recursive delete in Windows)
if [[ "$command_lower" =~ del[[:space:]]+.*/s ]]; then
    log_security "WARNING" "block-destructive" "del /s requires confirmation: $command"
    respond_ask \
        "⚠️ Recursive delete detected. Please confirm: $command" \
        "This del command will recursively delete files. Please verify the target path is correct."
    exit 0
fi

# Pattern: rmdir /s (recursive directory removal)
if [[ "$command_lower" =~ rmdir[[:space:]]+.*/s ]]; then
    log_security "WARNING" "block-destructive" "rmdir /s requires confirmation: $command"
    respond_ask \
        "⚠️ Recursive directory removal detected. Please confirm: $command" \
        "This rmdir command will recursively remove directories. Please verify the target path."
    exit 0
fi

# Pattern: truncate (file truncation)
if [[ "$command_lower" =~ ^[[:space:]]*truncate[[:space:]] ]]; then
    log_security "WARNING" "block-destructive" "truncate requires confirmation: $command"
    respond_ask \
        "⚠️ File truncation detected. Please confirm: $command" \
        "The truncate command will modify file size, potentially causing data loss. Please confirm."
    exit 0
fi

# Pattern: shred (secure file deletion)
if [[ "$command_lower" =~ ^[[:space:]]*shred[[:space:]] ]]; then
    log_security "WARNING" "block-destructive" "shred requires confirmation: $command"
    respond_ask \
        "⚠️ Secure file deletion detected. Please confirm: $command" \
        "The shred command will permanently and irrecoverably delete files. Please confirm."
    exit 0
fi

# Allow all other commands
log_debug "Command allowed: $command"
respond_allow

