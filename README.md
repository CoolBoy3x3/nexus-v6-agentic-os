# Nexus V6 — Agentic Developer OS

> Autonomous agentic developer OS. Run `/nexus:plan` — the system plans, executes, verifies, and unifies without you typing another command.

---

## What Is Nexus V6?

Nexus V6 is an **autonomous agentic developer OS**. Run one command — the system handles the rest.

```
/nexus:plan   ──▶  PLAN  ──▶  EXECUTE  ──▶  VERIFY  ──▶  UNIFY  ──▶  (next phase)
```

The pipeline runs **automatically by default**. When you type `/nexus:plan`, Nexus:
1. Discusses your intent and captures locked decisions
2. Researches the domain with an oracle agent
3. Creates a wave-based plan with risk tiers and TDD modes
4. Executes each wave with narrow-context worker agents
5. Runs the 8-rung verification ladder
6. Closes the loop with SUMMARY.md and governance updates
7. Chains to the next phase — no manual commands needed

**You intervene only when blocked.** The system auto-pauses at: 3-consecutive failures, critical risk approval, or `--manual` flag.

Every failure is recorded as a **scar** with a prevention rule. Every high-risk change creates a **checkpoint** you can roll back to. Every merge requires passing an **8-rung verification ladder**.

Works with **Claude Code** today, Codex, Gemini, and OpenCode support built in.

---

## Requirements

- **Node.js** 20 or later
- **pnpm** 9 or later (`npm install -g pnpm`)
- **Claude Code** (`npm install -g @anthropic-ai/claude-code`)
- **Git** (required for worktrees and checkpoints)

---

## Install

### Step 1 — Clone the repo

```bash
git clone https://github.com/CoolBoy3x3/nexus-v6-agentic-os.git
cd nexus-v6
```

### Step 2 — Install dependencies and build

```bash
pnpm install
pnpm build
```

### Step 3 — Install into Claude Code (global)

```bash
node packages/nexus-cli/dist/index.js install --claude --global
```

This copies the Nexus command suite into `~/.claude/`:
- `~/.claude/commands/nexus/` — 12 slash commands
- `~/.claude/agents/nexus/` — 8 specialized agents
- `~/.claude/skills/nexus/` — 8 skills (TDD, debugging, adversarial review, etc.)
- `~/.claude/nexus/` — CLAUDE.md firmware + 7 workflow files

### Step 4 — Verify the install

Open Claude Code and type `/nexus` — you should see the full command list:

```
/nexus:init          Initialize a new .nexus/ workspace
/nexus:plan          ★ MAIN ENTRY — full autonomous pipeline: discuss→research→plan→execute→verify→unify
/nexus:progress      ★ SESSION ENTRY — orient, resume, and route to ONE next action (use at session start)
/nexus:execute       Execute plan waves (called automatically by plan)
/nexus:verify        Run the 8-rung verification ladder (called automatically by execute)
/nexus:unify         Close the loop (called automatically by verify on pass)
/nexus:recover       Roll back to a checkpoint and re-plan
/nexus:revise        Revise a plan with blast-radius analysis
/nexus:map-codebase  Index an existing codebase into .nexus/
/nexus:settings      View and update settings.json
```

> **Tip:** If commands don't appear, restart Claude Code — it reads `~/.claude/commands/` on startup.

---

## Using Nexus V6

### Starting a new project

```
/nexus:init
```

Creates `.nexus/` with all governance files pre-populated.

Then write your mission:
- `.nexus/00-mission/PRD.md` — what you're building, hard constraints
- `.nexus/00-mission/ACCEPTANCE_MASTER.md` — Given/When/Then acceptance criteria

### Running the autonomous pipeline

```
/nexus:plan
```

**That's it.** The full pipeline runs automatically:

1. **Discuss** — Nexus asks about your intent, captures locked decisions in CONTEXT.md
2. **Research** — Oracle agent researches the domain (RESEARCH.md)
3. **Plan** — Planner creates PLAN.md with waves, risk tiers, TDD modes, must-haves
4. **Execute** — Workers run wave-by-wave with narrow context packets; validator checks each task
5. **Verify** — 8-rung ladder: physicality → deterministic → goal-backward → adversarial → merge-judge
6. **Unify** — SUMMARY.md, ARCHITECTURE.md, SCARS.md, ROADMAP.md updated; next phase auto-starts

You only need to intervene when:
- The pipeline is explicitly blocked (3-consecutive failures, missing dependency)
- A critical risk task needs approval
- You use `--manual` to pause between steps

### Orientation and session resume

```
/nexus:progress
```

Run at the start of any session. Reads HANDOFF.md + STATE.md, shows where you are, outputs **exactly ONE next action**.

To save session state mid-session:
```
/nexus:progress --pause [optional reason]
```

### 8-rung verification ladder

