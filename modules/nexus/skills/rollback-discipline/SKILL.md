---
name: rollback-discipline
description: Checkpoint-before-risk policy, 3-consecutive-failures rule, and how to record Scars after recovery.
---

# Rollback Discipline

## Core Principle

**Rollback is not failure. Rollback is correct behavior.**

The failure is not in needing to roll back. The failure is in not rolling back when you should, and instead attempting fixes that compound the damage until recovery is impossible.

Experienced engineers roll back readily. They know that the cost of a rollback is bounded (lose the work since the last checkpoint, re-plan, try again). The cost of NOT rolling back can be unbounded (corrupted data, broken production, security breach, weeks of debugging).

---

## Policy 1: Checkpoint-Before-Risk

Any task with `risk_tier: high` or `risk_tier: critical` **must** have a checkpoint created before the worker dispatches.

This is enforced by the mission-controller and the execute workflow. It is not optional.

### What a Checkpoint Is

A checkpoint records the current state of the codebase so it can be restored exactly:

```json
{
  "id": "checkpoint-T03-2024-01-15T14:30:00Z",
  "taskId": "T03",
  "phase": "02-auth",
  "gitRef": "abc123f7",
  "stateSnapshot": ".nexus/06-checkpoints/snapshot-T03/",
  "reason": "Pre-task checkpoint for critical risk task: database migration",
  "created": "2024-01-15T14:30:00Z"
}
```

The `gitRef` is the commit SHA at the moment of checkpointing. Rolling back means `git reset --hard abc123f7`.

### Creating a Checkpoint

```bash
# Get current git ref
GIT_REF=$(git rev-parse HEAD)

# Create checkpoint JSON
cat > .nexus/06-checkpoints/checkpoint-{task-id}-{timestamp}.json << EOF
{
  "id": "checkpoint-{task-id}-{timestamp}",
  "taskId": "{task-id}",
  "phase": "{phase}",
  "gitRef": "{GIT_REF}",
  "reason": "{reason}",
  "created": "{ISO timestamp}"
}
EOF
```

### Checkpoint Lifecycle

Checkpoints accumulate. The `settings.checkpoints.maxRetained` setting (default: 10) controls the maximum number retained. When the limit is reached, the oldest checkpoint is pruned.

Never manually delete checkpoints. They may be needed for recovery.

---

## Policy 2: On Unexpected Behavior — STOP, Do Not Fix Forward

When a task produces unexpected behavior:

1. **STOP.** Do not continue with the next task.
2. **Do not attempt to fix forward.** "Just patch it and move on" creates technical debt and hidden bugs.
3. **Assess:** Is this recoverable by fixing the current code, or has damage been done that requires rollback?

### The Decision Tree

```
Unexpected behavior detected
│
├─ Is it a logic error in new code? (no data corrupted, no prod impact)
│   └─ YES: Apply systematic-debugging. Fix forward.
│
├─ Is it a schema or migration error? (data may be incorrect)
│   └─ YES: STOP. Check database state. Consider rollback.
│
├─ Is it a security-impacting error? (auth bypass, data leak)
│   └─ YES: STOP EVERYTHING. Rollback immediately.
│
├─ Is it an external service integration error? (webhook, API, payment)
│   └─ YES: STOP. Do not retry until root cause is understood.
│
└─ Did fix attempts 1 and 2 both fail?
    └─ YES: See Policy 3 (3-consecutive-failures)
```

---

## Policy 3: 3-Consecutive-Failures Rule

If a task has failed to pass validation three separate times (three different fix attempts, each producing a different failure):

**STOP. Do not attempt fix number 4.**

This rule exists because 3 consecutive failures on a task almost always indicates an architectural problem, not a code problem. Continuing to attempt fixes at the code level wastes time while the underlying problem remains.

### What To Do When This Triggers

1. Send `<<NEXUS_BLOCKED: 3 consecutive validation failures. Architectural review needed. Details: {summary of failures}>>`

2. The mission-controller will dispatch the architect agent to analyze the module.

3. Present the failure pattern to the user:
   - Summary of what failed each time
   - Pattern: did each fix reveal a new problem in a different place?
   - Question: is this a code problem or an architecture problem?

4. Record a candidate Scar in STATE.md:
   ```
   CANDIDATE SCAR: {task-id} — 3 consecutive failures
   Failures: {summary}
   Architectural review requested
   ```

