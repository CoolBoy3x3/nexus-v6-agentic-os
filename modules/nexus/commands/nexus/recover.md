---
name: recover
description: Roll back to a checkpoint, record the failure as a Scar, and re-plan
argument-hint: "[checkpoint-id]"
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
---

# nexus:recover

## RULE 0

Read `~/.claude/nexus/workflows/recover-phase.md` before executing this command.

Never execute from memory. The file is truth.

---

## Purpose

Roll back the project to a known-good state when things go wrong. Recovery is not failure — it is correct behavior. The goal is to undo the damage, understand why it happened, record a prevention rule, and re-plan with that knowledge.

Never use recovery to hide failures. Every recovery produces a Scar. Scars are permanent. They become prevention rules that protect all future work in this project.

---

## Step 1 — List Available Checkpoints

Read the checkpoints directory:

```bash
ls -la .nexus/06-checkpoints/checkpoint-*.json 2>/dev/null
```

Also check git stash if available:
```bash
git stash list 2>/dev/null | grep "nexus-checkpoint"
```

If no checkpoints exist:
```
No checkpoints found in .nexus/06-checkpoints/ or git stash.

Recovery requires a checkpoint to roll back to. Checkpoints are created:
  - Automatically before high/critical risk tasks (during /nexus:execute)
  - Manually by running /nexus:revise

If no checkpoints exist, you may need to:
  1. Use git directly: git log --oneline (find a safe commit)
  2. Use git reset --hard {SHA} (dangerous — discuss with team first)
  3. Manually restore files from their last known-good state

Run /nexus:progress to see the current project status.
```

---

## Step 2 — Show Checkpoint List and Diffs

For each checkpoint found, display:

```
════════════════════════════════════════
  AVAILABLE CHECKPOINTS
════════════════════════════════════════

[1] checkpoint-T02-2024-01-15-14-30
    Created: 2024-01-15T14:30:00Z
    Phase: 02-auth
    Task: T02 (high risk)
    Git ref: abc123f
    Reason: Pre-task checkpoint for high risk task

[2] checkpoint-prerevision-02-auth-2024-01-14-10-00
    Created: 2024-01-14T10:00:00Z
    Phase: 02-auth
    Reason: Pre-revision checkpoint

Current HEAD: def456g (2024-01-15T16:00:00Z)

Which checkpoint do you want to roll back to?
Enter number or checkpoint ID:
```

If `$ARGUMENTS` was provided with a checkpoint ID, skip the list and use that checkpoint directly.

---

## Step 3 — Show Diff

After the user selects a checkpoint, show the diff between current state and the checkpoint:

```bash
git diff {checkpoint_git_ref}..HEAD --stat 2>/dev/null
```

Display:
```
════════════════════════════════════════
  DIFF: Current vs {checkpoint-id}
════════════════════════════════════════

Files that would be reverted:
  src/auth/login.ts          (modified)
  src/auth/session.ts        (modified)
  src/auth/middleware.ts     (modified — will be DELETED, it was created after checkpoint)

.nexus/ state:
  .nexus/01-governance/STATE.md    (modified)
  .nexus/04-phases/02-auth/TASK_GRAPH.json (modified)

{N} files changed, {additions} additions to remove, {deletions} deletions to restore

════════════════════════════════════════
```

---

## Step 4 — Confirm Rollback

Ask for explicit confirmation:

```
This will roll back to checkpoint: {checkpoint-id}

What this means:
  - {N} files will be reverted to their state at {checkpoint timestamp}
  - Any work done after this checkpoint will be LOST
  - This cannot be undone without re-executing the work

The failure will be recorded as a Scar with a prevention rule.

Continue? (yes/no)
```

If the user says no: stop. No changes made.
If the user says yes: proceed.

---

## Step 5 — Execute Rollback

### 5a — If checkpoint uses git stash:
```bash
git stash pop {stash_id}
```

### 5b — If checkpoint uses git ref:
```bash
git reset --hard {checkpoint_git_ref}
```

### 5c — Restore .nexus/ state

If the checkpoint JSON includes a `.nexus/` state snapshot path, restore it:
```bash
cp {snapshot_path}/STATE.md .nexus/01-governance/STATE.md
cp {snapshot_path}/TASK_GRAPH.json .nexus/04-phases/{phase}/TASK_GRAPH.json
```

