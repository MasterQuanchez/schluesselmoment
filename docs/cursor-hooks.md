# Cursor Agent Hooks - Security Configuration

This document describes the security hooks implemented for the Cursor AI agent to protect developers and vibe-coders from accidental damage when using automatic/YOLO mode.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Model](#security-model)
4. [Hook Reference](#hook-reference)
5. [Setup Instructions](#setup-instructions)
6. [Testing](#testing)
7. [Audit Logging](#audit-logging)
8. [Known Limitations](#known-limitations)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What are Cursor Hooks?

Cursor hooks are scripts that intercept AI agent actions before they execute. They provide a security layer that can:

- **ALLOW** - Let the action proceed automatically
- **ASK** - Require explicit user confirmation
- **DENY** - Block the action entirely

### Why Do We Need Them?

When developers use Cursor's agent in automatic mode (YOLO mode), the AI can execute shell commands, read files, and make changes without manual approval. This creates risks:

| Risk Category | Example | Impact |
|--------------|---------|--------|
| Data Loss | `rm -rf /` | Catastrophic |
| Cloud Damage | `az group delete` | Service outage |
| Credential Exposure | Reading `.env` files | Security breach |
| Database Corruption | `DROP DATABASE` | Data loss |

Our hooks mitigate these risks while maintaining developer productivity.

### ⚠️ Important Limitation

**Hooks only intercept Agent-initiated actions, not direct tool calls.**

According to the [Cursor hooks documentation](https://cursor.com/docs/agent/hooks), hooks intercept:
- Shell commands that **the Cursor Agent decides to execute**
- File reads/edits that **the Cursor Agent performs**
- MCP tool calls made by **the Cursor Agent**

**What hooks DO protect:**
- ✅ Commands the Agent generates and executes (e.g., when Agent decides to run `cat .env`)
- ✅ File operations the Agent performs
- ✅ MCP tools the Agent invokes

**What hooks DO NOT protect:**
- ❌ Direct tool calls made by AI assistants (e.g., `run_terminal_cmd` tool)
- ❌ User-initiated terminal commands in the IDE
- ❌ Manual file operations

**Example scenario:**
- If Cursor Agent decides to run `cat .env`, the hook will block it ✅
- If the AI uses `run_terminal_cmd` to run `cat .env`, the hook is bypassed ❌

**Security implication:** While hooks provide a valuable security layer for agent-initiated actions, they should not be relied upon as the sole protection mechanism. Additional safeguards like `.cursorignore`, file system permissions, and code review remain essential.

**Status:** This limitation has been documented for follow-up with Cursor to understand if this is intended behavior or if hooks should also intercept direct tool calls.

---

## Architecture

```
.cursor/
├── hooks.json              # Hook configuration (which hooks run when)
└── hooks/
    ├── lib/
    │   └── common.sh       # Shared utilities (logging, JSON parsing)
    ├── audit.sh            # Logs all events for compliance
    ├── block-secret-reads.sh # Blocks shell commands reading sensitive files
    ├── block-network.sh    # Blocks data exfiltration via curl/wget/nc/scp
    ├── block-publish.sh    # Blocks package publishing (npm, twine, docker push)
    ├── block-git.sh        # Controls Git/GitHub operations
    ├── block-destructive.sh # Blocks dangerous file operations
    ├── block-azure-cli.sh  # Controls Azure cloud operations
    ├── block-database.sh   # Blocks dangerous SQL operations
    ├── redact-secrets.sh   # Prevents credential exposure via file reads
    └── format.sh           # Post-edit formatting (passthrough)
```

### Hook Execution Flow

```mermaid
flowchart LR
    A[Agent Action] --> B[Hooks Check]
    B --> C{Decision}
    C -->|🚫 deny| D[Blocked]
    C -->|⚠️ ask| E[User Confirms]
    C -->|✅ allow| F[Executed]
    E -->|Approve| F
    E -->|Reject| D
    B --> G[📝 Audit Log]
    
    style D fill:#ffcccc
    style E fill:#fff4cc
    style F fill:#ccffcc
    style G fill:#cce5ff
```

### Windows Compatibility

All hooks are written in bash and designed to work with Git Bash on Windows:

- **JSON** - JSON parsing uses native bash
- **Windows-compatible paths** - Logs stored in `$USERPROFILE/.cursor/logs/`
- **Works with Git Bash** - Shell configured as `C:\Program Files\Git\bin\bash.exe`

---

## Security Model

### Permission Levels

| Permission | Icon | User Experience | Use Case |
|------------|------|-----------------|----------|
| `allow` | ✅ | Silent, automatic | Safe operations |
| `ask` | ⚠️ | Popup confirmation | Risky but valid operations |
| `deny` | 🚫 | Blocked with message | Dangerous operations |

### Defense in Depth

Our hooks implement multiple layers of protection:

1. **Command Blocking** - Catastrophic commands are denied entirely
2. **Approval Gates** - Risky commands require user confirmation
3. **Secret Detection** - Credentials cannot be read by the agent (via both file reads and shell commands)
4. **Audit Trail** - All actions are logged for review

**Note:** Hooks intercept Agent-initiated actions only. They do not intercept direct tool calls (e.g., `run_terminal_cmd`). See [Known Limitations](#known-limitations) for details.

---

## Hook Reference

### 1. audit.sh

**Purpose:** Log all agent actions for compliance and debugging.

**Triggers:** All events (shell, file read, file edit, MCP, prompts)

**Behavior:** Always allows; writes to audit log only.

**Log Location:** `$USERPROFILE/.cursor/logs/agent-audit.log`

---

### 2. block-git.sh

**Purpose:** Allow normal git workflow but protect against dangerous operations.

**Triggers:** `beforeShellExecution`

| Category | Command | Risk/Reason/Examples |
|----------|---------|---------------------|
| 🚫 **BLOCKED** | `git push --force origin main/master` | Destroys shared history on protected branch |
| 🚫 **BLOCKED** | `git reset --hard origin/main` | Loses local commits |
| ⚠️ **ASK** | `git push --force` (feature branches) | Rewrites remote history |
| ⚠️ **ASK** | `git reset --hard` | Discards uncommitted changes |
| ⚠️ **ASK** | `git clean -fd` | Deletes untracked files permanently |
| ⚠️ **ASK** | `git rebase` | Rewrites commit history |
| ⚠️ **ASK** | `git push origin main/master` | Direct push to protected branch |
| ⚠️ **ASK** | `git branch -D` | Force deletes branch with unmerged changes |
| ⚠️ **ASK** | `git stash drop/clear` | Permanently deletes stashed changes |
| ✅ **ALLOW** | Read operations | `git status`, `git log`, `git diff`, `git show` |
| ✅ **ALLOW** | Staging | `git add`, `git restore` |
| ✅ **ALLOW** | Committing | `git commit` |
| ✅ **ALLOW** | Branching | `git branch`, `git checkout -b`, `git switch` |
| ✅ **ALLOW** | Fetching | `git fetch`, `git pull` |
| ✅ **ALLOW** | Pushing (feature) | `git push origin feature-branch` |

**Rationale:** Normal git workflow is allowed; only operations that could cause data loss or affect shared branches require confirmation.

---

### 3. block-destructive.sh

**Purpose:** Prevent catastrophic file/system deletion.

**Triggers:** `beforeShellExecution`

| Category | Command | Risk/Reason/Examples |
|----------|---------|---------------------|
| 🚫 **BLOCKED** | `rm -rf /` | System destruction |
| 🚫 **BLOCKED** | `rm -rf /*` | System destruction |
| 🚫 **BLOCKED** | `format C:` | Disk wipe |
| 🚫 **BLOCKED** | `chmod 777 /etc` | Security vulnerability |
| 🚫 **BLOCKED** | `mkfs.ext4 /dev/sda` | Data destruction |
| 🚫 **BLOCKED** | `dd if=x of=/dev/sda` | Disk overwrite |
| ⚠️ **ASK** | `rm -rf ./node_modules` | Data loss (relative path) |
| ⚠️ **ASK** | `del /s /q temp` | Recursive delete |
| ⚠️ **ASK** | `rmdir /s /q build` | Directory removal |
| ⚠️ **ASK** | `truncate -s 0 file` | Data loss |
| ⚠️ **ASK** | `shred file` | Secure file deletion (irrecoverable) |
| ✅ **ALLOW** | `rm file.txt` | Single file deletion |
| ✅ **ALLOW** | `mkdir -p ./new_dir` | Directory creation |
| ✅ **ALLOW** | `cp -r src dest` | File copy operations |

---

### 4. block-azure-cli.sh

**Purpose:** Prevent accidental cloud infrastructure damage.

**Triggers:** `beforeShellExecution`

| Category | Command | Risk/Reason/Examples |
|----------|---------|---------------------|
| 🚫 **BLOCKED** | `az group delete` | Deletes entire resource group |
| 🚫 **BLOCKED** | `az storage account delete` | Data loss |
| 🚫 **BLOCKED** | `az keyvault delete` | Secret exposure |
| 🚫 **BLOCKED** | `az sql server delete` | Database destruction |
| 🚫 **BLOCKED** | `az sql db delete` | Database destruction |
| 🚫 **BLOCKED** | `az vm delete` | Service disruption |
| 🚫 **BLOCKED** | `az aks delete` | Kubernetes cluster loss |
| 🚫 **BLOCKED** | `az ad app create/delete` | IAM changes |
| 🚫 **BLOCKED** | `az ad sp create/delete` | Service principal changes |
| 🚫 **BLOCKED** | `az ad user create/delete` | User account changes |
| 🚫 **BLOCKED** | `az role assignment create/delete` | RBAC changes |
| ⚠️ **ASK** | `az deployment group` | Infrastructure changes |
| ⚠️ **ASK** | `az webapp config` | Configuration changes |
| ⚠️ **ASK** | `az account show` | Cloud interaction |
| ⚠️ **ASK** | `az webapp list` | Cloud interaction |
| ⚠️ **ASK** | All other `az` commands | Cloud interaction |
| ✅ **ALLOW** | `npm install` | Non-Azure commands |
| ✅ **ALLOW** | `python script.py` | Non-Azure commands |

---

### 5. block-database.sh

**Purpose:** Prevent destructive database operations.

**Triggers:** `beforeShellExecution`

| Category | Command | Risk/Reason/Examples |
|----------|---------|---------------------|
| 🚫 **BLOCKED** | `DROP DATABASE` | Complete data loss |
| 🚫 **BLOCKED** | `DROP SCHEMA` | Multi-table loss |
| 🚫 **BLOCKED** | `TRUNCATE TABLE` | All rows deleted |
| 🚫 **BLOCKED** | `DELETE FROM users` (no WHERE) | All rows deleted |
| 🚫 **BLOCKED** | `UPDATE users SET` (no WHERE) | All rows modified |
| 🚫 **BLOCKED** | `GRANT ALL ON *.*` | Permission changes |
| 🚫 **BLOCKED** | `REVOKE SELECT` | Permission changes |
| 🚫 **BLOCKED** | `DROP USER/ROLE` | Access changes |
| ⚠️ **ASK** | `DROP TABLE temp_table` | Single table deletion |
| ⚠️ **ASK** | `DROP INDEX idx_name` | Performance impact |
| ⚠️ **ASK** | `ALTER TABLE users ADD COLUMN` | Schema changes |
| ⚠️ **ASK** | `DELETE FROM logs WHERE created_at < date` | Data modification |
| ⚠️ **ASK** | `sqlcmd`, `psql`, `mysql` with mutations | Database CLI with data changes |
| ✅ **ALLOW** | `SELECT * FROM users` | Read operations |
| ✅ **ALLOW** | `INSERT INTO logs VALUES` | Insert operations |

---

### 6. block-secret-reads.sh

**Purpose:** Prevent AI agent from bypassing file read protections via shell commands.

**Triggers:** `beforeShellExecution`

| Category | Command/Pattern | Risk/Reason/Examples |
|----------|------------------|---------------------|
| 🚫 **BLOCKED** | `cat .env`, `type .env`, `Get-Content .env` | Reading environment files via shell |
| 🚫 **BLOCKED** | `cat id_rsa`, `cat server.key` | Reading credential/key files via shell |
| 🚫 **BLOCKED** | `cat local.settings.json` | Reading Azure config files via shell |
| 🚫 **BLOCKED** | `grep PASSWORD .env`, `findstr .env` | Searching sensitive files |
| 🚫 **BLOCKED** | `vim .env`, `code .env`, `notepad .env` | Opening sensitive files with editors |
| 🚫 **BLOCKED** | `python script.py < .env` | Input redirection from sensitive files |
| ✅ **ALLOW** | `cat README.md` | Reading safe files |
| ✅ **ALLOW** | `grep TODO src/app.py` | Searching source code files |
| ✅ **ALLOW** | `cat .env.example` | Reading example/template files |

**Rationale:** This hook closes a security gap where AI agents could bypass `redact-secrets.sh` (which only blocks the `read_file` tool) by using shell commands like `cat .env`. It runs early in the `beforeShellExecution` chain to catch these attempts before other hooks process them.

---

### 7. redact-secrets.sh

**Purpose:** Prevent the AI agent from reading sensitive files via the file read tool.

**Triggers:** `beforeReadFile`

| Category | Command/Pattern | Risk/Reason/Examples |
|----------|------------------|---------------------|
| 🚫 **BLOCKED** | `.env*` files | `.env`, `.env.local`, `.env.production` |
| 🚫 **BLOCKED** | Credential files | `credentials`, `secrets`, `passwords` |
| 🚫 **BLOCKED** | Key files | `*.key`, `*.pem`, `*.pfx`, `id_rsa`, `id_ed25519` |
| 🚫 **BLOCKED** | Azure configs | `local.settings.json`, `appsettings.Production.json` |
| 🚫 **BLOCKED** | GitHub tokens in content | `ghp_*`, `ghs_*`, `github_pat_*` |
| 🚫 **BLOCKED** | AWS credentials in content | `AKIA*`, `aws_secret_access_key` |
| 🚫 **BLOCKED** | Azure connection strings | `DefaultEndpointsProtocol=https;AccountName=`, `AccountKey=*` |
| 🚫 **BLOCKED** | Azure Service Bus strings | `Endpoint=sb://*.servicebus.windows.net`, `SharedAccessKey=*` |
| 🚫 **BLOCKED** | Azure SQL with password | `Server=*.database.windows.net.*Password=` |
| 🚫 **BLOCKED** | OpenAI API keys | `sk-*` (48+ characters) |
| 🚫 **BLOCKED** | Private keys in content | `-----BEGIN PRIVATE KEY-----` |
| 🚫 **BLOCKED** | JWT tokens | `eyJ*.eyJ*.*` pattern |
| 🚫 **BLOCKED** | Slack tokens | `xox[baprs]-*` |
| 🚫 **BLOCKED** | Generic API keys | `api_key=`, `api_secret=`, `auth_token=` patterns |
| ✅ **ALLOW** | `README.md` | Documentation files |
| ✅ **ALLOW** | `src/app.py` | Source code files |
| ✅ **ALLOW** | `.env.example` | Example/template files |

---

### 8. block-network.sh

**Purpose:** Block network egress commands that could exfiltrate workspace data.

**Triggers:** `beforeShellExecution`

| Category | Command/Pattern | Risk/Reason/Examples |
|----------|------------------|---------------------|
| 🚫 **BLOCKED** | `curl -X POST -d @file URL` | Data exfiltration via HTTP POST |
| 🚫 **BLOCKED** | `curl --data / --data-raw / --data-binary` | Sending data payloads |
| 🚫 **BLOCKED** | `nc / ncat / netcat` | Arbitrary network connections |
| 🚫 **BLOCKED** | `scp / rsync / sftp` | File transfer to remote hosts |
| 🚫 **BLOCKED** | `ssh user@host -- command` | Remote command execution |
| 🚫 **BLOCKED** | Pipe to curl: `cat file \| curl -X POST` | Data exfiltration via pipe |
| ⚠️ **ASK** | `curl` to non-standard ports (8443, 9090, etc.) | Suspicious network activity |
| ⚠️ **ASK** | `python -m http.server` | Exposing files via HTTP server |
| ✅ **ALLOW** | `curl https://api.example.com` (GET) | Safe read-only requests |
| ✅ **ALLOW** | `wget https://example.com/file` | Safe downloads |
| ✅ **ALLOW** | `npm install / uv sync / pip install` | Package installation |

### 9. block-publish.sh

**Purpose:** Prevent accidental publication of internal code to public registries.

**Triggers:** `beforeShellExecution`

| Category | Command/Pattern | Risk/Reason/Examples |
|----------|------------------|---------------------|
| 🚫 **BLOCKED** | `npm publish` | Publishing to npm registry |
| 🚫 **BLOCKED** | `pnpm publish / yarn publish` | Publishing via alternative package managers |
| 🚫 **BLOCKED** | `twine upload / uv publish` | Publishing to PyPI |
| 🚫 **BLOCKED** | `setup.py upload` | Legacy Python publishing |
| 🚫 **BLOCKED** | `docker push` | Pushing images to registries |
| 🚫 **BLOCKED** | `docker buildx --push` | Building and pushing images |
| 🚫 **BLOCKED** | `az acr push / import / upload` | Pushing to Azure Container Registry |
| 🚫 **BLOCKED** | `dotnet nuget push` | Publishing NuGet packages |
| ✅ **ALLOW** | `npm install / uv sync` | Installing dependencies |
| ✅ **ALLOW** | `docker build / docker pull` | Local image operations |

### 10. format.sh

**Purpose:** Post-edit formatting hook. Currently a passthrough that logs edits for audit.

**Triggers:** `afterFileEdit`

To enable auto-formatting, uncomment the relevant sections in `format.sh`:
- Python: `ruff format`
- JavaScript/TypeScript: `prettier`
- Shell: `shfmt`

## Setup Instructions

### For Developers (Project-Level)

1. **Verify Git Bash is installed:**
   ```bash
   which bash
   # Should show: /usr/bin/bash or /c/Program Files/Git/usr/bin/bash
   ```

2. **Ensure hooks are executable:**
   ```bash
   cd .cursor/hooks
   chmod +x *.sh lib/*.sh
   ```

3. **Test the setup:**
   ```bash
   cd tests/hooks
   bash run_tests.sh
   ```

4. **Configure Cursor:**
   - Open Cursor Settings → Features → Agent
   - Ensure "Enable hooks" is checked
   - The `.cursor/hooks.json` file configures which hooks run

### For All Users (User-Level Installation — Recommended)

Project-level hooks only protect the current repo. For consistent protection across **all repositories**, install hooks at the user level.

1. **Copy hooks to user directory:**
   ```bash
   # From the ai-first-dis repo root
   mkdir -p ~/.cursor/hooks/lib
   cp .cursor/hooks.json ~/.cursor/hooks.json
   cp .cursor/hooks/*.sh ~/.cursor/hooks/
   cp .cursor/hooks/lib/*.sh ~/.cursor/hooks/lib/
   chmod +x ~/.cursor/hooks/*.sh ~/.cursor/hooks/lib/*.sh
   ```

2. **Verify installation:**
   ```bash
   ls ~/.cursor/hooks.json ~/.cursor/hooks/
   ```

3. **Test:**
   Open any repo in Cursor, enable Agent mode, and try a blocked command like `cat .env`.

> **Why user-level?** Non-coders (PMs, Digital Advisors, Managers) may open multiple repos or create ad-hoc projects. User-level hooks ensure they're always protected, regardless of which repo they're working in.

### For Infra/Security Team

1. **Audit Log Location:**
   ```
   Windows: %USERPROFILE%\.cursor\logs\
   Unix:    ~/.cursor/logs/
   ```

2. **Log Files:**
   - `agent-audit.log` - All agent actions
   - `security-events.log` - Security decisions (BLOCKED, WARNING, ALLOWED)
   - `hooks-debug.log` - Debug information

3. **Log Format:**
   ```
   [2024-12-05T10:30:45+0000] [BLOCKED] [block-azure-cli] az group delete --name production
   ```

---

## Testing

### Running Tests

```bash
# Run all tests
bash tests/hooks/run_tests.sh

# Run specific hook tests
bash tests/hooks/run_tests.sh block-git
bash tests/hooks/run_tests.sh block-azure-cli
bash tests/hooks/run_tests.sh block-secret-reads
bash tests/hooks/run_tests.sh redact-secrets
```
---

## Audit Logging

### Log Viewing Commands

Set the log directory variable for easy access:

```bash
LOG_DIR="$USERPROFILE/.cursor/logs"
```

#### Quick Views

```bash
# View recent security events (last 20)
tail -20 "$LOG_DIR/security-events.log"

# View all audit entries (last 20)
tail -20 "$LOG_DIR/agent-audit.log"

# View debug logs (last 20)
tail -20 "$LOG_DIR/hooks-debug.log"
```

#### Filtered Views

```bash
# Show only BLOCKED events
grep "\[BLOCKED\]" "$LOG_DIR/security-events.log" | tail -20

# Show only WARNING events (ASK confirmations)
grep "\[WARNING\]" "$LOG_DIR/security-events.log" | tail -20

# Show events from a specific hook
grep "\[block-git\]" "$LOG_DIR/security-events.log" | tail -20
grep "\[block-azure-cli\]" "$LOG_DIR/security-events.log" | tail -20
grep "\[block-secret-reads\]" "$LOG_DIR/security-events.log" | tail -20
grep "\[redact-secrets\]" "$LOG_DIR/security-events.log" | tail -20

# Show events from today only
grep "$(date '+%Y-%m-%d')" "$LOG_DIR/security-events.log"
```

#### Statistics

```bash
# Count blocked vs warning events
echo "BLOCKED: $(grep -c '\[BLOCKED\]' "$LOG_DIR/security-events.log")"
echo "WARNING: $(grep -c '\[WARNING\]' "$LOG_DIR/security-events.log")"

# Count events by hook type
grep -o "\[.*\] \[.*\]" "$LOG_DIR/security-events.log" | sort | uniq -c | sort -rn

# Count events by date
grep -o "^\[[0-9-]*" "$LOG_DIR/security-events.log" | sort | uniq -c
```

#### Live Monitoring

```bash
# Watch security events in real-time (Ctrl+C to stop)
tail -f "$LOG_DIR/security-events.log"

# Watch all logs in real-time
tail -f "$LOG_DIR"/*.log
```

#### Search & Analysis

```bash
# Search for specific command patterns
grep "git push" "$LOG_DIR/security-events.log"
grep "az " "$LOG_DIR/security-events.log"
grep "rm -rf" "$LOG_DIR/security-events.log"

# Search for specific file patterns
grep "\.env" "$LOG_DIR/security-events.log"
grep "credentials" "$LOG_DIR/security-events.log"
```

#### Quick Dashboard

```bash
# One-liner dashboard with summary and recent events
LOG_DIR="$USERPROFILE/.cursor/logs" && \
echo "=== Cursor Hooks Dashboard ===" && \
echo "BLOCKED: $(grep -c '\[BLOCKED\]' "$LOG_DIR/security-events.log")" && \
echo "WARNING: $(grep -c '\[WARNING\]' "$LOG_DIR/security-events.log")" && \
echo "" && \
echo "=== Recent Events ===" && \
tail -5 "$LOG_DIR/security-events.log"
```

#### Export & Reporting

```bash
# Export blocked events to a file
grep "\[BLOCKED\]" "$LOG_DIR/security-events.log" > blocked-events-$(date +%Y%m%d).txt

# Export today's events
grep "$(date '+%Y-%m-%d')" "$LOG_DIR/security-events.log" > today-events.txt
```

---

## Known Limitations

### Hooks Don't Intercept Direct Tool Calls

**Issue:** Hooks successfully block Agent-initiated commands but do not intercept direct tool calls made by AI assistants.

**Evidence:**
```bash
# Check security logs
tail -20 "$USERPROFILE/.cursor/logs/security-events.log"

# You'll see entries like:
[2025-12-05T19:41:56+0100] [BLOCKED] [block-secret-reads] Blocked shell command reading .env file: cat .env
```

The hook executes and returns a `deny` permission, but direct tool calls bypass this entirely.

**Test Results:**
- ✅ Hook code is correct and functional (manual tests confirm it blocks `cat .env`)
- ✅ Hook configuration is correct in `hooks.json`
- ✅ Hook returns proper JSON format with `user_message` and `agent_message`
- ✅ Hook successfully blocks Agent-initiated `cat .env` commands
- ❌ Hook does NOT intercept direct `run_terminal_cmd` tool calls

**Workarounds:**
1. Use `.cursorignore` to prevent file read tools from accessing sensitive files
2. Set file system permissions to restrict access
3. Rely on code review and manual oversight
4. Use environment variables stored outside the workspace

**Follow-up:** This limitation should be clarified with Cursor to determine if:
- This is intended behavior (hooks only for Agent, not direct tools)
- This is a gap that should be addressed in future versions
- There's an alternative configuration to intercept tool calls

---

## Troubleshooting

### Hooks Not Running

1. **Check hooks.json exists:**
   ```bash
   cat .cursor/hooks.json
   ```

2. **Check hooks are executable:**
   ```bash
   ls -la .cursor/hooks/
   ```

3. **Check Cursor settings:**
   - Settings → Features → Agent → "Enable hooks"

### Permission Errors

```bash
# Fix permissions on Windows (Git Bash)
chmod +x .cursor/hooks/*.sh
chmod +x .cursor/hooks/lib/*.sh
```

### Debug Mode

Add debug output to any hook:
```bash
echo "DEBUG: $variable" >> "$HOOKS_LOG"
```

Check debug logs:
```bash
cat ~/.cursor/logs/hooks-debug.log
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Logs not appearing | Check `$USERPROFILE/.cursor/logs/` directory exists |
| Hook blocking too much | Check the specific hook's patterns |
| Hook not intercepting commands | Verify commands are Agent-initiated, not direct tool calls (see Known Limitations) |
| Wrong JSON format | Use `user_message` and `agent_message` (underscores), not camelCase |
| Hook not blocking enough | Add patterns to the relevant hook |

---

## Appendix: Adding Custom Hooks

### Hook Input Format

Hooks receive JSON on stdin:

**Shell execution:**
```json
{"command": "npm install express"}
```

**File read:**
```json
{"file_path": "src/app.py", "content": "...file content..."}
```

### Hook Output Format

```json
{
  "continue": true,
  "permission": "allow|ask|deny",
  "userMessage": "Message shown to user (optional)",
  "agentMessage": "Message sent to agent (optional)"
}
```

### Creating a New Hook

1. Create the script in `.cursor/hooks/`:
   ```bash
   #!/bin/bash
   source "$(dirname "$0")/lib/common.sh"
   
   input=$(cat)
   command=$(json_get_command "$input")
   
   if [[ "$command" =~ dangerous_pattern ]]; then
       respond_deny "Blocked for safety" "This command was blocked."
       exit 0
   fi
   
   respond_allow
   ```

2. Add to `.cursor/hooks.json`:
   ```json
   {
     "beforeShellExecution": [
       { "command": "./hooks/my-new-hook.sh" }
     ]
   }
   ```

3. Add tests in `tests/hooks/run_tests.sh`

---

*Last updated: December 2024*

