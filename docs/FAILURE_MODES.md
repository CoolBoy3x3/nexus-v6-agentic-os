# Nexus V6 — Failure Modes and Troubleshooting Guide

> This guide covers the most common failure modes in the Nexus governance loop and how to resolve them.

---

## Overview

Nexus is designed to fail safely. Every failure mode triggers a defined response: halt execution,
preserve state, write a gap report, and provide clear instructions for recovery. This guide documents
the failure modes you are most likely to encounter and the steps to resolve them.

All failure signals are written to `.nexus/05-context/gaps/` as JSON gap reports. Always check this
directory first when something goes wrong.

---

## Failure Mode 1: Task Fails During Execution

### Symptoms

```
[nexus-runtime] Task task-0042 FAILED after 45.2s
[nexus-runtime] Signal: NEXUS_BLOCKED
[nexus-runtime] Reason: Worker agent reported non-zero exit
[nexus-runtime] Checkpoint: ckpt-20260228-142301-a3f9
[nexus-runtime] Action: Rolling back to checkpoint...
[nexus-runtime] Rollback complete. Wave 2 halted.
```

The task file is moved from `.nexus/04-tasks/in-progress/` to `.nexus/04-tasks/blocked/`.

### What Happened

The worker agent executing the task encountered an error it could not recover from. This could be:
- A TypeScript compilation error that blocked the agent
- A file permission error preventing writes
- The agent running out of context and producing partial output
- An unexpected dependency that the agent could not resolve

### Resolution Steps

1. **Read the gap report:**
   ```bash
   cat .nexus/05-context/gaps/gap-task-0042.json
   ```

2. **Check the agent log:**
   ```bash
   cat .nexus/07-artifacts/logs/task-0042.log
   ```

3. **Inspect the blocked task:**
   ```bash
   cat .nexus/04-tasks/blocked/task-0042.md
   ```

4. **Verify rollback was clean:**
   ```bash
   nexus status
   git status
   ```

5. **Re-plan the task with additional context:**
   The gap report will contain the error details. Add them as additional context to the task and
   re-queue it:
   ```bash
   nexus requeue task-0042 --with-gap
   nexus execute --wave 2
   ```

6. **If the task keeps failing (3+ times):** See Failure Mode 3 (3 Consecutive Failures).

### Prevention

- Ensure `files_to_touch` lists all files the task needs to modify (not just create)
- Keep context packets narrow — a large context packet increases the chance of agent confusion
- Verify the architecture rules allow the imports the task needs to make

---

## Failure Mode 2: Verification Fails

### Symptoms

```
[nexus-validator] Running verification ladder for wave 2...
[nexus-validator] Physicality check: PASS
[nexus-validator] Goal-backward check: FAIL
[nexus-validator]   MISSING: AC-07 — "Given valid JWT, middleware passes request"
[nexus-validator]   STUB DETECTED: src/auth/jwt.ts:validateToken — function body is TODO comment
[nexus-validator] Verification: FAIL
[nexus-validator] Gap report written: .nexus/05-context/gaps/verify-gap-wave-2.json
```

### What Happened

The code was written, but it does not meet the acceptance criteria. The most common reasons:
- A function was stubbed out (`// TODO: implement`) instead of fully implemented
- An acceptance criterion was overlooked during task execution
- The implementation is present but the test that validates it is failing

### Resolution Steps

1. **Read the verification gap report:**
   ```bash
   cat .nexus/05-context/gaps/verify-gap-wave-2.json
   ```

2. **Identify the specific gaps:**
   - `MISSING_CRITERION`: an AC was not addressed
   - `STUB_DETECTED`: a function body is a placeholder
   - `TEST_FAILURE`: a unit test is failing
   - `TYPE_ERROR`: TypeScript compilation fails

3. **Re-plan with specific fixes:**
   ```bash
   nexus replan --from-gap .nexus/05-context/gaps/verify-gap-wave-2.json
   ```
   This creates new tasks that specifically address the gaps found.

