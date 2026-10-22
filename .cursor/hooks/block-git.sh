#!/bin/bash

# block-git.sh - Control Git command execution
# Purpose: Allow git commands but require approval for dangerous operations

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-git.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# BLOCKED - Extremely dangerous git operations
# =============================================================================

# Pattern: Force push to main/master (can destroy shared history)
if [[ "$command_lower" =~ git[[:space:]]+push[[:space:]].*--force ]] || \
   [[ "$command_lower" =~ git[[:space:]]+push[[:space:]].*-f[[:space:]] ]]; then
    if [[ "$command_lower" =~ (main|master|develop|production) ]]; then
        log_security "BLOCKED" "block-git" "Force push to protected branch blocked: $command"
        respond_deny \
            "BLOCKED: Force push to protected branch (main/master/develop/production) is not allowed." \
            "Force pushing to protected branches can destroy shared history and cause data loss. Use a PR workflow instead."
        exit 0
    fi
fi

# Pattern: git reset --hard on remote tracking branches
if [[ "$command_lower" =~ git[[:space:]]+reset[[:space:]]+--hard[[:space:]]+origin/ ]]; then
    log_security "BLOCKED" "block-git" "Hard reset to remote blocked: $command"
    respond_deny \
        "BLOCKED: Hard reset to remote branch is dangerous." \
        "This command can cause loss of local commits. Please use 'git stash' first or create a backup branch."
    exit 0
fi

# =============================================================================
# WARNING - Risky operations requiring confirmation
# =============================================================================

# Pattern: Any force push (not to protected branches)
if [[ "$command_lower" =~ git[[:space:]]+push[[:space:]].*--force ]] || \
   [[ "$command_lower" =~ git[[:space:]]+push[[:space:]].*-f ]]; then
    log_security "WARNING" "block-git" "Force push requires confirmation: $command"
    respond_ask \
        "⚠️ Force push detected. This can overwrite remote history. Confirm: $command" \
        "Force push will overwrite commits on the remote. Make sure this is intentional."
    exit 0
fi

# Pattern: git reset --hard (can lose uncommitted changes)
if [[ "$command_lower" =~ git[[:space:]]+reset[[:space:]]+--hard ]]; then
    log_security "WARNING" "block-git" "Hard reset requires confirmation: $command"
    respond_ask \
        "⚠️ Hard reset will discard uncommitted changes. Confirm: $command" \
        "This will discard all uncommitted changes. Consider 'git stash' first."
    exit 0
fi

# Pattern: git clean -fd (removes untracked files)
if [[ "$command_lower" =~ git[[:space:]]+clean[[:space:]]+-[a-z]*f ]]; then
    log_security "WARNING" "block-git" "Git clean requires confirmation: $command"
    respond_ask \
        "⚠️ Git clean will permanently delete untracked files. Confirm: $command" \
        "This will remove untracked files that cannot be recovered. Please verify."
    exit 0
fi

# Pattern: git checkout/switch with --force (discards local changes)
if [[ "$command_lower" =~ git[[:space:]]+(checkout|switch)[[:space:]].*--force ]] || \
   [[ "$command_lower" =~ git[[:space:]]+(checkout|switch)[[:space:]].*-f[[:space:]] ]]; then
    log_security "WARNING" "block-git" "Forced checkout requires confirmation: $command"
    respond_ask \
        "⚠️ Forced checkout will discard local changes. Confirm: $command" \
        "This will discard uncommitted changes when switching branches."
    exit 0
fi

# Pattern: git rebase (can rewrite history)
if [[ "$command_lower" =~ git[[:space:]]+rebase ]]; then
    log_security "WARNING" "block-git" "Rebase requires confirmation: $command"
    respond_ask \
        "⚠️ Rebase rewrites commit history. Confirm: $command" \
        "Rebasing changes commit history. Avoid rebasing commits that have been pushed to shared branches."
    exit 0
fi

# Pattern: git push to main/master/develop/production (even without force)
if [[ "$command_lower" =~ git[[:space:]]+push[[:space:]] ]] && \
   [[ "$command_lower" =~ (main|master|develop|production) ]]; then
    log_security "WARNING" "block-git" "Push to protected branch requires confirmation: $command"
    respond_ask \
        "⚠️ Pushing to protected branch. Confirm: $command" \
        "You're pushing directly to a protected branch. Consider using a PR workflow."
    exit 0
fi

# Pattern: git branch -D (force delete branch) - check original case, not lowercase
if [[ "$command" =~ git[[:space:]]+branch[[:space:]]+-D ]]; then
    log_security "WARNING" "block-git" "Force branch delete requires confirmation: $command"
    respond_ask \
        "⚠️ Force deleting a branch. Confirm: $command" \
        "This will delete the branch even if it has unmerged changes."
    exit 0
fi

# Pattern: git stash drop/clear (loses stashed changes)
if [[ "$command_lower" =~ git[[:space:]]+stash[[:space:]]+(drop|clear) ]]; then
    log_security "WARNING" "block-git" "Stash drop/clear requires confirmation: $command"
    respond_ask \
        "⚠️ This will permanently delete stashed changes. Confirm: $command" \
        "Dropped or cleared stashes cannot be recovered."
    exit 0
fi

# =============================================================================
# ALLOW - Safe git operations
# =============================================================================

# All other git commands are allowed (status, log, diff, add, commit, pull, fetch, etc.)
if [[ "$command_lower" =~ ^[[:space:]]*git[[:space:]] ]]; then
    log_debug "Git command allowed: $command"
    respond_allow
    exit 0
fi

# Non-git commands pass through
log_debug "Non-git command allowed: $command"
respond_allow