### 5d — Verify rollback succeeded

```bash
git status
```

Confirm the working tree matches expectations. If the rollback produced unexpected results, STOP and report to user before continuing.

---

## Step 6 — Quarantine the Failed Patch

Move any failed artifacts to the quarantine directory:

```bash
mkdir -p .nexus/07-artifacts/patches/
git diff {checkpoint_git_ref}..{failed_HEAD} > .nexus/07-artifacts/patches/failed-patch-{phase}-{timestamp}.diff
```

This preserves the failed work for analysis without leaving it in the active codebase.

---

## Step 7 — Ask About Root Cause

This is mandatory. The recovery is not complete without a Scar.

Ask:
```
What went wrong? (This becomes a prevention rule for all future work in this project.)

Be specific:
  Good: "The migration ran before the schema change, causing data loss in production"
  Good: "Worker wrote outside its declared files_modified, breaking the auth module"
  Bad: "It didn't work"
  Bad: "The code was wrong"

Root cause:
```

If the user provides a vague answer, ask them to be more specific. The prevention rule derived from this Scar will affect all future tasks.

---

## Step 8 — Record the Scar

Append to `.nexus/02-architecture/SCARS.md`:

**In the Scar Log table:**
```markdown
| SCAR-{auto-N} | {date} | {category} | {description} | {root cause from Step 7} | Rolled back to {checkpoint-id} | {prevention rule} |
```

**In the Active Prevention Rules table:**
```markdown
| {prevention rule derived from root cause} | SCAR-{N} | {today's date} |
```

**Deriving the prevention rule:** Transform the root cause into an actionable constraint that prevents recurrence. Examples:
- Root cause: "Worker wrote to files outside its declared scope"
  Prevention rule: "Always verify worker context packets list all files before dispatch; validator must reject undeclared writes"
- Root cause: "High-risk task ran without checkpoint"
  Prevention rule: "Any task with risk_tier: high must have checkpoint created before dispatch"

---

## Step 9 — Update STATE.md

Update STATE.md:
- Reset loop position to the appropriate state for the checkpoint (if checkpoint was pre-task: loop position goes back to EXECUTE ●)
- Increment scar_count
- Add to session continuity:

```markdown
## Session Continuity

Rolled back to: {checkpoint-id} at {ISO timestamp}
Reason: {root cause}
Scar recorded: SCAR-{N}
Prevention rule added: {rule}
Next action: Run /nexus:plan to re-plan the failed work
```

---

## Step 10 — Output

```
════════════════════════════════════════
  ROLLBACK COMPLETE
════════════════════════════════════════

Rolled back to: {checkpoint-id}
Phase: {phase name}
Git state: {git SHA}

Scar recorded: SCAR-{N}
  Root cause: {root cause}
  Prevention rule: {rule}

This prevention rule is now active and will be applied to all
future tasks in this project.

Failed patch quarantined: .nexus/07-artifacts/patches/failed-patch-{timestamp}.diff

════════════════════════════════════════
  NEXT ACTION: Run /nexus:plan to re-plan the failed work
════════════════════════════════════════
```

---

## Error Handling

**Rollback itself fails:** Do NOT attempt a second rollback. Report the failure. Provide git commands for the user to run manually. Never silently continue after a failed rollback.

**Root cause is missing:** The Scar cannot be written without a root cause. Keep asking until a specific, actionable root cause is provided.

**Checkpoint is stale (too old):** Warn the user: "This checkpoint is {N} days old. Rolling back may lose significant work. You may want to find a more recent checkpoint or proceed with a targeted fix instead. Continue? (yes/no)"

---

## Success Criteria

- [ ] Checkpoints listed from .nexus/06-checkpoints/ and git stash
- [ ] Diff shown between current state and selected checkpoint
- [ ] Explicit user confirmation obtained before rollback
- [ ] Rollback executed (git reset or stash pop)
- [ ] .nexus/ state restored to match checkpoint
- [ ] Failed patch quarantined to .nexus/07-artifacts/patches/
- [ ] Root cause gathered from user
- [ ] Scar recorded in SCARS.md with root cause and prevention rule
- [ ] Prevention rule added to Active Prevention Rules table
- [ ] STATE.md updated: loop position reset, scar_count incremented
- [ ] Output: "Rolled back to {id}. Prevention rule added: {rule}. Run /nexus:plan to re-plan."
