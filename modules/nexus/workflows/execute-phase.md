# Execute Phase Workflow

Implements wave-based task execution for `/nexus:execute`. Lean orchestrator: holds structure, not file contents. Dispatches workers with a pre-built context packet — all 14 slots inline.

**Key principle: Orchestrator target <15% context. Workers each get a fresh 200k context. Build the context packet once in orchestrator — pass all 14 slots inline to each worker.**

**Automation first:** Claude runs all CLI/server/build commands. Users NEVER run commands — they only visit URLs, evaluate visuals, provide secrets. Claude sets up the verification environment before any checkpoint.

---

## Load Plan (Paths Only)

1. Resolve plan path from $ARGUMENTS or STATE.md resume_file
2. Read PLAN.md: extract phase, wave_count, risk_tier, tdd_mode, playwright_required, checkpoint_before, all task definitions
3. Read TASK_GRAPH.json: get current task statuses (for resume support)
4. Verify loop position is PLAN ✓
5. If EXECUTE already in-progress: find last completed task, resume from there

**Orchestrator must NOT read file contents directly. Delegate all context loading to ContextPacketBuilder — it reads and filters everything. Orchestrator holds task definitions and the pre-built packets only.**

---

## Validate Preconditions

1. PLAN.md status is not `complete`
2. Loop position in STATE.md is PLAN ✓
3. Required skills: read `settings.json → required_skills`, block if any missing
4. If `--gaps-only`: filter task list to `gap_closure: true` tasks only

---

## Update STATE.md

Set loop position EXECUTE ●:
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ●           ○         ○
[Executing — Wave 1 of {wave_count}]
```

---

## Announce Execution Plan

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► EXECUTING Phase {N}: {Name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Wave | Tasks | What it builds |
|------|-------|----------------|
| 1    | T01, T02 | {2-5 word description each} |
| 2    | T03      | {description} |

Risk: {tier} | TDD: {mode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Wave Execution Loop

For each wave from 1 to wave_count in order:

### Wave Start

1. Get all tasks where `wave == current_wave`
2. Skip tasks with `status: complete` (resume support)
3. For `--gaps-only`: also skip tasks without `gap_closure: true`
4. Verify all `depends_on` tasks are `status: complete` in TASK_GRAPH.json
5. Announce wave:

```
---
## Wave {N}

{For each task: "T{id}: {what this builds — 2-3 sentences, technical approach, why it matters}"}

