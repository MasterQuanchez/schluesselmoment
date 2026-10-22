#!/bin/bash

# redact-secrets.sh - Block file reads that contain credentials or secrets
# Purpose: Prevent accidental exposure of sensitive information to the AI agent

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "redact-secrets.sh received input"

# Extract file path and content
file_path=$(json_get_file_path "$input")
content=$(json_get_content "$input")

log_debug "Checking file: '$file_path'"

# =============================================================================
# BLOCKED FILES - Always deny reading these files
# =============================================================================

# Block .env files (environment variables often contain secrets)
if [[ "$file_path" =~ \.env($|\.local$|\.production$|\.development$|\.staging$) ]]; then
    log_security "BLOCKED" "redact-secrets" "Blocked .env file read: $file_path"
    respond_deny \
        "BLOCKED: Reading .env files is not allowed to prevent credential exposure." \
        "The file '$file_path' appears to be an environment file that may contain secrets. Create a .env.example with placeholder values instead."
    exit 0
fi

# Block common credential files
if [[ "$file_path" =~ (credentials|secrets|passwords|\.key$|\.pem$|\.pfx$|\.p12$|id_rsa|id_ed25519|\.keystore$) ]]; then
    log_security "BLOCKED" "redact-secrets" "Blocked credential file read: $file_path"
    respond_deny \
        "BLOCKED: Reading credential/key files is not allowed." \
        "The file '$file_path' appears to contain credentials or cryptographic keys. These should never be exposed to AI agents."
    exit 0
fi

# Block Azure-specific config files that may contain connection strings
if [[ "$file_path" =~ (local\.settings\.json|appsettings\.(Development|Production|Staging)\.json) ]]; then
    log_security "BLOCKED" "redact-secrets" "Blocked Azure config file read: $file_path"
    respond_deny \
        "BLOCKED: Reading environment-specific config files is not allowed." \
        "The file '$file_path' may contain environment-specific secrets. Use appsettings.json with placeholder values."
    exit 0
fi

# =============================================================================
# CONTENT SCANNING - Check file content for secrets
# =============================================================================

# If we have content, scan it for secrets
if [[ -n "$content" ]]; then
    
    # GitHub tokens (ghp_, ghs_, ghu_, ghr_, github_pat_)
    if echo "$content" | grep -qE 'gh[psuro]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}'; then
        log_security "BLOCKED" "redact-secrets" "GitHub token detected in: $file_path"
        respond_deny \
            "BLOCKED: GitHub token detected in file content." \
            "The file '$file_path' contains what appears to be a GitHub token. Please remove or rotate this credential."
        exit 0
    fi
    
    # AWS credentials
    if echo "$content" | grep -qE 'AKIA[0-9A-Z]{16}|aws_secret_access_key[[:space:]]*[=:][[:space:]]*[A-Za-z0-9/+=]{40}'; then
        log_security "BLOCKED" "redact-secrets" "AWS credential detected in: $file_path"
        respond_deny \
            "BLOCKED: AWS credential detected in file content." \
            "The file '$file_path' contains what appears to be AWS credentials. Please remove or rotate these credentials."
        exit 0
    fi
    
    # Azure connection strings
    if echo "$content" | grep -qE 'DefaultEndpointsProtocol=https;AccountName=|AccountKey=[A-Za-z0-9+/=]{44,}'; then
        log_security "BLOCKED" "redact-secrets" "Azure Storage connection string detected in: $file_path"
        respond_deny \
            "BLOCKED: Azure Storage connection string detected." \
            "The file '$file_path' contains an Azure Storage connection string. Use managed identities or Key Vault references instead."
        exit 0
    fi
    
    # Azure Service Bus / Event Hub connection strings
    if echo "$content" | grep -qE 'Endpoint=sb://.*\.servicebus\.windows\.net|SharedAccessKey=[A-Za-z0-9+/=]{44,}'; then
        log_security "BLOCKED" "redact-secrets" "Azure Service Bus connection string detected in: $file_path"
        respond_deny \
            "BLOCKED: Azure Service Bus/Event Hub connection string detected." \
            "The file '$file_path' contains Azure messaging credentials. Use managed identities instead."
        exit 0
    fi
    
    # Azure SQL connection strings with password
    if echo "$content" | grep -qiE 'Server=.*\.database\.windows\.net.*Password=' || \
       echo "$content" | grep -qiE 'Data Source=.*\.database\.windows\.net.*Password='; then
        log_security "BLOCKED" "redact-secrets" "Azure SQL connection string with password detected in: $file_path"
        respond_deny \
            "BLOCKED: Azure SQL connection string with password detected." \
            "The file '$file_path' contains database credentials. Use managed identities or Key Vault references."
        exit 0
    fi
    
    # OpenAI API keys
    if echo "$content" | grep -qE 'sk-[A-Za-z0-9]{48}|sk-proj-[A-Za-z0-9_-]{48,}'; then
        log_security "BLOCKED" "redact-secrets" "OpenAI API key detected in: $file_path"
        respond_deny \
            "BLOCKED: OpenAI API key detected in file content." \
            "The file '$file_path' contains an OpenAI API key. Store API keys in environment variables or Key Vault."
        exit 0
    fi
    
    # Generic API keys and secrets (common patterns)
    if echo "$content" | grep -qiE '(api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token)[[:space:]]*[=:][[:space:]]*["\047]?[A-Za-z0-9_-]{20,}'; then
        log_security "BLOCKED" "redact-secrets" "Generic API key/secret pattern detected in: $file_path"
        respond_deny \
            "BLOCKED: API key or secret pattern detected in file content." \
            "The file '$file_path' contains what appears to be an API key or secret. Please store credentials securely."
        exit 0
    fi
    
    # Private keys
    if echo "$content" | grep -qE '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'; then
        log_security "BLOCKED" "redact-secrets" "Private key detected in: $file_path"
        respond_deny \
            "BLOCKED: Private key detected in file content." \
            "The file '$file_path' contains a private key. Private keys should never be committed or shared."
        exit 0
    fi
    
    # JWT tokens (common in config files)
    if echo "$content" | grep -qE 'eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*'; then
        log_security "BLOCKED" "redact-secrets" "JWT token detected in: $file_path"
        respond_deny \
            "BLOCKED: JWT token detected in file content." \
            "The file '$file_path' contains a JWT token. Tokens should not be hardcoded in source files."
        exit 0
    fi
    
    # Slack tokens
    if echo "$content" | grep -qE 'xox[baprs]-[A-Za-z0-9-]+'; then
        log_security "BLOCKED" "redact-secrets" "Slack token detected in: $file_path"
        respond_deny \
            "BLOCKED: Slack token detected in file content." \
            "The file '$file_path' contains a Slack token. Please store this securely."
        exit 0
    fi
    
fi

# =============================================================================
# ALLOW - No secrets detected
# =============================================================================

log_debug "No secrets detected in: $file_path"
respond_allow
