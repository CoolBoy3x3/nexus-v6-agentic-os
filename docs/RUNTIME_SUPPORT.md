# Nexus V6 — Runtime Support Guide

> This document covers the supported AI coding runtimes, how to install Nexus integrations
> for each, and runtime-specific limitations.

---

## Supported Runtimes

Nexus V6 supports four AI coding runtimes out of the box:

| Runtime | Command | Install Flag | Config Location |
|---------|---------|-------------|-----------------|
| Claude Code | `claude` | `--claude` | `~/.claude/` |
| Codex CLI | `codex` | `--codex` | `~/.codex/` |
| Gemini CLI | `gemini` | `--gemini` | `~/.gemini/` |
| OpenCode | `opencode` | `--opencode` | `~/.config/opencode/` |

All four runtimes are supported simultaneously. The same Nexus project can be worked on by any
combination of runtimes without conflict, because all state is stored in the filesystem-based
`.nexus/` directory.

---

## Installation

### Install a Single Runtime

```bash
# Claude Code
nexus install --claude

# Codex CLI
nexus install --codex

# Gemini CLI
nexus install --gemini

# OpenCode
nexus install --opencode
```

### Install All Runtimes

```bash
nexus install --all
```

### Global vs Project-Level Installation

By default, `nexus install` installs integrations globally (in the user's home directory config
folders). This means the Nexus commands and agents are available in every project for that runtime.

To install only for the current project:

```bash
nexus install --claude --local
nexus install --all --local
```

Local installation writes integration files to the project's runtime config directory (e.g.,
`.claude/` for Claude Code) instead of the global config.

### Verify Installation

```bash
nexus doctor

# Or check a specific runtime
nexus doctor --runtime claude
nexus doctor --runtime codex
```

---

## What Gets Installed — Per Runtime

### Claude Code (`--claude`)

Claude Code is the primary supported runtime. It receives the most complete integration.

**Global install paths:**
- `~/.claude/commands/` — custom slash commands for the Claude Code CLI
- `~/.claude/agents/` — sub-agent definitions for multi-agent tasks
- `~/.claude/settings.json` — updated with Nexus MCP server configuration

**Commands installed (`~/.claude/commands/`):**
- `nexus-plan.md` — invokes `nexus plan` with context from current directory
- `nexus-execute.md` — invokes `nexus execute` for the next pending wave
- `nexus-verify.md` — invokes `nexus verify` and shows the ladder output
- `nexus-unify.md` — invokes `nexus unify` after verify passes
- `nexus-status.md` — shows current task and verification status
- `nexus-rollback.md` — shows checkpoints and invokes rollback
- `nexus-doctor.md` — runs the health check
- `nexus-task.md` — reads and displays a specific task file

**Agents installed (`~/.claude/agents/`):**
- `nexus-worker.md` — worker agent definition for executing individual tasks
- `nexus-planner.md` — planner agent definition for decomposing goals
- `nexus-verifier.md` — verifier agent definition for running checks

**settings.json additions:**
```json
{
  "mcpServers": {
    "nexus": {
      "command": "nexus-mcp",
      "args": ["--stdio"]
    }
  }
}
```

**Local install paths (with `--local`):**
- `.claude/commands/` — project-scoped commands
- `.claude/agents/` — project-scoped agents

### Codex CLI (`--codex`)

**Global install paths:**
- `~/.codex/instructions/` — system instruction files
- `~/.codex/tools/` — custom tool definitions

**Instructions installed (`~/.codex/instructions/`):**
- `nexus-worker.md` — worker instructions for task execution
- `nexus-governance.md` — governance loop rules embedded as system instructions

**Tools installed (`~/.codex/tools/`):**
- `nexus-verify.json` — tool definition for physicality and goal-backward checks
- `nexus-checkpoint.json` — tool definition for creating/restoring checkpoints
- `nexus-mailbox.json` — tool definition for inter-agent messaging

**Limitations with Codex CLI:**
- Codex CLI does not support MCP servers natively. Nexus features that rely on MCP (Playwright
  integration, extended tool access) are not available.
- Multi-agent coordination is limited — the mailbox integration is available but sub-agent spawning
  must be done manually.
- The `--codex` install does not modify any global Codex settings file. Instructions and tools must
  be referenced explicitly in Codex sessions.

### Gemini CLI (`--gemini`)

**Global install paths:**
- `~/.gemini/system-prompts/` — system prompt files
- `~/.gemini/tools/` — tool definitions (if Gemini CLI supports custom tools)

**System prompts installed (`~/.gemini/system-prompts/`):**
- `nexus-worker.txt` — worker system prompt
- `nexus-laws.txt` — the 5 design laws as system prompt additions

**Limitations with Gemini CLI:**
- Gemini CLI tool support depends on the version installed. Check `gemini --version` and the
  Gemini CLI changelog for current tool support status.
- Playwright MCP integration is not available for Gemini CLI.
- Context packet consumption requires manual setup — Gemini CLI does not have native Nexus
  command integration.
- The governance loop commands (plan, execute, verify, unify) must be invoked via the `nexus` CLI
  directly; there are no Gemini CLI slash commands for these.

