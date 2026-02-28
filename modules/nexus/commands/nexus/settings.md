---
name: settings
description: View and edit project settings directly in settings.json
argument-hint: "[key=value | --show]"
allowed-tools: [Read, Write]
---

# nexus:settings

## Purpose

View or update `.nexus/01-governance/settings.json`. For most changes, edit the file directly — this command is a convenience wrapper.

---

## Usage

**Show all settings:**
```
/nexus:settings --show
```

Read `.nexus/01-governance/settings.json` and display it formatted.

**Set a value:**
```
/nexus:settings auto_advance=false
/nexus:settings tdd_mode=hard
/nexus:settings max_autonomy=medium
```

Read the current settings.json, update the specified key, write it back, confirm the change.

**Edit directly (recommended):**
Just open `.nexus/01-governance/settings.json` in your editor. The file is human-readable JSON.

---

## Key Settings Reference

| Key | Values | Default | Effect |
|-----|--------|---------|--------|
| `pipeline.auto_advance` | `true/false` | `true` | Auto-chain plan→execute→verify→unify |
| `pipeline.parallelization` | `true/false` | `true` | Run wave tasks in parallel |
| `autonomy.default` | `low/medium/high` | `medium` | Max autonomy level for all tasks |
| `tdd.default` | `hard/standard/skip` | `standard` | TDD rigor for all phases |
| `commands.test` | shell command | `npm test` | Test command run by validator |
| `commands.lint` | shell command | `npm run lint` | Lint command run by validator |
| `commands.typecheck` | shell command | `npx tsc --noEmit` | Type check command |
| `commands.format_check` | shell command | `npx prettier --check .` | Format check command |
| `playwright.enabled` | `true/false` | `false` | Enable Playwright MCP integration |
| `playwright.mcpPath` | file path | `""` | Path to Playwright MCP server binary (required when `playwright_required: true` in PLAN.md) |
| `checkpoints.beforeHighRisk` | `true/false` | `true` | Auto-checkpoint before high/critical tasks |
| `checkpoints.maxRetained` | number | `10` | Max checkpoints kept before pruning |

---

## Notes

Settings in `settings.json` are project-level defaults. Individual phase plans can override `tdd_mode`, `playwright_required`, and `checkpoint_before` per-phase in PLAN.md frontmatter.

To disable auto-advance globally (manual control of the loop):
```
/nexus:settings auto_advance=false
```

Or use `--manual` flag on individual commands to override per-run without changing the project default.
