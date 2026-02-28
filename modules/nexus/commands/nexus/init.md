---
name: init
description: Initialize a new Nexus project or resume an existing one
argument-hint: "[project-name]"
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
---

# nexus:init

## RULE 0

Read `~/.claude/nexus/workflows/init-project.md` before executing this command.

Never execute from memory. The file is truth.

---

## Purpose

Bootstrap a Nexus V6 project workspace. Creates the `.nexus/` directory tree, populates templates, and establishes the project governance state. This is the mandatory first step before any other Nexus commands can run.

When invoked, your job is to create a fully operational `.nexus/` workspace that is ready for `/nexus:plan`. Every file must be populated with real content — no placeholder text, no "fill this in later."

---

## Step 1 — Check for Existing Workspace

Before asking any questions, check if `.nexus/` already exists.

```bash
ls -la .nexus/ 2>/dev/null
```

If `.nexus/` exists AND contains `01-governance/STATE.md`:

```
════════════════════════════════════════
  NEXUS WORKSPACE DETECTED
════════════════════════════════════════

An existing Nexus workspace was found at .nexus/

Options:
  [1] Resume — read STATE.md and continue where you left off
  [2] Reset — archive existing workspace and start fresh

Which do you prefer?
════════════════════════════════════════
```

- If the user selects **Resume**: Read `.nexus/01-governance/STATE.md` and `.nexus/01-governance/ROADMAP.md`, then output exactly ONE next action based on the current loop position. Do not re-initialize. Do not ask project questions. Stop here.
- If the user selects **Reset**: Archive the existing workspace by moving it to `.nexus-archive-{YYYY-MM-DD}/`, then proceed with initialization below.

If `.nexus/` does not exist, proceed directly to Step 2.

---

## Step 2 — Gather Project Information

Ask the following questions. Ask them ONE AT A TIME. Wait for the user's answer before asking the next question.

### Question 1 — Core Value

Ask:
```
What is the core value this project delivers?

(Example: "Lets small teams ship production features without bottlenecks"
 or "Reduces customer support ticket volume by automating FAQ responses")

Be specific — this becomes the project's north star.
```

Record the answer as `core_value`.

### Question 2 — Project Description

Ask:
```
Briefly describe what you are building.

(Example: "A SaaS dashboard for monitoring microservice health with real-time alerting"
 or "A CLI tool that generates typed API clients from OpenAPI specs")
```

Record the answer as `project_description`.

### Question 3 — Runtime / Tech Stack

Ask:
```
What is the primary runtime or technology stack?

(Example: "TypeScript / Node.js / Next.js / PostgreSQL"
 or "Python / FastAPI / SQLite"
 or "Go / Gin / Redis")

This helps configure default TDD and linting settings.
```

Record the answer as `tech_stack`.

### Question 4 — Playwright Browser Testing

Ask:
```
Does this project need browser/UI testing with Playwright?

(Playwright MCP lets Nexus capture screenshots, run UI flows, and verify browser behavior during the VERIFY phase)

[y] Yes — I want browser testing
[n] No — this is an API/CLI/backend project
```

- If yes: set `playwright_needed = true`
  - Check `~/.claude/nexus/playwright-detect.json` (or runtime-equivalent). If `mcpPath` is set and not the npx fallback, show: "Detected Playwright MCP at: {path}. Using this automatically."
  - If only the npx fallback is available, show: "Will use 'npx @playwright/mcp@latest'. To use a local binary, run: npm install -g @playwright/mcp"
- If no: set `playwright_needed = false`

Record as `playwright_needed`.

### Question 5 — Project Name

If `$ARGUMENTS` was provided when the command was invoked, use that as the project name without asking.

Otherwise ask:
```
What should this project be called?

(Used for git commit messages and SUMMARY headers)
```

Record the answer as `project_name`.

---

## Step 3 — Create the .nexus/ Directory Structure

All 8 subdirectories should already exist (the Nexus monorepo creates them). If any are missing, create them now:

```
.nexus/
├── 01-governance/
├── 02-architecture/
├── 03-index/
├── 04-phases/
├── 05-artifacts/
├── 06-checkpoints/
├── 07-artifacts/patches/
└── 08-playwright/flow-specs/
```

---

## Step 4 — Populate Core Governance Files

Create the following files. Every field must be filled with real content drawn from the user's answers. No placeholders.

### `.nexus/01-governance/STATE.md`

Create from the STATE.md template. Fill in:
- `project_name`: from Step 2
- `core_value`: from Step 2
- `tech_stack`: from Step 2
- `loop_position`: `○ ○ ○ ○` (fresh — nothing done yet)
- `current_phase`: `none`
- `scar_count`: `0`
- `session_continuity.next_action`: `Run /nexus:plan to create your first phase plan`
- All timestamps: current ISO datetime

### `.nexus/01-governance/ROADMAP.md`

Create from the ROADMAP.md template. Fill in the project name and leave phases for the user to populate. Add a note at the top:

