# Nexus V6 — System Overview

> Version: 6.0.0
> Last Updated: 2026-02-28

---

## Table of Contents

1. [What Is Nexus V6?](#what-is-nexus-v6)
2. [Two-Component Architecture](#two-component-architecture)
3. [The 4-Step Governance Loop](#the-4-step-governance-loop)
4. [Package Overview](#package-overview)
5. [The .nexus/ Directory Structure](#the-nexus-directory-structure)
6. [Key Design Principles](#key-design-principles)
7. [Quick Start Guide](#quick-start-guide)

---

## What Is Nexus V6?

Nexus V6 is an **agentic developer operating system** — a structured framework that allows AI coding agents
(Claude Code, Codex CLI, Gemini CLI, OpenCode, and others) to plan, execute, verify, and unify software
changes safely and repeatably.

Traditional AI coding tools operate in an ad-hoc manner: the agent takes instructions, modifies files,
and reports back. There is no structured way to verify that changes were actually made, no rollback
mechanism, no decomposition of large goals into safe sub-tasks, and no memory across sessions.

Nexus V6 solves all of these problems by providing:

- **A governance loop** that enforces plan -> execute -> verify -> unify in strict order
- **Filesystem-as-truth** verification so agents can never lie about what they did
- **Wave-based task scheduling** to parallelize work safely across agent workers
- **Checkpoint and rollback** infrastructure to make every action reversible
- **A shared memory layer** (.nexus/ directory) that persists project state across sessions
- **Multi-runtime support** so the same project can be worked on by different AI agents

Nexus V6 is not a chatbot. It is not a code-completion tool. It is an orchestration layer that sits
above AI agents and enforces discipline on their behavior.

---

## Two-Component Architecture

Nexus V6 consists of two distinct components:

### Component 1: The Framework Repository (nexus-v6/)

The framework repository is the Nexus codebase itself. It contains:

- `packages/` — Seven npm packages published to the registry
- `tools/` — Utility scripts for maintenance and CI
- `tests/` — Unit and integration tests for all packages
- `docs/` — Documentation (this file)
- `examples/` — Sample projects demonstrating Nexus usage

The framework repository is maintained by the Nexus team. Users install Nexus packages from npm and
use the `nexus` CLI that ships with the `nexus-cli` package.

### Component 2: The .nexus/ Workspace Directory

The `.nexus/` directory is created inside a user's project when they run `nexus init`. It is the
**live brain** of the project — a filesystem-based shared memory that persists state across sessions,
agents, and runtimes.

The `.nexus/` directory is the source of truth for:
- What the project is trying to accomplish (mission, roadmap, PRD)
- The current architectural state (modules, contracts, migrations)
- The codebase index (files, exports, test mappings)
- Active tasks and their status
- Verification results and artifacts
- Checkpoint history for rollback

Every agent that works on a Nexus-managed project reads from and writes to `.nexus/`. This shared
state is what enables multi-agent coordination without a central server.

---

## The Autonomous 4-Step Governance Loop

**The pipeline runs automatically by default.** Run `/nexus:plan` — the system chains through all four steps without further commands. You only intervene when blocked.

```
/nexus:plan
     │
     ▼
  DISCUSS ──▶ RESEARCH ──▶ PLAN ──▶ [auto] EXECUTE ──▶ VERIFY ──▶ UNIFY
                                                              │         │
                                                    gap-plan ◀──────── │ (on fail)
                                                                        │
                                                              next phase ▼ (on pass)
```

### Step 1: PLAN

Entry point: `/nexus:plan [phase-name] [--manual]`

1. **Discuss** — Asks user about goals and design preferences. Creates `CONTEXT.md` with locked decisions.
2. **Research** — Dispatches oracle agent (paths only). Oracle reads files, writes `RESEARCH.md`.
3. **Plan** — Dispatches planner agent (paths only). Planner creates `PLAN.md` with:
   - Tasks with wave assignments (wave = execution order; same-wave tasks are independent)
   - Risk tier per task (`low | medium | high | critical`)
   - TDD mode per task (`hard | standard | skip`)
   - `must_haves`: truths (observable behaviors), artifacts (files), key_links (wiring)
4. **Quality check** — Orchestrator validates plan structure inline (no file content loaded).
5. **Skills check** — If `required_skills` is configured, blocks until skills are loaded.
6. **Auto-advance** — Chains to `/nexus:execute` automatically (unless `--manual`).

Output: `PLAN.md`, `TASK_GRAPH.json`, `CONTEXT.md`

### Step 2: EXECUTE

Auto-called by plan. Can be invoked directly: `/nexus:execute [plan-path] [--gaps-only]`

**Lean orchestrator:** Passes task definitions + file paths to workers. Workers read their own context. Orchestrator stays at <15% context.

For each wave:
1. Announces wave with substantive task descriptions
2. Creates git checkpoint before high/critical tasks
3. Dispatches worker agents with task + paths only (parallel if `parallelization: true`)
4. **Spot-check** when worker reports `<<NEXUS_COMPLETE>>` (3-line fs check before validator)
5. Dispatches validator agent with file paths only
6. Marks task complete in `TASK_GRAPH.json`
7. On 3 consecutive failures: escalates to architect (no 4th attempt)

Output: Updated `TASK_GRAPH.json`, all tasks `complete`

### Step 3: VERIFY

Auto-called by execute. Can be invoked directly: `/nexus:verify [plan-path]`

**8-rung verification ladder:**

| Rung | Check | Behavior |
|------|-------|----------|
| 1 | **Physicality** — files exist, non-empty, no undeclared writes | FAIL-FAST |
| 2 | **Deterministic** — lint, types, formatter, unit tests | FAIL-FAST |
| 3 | **Delta tests** — full module suite for changed files | Record gap, continue |
| 4 | **Goal-backward** — every must-have WIRED (exists + imported + called + return used) | Record gap, continue |
| 5 | **Adversarial** — edge cases, error paths, dev artifacts, security | Blocker fails, continue |
| 6 | **System validation** — integration + E2E tests | Record gap, continue |
| 7 | **Playwright** — browser flows (only if `playwright_required: true`) | Record gap, continue |
| 8 | **Merge-judge** — all flags must be true | APPROVE or REJECT |

All agents dispatched with paths only (not file contents).

On **PASS**: auto-chains to `/nexus:unify`.
On **FAIL**: auto-invokes `/nexus:plan --gaps` → creates targeted gap-closure plan → executes → re-verifies.

Output: `verification-report.json`, provisional scars on failure

### Step 4: UNIFY

Auto-called by verify on pass. Can be invoked directly: `/nexus:unify [plan-path]`

1. Reconciles plan vs actual (what was planned vs what was built)
2. Writes `SUMMARY.md` — substantive one-liner + full narrative
3. Updates `DECISION_LOG.md`, `SCARS.md`, `ARCHITECTURE.md`
4. Writes `HANDOFF.md` for session continuity
5. Updates `STATE.md` (UNIFY ✓) and `ROADMAP.md` (phase = complete)
6. **Auto-advances** to next `/nexus:plan` if more phases remain, or declares PROJECT COMPLETE

Output: `SUMMARY.md`, `HANDOFF.md`, all governance files updated

---

## Package Overview

Nexus V6 ships seven npm packages, each with a focused responsibility.

### nexus-cli

**Purpose:** The command-line interface. Entry point for all Nexus operations.

**Key commands:**
- `nexus install` — installs runtime-specific integration files
- `nexus init` — initializes .nexus/ in a project
- `nexus plan` — decomposes goals into tasks
- `nexus execute` — runs tasks in waves
- `nexus verify` — runs verification ladder
- `nexus unify` — merges and tags verified work
- `nexus doctor` — health check for the Nexus workspace
- `nexus rollback` — restores a previous checkpoint
- `nexus status` — shows current task and verification state

**Internal structure:**
- `src/commands/` — one file per command
- `src/install/` — runtime adapters (claude, codex, gemini, opencode)
- `src/doctor/` — health check implementations

### nexus-core

**Purpose:** Shared types, schemas, utilities, and the governance loop engine.

**Key exports:**
- `GovernanceEngine` — orchestrates the 4-step loop
- `Task`, `TaskStatus`, `Wave` — core domain types
- `NexusConfig` — workspace configuration type
- JSON schemas for all .nexus/ files
- `Logger` — structured logging with session IDs

### nexus-graph

**Purpose:** Codebase indexing and dependency analysis.

**Key exports:**
- `CodebaseIndexer` — scans files, extracts exports, builds file index
- `DependencyAnalyzer` — builds import graph, detects cycles
- `TestMapper` — maps source files to their test files
- `ContextPacketBuilder` — assembles narrow context packets for workers

### nexus-runtime

**Purpose:** Task scheduling, execution, rollback, and inter-agent communication.

**Key exports:**
- `Scheduler` — wave-based task dispatcher
- `RollbackManager` — checkpoint creation and restoration
- `Mailbox` — file-based inter-agent message passing
- `WorkerPool` — manages concurrent agent workers

### nexus-validator

**Purpose:** The verification ladder — all checks that run in the VERIFY step.

**Key exports:**
- `PhysicalityChecker` — verifies files exist on disk
- `GoalBackwardChecker` — validates acceptance criteria and detects stubs
- `ContractChecker` — validates API contracts have not regressed
- `SystemValidator` — runs the full verification ladder in sequence

### nexus-playwright

**Purpose:** Browser automation integration via Playwright MCP.

**Key exports:**
- `FlowRunner` — loads and executes flow specs
- `ArtifactWriter` — captures screenshots, videos, and logs
- `PassTracker` — implements the 3-consecutive-pass promotion rule
- `FlowSpec` — type definition for flow specification files

### nexus-dashboard

**Purpose:** A terminal UI for monitoring Nexus state in real time.

**Key exports:**
- `Dashboard` — ink-based TUI component
- `TaskPanel` — displays current task states
- `VerificationPanel` — shows verification ladder results
- `LogPanel` — streams agent output

---

## The .nexus/ Directory Structure

When you run `/nexus:init` in a project, the following directory structure is created:

```
.nexus/
├── 00-mission/
│   ├── PRD.md                     ← Write your mission here
│   └── ACCEPTANCE_MASTER.md       ← Given/When/Then acceptance criteria
│
├── 01-governance/
│   ├── STATE.md                   ← Live loop position (human-readable)
│   ├── ROADMAP.md                 ← Phase roadmap with status
│   ├── DECISION_LOG.md            ← Every architectural decision
│   ├── SCARS.md                   ← Failure records + prevention rules
│   ├── HANDOFF.md                 ← Session resume context (written by unify/pause)
│   └── settings.json              ← Project configuration
│
├── 02-architecture/
│   ├── ARCHITECTURE.md            ← Narrative (auto-updated by /nexus:unify)
│   ├── modules.json               ← Module boundaries and ownership
│   ├── api_contracts.json         ← API surface contracts
│   ├── data_models.json           ← Schema/data model registry
│   ├── dependencies.json          ← Module dependency graph
│   ├── services.json              ← External service registry
│   └── event_flows.json           ← Event/message flow definitions
│
├── 03-index/
│   ├── files.json                 ← Full file index with exports
│   ├── symbols.json               ← Exported classes/functions/types
│   ├── ownership.json             ← File → module ownership map
│   ├── test_map.json              ← Source file → test file map
│   └── migration_map.json         ← Schema migration lineage
│
├── 04-phases/
│   └── 01-phase-name/
│       ├── CONTEXT.md             ← User intent (locked decisions for planner)
│       ├── RESEARCH.md            ← Oracle research output
│       ├── PLAN.md                ← Written by /nexus:plan
│       ├── TASK_GRAPH.json        ← Live task status
│       ├── SUMMARY.md             ← Written by /nexus:unify
│       └── verification-report.json ← Verification ladder results
│
├── 06-checkpoints/                ← Git stash snapshots before high/critical tasks
│
├── 07-artifacts/
│   ├── screenshots/               ← Playwright screenshots
│   ├── traces/                    ← Playwright trace bundles
│   ├── videos/                    ← Playwright recordings (flows > 30s)
│   ├── logs/                      ← Agent execution logs
│   └── patches/                   ← Quarantined patches from failed tasks
│
└── 08-playwright/
    ├── flow-specs/                ← Browser flow specifications (.md)
    ├── generated-tests/           ← Promoted stable flow tests
    └── bug-repros/                ← Reproducible bug scripts
```

> **Add `.nexus/` to `.gitignore`.** It is per-machine runtime state, not source code.

---

## Key Design Principles

Nexus V6 is governed by five immutable design laws. These laws are enforced in code and documented
in `CLAUDE.md` at the root of every Nexus-managed project.

### Law 1: FILESYSTEM IS TRUTH

> Never trust what an agent says it did. Trust only what is on disk.

Every verification check reads files directly. No agent output, log, or claim is accepted without a
corresponding file read. Physicality checks compare SHA256 hashes against the index. If the file does
not exist or its hash does not match, the task has failed — regardless of what the agent reported.

### Law 2: ARCHITECTURE IS FIRST-CLASS

> Module boundaries are not suggestions. They are mandatory state.

The architecture graph in `.nexus/02-architecture/` defines which modules may import from which other
modules. A task that crosses a module boundary without updating the architecture files is rejected by
the verifier. The dependency analyzer runs on every verify cycle.

### Law 3: EVERY ACTION IS REVERSIBLE OR MUST BE APPROVED

> Before any risky operation, create a checkpoint.

The rollback manager creates a git-tagged checkpoint before every task execution. If a task fails at
any point, the project can be restored to the pre-task state with a single command. Operations that
cannot be reversed (external API calls, database writes) require explicit human approval via a
NEXUS_APPROVAL_REQUIRED signal.

### Law 4: VERIFY BEFORE MERGE

> The full verification ladder must pass before any merge to main.

The unify command will refuse to execute unless the verify command has completed successfully in the
current session. There is no bypass flag. This ensures that the main branch always reflects a fully
verified state.

### Law 5: NARROW CONTEXT OVER GIANT CONTEXT

> Give each worker agent only the context it needs for its task.

The context packet builder assembles a targeted packet for each worker: only the files in
`files_to_touch`, only the relevant acceptance criteria, only the architectural context for the
modules being modified. Large monolithic context dumps are forbidden. This keeps agents focused
and reduces hallucination.

---

## Quick Start Guide

### Step 1: Install Nexus

```bash
# Build from source (requires pnpm)
git clone https://github.com/your-org/nexus-v6.git
cd nexus-v6
pnpm install && pnpm build

# Install runtime integration for Claude Code
node packages/nexus-cli/dist/index.js install --claude --global

# Verify installation
node packages/nexus-cli/dist/index.js doctor
```

### Step 2: Initialize a Project

```bash
cd my-project
git init  # Nexus requires git for checkpoints

# Open Claude Code in this directory, then run:
/nexus:init
```

This creates `.nexus/` with all template files pre-populated.

Edit the mission files:
- `.nexus/00-mission/PRD.md` — what you're building, who uses it, hard constraints
- `.nexus/00-mission/ACCEPTANCE_MASTER.md` — testable acceptance criteria (Given/When/Then)
- `.nexus/01-governance/ROADMAP.md` — phase-by-phase delivery plan

### Step 3: Run the Autonomous Pipeline

```
/nexus:plan
```

**That's it.** The full pipeline runs automatically:
1. Discusses your intent (creates CONTEXT.md with locked decisions)
2. Researches the domain (oracle agent → RESEARCH.md)
3. Creates the plan (planner agent → PLAN.md + TASK_GRAPH.json)
4. Executes wave by wave (worker agents with narrow context packets)
5. Verifies with 8-rung ladder (physicality → merge-judge)
6. Closes the loop (SUMMARY.md, ARCHITECTURE.md, HANDOFF.md)
7. Chains to the next phase automatically

### Step 4: Orient at Any Time

```
/nexus:progress
```

Run at session start or whenever you're unsure what to do. Shows the loop position and outputs ONE next action.

---

## Further Reading

- `docs/DESIGN_LAWS.md` — Deep dive into the 5 immutable design laws
- `docs/RUNTIME_SUPPORT.md` — Runtime-specific installation and configuration
- `docs/PLAYWRIGHT_MCP.md` — Browser automation with Playwright MCP
- `docs/FAILURE_MODES.md` — Troubleshooting guide for common failures
- `docs/RELEASE_CHECKLIST.md` — Release process for Nexus itself
- `CLAUDE.md` — Root CLAUDE.md with all agent instructions (in your project)
