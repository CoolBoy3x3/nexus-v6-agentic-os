# Init Project Workflow

Implements the full conversational setup flow for `/nexus:init`.

---

## Step 1: Ask Project Questions

Ask these questions one at a time. Record all answers.

**Q1 — Core Value:**
"What is the core value this project delivers?"
Record as: `core_value`

**Q2 — Project Description:**
"Briefly describe what you are building."
Record as: `project_description`

**Q3 — Tech Stack:**
"What is the primary runtime or technology stack?"
Record as: `tech_stack`

**Q4 — Project Name:**
If `$ARGUMENTS` provided: use as project name.
Otherwise ask: "What should this project be called?"
Record as: `project_name`

---

## Step 2: Create Directory Structure

Verify all 8 subdirectories exist (create if missing):

```
.nexus/
├── 01-governance/
├── 02-architecture/
├── 03-index/
├── 04-phases/
├── 05-artifacts/
├── 06-checkpoints/
├── 07-artifacts/
│   └── patches/
└── 08-playwright/
    └── flow-specs/
```

---

## Step 3: Populate Templates

Read template files from `modules/nexus/templates/` and write populated versions to `.nexus/`.

### 01-governance/STATE.md
From template, fill in:
- `project_name`
- `core_value`
- `tech_stack`
- Loop position: `○ ○ ○ ○`
- `current_phase`: none
- `scar_count`: 0
- `session_continuity.next_action`: "Run /nexus:plan to create your first phase plan"
- All timestamps: current ISO datetime

### 01-governance/ROADMAP.md
From template, fill in project name. Add note:
```
> Roadmap is empty. Add phases or run /nexus:plan to define the first phase.
```

### 01-governance/settings.json
From template, set:
- `project.name`: project_name
- `project.version`: "0.1.0"

### 01-governance/PRD.md
From template. Pre-fill Executive Summary with core_value and project_description.

### 01-governance/ACCEPTANCE_MASTER.md
From template. Pre-fill header with project name.

### 02-architecture/ARCHITECTURE.md
From template. Pre-fill project name and tech stack in Overview section.

### 02-architecture/DECISION_LOG.md
From template. Pre-fill project name header.

### 02-architecture/SCARS.md
From template. Pre-fill project name header.

### 03-index/ JSON files
Write from templates with `lastAnalyzed` set to current ISO timestamp:
- `files.json`
- `symbols.json`
- `ownership.json`
- `test_map.json`
- `migration_map.json`

### 02-architecture/ JSON files
Write from templates:
- `modules.json`
- `dependencies.json`
- `services.json`
- `api_contracts.json`
- `data_models.json`
- `event_flows.json`

---

## Step 4: Initialize settings.json

Write `.nexus/01-governance/settings.json` with defaults from template and project-specific values.

---

## Step 5: Output .nexus/ Tree

Display the directory tree with checkmarks for created files.

---

## Step 6: Output Next Steps

Output single next action: "Run /nexus:plan to create your first phase plan."

Include optional suggestions:
- Add phases to ROADMAP.md first
- Define acceptance criteria in ACCEPTANCE_MASTER.md
- Run /nexus:map-codebase for existing codebases