```
> Roadmap is empty. Add phases based on your PRD or run /nexus:plan to define the first phase.
```

### `.nexus/01-governance/settings.json`

Create from the settings.json template. Fill in:
- `project.name`: from Step 2
- `project.version`: `0.1.0`
- `playwright.enabled`: `true` if `playwright_needed`, else `false`
- `playwright.mcpPath`: if `playwright_needed`, read `~/.claude/nexus/playwright-detect.json` (or runtime-equivalent) and use the `mcpPath` found there (even if it's the npx fallback). If not needed, leave `""`.

### `.nexus/01-governance/PRD.md`

Create from the PRD.md template. Pre-fill the Executive Summary section with the `core_value` and `project_description` from Step 2. Leave remaining sections as structured stubs with their section headers intact.

### `.nexus/01-governance/ACCEPTANCE_MASTER.md`

Create from the ACCEPTANCE_MASTER.md template. Pre-fill the header. Leave the table with the AC-1 placeholder row — the user will populate this when planning.

### `.nexus/02-architecture/ARCHITECTURE.md`

Create from the ARCHITECTURE.md template. Pre-fill project name. Set tech stack in the Overview section from `tech_stack`. Leave module map and data flow sections as stubs.

### `.nexus/02-architecture/DECISION_LOG.md`

Create from the DECISION_LOG.md template. No pre-filling needed beyond project name.

### `.nexus/02-architecture/SCARS.md`

Create from the SCARS.md template. No pre-filling needed beyond project name.

### `.nexus/03-index/` JSON stubs

Create these files from templates, filling in the current timestamp for `lastAnalyzed`:
- `files.json`
- `symbols.json`
- `ownership.json`
- `test_map.json`
- `migration_map.json`

### `.nexus/02-architecture/` JSON stubs

Create these files from templates:
- `modules.json`
- `dependencies.json`
- `services.json`
- `api_contracts.json`
- `data_models.json`
- `event_flows.json`

### `.nexus/04-phases/` Directory

This directory is empty on init. Phases will be added by `/nexus:plan`.

---

## Step 5 — Show the .nexus/ Tree

After all files are created, display the directory tree:

```
════════════════════════════════════════
  NEXUS WORKSPACE INITIALIZED
════════════════════════════════════════

Project: {project_name}
Core value: {core_value}

.nexus/
├── 01-governance/
│   ├── STATE.md          ✓
│   ├── ROADMAP.md        ✓
│   ├── settings.json     ✓
│   ├── PRD.md            ✓
│   └── ACCEPTANCE_MASTER.md  ✓
├── 02-architecture/
│   ├── ARCHITECTURE.md   ✓
│   ├── DECISION_LOG.md   ✓
│   ├── SCARS.md          ✓
│   ├── modules.json      ✓
│   ├── dependencies.json ✓
│   ├── services.json     ✓
│   ├── api_contracts.json ✓
│   ├── data_models.json  ✓
│   └── event_flows.json  ✓
├── 03-index/
│   ├── files.json        ✓
│   ├── symbols.json      ✓
│   ├── ownership.json    ✓
│   ├── test_map.json     ✓
│   └── migration_map.json ✓
├── 04-phases/            (empty — phases added by /nexus:plan)
├── 05-artifacts/         (empty)
├── 06-checkpoints/       (empty)
├── 07-artifacts/patches/ (empty)
└── 08-playwright/
    └── flow-specs/       (empty)

════════════════════════════════════════
```

---

## Step 6 — Output the Single Next Action

End with exactly this output block, no additional options or menus:

```
════════════════════════════════════════
  NEXT ACTION
════════════════════════════════════════

Run /nexus:plan to create your first phase plan.

Before running /nexus:plan, consider:
  1. Add phases to .nexus/01-governance/ROADMAP.md
  2. Define acceptance criteria in .nexus/01-governance/ACCEPTANCE_MASTER.md
  3. Run /nexus:map-codebase if this is an existing codebase

════════════════════════════════════════
```

Do not suggest multiple options. The next action is `/nexus:plan`.

---

## Error Handling

**User declines to answer a question:** Ask if they want to skip with a placeholder and continue. If yes, use a descriptive placeholder like `"[To be defined]"` and note it in STATE.md session continuity as something to fill in.

**File write fails:** Report the specific file path and error. Do not continue silently.

**Git not initialized:** Note this in STATE.md under session continuity. Do not attempt to initialize git — that is the user's responsibility.

---

## Success Criteria

- [ ] `.nexus/` directory tree exists with all 8 subdirectories
- [ ] `STATE.md` populated with real project data, no placeholders
- [ ] `ROADMAP.md` created
- [ ] `settings.json` created with correct project name, `playwright.enabled`, and `playwright.mcpPath`
- [ ] All JSON index files created
- [ ] All architecture template files created
- [ ] Tree displayed to user
- [ ] Exactly ONE next action output: `/nexus:plan`