Spawning {count} worker(s)...
---
```

Good description: "T01: POST /api/auth/login endpoint — bcrypt password comparison, JWT session token on success, 401 on failure. Foundation for all authenticated routes."
Bad description: "Executing authentication task."

### Checkpoint High/Critical Tasks

For any task with `risk_tier: high` or `critical`, create checkpoint BEFORE dispatch:
```bash
git add -A && git stash --include-untracked -m "nexus-checkpoint-{task-id}-{timestamp}"
```
Write checkpoint record to `.nexus/06-checkpoints/`. Announce: "Checkpoint created before {task-id}."

### Build Context Packet and Dispatch Workers

Before dispatching any worker in the wave, call `ContextPacketBuilder.buildForTask(task, allTasks)` for each task. This builds all 14 slots in parallel and returns a `ContextPacket` object. Then pass it inline to the worker — workers receive pre-loaded content, not paths to read.

For each task, spawn a worker. Parallel if `settings.parallelization: true`, sequential otherwise.

**Pass the full pre-built ContextPacket inline. Workers do NOT read their own context — everything is pre-loaded.**

```
Task(
  subagent_type="nexus-worker",
  prompt="
    Read ~/.claude/agents/nexus/worker.md for your role and rules.

    Execute: T{id}: {full description}

    ## Your Pre-Built Context Packet (14 slots — all pre-loaded, do not re-read these files)

    ### Identity
    taskId: {packet.taskId}
    tddMode: {packet.tddMode}        ← hard | standard | skip — governs your testing discipline
    riskTier: {packet.riskTier}      ← low | medium | high | critical

    ### WHY (why does this task exist?)
    missionContext:
    {packet.missionContext}

    phaseObjective:
    {packet.phaseObjective}

    ### WHAT (what exactly must be built)
    files: {packet.files}

    filesContent:
    {For each file in packet.filesContent: "--- {filename} ---\n{content}\n---"}
    (empty string = file does not exist yet — create it)

    acceptanceCriteria:
    {packet.acceptanceCriteria}

    ### HOW (how the system is structured and what you can call)
    architectureSlice:
    {JSON.stringify(packet.architectureSlice)}

    contractsSlice:
    {JSON.stringify(packet.contractsSlice)}

    dependencySymbols (exported names from files you import but don't own):
    {JSON.stringify(packet.dependencySymbols)}

    testsSlice (test files covering your source files):
    {packet.testsSlice.join(', ') || '(none mapped yet)'}

    waveContext (what prior waves already built — build on top of this):
    {packet.waveContext}

    ### CONSTRAINTS (non-negotiable rules)
    scarsDigest (active prevention rules — do NOT repeat these failures):
    {packet.scarsDigest}

    stateDigest (loop position, recent decisions, blockers):
    {packet.stateDigest}

    boundaries (files you must NEVER touch):
    {packet.boundaries.join('\n') || '(none specified)'}

    ### TOOLING (exact commands to use)
    test command:      {packet.settings.commands.test}
    lint command:      {packet.settings.commands.lint}
    typecheck command: {packet.settings.commands.typecheck}
    {packet.settings.commands.build ? 'build command:     ' + packet.settings.commands.build : ''}
    auto_advance:      {packet.settings.auto_advance}

    ---

    ONLY write to files in the `files` list above.
    Use NEXUS_PERMISSION_REQUEST for any file not in your packet.
  "
)
```

### Handle NEXUS_PERMISSION_REQUEST

Worker requests a file outside context: evaluate legitimacy, grant with content or deny with explanation. Log all grants in STATE.md.

### On NEXUS_COMPLETE — Spot-Check First

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

If spot-check passes: dispatch validator (use commands from context packet):
```
Task(
  subagent_type="nexus-validator",
  prompt="
    Read ~/.claude/agents/nexus/validator.md for your role.

    Validate T{id}: {description}

    Files to check: {task.files_modified.join(', ')}
    Test files: {packet.testsSlice.join(', ') || 'run full suite'}

    Commands (from project settings — use these exactly):
    - Lint:      {packet.settings.commands.lint}
    - Typecheck: {packet.settings.commands.typecheck}
    - Test:      {packet.settings.commands.test} {test_files}

    Return ## VALIDATION PASSED with summary,
    or ## VALIDATION FAILED with exact errors.
  "
)
```

On pass: mark T{id} `complete` in TASK_GRAPH.json.
Also extract and log deviations from worker's NEXUS_COMPLETE payload to STATE.md.
On fail: mark T{id} `blocked`. Report failures. Pause wave.

**3-consecutive-failures rule:** After 3 failed validator attempts on same task → STOP. Do not attempt fix #4.

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

Dispatch architect agent:
```
Task(
  subagent_type="nexus-architect",
  prompt="
    Read ~/.claude/agents/nexus/architect.md for your role.

    Analyze why T{id} has failed 3 consecutive times.

    Task description: {description}
    Files involved: {files_modified}
    Failure outputs: {paste last 3 validator failure outputs}

    Read the relevant source files and identify the root cause.
    Is this a design flaw, missing dependency, wrong abstraction, or scope issue?

    Return:
    ## ARCHITECT ANALYSIS
    Root cause: {specific diagnosis}
    Options:
      [1] {option} — {what changes, estimated effort}
      [2] {option} — {what changes, estimated effort}
      [3] Roll back to checkpoint — {what we lose}
    Recommended: [N] — {one-line reason}
  "
)
```

After architect returns, present to user:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ARCHITECT ANALYSIS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{architect findings}

Choose an option (1/2/3):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

On user choice:
- `[1]` or `[2]`: revise the task per architect's recommendation, reset failure counter, re-dispatch worker
- `[3]` Roll back: invoke `/nexus:recover`, record scar, re-plan
- User types custom instruction: incorporate and re-dispatch

Record in STATE.md: `3-failure escalation: T{id} — architect dispatched — {date} — user chose option {N}`

### On NEXUS_BLOCKED

Parse the blocked payload to determine type. Check `settings.auto_advance` first (see Auto-Mode below).

**`checkpoint:human-verify`** (90% of checkpoints):
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: {completed}/{total} tasks complete
Task: {task.id}: {task.description}

Built: {what was built}

How to verify:
  1. {exact step — URL, expected behavior}
  2. {next step}

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

**`checkpoint:decision`** (9% of checkpoints):
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                        ║
╚═══════════════════════════════════════════════════════╝

Progress: {completed}/{total} tasks complete
Task: {task.id}: {task.description}

Decision: {what's being decided}

Options:
  1. {option name} — Pros: {benefits} | Cons: {tradeoffs}
  2. {option name} — Pros: {benefits} | Cons: {tradeoffs}

────────────────────────────────────────────────────────
→ YOUR ACTION: Select 1, 2, or describe your choice
────────────────────────────────────────────────────────
```

**`checkpoint:human-action`** (1% — auth gates, email links, 2FA):
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: {completed}/{total} tasks complete
Task: {task.id}: {task.description}

Attempted: {CLI command that was run}
Error: {exact error message}

What you need to do:
  1. {exact step}
  2. {follow-up if needed}

I'll verify: {CLI command to confirm}

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when complete
────────────────────────────────────────────────────────
```

**Generic block / architectural issue:**
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

**After checkpoint resolved:**
- human-verify "approved" → continue to next task
- decision selection → re-dispatch worker with decision embedded
- human-action "done" → run verification command, then re-dispatch worker
- Generic [2] → mark task deferred in TASK_GRAPH.json

### Auto-Mode Checkpoint Behavior

Before displaying any checkpoint, check `settings.auto_advance`:

- `checkpoint:human-verify` + auto_advance true → log `⚡ Auto-approved: {what-built}`, continue
- `checkpoint:decision` + auto_advance true → log `⚡ Auto-selected: {first option}`, embed decision, continue
- `checkpoint:human-action` → ALWAYS display. Auth gates cannot be automated, ever.

### Wave Complete

All tasks in wave must be `complete` before next wave:
```
---
## Wave {N} Complete ✓

{What was built — from TASK_GRAPH notes}
{If more waves: "This enables: {what next wave depends on}"}
---
```

---

## All Waves Complete

1. Update TASK_GRAPH.json: all tasks `complete`
2. Update STATE.md: loop position EXECUTE ✓

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

---

## Auto-Advance

If `--manual` OR `auto_advance: false`:
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

## Known Issue: classifyHandoffIfNeeded

If a worker reports "failed" with `classifyHandoffIfNeeded is not defined` — this is a Claude Code runtime bug (fires in completion handler after all tool calls finish). Run spot-check manually. If spot-check passes → treat as successful completion.
