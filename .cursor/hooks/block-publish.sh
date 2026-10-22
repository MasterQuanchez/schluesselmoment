#!/bin/bash

# block-publish.sh - Block package publishing commands
# Purpose: Prevent accidental publication of internal code to public registries

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Read the JSON input from stdin
input=$(cat)
log_debug "block-publish.sh received input"

# Extract the command
command=$(json_get_command "$input")
log_debug "Parsed command: '$command'"

# Convert to lowercase for matching
command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# BLOCKED - Package publishing to public registries
# =============================================================================

# Pattern: npm publish
if [[ "$command_lower" =~ npm[[:space:]]+publish ]]; then
    log_security "BLOCKED" "block-publish" "npm publish blocked: $command"
    respond_deny \
        "BLOCKED: Publishing packages to npm is not allowed." \
        "The command '$command' would publish a package to the npm registry. This could expose internal code publicly. Use private registries or remove this command."
    exit 0
fi

# Pattern: pnpm publish
if [[ "$command_lower" =~ pnpm[[:space:]]+publish ]]; then
    log_security "BLOCKED" "block-publish" "pnpm publish blocked: $command"
    respond_deny \
        "BLOCKED: Publishing packages via pnpm is not allowed." \
        "The command '$command' would publish a package. This could expose internal code publicly."
    exit 0
fi

# Pattern: yarn publish
if [[ "$command_lower" =~ yarn[[:space:]]+publish ]]; then
    log_security "BLOCKED" "block-publish" "yarn publish blocked: $command"
    respond_deny \
        "BLOCKED: Publishing packages via yarn is not allowed." \
        "The command '$command' would publish a package. This could expose internal code publicly."
    exit 0
fi

# Pattern: twine upload (Python PyPI)
if [[ "$command_lower" =~ twine[[:space:]]+upload ]]; then
    log_security "BLOCKED" "block-publish" "twine upload blocked: $command"
    respond_deny \
        "BLOCKED: Publishing packages to PyPI is not allowed." \
        "The command '$command' would upload a package to PyPI. This could expose internal code publicly."
    exit 0
fi

# Pattern: python setup.py sdist upload
if [[ "$command_lower" =~ setup\.py.*upload ]]; then
    log_security "BLOCKED" "block-publish" "setup.py upload blocked: $command"
    respond_deny \
        "BLOCKED: Publishing packages via setup.py is not allowed." \
        "The command '$command' would upload a package. This could expose internal code publicly."
    exit 0
fi

# Pattern: uv publish (Python packaging)
if [[ "$command_lower" =~ uv[[:space:]]+publish ]]; then
    log_security "BLOCKED" "block-publish" "uv publish blocked: $command"
    respond_deny \
        "BLOCKED: Publishing packages via uv is not allowed." \
        "The command '$command' would publish a package. This could expose internal code publicly."
    exit 0
fi

# Pattern: docker push
if [[ "$command_lower" =~ docker[[:space:]]+push ]]; then
    log_security "BLOCKED" "block-publish" "docker push blocked: $command"
    respond_deny \
        "BLOCKED: Pushing Docker images is not allowed." \
        "The command '$command' would push a Docker image to a registry. This could expose internal images or code. Use an internal registry with proper access controls."
    exit 0
fi

# Pattern: docker build with --push (buildx)
if [[ "$command_lower" =~ docker[[:space:]]+buildx.*--push ]]; then
    log_security "BLOCKED" "block-publish" "docker buildx push blocked: $command"
    respond_deny \
        "BLOCKED: Building and pushing Docker images is not allowed." \
        "The command '$command' would build and push a Docker image. This could expose internal code."
    exit 0
fi

# Pattern: az acr push (Azure Container Registry)
if [[ "$command_lower" =~ az[[:space:]]+acr[[:space:]]+(push|import|upload) ]]; then
    log_security "BLOCKED" "block-publish" "ACR push blocked: $command"
    respond_deny \
        "BLOCKED: Pushing to Azure Container Registry is not allowed via agent." \
        "The command '$command' would push a container image. Use CI/CD pipelines for container publishing."
    exit 0
fi

# Pattern: dotnet nuget push
if [[ "$command_lower" =~ dotnet[[:space:]]+nuget[[:space:]]+push ]]; then
    log_security "BLOCKED" "block-publish" "NuGet push blocked: $command"
    respond_deny \
        "BLOCKED: Publishing NuGet packages is not allowed." \
        "The command '$command' would publish a NuGet package. This could expose internal code publicly."
    exit 0
fi

# =============================================================================
# ALLOW - Safe package operations
# =============================================================================

# npm install, pip install, uv sync, docker build (local), docker pull are all allowed

log_debug "Command allowed: $command"
respond_allow