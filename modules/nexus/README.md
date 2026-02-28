# modules/nexus

This directory contains the **AI runtime module** for Nexus V6 — the files that get installed into your AI runtime (Claude Code, Codex, Gemini, OpenCode) to give it the Nexus autonomous governance loop.

**The pipeline is autonomous by default.** Run `/nexus:plan` — the system chains plan→execute→verify→unify without further commands. Use `/nexus:progress` at session start to orient and resume.

These are plain Markdown files. They are not compiled. The `nexus install` command copies them to the appropriate locations for your runtime.

---

## Contents

### `CLAUDE.md`

The agent firmware. Loaded by Claude Code as project memory. Contains:
- 5 immutable design laws
- Command routing rules (which agent handles which `/nexus:*` command)
- Autonomy levels and risk tier definitions
- TDD mode logic (hard/standard/skip)
- Physicality rules and pre-completion checklist
- Recovery rules and 3-consecutive-failures escalation
- Playwright usage rules
- Architecture integrity rules
- Context packing rules
- Handoff and resume rules

### `commands/nexus/` — 12 slash commands

Installed to `~/.claude/commands/nexus/` (or runtime equivalent). Invoked as `/nexus:<name>`.

**★ = primary entry points. The rest are called automatically.**

| Command | Purpose |
|---------|---------|
| `init.md` | Initialize `.nexus/` workspace |
| `plan.md` | ★ **Primary entry** — discuss→research→plan→auto-execute→verify→unify |
| `progress.md` | ★ **Session entry** — orient + route to ONE next action; absorbs pause/resume |
| `execute.md` | Execute plan waves (auto-called by plan) |
| `verify.md` | Run the 8-rung verification ladder (auto-called by execute) |
| `unify.md` | Close the loop (auto-called by verify on pass) |
| `recover.md` | Roll back to checkpoint, record scar, re-plan |
| `revise.md` | Revise a plan with blast-radius analysis |
| `map-codebase.md` | Index existing codebase into .nexus/ |
| `settings.md` | View and update settings.json |
| `pause.md` | Deprecated — use `/nexus:progress --pause` |
| `resume.md` | Deprecated — use `/nexus:progress` |

### `agents/` — 8 agent definitions

Installed to `~/.claude/agents/nexus/`. Specialized agents dispatched by the mission controller.

| Agent | Role |
|-------|------|
| `mission-controller.md` | Governs the 4-step loop, never touches code |
| `architect.md` | Maps codebase, maintains architecture files |
| `planner.md` | Goal-backward decomposition, wave assignment |
| `oracle.md` | Pre-planning research, verifies all assumptions |
| `worker.md` | Bounded code implementation with context-packet-only access |
| `validator.md` | Physicality and deterministic verification rungs |
| `verifier.md` | Goal-backward and adversarial verification rungs |
| `merge-judge.md` | Final gate — all flags must be true |

### `skills/` — 8 skill definitions

Installed to `~/.claude/skills/nexus/`. Each skill is a directory with a `SKILL.md`.

| Skill | Purpose |
|-------|---------|
| `smart-tdd/` | Hard/standard/skip TDD modes with red-green-refactor iron law |
| `systematic-debugging/` | 4-phase debugging with 3-consecutive-failures escalation |
| `adversarial-review/` | 7-category red-team checklist |
| `context-packing/` | Narrow context assembly for workers |
| `brainstorming/` | Structured ideation, terminal state = approved plan |
| `contract-first/` | Define contract before implementation |
| `rollback-discipline/` | Checkpoint-before-risk, escalation rules |
| `playwright-browser-validation/` | Browser automation decision tree |

### `workflows/` — 7 workflow definitions

Installed to `~/.claude/nexus/workflows/`. Detailed step-by-step procedures referenced by commands.

| Workflow | Maps to |
|----------|---------|
| `init-project.md` | `/nexus:init` |
| `plan-phase.md` | `/nexus:plan` |
| `execute-phase.md` | `/nexus:execute` |
| `verify-phase.md` | `/nexus:verify` |
| `unify-phase.md` | `/nexus:unify` |
| `revise-phase.md` | `/nexus:revise` |
| `recover-phase.md` | `/nexus:recover` |

### `templates/` — 23 governance templates

Copied into `.nexus/` when a user runs `/nexus:init`. 10 Markdown files + 13 JSON files.

---

## Installation

```bash
# From the nexus-v6 repo root, after pnpm build:
node packages/nexus-cli/dist/index.js install --claude --global

# Or for other runtimes:
node packages/nexus-cli/dist/index.js install --codex --global
node packages/nexus-cli/dist/index.js install --gemini --global
node packages/nexus-cli/dist/index.js install --opencode --global
node packages/nexus-cli/dist/index.js install --all --global
```

## After install

Files land at:
- `~/.claude/commands/nexus/` — slash commands
- `~/.claude/agents/nexus/` — agents
- `~/.claude/skills/nexus/` — skills
- `~/.claude/nexus/` — CLAUDE.md + workflows

Restart Claude Code and type `/nexus` to see all available commands.
