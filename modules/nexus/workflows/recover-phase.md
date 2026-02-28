# Recover Phase Workflow

Implements the rollback and Scar recording flow for `/nexus:recover`.

---

## List Checkpoints

1. Read all files from `.nexus/06-checkpoints/checkpoint-*.json`
2. Read git stash list for nexus-checkpoint entries
3. Display numbered list with: id, created date, phase, task id, reason

If no checkpoints: output guidance on manual recovery. Stop.

---

## Show Diff

After user selects checkpoint:

1. Get `gitRef` from checkpoint JSON
2. Run: `git diff {gitRef}..HEAD --stat`
3. Display files that would be reverted
4. Include .nexus/ state changes in diff view

---

## Confirm Rollback

Display:
```
This will roll back to: {checkpoint-id}
{N} files will be reverted.
This cannot be undone.

Continue? (yes/no)
```

If no: stop. No changes made.

---

## Execute Rollback

### Git Reset

```bash
git reset --hard {checkpoint.gitRef}
```

### Restore .nexus/ State

If checkpoint includes a state snapshot: restore STATE.md and TASK_GRAPH.json from snapshot.

### Verify Success

```bash
git status
```

Confirm working tree matches expectations. If unexpected: STOP and report.

---

## Quarantine Failed Patch

```bash
mkdir -p .nexus/07-artifacts/patches/
git diff {checkpoint.gitRef}..{failed_HEAD} > .nexus/07-artifacts/patches/failed-patch-{phase}-{timestamp}.diff
```

---

## Gather Root Cause

Ask: "What went wrong?"

Require specificity. Reject vague answers ("it didn't work"). Ask again with examples of good answers until root cause is specific and actionable.

---

## Record Scar

Derive prevention rule from root cause.

1. Append to SCARS.md Scar Log table
2. Add prevention rule to Active Prevention Rules table
3. Increment STATE.md scar_count

---

## Update STATE.md

1. Reset loop position to match checkpoint state
2. Increment scar_count
3. Add to session continuity:
   - Rolled back to: {checkpoint-id}
   - Scar: SCAR-{N}
   - Prevention rule: {rule}
   - Next action: Run /nexus:plan to re-plan

---

## Output

```
ROLLBACK COMPLETE

Rolled back to: {checkpoint-id}
Git state: {SHA}

Scar recorded: SCAR-{N}
  Root cause: {root cause}
  Prevention rule: {rule}

Failed patch quarantined: .nexus/07-artifacts/patches/failed-patch-{timestamp}.diff

Run /nexus:plan to re-plan the failed work.
```
