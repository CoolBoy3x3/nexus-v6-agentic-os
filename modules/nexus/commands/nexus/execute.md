---
name: execute
description: Execute phase plan waves with lean orchestration, spot-check, then auto-chain to verify
argument-hint: "[plan-path] [--gaps-only] [--manual]"
allowed-tools: [Read, Write, Bash, Glob]
---

# nexus:execute

## Purpose

Execute the current phase plan. Dispatches worker agents for each task in wave order. Orchestrator stays lean — passes task definitions and file paths to workers; workers read their own context. Spot-check + validator on each NEXUS_COMPLETE. Auto-chains to `/nexus:verify` when all waves pass.

PLAN ✓ → **EXECUTE** → VERIFY → UNIFY

Flags:
- `--gaps-only` — run only tasks flagged `gap_closure: true`
- `--manual` — disable auto-advance to verify after waves complete

**Called automatically by `/nexus:plan`. Can also be invoked directly.**

---

## RULE 0

Read `~/.claude/nexus/workflows/execute-phase.md` before executing.

---

## Automation First

**Golden rules (applied every task, no exceptions):**
1. If Claude can run it, Claude runs it. Never ask the user to execute CLI commands, start servers, or run builds.
2. Claude sets up the verification environment — start dev servers, seed databases, configure env vars BEFORE any checkpoint.
3. Users only do what requires human judgment — visual checks, UX evaluation, providing secrets.
4. Secrets come from user, automation comes from Claude — ask for API keys, then Claude uses them via CLI.
5. Auto-mode bypasses verification/decision checkpoints — when `settings.auto_advance: true`, human-verify auto-approves, decision auto-selects first option, human-action still stops (auth gates cannot be automated).

**Never present a checkpoint with a broken verification environment.** If `curl localhost:3000` fails, fix the server first — don't ask user to "visit localhost:3000".

---

## Step 1 — Load Plan (Paths Only)

Determine plan path from `$ARGUMENTS` or STATE.md `resume_file`.

Read PLAN.md: extract phase, wave_count, risk_tier, tdd_mode, playwright_required, checkpoint_before, all task definitions.

Read TASK_GRAPH.json: get current task statuses (for resume support).

Read `settings.json`: check `auto_advance` flag.

**Orchestrator goal: hold structure, not file contents. Target <15% context.**

---

## Step 2 — Validate Preconditions

1. PLAN.md status is not `complete`
2. Loop position in STATE.md is PLAN ✓
3. If EXECUTE already in-progress: find last completed task, resume from there
4. If `--gaps-only`: filter task list to gap_closure tasks only
5. Required skills: read `settings.json → required_skills`, block if any missing

Update STATE.md:
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ●           ○         ○
[Executing — Wave 1 of {wave_count}]
```

---

## Step 3 — Announce Execution Plan

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► EXECUTING Phase {N}: {Name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Wave | Tasks | What it builds |
|------|-------|----------------|
| 1    | T01, T02 | {2-5 word description each} |
| 2    | T03      | {description} |

Risk: {tier} | TDD: {mode} | Auto-mode: {on/off}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 4 — Wave Execution Loop

For each wave from 1 to wave_count in order:

### 4a — Get Wave Tasks

Collect tasks where `wave == current_wave`. Skip tasks with `status: complete` (resume support). For `--gaps-only`: also skip tasks without `gap_closure: true`.

### 4b — Verify Dependencies

For each task, all `depends_on` tasks must be `status: complete`. If not: stop with clear dependency error.

### 4c — Checkpoint High/Critical Tasks

For any task with `risk_tier: high` or `critical`, create checkpoint BEFORE dispatch:

```bash
git add -u && git stash --include-untracked -m "nexus-checkpoint-{task-id}-{timestamp}"
```

Write checkpoint record to `.nexus/06-checkpoints/`. Announce: "Checkpoint created before {task-id}."

### 4d — Announce Wave

```
---
## Wave {N}

{For each task: "T{id}: {what this builds — 2-3 sentences, technical approach, why it matters}"}