4. **Execute the fix tasks:**
   ```bash
   nexus execute --wave 2-fix
   ```

5. **Re-verify:**
   ```bash
   nexus verify
   ```

6. **If the same gaps reappear:** The worker agent may not have enough context about what
   "not a stub" means. Add explicit examples to the task description.

### Gap Report Format

```json
{
  "gapId": "verify-gap-wave-2",
  "waveId": "wave-2",
  "timestamp": "2026-02-28T14:45:00Z",
  "checks": {
    "physicality": "PASS",
    "goalBackward": "FAIL",
    "contracts": "PASS",
    "typecheck": "PASS",
    "lint": "PASS",
    "tests": "FAIL",
    "playwright": "SKIPPED"
  },
  "gaps": [
    {
      "type": "STUB_DETECTED",
      "file": "src/auth/jwt.ts",
      "line": 42,
      "function": "validateToken",
      "evidence": "throw new Error('not implemented')"
    },
    {
      "type": "TEST_FAILURE",
      "testFile": "tests/auth/jwt.test.ts",
      "testName": "validateToken returns payload for valid JWT",
      "error": "Error: not implemented"
    }
  ]
}
```

---

## Failure Mode 3: 3 Consecutive Failures

### Symptoms

```
[nexus-runtime] Task task-0042 has failed 3 consecutive times.
[nexus-runtime] This indicates an architectural problem that cannot be solved at the task level.
[nexus-runtime] Action: Escalating to architect agent.
[nexus-runtime] All waves in this phase are HALTED pending architect review.
```

### What Happened

A task has failed 3 times in a row despite gap reports and re-planning. This is a signal that the
problem is not a simple implementation error — it is a deeper architectural or design issue that
the worker agent cannot solve alone.

Common causes:
- The module boundaries declared in `modules.json` make the task impossible to implement correctly
- The acceptance criteria conflict with the current data model
- A dependency that the task requires has not been implemented yet
- The task decomposition was incorrect — the task is too large or has hidden prerequisites

### Resolution Steps

1. **Do not attempt a fourth execution.** The escalation flag is now set.

2. **Run the architect review:**
   ```bash
   nexus architect-review task-0042
   ```
   This command assembles a broad context packet (not a narrow one) including:
   - The full task history with all gap reports
   - The current module graph
   - The acceptance criteria that are failing
   - The codebase sections involved

3. **The architect agent will produce one of:**
   - A redesign of the task decomposition (new tasks replacing the failed one)
   - A proposed change to `modules.json` to allow the necessary imports
   - A flag that the acceptance criteria need clarification from the human

4. **Apply the architect recommendation:**
   ```bash
   nexus apply-architect-plan architect-plan-task-0042.json
   ```

5. **Reset the failure counter and re-execute:**
   ```bash
   nexus reset-failures task-0042
   nexus execute --wave 2
   ```

### When Human Intervention Is Required

If the architect agent flags that the acceptance criteria need clarification:
- The task is moved to `.nexus/04-tasks/blocked/` with status `NEEDS_HUMAN_REVIEW`
- Nexus halts the entire phase
- A human must review `.nexus/05-context/gaps/architect-review-task-0042.json` and clarify the requirements
- After clarification, run `nexus replan --from-human-review` to continue

---

## Failure Mode 4: Checkpoint Creation Fails

### Symptoms

```
[nexus-runtime] Creating checkpoint before task task-0042...
[nexus-runtime] ERROR: git commit failed
[nexus-runtime] stdout: On branch main
[nexus-runtime] stderr: error: Your local changes to the following files would be overwritten by commit:
[nexus-runtime]         src/auth/jwt.ts
[nexus-runtime] HALTED: Cannot create checkpoint. Resolve git issues first.
```

### What Happened

The checkpoint system relies on git commits to tag the pre-task state. If git is in a bad state,
checkpoint creation fails and Nexus halts rather than proceeding without a safety net.

