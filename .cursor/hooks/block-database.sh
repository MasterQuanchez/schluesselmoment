#!/bin/bash

# block-database.sh - Block dangerous database operations
# Purpose: Prevent accidental data loss from destructive SQL commands

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-database.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# BLOCKED PATTERNS - Catastrophic database operations
# =============================================================================

# Pattern: DROP DATABASE
if [[ "$command_lower" =~ drop[[:space:]]+database ]]; then
    log_security "BLOCKED" "block-database" "DROP DATABASE blocked: $command"
    respond_deny \
        "BLOCKED: DROP DATABASE command is not allowed via agent." \
        "Dropping databases causes irreversible data loss. Please perform this operation manually through proper change management."
    exit 0
fi

# Pattern: DROP SCHEMA
if [[ "$command_lower" =~ drop[[:space:]]+schema ]]; then
    log_security "BLOCKED" "block-database" "DROP SCHEMA blocked: $command"
    respond_deny \
        "BLOCKED: DROP SCHEMA command is not allowed via agent." \
        "Dropping schemas can delete multiple tables and data. Please perform this operation manually."
    exit 0
fi

# Pattern: TRUNCATE TABLE (faster than DELETE, no transaction log)
if [[ "$command_lower" =~ truncate[[:space:]]+table ]]; then
    log_security "BLOCKED" "block-database" "TRUNCATE TABLE blocked: $command"
    respond_deny \
        "BLOCKED: TRUNCATE TABLE command is not allowed via agent." \
        "TRUNCATE removes all data from a table without logging individual row deletions. Please use DELETE with proper WHERE clause or perform manually."
    exit 0
fi

# Pattern: DELETE without WHERE clause (mass deletion)
if [[ "$command_lower" =~ delete[[:space:]]+from[[:space:]]+[a-z_]+ ]] && \
   ! [[ "$command_lower" =~ where ]]; then
    log_security "BLOCKED" "block-database" "DELETE without WHERE blocked: $command"
    respond_deny \
        "BLOCKED: DELETE without WHERE clause is not allowed." \
        "DELETE without a WHERE clause will remove ALL rows from the table. Please add a WHERE clause to specify which rows to delete."
    exit 0
fi

# Pattern: UPDATE without WHERE clause (mass update)
if [[ "$command_lower" =~ update[[:space:]]+[a-z_]+[[:space:]]+set ]] && \
   ! [[ "$command_lower" =~ where ]]; then
    log_security "BLOCKED" "block-database" "UPDATE without WHERE blocked: $command"
    respond_deny \
        "BLOCKED: UPDATE without WHERE clause is not allowed." \
        "UPDATE without a WHERE clause will modify ALL rows in the table. Please add a WHERE clause to specify which rows to update."
    exit 0
fi

# Pattern: DROP USER / DROP ROLE (security-critical)
if [[ "$command_lower" =~ drop[[:space:]]+(user|role|login) ]]; then
    log_security "BLOCKED" "block-database" "DROP USER/ROLE blocked: $command"
    respond_deny \
        "BLOCKED: Dropping database users/roles is not allowed via agent." \
        "Dropping users or roles can affect application access. Please perform this through proper IAM workflows."
    exit 0
fi

# Pattern: GRANT / REVOKE (permission changes)
if [[ "$command_lower" =~ ^[[:space:]]*(grant|revoke)[[:space:]] ]]; then
    log_security "BLOCKED" "block-database" "GRANT/REVOKE blocked: $command"
    respond_deny \
        "BLOCKED: Database permission changes are not allowed via agent." \
        "GRANT and REVOKE commands affect database security. Please manage permissions through proper IAM workflows."
    exit 0
fi

# =============================================================================
# WARNING PATTERNS - Require user confirmation
# =============================================================================

# Pattern: DROP TABLE
if [[ "$command_lower" =~ drop[[:space:]]+table ]]; then
    log_security "WARNING" "block-database" "DROP TABLE requires confirmation: $command"
    respond_ask \
        "⚠️ DROP TABLE detected. This will permanently delete the table and all its data. Confirm: $command" \
        "This command will drop a database table. Please verify this is the correct table and you have backups."
    exit 0
fi

# Pattern: DROP INDEX
if [[ "$command_lower" =~ drop[[:space:]]+index ]]; then
    log_security "WARNING" "block-database" "DROP INDEX requires confirmation: $command"
    respond_ask \
        "⚠️ DROP INDEX detected. This may affect query performance. Confirm: $command" \
        "Dropping indexes can significantly impact query performance. Please confirm this is intended."
    exit 0
fi

# Pattern: ALTER TABLE (structural changes)
if [[ "$command_lower" =~ alter[[:space:]]+table ]]; then
    log_security "WARNING" "block-database" "ALTER TABLE requires confirmation: $command"
    respond_ask \
        "⚠️ ALTER TABLE detected. Please confirm structural change: $command" \
        "This command will modify table structure. Please verify the changes are correct and won't break existing queries."
    exit 0
fi

# Pattern: DELETE with WHERE (safer, but still needs confirmation)
if [[ "$command_lower" =~ delete[[:space:]]+from ]] && [[ "$command_lower" =~ where ]]; then
    log_security "WARNING" "block-database" "DELETE requires confirmation: $command"
    respond_ask \
        "⚠️ DELETE statement detected. Please confirm: $command" \
        "This DELETE command will remove data. Please verify the WHERE clause is correct."
    exit 0
fi

# Pattern: Database CLI tools (sqlcmd, psql, mysql, etc.)
if [[ "$command_lower" =~ ^[[:space:]]*(sqlcmd|psql|mysql|sqlite3|mongosh|mongo)[[:space:]] ]]; then
    # Check if it contains dangerous operations
    if [[ "$command_lower" =~ (drop|truncate|delete|update) ]]; then
        log_security "WARNING" "block-database" "Database CLI with mutation requires confirmation: $command"
        respond_ask \
            "⚠️ Database CLI command with potential data modification detected. Please confirm: $command" \
            "This database command may modify data. Please review carefully."
        exit 0
    fi
fi

# Allow all other commands
log_debug "Command allowed: $command"
respond_allow