Spawning {count} worker(s)...
---
```

Good: "T01: POST /api/auth/login endpoint — bcrypt password comparison, JWT session token on success, 401 on failure. Foundation for all authenticated routes."
Bad: "Executing authentication task."

### 4e — Dispatch Workers (Paths Only)

For each task, spawn a worker. Parallel if `settings.parallelization: true`, sequential otherwise.

**Pass task definition and file paths — worker reads its own context. Do NOT read file contents in orchestrator.**

```
Task(
  subagent_type="nexus-worker",
  description="T{id}: {short description}",
  prompt="
    Read ~/.claude/agents/nexus/worker.md for your role and rules.

    Execute: T{id}: {full description}

    Your context packet — read each of these yourself at start:
    task: {inline JSON of task definition}
    files_modified: {list of file paths}
    architectureSlice: sections of .nexus/02-architecture/modules.json for modules owning {files}
    contractsSlice: .nexus/02-architecture/api_contracts.json entries for {files}
    testsSlice: .nexus/03-index/test_map.json entries for {files}
    stateDigest: first 150 lines of .nexus/01-governance/STATE.md
    scars: Active Prevention Rules table from .nexus/01-governance/SCARS.md
    settings: .nexus/01-governance/settings.json
    boundaries: {DO NOT CHANGE list from PLAN.md boundaries section}
    tddMode: {task.tdd_mode}

    ONLY read files in files_modified + the paths above.
    ONLY write to files in files_modified.
    Use NEXUS_PERMISSION_REQUEST for anything else.
  "
)
```

### 4f — Handle NEXUS_PERMISSION_REQUEST

Worker requests a file outside context: evaluate legitimacy, grant with content or deny with explanation. Log all grants in STATE.md.

### 4g — On NEXUS_COMPLETE — Spot-Check First

When worker reports `<<NEXUS_COMPLETE>>`:

**Spot-check BEFORE dispatching validator (prevents wasted validator turns on false completions):**

```bash
# 1. All declared files exist on disk (handles 0, 1, or many files)
ls -1 {files_modified...} 2>/dev/null | wc -l
# Expected count must equal files_modified.length

# 2. Non-empty diff exists
git diff --stat HEAD -- {files_modified...}
```

If spot-check fails: treat as NEXUS_BLOCKED — do NOT dispatch validator:
```
T{id} spot-check failed: {N of M files found / zero diff}
Wave paused — possible false completion signal.
```

If spot-check passes: dispatch validator (paths only):

```
Task(
  subagent_type="nexus-validator",
  description="Validate T{id}",
  prompt="
    Read ~/.claude/agents/nexus/validator.md for your role.

    Validate T{id}: {description}

    Read and check:
    - {each file in task.files_modified}
    - Run: {settings.commands.lint} -- {files}
    - Run: {settings.commands.typecheck}
    - Run: {settings.commands.test} {test files}

    Return ## VALIDATION PASSED with summary,
    or ## VALIDATION FAILED with exact errors.
  "
)
```

On pass: mark T{id} `complete` in TASK_GRAPH.json:
```
T{id} ✓  Spot-check: pass | Validator: pass (lint clean, tests green)
```

Also extract and log deviations from worker's NEXUS_COMPLETE payload to STATE.md.

On fail: mark T{id} `blocked`. Report failures. Pause wave. Do NOT continue.

**3-consecutive-failures rule:** After 3 failed validator attempts on same task → STOP. Escalate to architect (see Step 4h). Do not attempt fix #4.

### 4h — On NEXUS_BLOCKED

Parse the blocked payload to determine type. Display the appropriate checkpoint format:

**`checkpoint:human-verify`** — Claude automated everything, human confirms it works:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: {completed}/{total} tasks complete
Task: {task.id}: {task.description}

Built: {what was built}

How to verify:
  1. {exact step — URL to visit, expected behavior}
  2. {next step}
  3. {etc.}

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

After "approved": mark task complete, continue to next task.
After issues described: re-dispatch worker with issue details, increment retry counter.

---

**`checkpoint:decision`** — Human must make a choice that affects implementation:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                        ║
╚═══════════════════════════════════════════════════════╝

Progress: {completed}/{total} tasks complete
Task: {task.id}: {task.description}

Decision: {what's being decided}

Context: {why this decision matters — impact on the plan}

Options:
  1. {option name}
     Pros: {benefits}
     Cons: {tradeoffs}

  2. {option name}
     Pros: {benefits}
     Cons: {tradeoffs}

────────────────────────────────────────────────────────
→ YOUR ACTION: Select 1, 2, or describe your choice
────────────────────────────────────────────────────────
```

After selection: embed decision in context, re-dispatch worker with decision locked in.

---

**`checkpoint:human-action`** — Auth gate or truly unavoidable manual step:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: {completed}/{total} tasks complete
Task: {task.id}: {task.description}

Attempted: {exact CLI command that was run}
Error: {exact error message received}

What you need to do:
  1. {exact step — CLI command or URL to visit}
  2. {follow-up step if needed}

I'll verify: {exact CLI command Claude will run to confirm it worked}

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when complete
────────────────────────────────────────────────────────
```

After "done": run the verification command. If passes → re-dispatch worker to retry original task. If still fails → surface error.

---

**Generic block (no type field or architectural issue):**

```
════════════════════════════════════════
  WAVE {N} BLOCKED
════════════════════════════════════════

Task T{id}: {reason}