Common causes:
- Merge conflict markers in files
- Files in an unexpected git state (untracked large files, locked index)
- Disk space exhausted
- Git repository corruption

### Resolution Steps

1. **Check git status:**
   ```bash
   git status
   git diff --stat
   ```

2. **Check disk space:**
   ```bash
   df -h .
   du -sh .nexus/
   du -sh .git/
   ```

3. **Resolve git issues:**
   - If there are conflict markers: resolve conflicts manually and `git add .`
   - If index is locked: remove `.git/index.lock` (only if no other git process is running)
   - If there are uncommitted changes that should not be there: either commit or stash them

4. **Clean up old artifacts if disk is low:**
   ```bash
   # Archive old Playwright artifacts
   tar -czf playwright-archive-$(date +%Y%m%d).tar.gz .nexus/07-artifacts/
   rm -rf .nexus/07-artifacts/screenshots/ .nexus/07-artifacts/videos/
   mkdir -p .nexus/07-artifacts/screenshots/ .nexus/07-artifacts/videos/

   # Clean up processed context packets
   rm -rf .nexus/05-context/processed/
   ```

5. **Retry the task:**
   ```bash
   nexus execute --wave 2
   ```

---

## Failure Mode 5: Mailbox Corruption

### Symptoms

```
[nexus-runtime] Mailbox poll error: SyntaxError: Unexpected end of JSON input
[nexus-runtime] File: .nexus/05-context/packets/ctx-task-0043-wave-2.json
[nexus-runtime] Mailbox appears corrupted. Attempting recovery...
[nexus-runtime] Recovery failed. Manual cleanup required.
```

### What Happened

A context packet or mailbox message file is corrupted — typically because a write was interrupted
mid-way (process killed, power loss, disk full during write). The JSON is invalid and cannot be
parsed.

### Resolution Steps

1. **Identify the corrupted file:**
   ```bash
   ls -la .nexus/05-context/packets/
   # Look for files with 0 size or very small unexpected sizes
   ```

2. **Try to parse each file to find the corrupted one:**
   ```bash
   for f in .nexus/05-context/packets/*.json; do
     node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>&1 && echo "OK: $f" || echo "CORRUPT: $f"
   done
   ```

3. **Delete corrupted files:**
   ```bash
   rm .nexus/05-context/packets/ctx-task-0043-wave-2.json
   ```

4. **Clean up the processed directory:**
   ```bash
   # Move everything to processed (they will be regenerated)
   mv .nexus/05-context/packets/*.json .nexus/05-context/processed/ 2>/dev/null || true
   ```

5. **Re-run the planner to regenerate context packets:**
   ```bash
   nexus plan --regenerate-packets --wave 2
   ```

6. **Retry execution:**
   ```bash
   nexus execute --wave 2
   ```

### Prevention

- Ensure adequate disk space before starting long execution runs
- Do not kill the Nexus process with SIGKILL (use Ctrl+C which sends SIGINT and triggers cleanup)
- Run `nexus doctor` before starting new work sessions

---

## Failure Mode 6: Deadlock in Task Graph

### Symptoms

```
[nexus-runtime] Analyzing task graph for wave scheduling...
[nexus-runtime] ERROR: Circular dependency detected in task graph:
[nexus-runtime]   task-0041 -> task-0042 -> task-0043 -> task-0041
[nexus-runtime] Cannot schedule waves. Re-plan required.
```

### What Happened

The tasks generated by the planner have circular dependencies. Task A depends on Task B which depends
on Task C which depends on Task A. This creates an unresolvable scheduling problem — none of the tasks
can be placed in a wave because each depends on another that has not yet run.

Common causes:
- The planner created interdependent tasks for features that should have been decoupled
- A shared utility was needed by multiple tasks and each task was marked as depending on the other
  to create it
- Task decomposition was too fine-grained, creating artificial dependencies

### Resolution Steps

1. **View the cycle output:**
   ```bash
   nexus detect-cycles
   ```
   This prints the full cycle path with task titles for each task in the cycle.