| Rung | Check | Fail behavior |
|------|-------|--------------|
| 1 | **Physicality** — files exist, non-empty, no undeclared writes | Stop — fail-fast |
| 2 | **Deterministic** — lint, types, formatter, unit tests | Stop — fail-fast |
| 3 | **Delta tests** — full module suite for changed files | Record gap, continue |
| 4 | **Goal-backward** — every must-have is WIRED (exists + imported + called + return used) | Record gap, continue |
| 5 | **Adversarial** — edge cases, error paths, dev artifacts, security | Record gap (blockers fail), continue |
| 6 | **System validation** — integration and E2E tests | Record gap, continue |
| 7 | **Playwright** — browser flows (only if `playwright_required: true`) | Record gap, continue |
| 8 | **Merge-judge** — all flags must be true | Approve or reject |

On failure: gaps auto-create a gap-closure plan via `/nexus:plan --gaps`, which executes and re-verifies automatically.

### Existing project

```
/nexus:init
/nexus:map-codebase
```

Indexes your codebase into `.nexus/02-architecture/` and `.nexus/03-index/`, then run `/nexus:plan` for the normal loop.

### Rolling back after a failure

```
/nexus:recover
```

Lists checkpoints, rolls back git, records a scar with prevention rule, returns to PLAN.

### Manual control (disable auto-advance)

```
/nexus:plan --manual
```

Or set `auto_advance: false` in `.nexus/01-governance/settings.json` to disable globally.

---

## The .nexus/ Directory

```
.nexus/
├── 00-mission/
│   ├── PRD.md                      ← Write your mission here
│   └── ACCEPTANCE_MASTER.md        ← Testable acceptance criteria
├── 01-governance/
│   ├── STATE.md                    ← Live loop position (human-readable)
│   ├── ROADMAP.md                  ← Phase roadmap with status
│   ├── DECISION_LOG.md             ← Every architectural decision
│   ├── SCARS.md                    ← Failure records + prevention rules
│   ├── HANDOFF.md                  ← Session resume context (written by unify/pause)
│   └── settings.json               ← Project configuration
├── 02-architecture/
│   ├── ARCHITECTURE.md             ← Narrative (auto-updated by /nexus:unify)
│   ├── modules.json
│   ├── api_contracts.json
│   ├── data_models.json
│   ├── dependencies.json
│   ├── services.json
│   └── event_flows.json
├── 03-index/
│   ├── files.json
│   ├── symbols.json
│   ├── ownership.json
│   ├── test_map.json
│   └── migration_map.json
├── 04-plans/
│   └── 01-phase-name/
│       ├── PLAN.md                 ← Written by /nexus:plan
│       ├── SUMMARY.md              ← Written by /nexus:unify
│       └── verification-report.json
├── 05-runtime/
│   ├── TASK_GRAPH.json             ← Live task status
│   ├── state.json                  ← Machine-readable state
│   └── mission-log.jsonl           ← JSONL audit trail
├── 06-checkpoints/                 ← Git snapshots before high/critical tasks
├── 07-artifacts/
│   ├── screenshots/
│   ├── traces/
│   ├── videos/
│   ├── logs/
│   └── patches/
└── 08-playwright/
    ├── flow-specs/
    ├── generated-tests/
    └── bug-repros/
```

> **Add `.nexus/` to your `.gitignore`.** It is per-machine runtime state, not source code.

---

## Settings

`.nexus/01-governance/settings.json`:

```json
{
  "project": { "name": "my-project", "version": "0.1.0" },
  "autonomy": { "default": "medium", "overrides": {} },
  "tdd": { "default": "standard", "overrides": {} },
  "playwright": { "enabled": true, "mcpPath": "" },
  "dashboard": { "port": 7890 },
  "checkpoints": { "beforeHighRisk": true, "maxRetained": 10 },
  "notifications": { "onHighRisk": true, "onCriticalRisk": true, "onScar": true }
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `autonomy.default` | `low` / `medium` / `high` | How much the agent self-approves vs. asks |
| `tdd.default` | `hard` / `standard` / `skip` | `hard` = red-green-refactor iron law |
| `playwright.enabled` | `true` / `false` | Enable Rung 7 browser validation |
| `dashboard.port` | number | Port for the live dashboard |
| `checkpoints.beforeHighRisk` | `true` / `false` | Auto-checkpoint before high/critical tasks |

---

## Live Dashboard

```bash
node launch-dashboard.mjs /path/to/your-project
# Opens at http://localhost:7890 (or your configured port)
```

Shows live task graph, agent status, scars, artifacts, and loop position.

---

## Key Concepts

### The 4-Step Governance Loop

```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY ──▶ (repeat)
```

Every unit of work follows this loop. No phase can be skipped. The loop is tracked in `STATE.md` so any session can resume from exactly where it left off — even weeks later.

- **PLAN** — Goal-backward decomposition into a wave-ordered task graph with explicit risk tiers, TDD modes, must-haves, and dependency edges.
- **EXECUTE** — Wave-by-wave dispatch of parallel worker agents, each operating in an isolated git worktree with a narrow context packet.
- **VERIFY** — 8-rung ladder that checks physical existence, correctness, coverage, goal alignment, adversarial edge cases, and (optionally) browser truth.
- **UNIFY** — Architecture rebuild, scar consolidation, SUMMARY.md, HANDOFF.md for session continuity, auto-advance to next phase.

### Wave-Based Parallel Workers

Tasks are organized into **waves** — groups of independent tasks that can run simultaneously. Each wave must fully pass verification before the next wave starts.

```
Wave 1: [DB schema] [Auth types] [Config]        ← run in parallel
Wave 2: [Auth service] [User model]              ← run in parallel (depend on Wave 1)
Wave 3: [Login endpoint] [Register endpoint]     ← run in parallel (depend on Wave 2)
```

Each worker:
- Gets its own git **worktree** (isolated branch, no file conflicts)
- Receives only a **narrow context packet** (never the full codebase)
- Emits structured `<<NEXUS_STATUS>>` / `<<NEXUS_COMPLETE>>` / `<<NEXUS_BLOCKED>>` tags
- Has a **3-fix-attempt limit** — after 3 failures, it stops and escalates rather than spinning

### Narrow Context Packets

Workers never load the full codebase. Each packet contains only what the task actually needs:

| Slot | Content | Size limit |
|------|---------|-----------|
| Files | Only files the task will modify | Exact paths |
| Architecture slice | Module boundaries + dependencies for affected modules | Subset of modules.json |
| Contracts slice | API contracts for endpoints the task touches | Subset of api_contracts.json |
| Test slice | Test files mapped to the modified files | From test_map.json |
| State digest | Current loop position + last decision | 150 lines of STATE.md |

This keeps orchestrator context lean and prevents workers from developing false confidence from reading unrelated code.

### Iron-Law TDD

When `tdd: "hard"` is set (the default for high/critical risk tasks), the worker must follow strict red-green-refactor discipline:

1. **Red** — Write a failing test that defines the contract. Commit. Verify it fails.
2. **Green** — Write the minimum implementation to pass. Commit.
3. **Refactor** — Clean up without breaking the test. Commit.

The verification ladder's physicality rung checks that the test existed *before* the implementation commit. `tdd: "standard"` requires tests but not strict ordering. `tdd: "skip"` is only allowed for scaffolding, docs, and config.

### Risk Tiers

| Tier | Examples | Behavior |
|------|---------|---------|
| `low` | Docs, tests, non-critical UI | Execute freely |
| `medium` | New features, refactors | Execute with awareness |
| `high` | DB schema, auth, APIs | Auto-checkpoint + notification |
| `critical` | Destructive migrations, security | Checkpoint + mandatory human review |

### Scars

Every failure creates a permanent **scar** — a record with a root cause and an extracted prevention rule:

```
| SCAR-001 | 2026-02-28 | logic | Login handler returned stub | No DB call wired | Always verify DB call exists before marking auth complete |
```

The planner reads all scars relevant to a task's files before planning. Prevention rules become active constraints — the same mistake cannot happen twice.

### The 3-Consecutive-Failures Rule

If a worker fails to fix the same issue 3 times in a row, it emits `<<NEXUS_BLOCKED>>` and stops entirely. The orchestrator escalates to the architect agent for a design review — persistent failures signal an architecture problem, not a code problem.

### Session Continuity

Every `UNIFY` phase writes a `HANDOFF.md` capturing:
- Exact loop position (which phase, which wave, which task)
- What was just completed and what comes next
- Active decisions and locked constraints
- Any open deviations or deferred items

Run `/nexus:progress` at the start of any new session — it reads HANDOFF.md + STATE.md and outputs **exactly ONE next action** to resume without re-reading the entire project.

---

## Repository Structure

```
nexus-v6/
├── packages/
│   ├── nexus-cli/          CLI: install, init, doctor, map-codebase, dashboard
│   ├── nexus-core/         Types, constants, state-store, task-graph, context-packet, risk-engine
│   ├── nexus-graph/        Codebase indexing, architecture graph, dependency analysis
│   ├── nexus-runtime/      Orchestrator, mailbox, worker-cell, checkpoint, rollback
│   ├── nexus-validator/    8-rung verification ladder
│   ├── nexus-playwright/   Browser automation, flow runner, artifact writer
│   ├── nexus-dashboard/    Fastify server + real-time SSE views
│   └── nexus-schemas/      8 JSON Schema draft-07 definitions
├── modules/nexus/
│   ├── CLAUDE.md           Agent firmware — 5 design laws + all rules
│   ├── commands/nexus/     12 slash command definitions
│   ├── agents/             8 agent definitions
│   ├── skills/             8 skill definitions
│   ├── workflows/          7 workflow definitions
│   └── templates/          23 governance templates
├── docs/                   SYSTEM_OVERVIEW, DESIGN_LAWS, FAILURE_MODES, RUNTIME_SUPPORT
├── tests/                  11 Vitest test suites
├── tools/                  Build scripts, contract-diff, migration-guard, e2e tests
└── examples/sqx-lite/      Example project
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
