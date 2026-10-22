#!/bin/bash

# block-azure-cli.sh - Control Azure CLI command execution
# Purpose: Prevent accidental cloud infrastructure changes in YOLO mode

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-azure-cli.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# BLOCKED PATTERNS - Dangerous Azure operations
# =============================================================================

# Pattern: az group delete (resource group deletion)
if [[ "$command_lower" =~ az[[:space:]]+group[[:space:]]+delete ]]; then
    log_security "BLOCKED" "block-azure-cli" "Resource group deletion blocked: $command"
    respond_deny \
        "BLOCKED: Azure resource group deletion is not allowed via agent." \
        "Deleting Azure resource groups can cause catastrophic data loss. Please perform this operation manually through the Azure Portal or with proper approval workflows."
    exit 0
fi

# Pattern: az storage account delete
if [[ "$command_lower" =~ az[[:space:]]+storage[[:space:]]+account[[:space:]]+delete ]]; then
    log_security "BLOCKED" "block-azure-cli" "Storage account deletion blocked: $command"
    respond_deny \
        "BLOCKED: Azure storage account deletion is not allowed via agent." \
        "Deleting storage accounts can cause irreversible data loss. Please perform this operation manually with proper approval."
    exit 0
fi

# Pattern: az keyvault delete
if [[ "$command_lower" =~ az[[:space:]]+keyvault[[:space:]]+delete ]]; then
    log_security "BLOCKED" "block-azure-cli" "Key vault deletion blocked: $command"
    respond_deny \
        "BLOCKED: Azure Key Vault deletion is not allowed via agent." \
        "Deleting Key Vaults can expose secrets and cause service outages. Please perform this operation manually."
    exit 0
fi

# Pattern: az sql server delete / az sql db delete
if [[ "$command_lower" =~ az[[:space:]]+sql[[:space:]]+(server|db)[[:space:]]+delete ]]; then
    log_security "BLOCKED" "block-azure-cli" "SQL deletion blocked: $command"
    respond_deny \
        "BLOCKED: Azure SQL deletion is not allowed via agent." \
        "Deleting SQL servers or databases can cause catastrophic data loss. Please perform this operation manually."
    exit 0
fi

# Pattern: az vm delete
if [[ "$command_lower" =~ az[[:space:]]+vm[[:space:]]+delete ]]; then
    log_security "BLOCKED" "block-azure-cli" "VM deletion blocked: $command"
    respond_deny \
        "BLOCKED: Azure VM deletion is not allowed via agent." \
        "Deleting virtual machines should be done through proper change management processes."
    exit 0
fi

# Pattern: az aks delete (Kubernetes cluster)
if [[ "$command_lower" =~ az[[:space:]]+aks[[:space:]]+delete ]]; then
    log_security "BLOCKED" "block-azure-cli" "AKS cluster deletion blocked: $command"
    respond_deny \
        "BLOCKED: Azure Kubernetes cluster deletion is not allowed via agent." \
        "Deleting AKS clusters can cause major service outages. Please use proper change management."
    exit 0
fi

# Pattern: az ad (Active Directory operations)
if [[ "$command_lower" =~ az[[:space:]]+ad[[:space:]]+(app|sp|user|group)[[:space:]]+(delete|create|update) ]]; then
    log_security "BLOCKED" "block-azure-cli" "Azure AD modification blocked: $command"
    respond_deny \
        "BLOCKED: Azure AD modifications are not allowed via agent." \
        "Active Directory changes can affect authentication and authorization across the organization. Please use proper IAM workflows."
    exit 0
fi

# Pattern: az role assignment (RBAC changes)
if [[ "$command_lower" =~ az[[:space:]]+role[[:space:]]+assignment[[:space:]]+(create|delete) ]]; then
    log_security "BLOCKED" "block-azure-cli" "RBAC modification blocked: $command"
    respond_deny \
        "BLOCKED: Azure RBAC changes are not allowed via agent." \
        "Role assignment changes can grant or revoke critical permissions. Please use proper IAM workflows."
    exit 0
fi

# =============================================================================
# WARNING PATTERNS - Require user confirmation
# =============================================================================

# =============================================================================
# READ-ONLY AZURE COMMANDS - Allowed without confirmation
# =============================================================================

# Pattern: az read-only commands (show, list, get, query, validate, check)
# These are safe: they don't modify resources
if [[ "$command_lower" =~ ^[[:space:]]*az[[:space:]]+[a-z]+[[:space:]]+(show|list|get|query|validate|check|browse|export) ]]; then
    log_debug "Azure read-only command allowed: $command"
    log_security "ALLOWED" "block-azure-cli" "Azure read-only command: $command"
    respond_allow
    exit 0
fi

# Pattern: az account show, az group list, az resource list (common reads)
if [[ "$command_lower" =~ ^[[:space:]]*az[[:space:]]+(account|group|resource|tag|policy|term)[[:space:]]+(show|list) ]]; then
    log_debug "Azure account/resource read command allowed: $command"
    log_security "ALLOWED" "block-azure-cli" "Azure read-only command: $command"
    respond_allow
    exit 0
fi

# Pattern: az --version, az help (informational)
if [[ "$command_lower" =~ ^[[:space:]]*az[[:space:]]+--(version|help) ]] || \
   [[ "$command_lower" =~ ^[[:space:]]*az[[:space:]]+help ]]; then
    log_debug "Azure help/version command allowed: $command"
    respond_allow
    exit 0
fi

# =============================================================================
# WARNING - Azure commands requiring confirmation
# =============================================================================

# Pattern: az deployment (infrastructure deployment)
if [[ "$command_lower" =~ az[[:space:]]+deployment[[:space:]]+(group|sub) ]]; then
    log_security "WARNING" "block-azure-cli" "Deployment requires confirmation: $command"
    respond_ask \
        "⚠️ Azure deployment detected. Please confirm: $command" \
        "This command will deploy Azure resources. Please verify the deployment parameters are correct."
    exit 0
fi

# Pattern: az webapp/functionapp config (app configuration changes)
if [[ "$command_lower" =~ az[[:space:]]+(webapp|functionapp)[[:space:]]+config ]]; then
    log_security "WARNING" "block-azure-cli" "App config change requires confirmation: $command"
    respond_ask \
        "⚠️ Azure app configuration change detected. Please confirm: $command" \
        "This command will modify application configuration. Please verify the changes are intended."
    exit 0
fi

# Pattern: Any other az command (general Azure CLI usage)
if [[ "$command_lower" =~ ^[[:space:]]*az[[:space:]] ]]; then
    log_security "WARNING" "block-azure-cli" "Azure CLI command requires confirmation: $command"
    respond_ask \
        "⚠️ Azure CLI command detected. Please confirm: $command" \
        "This command will interact with Azure cloud resources. Please review and confirm."
    exit 0
fi

# Allow all other commands
log_debug "Command allowed: $command"
respond_allow