2. **Read each task in the cycle:**
   ```bash
   cat .nexus/04-tasks/backlog/task-0041.md
   cat .nexus/04-tasks/backlog/task-0042.md
   cat .nexus/04-tasks/backlog/task-0043.md
   ```

3. **Identify the shared dependency:**
   Usually one of the tasks in the cycle should be a prerequisite for the others. Identify which
   task creates the shared artifact (type, interface, utility function) that the others need.

4. **Break the cycle:**
   Option A — Extract a foundation task:
   ```bash
   nexus split-task task-0041 --extract-foundation
   ```
   This creates a new `task-0041a` that just creates the shared artifact, and updates `task-0041`
   to depend on it.

   Option B — Merge circular tasks:
   ```bash
   nexus merge-tasks task-0041 task-0042
   ```
   Merges two tasks into one, eliminating the dependency.

   Option C — Manual re-plan:
   Edit the task files directly to remove the circular dependency, then re-run the scheduler.

5. **Re-schedule:**
   ```bash
   nexus schedule --rebuild
   nexus execute --wave 1
   ```

---

## Failure Mode 7: Context Packet Too Large

### Symptoms

```
[nexus-runtime] Building context packet for task task-0051...
[nexus-runtime] WARNING: Packet size 147KB exceeds limit of 100KB
[nexus-runtime] Context reduction required before execution.
[nexus-runtime] Largest contributors:
[nexus-runtime]   src/generated/api-client.ts       82KB
[nexus-runtime]   src/types/database-schema.ts      31KB
[nexus-runtime]   .nexus/00-mission/PRD.md           14KB
```

### What Happened

The context packet for a task exceeds the 100KB limit. This happens when:
- The task's `files_to_touch` list includes very large files (generated code, large schemas)
- The task spans too many modules, requiring too many interface definitions
- The PRD or acceptance master is too large to include

### Resolution Steps

1. **Check the file list:**
   ```bash
   nexus show-packet task-0051 --sizes
   ```
   This shows each file in the context packet and its contribution to total size.

2. **Remove generated files from files_to_touch:**
   Generated files (API clients, schema types) should typically not be in `files_to_touch`. If the
   task needs to reference them, they should be provided as interface summaries, not full file content.
   Edit the task file to remove generated files from the list.

3. **Reduce scope — split the task:**
   ```bash
   nexus split-task task-0051 --max-packet-size 80KB
   ```
   This automatically splits the task into sub-tasks, each with a context packet under 80KB.

4. **Use interface summaries instead of full files:**
   For large type definition files, Nexus can extract only the relevant type signatures:
   ```bash
   nexus extract-interfaces src/types/database-schema.ts --for task-0051
   ```
   This creates a summary file with only the types the task references.

5. **Retry:**
   ```bash
   nexus execute --wave 3
   ```

---

## General Diagnostic Commands

```bash
# Full health check
nexus doctor

# Show current task state
nexus status

# Show all gap reports
ls -la .nexus/05-context/gaps/

# Show checkpoint history
nexus checkpoints list

# Show task failure history
nexus task-history --failed

# Validate all schemas
nexus validate-schemas

# Reset a specific task's failure count
nexus reset-failures task-0042

# Force re-index the codebase
nexus build-index --force

# Force rebuild the architecture graph
nexus build-architecture --force
```

---

## Emergency Recovery

If the Nexus workspace is in a completely broken state and normal recovery steps are not working:

```bash
# 1. Find the most recent clean checkpoint
nexus checkpoints list --status clean

# 2. Restore from checkpoint
nexus rollback ckpt-20260228-120000-x7b2

# 3. Rebuild all derived state
nexus build-index --force
nexus build-architecture --force

# 4. Run doctor to verify clean state
nexus doctor

# 5. Re-plan from the current state
nexus plan --phase current
```

If git history is needed:
```bash
# Show all nexus checkpoint commits
git log --oneline refs/nexus/checkpoints/
```