### OpenCode (`--opencode`)

**Global install paths:**
- `~/.config/opencode/agents/` — agent definitions
- `~/.config/opencode/skills/` — skill definitions

**Agents installed (`~/.config/opencode/agents/`):**
- `nexus-worker.yaml` — worker agent definition
- `nexus-planner.yaml` — planner agent definition

**Skills installed (`~/.config/opencode/skills/`):**
- `nexus-plan.yaml` — plan skill
- `nexus-execute.yaml` — execute skill
- `nexus-verify.yaml` — verify skill
- `nexus-unify.yaml` — unify skill
- `nexus-status.yaml` — status skill

**Limitations with OpenCode:**
- OpenCode agent and skill formats may change between versions. The Nexus installer targets
  OpenCode >= 0.3.0. Older versions may not recognize the installed files.
- MCP server support in OpenCode is experimental. Check OpenCode release notes for current status.

---

## Runtime Detection

The Nexus CLI auto-detects which runtime is currently active when commands are run from within a
runtime session. Detection logic is in `packages/nexus-cli/src/runtime-detect.ts`.

### Detection Order

1. **Environment variables** — check `NEXUS_RUNTIME` if set explicitly
2. **Process tree inspection** — check parent process names for `claude`, `codex`, `gemini`, `opencode`
3. **Active MCP server check** — if a Nexus MCP session is active, the runtime is derived from the
   MCP client
4. **Fallback** — if no runtime is detected, operations run in `standalone` mode (no runtime-specific
   features)

### Setting Runtime Explicitly

```bash
# Set for the current session
export NEXUS_RUNTIME=claude

# Set in .nexus/settings.json for the project
{
  "preferredRuntime": "claude"
}
```

### Runtime-Specific Behavior

When a runtime is detected, Nexus adjusts its behavior:

- **Claude Code**: Uses MCP tool calls for file reads/writes instead of direct filesystem access
  where possible. Sub-agents are spawned as Claude Code sub-sessions.
- **Codex CLI**: Uses direct filesystem access. All tool calls go through the Nexus CLI process.
- **Gemini CLI**: Uses direct filesystem access. Minimal runtime-specific adaptation.
- **OpenCode**: Uses the OpenCode skill invocation mechanism if available; falls back to CLI.
- **Standalone**: All operations use direct filesystem access and subprocess spawning.

---

## Runtime-Specific Configuration

### Claude Code Configuration

Claude Code reads from `~/.claude/settings.json` (global) or `.claude/settings.json` (local).
Nexus adds the following settings on install:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "nexus-mcp",
      "args": ["--stdio"],
      "env": {
        "NEXUS_PROJECT_ROOT": "${workspaceRoot}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp-server"],
      "env": {}
    }
  },
  "permissions": {
    "allow": [
      "Bash(nexus *)",
      "Bash(pnpm *)",
      "Bash(git *)"
    ]
  }
}
```

### Playwright MCP with Claude Code

For Playwright MCP to work with Claude Code, the `playwright.mcpPath` must be set in the project's
Nexus settings:

```json
// .nexus/settings.json
{
  "playwright": {
    "mcpPath": "@playwright/mcp-server",
    "enabled": true,
    "passThreshold": 3
  }
}
```

See `docs/PLAYWRIGHT_MCP.md` for the full Playwright configuration guide.

---

## Checking Runtime Status

### nexus doctor Output

```
$ nexus doctor

Nexus V6 Health Check
=====================

Runtime: claude (detected via process tree)

[PASS] .nexus/ directory exists
[PASS] MISSION.md present
[PASS] PRD.md present
[PASS] ACCEPTANCE_MASTER.md present
[PASS] ROADMAP.md present
[PASS] modules.json valid (schema check)
[PASS] api_contracts.json valid (schema check)
[PASS] files.json present (last updated: 2026-02-28T14:00:00Z)
[PASS] test_map.json present
[WARN] hashes.json not found — run nexus build-index to generate
[PASS] Claude Code commands installed (~/.claude/commands/)
[PASS] Claude Code agents installed (~/.claude/agents/)
[PASS] MCP server nexus responding
[PASS] MCP server playwright responding

2 warnings, 0 errors
```

### Runtime-Specific Doctor Checks

| Check | Claude | Codex | Gemini | OpenCode |
|-------|--------|-------|--------|----------|
| Commands installed | Yes | N/A | N/A | N/A |
| Agents installed | Yes | N/A | N/A | Yes |
| Skills installed | N/A | N/A | N/A | Yes |
| Instructions installed | N/A | Yes | Yes | N/A |
| MCP server responding | Yes | No | No | Experimental |
| Playwright MCP available | Yes | No | No | Experimental |

---

## Updating Runtime Integrations

When Nexus is updated to a new version, re-run the install command to update integration files:

```bash
# Update all runtime integrations
nexus install --all

# Update a specific runtime
nexus install --claude
```

The install command is idempotent — running it multiple times is safe. It overwrites existing
integration files with the latest versions.

### Checking for Stale Integrations

```bash
nexus doctor --check-versions
```

This command compares the installed integration file versions against the current Nexus version and
warns if they are out of sync.