5. Do NOT attempt any more fixes until the architect agent's analysis is complete and the user has approved a direction.

### Signs This Is the Right Call

- Fix 1 solved problem A, but revealed problem B
- Fix 2 solved problem B, but revealed problem C
- Each fix moves the error to a different location rather than eliminating it
- The root cause seems to be in code you didn't write and shouldn't change
- "The fix requires massive refactoring" appears as a thought

---

## Policy 4: After Rollback — Always Record a Scar

Every rollback produces a Scar. No exceptions.

The Scar is not punishment. It is the mechanism by which the project learns and prevents the same failure from happening again.

### The Scar Fields

| Field | How to Fill It |
|-------|---------------|
| ID | Auto-increment from existing scars |
| Date | Today |
| Category | One of: implementation, architecture, testing, tooling, external, process |
| Description | What happened — specific enough to be useful a year from now |
| Root Cause | WHY it happened — the mechanism, not the symptom |
| Resolution | How it was resolved (rollback to checkpoint X, re-implemented with approach Y) |
| Prevention Rule | An actionable rule that prevents this from happening again |

### Writing a Good Prevention Rule

Transform the root cause into an actionable constraint.

| Root Cause | Prevention Rule |
|-----------|----------------|
| "Worker wrote to files outside its declared scope, silently breaking adjacent module" | "Validator must check undeclared writes after every NEXUS_COMPLETE; reject any undeclared write immediately" |
| "Database migration ran before schema change was deployed, corrupting data" | "All migration tasks must have checkpoint_before: true and include a down() reversal function" |
| "JWT secret was hardcoded in test file and committed to git" | "All auth-related tasks must have adversarial review with explicit check for hardcoded secrets" |
| "API integration test used production credentials in CI" | "Test tasks must use .env.test with mock credentials; production credentials never in test files" |

### Registering the Scar

1. Add to `.nexus/02-architecture/SCARS.md` Scar Log table
2. Add prevention rule to Active Prevention Rules table at the top of SCARS.md
3. Increment `scar_count` in STATE.md
4. Prevention rule is now active — it will be included in all future worker context packets via `stateDigest`

---

## Prevention Rules Are Cumulative

Prevention rules from Scars accumulate. They never expire.

When building a context packet for a worker, the `stateDigest` must include all active prevention rules from SCARS.md. This is how the project gets smarter over time: each Scar makes future workers aware of a failure mode that actually happened.

After 5+ scars, the project has a meaningful set of institutional knowledge embedded in every worker context.

---

## Checkpoint Pruning

When `.nexus/06-checkpoints/` contains more than `settings.checkpoints.maxRetained` (default: 10) checkpoints:

1. Sort checkpoints by `created` timestamp, oldest first
2. Delete the oldest ones until the count is at the limit
3. Log the pruned checkpoint IDs to STATE.md session continuity

Never prune a checkpoint that is:
- Referenced by a current Scar as the recovery point
- From the last 24 hours (too recent to prune safely)

---

## What You Must Never Do

- Skip the checkpoint for a high/critical risk task
- Attempt fix #4 after 3 consecutive failures without architect review
- Roll back without recording a Scar
- Record a Scar without a meaningful prevention rule
- Delete Scars or prevention rules after the fact
- Continue forward after signs of data corruption or security failure
- Treat rollback as something to be avoided — it is a healthy, expected operation

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| Task is high/critical risk | Create checkpoint before dispatching worker |
| Unexpected behavior, first occurrence | Stop. Systematic debug. Fix forward if safe. |
| Unexpected behavior, data/security impact | Stop. Assess. Consider rollback. |
| Fix attempt 3 failed | STOP. NEXUS_BLOCKED. Architect review. |
| Rollback executed | Always record Scar with prevention rule. |
| 5+ scars with no pattern change | Review SCARS.md — the architecture may need redesign. |

---

## Success Criteria

- [ ] Checkpoints created before every high/critical task
- [ ] Checkpoint JSON stored in .nexus/06-checkpoints/
- [ ] Unexpected behavior triggers STOP before any fix attempt
- [ ] 3-consecutive-failures rule triggers NEXUS_BLOCKED
- [ ] Every rollback produces a Scar
- [ ] Every Scar has a specific, actionable prevention rule
- [ ] Prevention rules appear in all future worker stateDigests
- [ ] Checkpoint count pruned to maxRetained when exceeded