[1] Provide clarification and retry
[2] Skip task (mark deferred — creates gap)
[3] Pause session
════════════════════════════════════════
```

---

**3-consecutive-failures → architect escalation:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3 CONSECUTIVE FAILURES — T{id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task: {description}
Failure pattern: {what kept failing across all 3 attempts}

This is an architectural problem, not a patch problem.
Dispatching architect agent to analyze...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Dispatch architect agent with task + 3 failure outputs. Present findings. Wait for user choice. On resolution: revise task and re-dispatch, OR `/nexus:recover`. Record in STATE.md.

### 4i — Auto-Mode Checkpoint Behavior

Before displaying any checkpoint, check `settings.auto_advance`:

**If `auto_advance: true`:**
- `checkpoint:human-verify` → log `⚡ Auto-approved: {what-built}`, continue to next task
- `checkpoint:decision` → log `⚡ Auto-selected: {first option name}`, embed in next worker dispatch, continue
- `checkpoint:human-action` → ALWAYS display full checkpoint. Auth gates cannot be automated.

**If `auto_advance: false` or `--manual` flag:**
- Display ALL checkpoints. Wait for user response before continuing.

### 4j — Wave Complete

All tasks in wave must be `complete` before next wave.

```
---
## Wave {N} Complete ✓

{What was built — from TASK_GRAPH notes}
{If deviations: "Auto-fixes applied: N (see task logs for details)"}
{If more waves: "This enables: {what next wave depends on}"}
---
```

---

## Step 5 — All Waves Complete

Update TASK_GRAPH.json: all tasks `complete`.
Update STATE.md: loop position = EXECUTE ✓.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► EXECUTE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase: {N} | Waves: {count} | Tasks: {count}

| Wave | Tasks | Status |
|------|-------|--------|
| 1    | T01, T02 | ✓ |
| 2    | T03      | ✓ |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Auto-advance check:**

If `--manual` OR `settings.auto_advance: false`:
```
▶ NEXT: /nexus:verify
  Type "go" to proceed.
```

If `auto_advance: true` (default):
```
Auto-advancing to VERIFY in 3s... (type "stop" to pause)
```
Invoke `/nexus:verify {plan-path}`.

---

## Checkpoint Type Quick Reference

| Type | Frequency | Auto-mode | Standard |
|------|-----------|-----------|---------|
| human-verify | 90% | ⚡ Auto-approved | Await "approved" |
| decision | 9% | ⚡ Auto-selects option 1 | Await selection |
| human-action | 1% | ALWAYS stops | Await "done" |

**Automatable quick reference:**
| Action | Claude does it? |
|--------|-----------------|
| Deploy (vercel/railway/fly) | YES |
| Start dev server | YES |
| Run tests/builds | YES |
| Seed database | YES |
| Write .env file | YES |
| Add env vars to platforms | YES |
| Click email verification link | NO |
| Complete OAuth in browser | NO |
| Visually verify UI layout | NO |

---

## Known Issue: Claude Code classifyHandoffIfNeeded

If a worker reports "failed" with `classifyHandoffIfNeeded is not defined` — this is a Claude Code runtime bug (fires in completion handler after all tool calls finish). Run spot-check manually. If spot-check passes → treat as successful completion.

---

## Anti-Patterns

**Loading file contents in orchestrator:** Pass paths. Workers read their own context. Orchestrator holds structure only.

**Skipping spot-check:** 3-line check prevents wasting a full validator agent turn on false completions.

**Continuing past a blocked task:** Waves are sequenced for dependency reasons. Never skip ahead.

**Retrying the same approach after 3 failures:** Escalate to architect. Do not attempt fix #4.

**Asking user to start dev server or run builds:** Claude runs everything. User only visits URLs and provides secrets.

**Presenting checkpoint with broken environment:** Fix the server first, then checkpoint.

**Pre-planning human-action checkpoints for automatable work:** Auth gates are discovered dynamically. Claude automates first, requests credentials only when actually blocked.

---

## Success Criteria

- [ ] execute-phase.md loaded (RULE 0)
- [ ] Automation-first: Claude runs all CLI/server/build commands
- [ ] Orchestrator context lean — no file contents loaded
- [ ] Required skills verified before execution
- [ ] Auto-mode flag checked from settings.json
- [ ] Checkpoints created for high/critical tasks
- [ ] Workers dispatched with paths only (150-line state digest)
- [ ] Spot-check runs before each validator dispatch
- [ ] 3-consecutive-failures escalation honored — architect dispatched
- [ ] Checkpoint types displayed with ╔═══╗ box format
- [ ] Auto-mode checkpoints handled (auto-approve verify, auto-select decision, always stop for human-action)
- [ ] Deviations extracted and logged from worker NEXUS_COMPLETE payloads
- [ ] TASK_GRAPH.json updated
- [ ] STATE.md: EXECUTE ✓
- [ ] Auto-advanced to /nexus:verify (or "go" prompt)
