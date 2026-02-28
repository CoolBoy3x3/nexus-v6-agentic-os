---
name: revise
description: Revise a completed or in-progress phase plan with blast-radius analysis before any changes
argument-hint: "[phase-name-or-number]"
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
---

# nexus:revise

## RULE 0

Read `~/.claude/nexus/workflows/revise-phase.md` before executing this command.

Never execute from memory. The file is truth.

---

## Purpose

Revise a phase plan after it has been created or executed. Performs impact analysis before any changes to prevent silent breakage in dependent phases. Requires human confirmation of the blast radius before proceeding.

Revision is not the same as re-planning from scratch. Use `/nexus:revise` when you need to modify an existing plan — not when starting a new phase.

---

## Step 1 — Identify the Target Phase

If `$ARGUMENTS` provided: identify the phase by name or number.

Otherwise: read ROADMAP.md and ask:
```
Which phase do you want to revise?

{List all phases with their current status}

Enter phase number or name:
```

Read:
- `.nexus/04-phases/{NN}-{phase-name}/PLAN.md`
- `.nexus/04-phases/{NN}-{phase-name}/SUMMARY.md` (if the phase is already complete)
- `.nexus/04-phases/{NN}-{phase-name}/TASK_GRAPH.json`

---

## Step 2 — Load the Revision Context

Read PLAN.md. Understand what the phase currently specifies:
- Phase goal
- Tasks and their `files_modified`
- `must_haves` artifacts and key links
- Acceptance criteria

If SUMMARY.md exists (phase already ran): read it to understand what was actually built.

---

## Step 3 — Ask What Needs to Change

Ask the user:
```
What needs to change in Phase {N}: {phase name}?

Describe the revision — for example:
  "The authentication approach needs to switch from sessions to JWTs"
  "Task T02 scope is too large — split it"
  "The files_modified list is missing src/types/auth.ts"
  "The must_haves don't include the rate limiting requirement"
```

Record the revision description.

---

## Step 4 — Run Impact Analysis

This is the most important step. Before touching anything, determine the blast radius.

### 4a — Direct Dependents

Read `.nexus/01-governance/ROADMAP.md`. Find all phases that list the target phase in their `depends_on` field.

### 4b — Artifact Dependents

From the target phase's PLAN.md, get the list of `provides` artifacts (what this phase delivers).

For each artifact, search for it in SUMMARY.md files of other phases:
```bash
grep -r "{artifact}" .nexus/04-phases/*/SUMMARY.md
```

### 4c — File Overlap

From the target phase's `files_modified` list, check which other phases also touch those files:
```bash
grep -r "{filename}" .nexus/04-phases/*/PLAN.md
```

### 4d — Contract Impact

If the revision touches API contracts: check `api_contracts.json` for any contracts defined or consumed by this phase. A contract change is a potential breaking change for any consumer phase.

---

## Step 5 — Show Blast Radius

Present the impact analysis to the user before making any changes:

```
════════════════════════════════════════
  BLAST RADIUS ANALYSIS
════════════════════════════════════════

Revising: Phase {N} — {phase name}

Requested change: {revision description}

Direct dependents (phases that depend on Phase {N}):
  - Phase {N+1}: {name} — status: {status}
  - Phase {N+2}: {name} — status: {status}

Artifact consumers (phases that use what Phase {N} produces):
  - Phase {M}: {name} uses: {artifact}

File overlap (other phases that touch the same files):
  - Phase {K}: {name} also modifies: {filename}

Contract impact:
  {If applicable: which contracts would change and who consumes them}
  {If not applicable: "No API contracts affected."}

Impact assessment: {low | medium | high}
  {Brief explanation of why}

════════════════════════════════════════
Are you sure you want to proceed with this revision? (yes/no)
```

If the user says no: stop. No changes made.

If the user says yes: proceed to Step 6.

---

## Step 6 — Create Checkpoint Before Changes

Before making any changes to PLAN.md, create a checkpoint:

```bash
git add .nexus/04-phases/{NN}-{phase-name}/
git stash -m "nexus: pre-revision checkpoint for phase {N} at {timestamp}"
```

Or create a checkpoint record:
```
.nexus/06-checkpoints/checkpoint-prerevision-{phase}-{timestamp}.json
{
  "id": "checkpoint-prerevision-{phase}-{timestamp}",
  "phase": "{phase}",
  "reason": "Pre-revision checkpoint for: {revision description}",
  "gitRef": "{current HEAD SHA}",
  "created": "{ISO timestamp}"
}
```

Announce: "Checkpoint created. You can roll back with `/nexus:recover` if needed."

---

## Step 7 — Route to Revise-Phase Workflow

Invoke the `workflows/revise-phase.md` workflow with:
- Target phase path
- Revision description
- Blast radius analysis results
- Checkpoint ID

The workflow handles:
- Dispatching the architect agent to update ARCHITECTURE.md if boundaries change
- Dispatching the planner agent to produce a revised PLAN.md
- Updating TASK_GRAPH.json

---

## Step 8 — Propagate to Dependent Phases

If the blast radius analysis identified dependent phases that are NOT yet complete:

For each incomplete dependent phase:
1. Add a note to their PLAN.md or ROADMAP.md entry: "Upstream revision: Phase {N} was revised on {date}. Review plan before executing."
2. Do NOT automatically modify their PLAN.md — the user must decide what changes are needed.
3. Add to STATE.md session continuity: "Phases {list} may need replanning due to revision of Phase {N}."

If dependent phases are already complete (SUMMARY.md exists):
1. Add a note to their SUMMARY.md: "NOTICE: Upstream phase {N} was revised after this phase completed. Verify outputs are still compatible."
2. Surface this to the user: "Warning: Phase {M} was already completed and may be affected by this revision."

---

## Step 9 — Update ROADMAP.md

Add a revision note to the target phase entry in ROADMAP.md:

```markdown
| Phase {N} | {name} | {status} | {Revised on YYYY-MM-DD: {brief description of change}} |
```

---

## Step 10 — Update DECISION_LOG.md

Record the revision as a decision:

```markdown
| {auto-ID} | {date} | Phase {N} | Revised phase plan | {reason for revision} | {impact on dependent phases} | [R] |
```

---

## Step 11 — Output Result

```
════════════════════════════════════════
  REVISION COMPLETE
════════════════════════════════════════

Phase {N} — {phase name}: plan revised

Change: {summary of what changed}

Affected phases noted:
  - {Phase N+1}: flagged for review
  - {Phase M}: already complete, compatibility check needed

ROADMAP.md updated.
DECISION_LOG.md entry added.
Checkpoint saved: {checkpoint-id}

════════════════════════════════════════
  NEXT ACTION: Run /nexus:execute to re-execute the revised plan
════════════════════════════════════════
```

---

## Error Handling

**Phase not found:** "Phase {identifier} not found in .nexus/04-phases/. Available phases: {list}."

**Phase is currently executing:** "Phase {N} has active execution in progress. Pause execution before revising. Run /nexus:progress --pause first."

**Revision would break a contract with a completed dependent phase:** Surface this prominently. Do not block the revision, but require explicit acknowledgment: "This revision breaks the API contract consumed by Phase {M} which is already complete. Proceeding will require re-executing Phase {M}. Confirm? (yes/no)"

---

## Success Criteria

- [ ] Target phase identified
- [ ] User describes what needs to change
- [ ] Blast radius analysis completed (direct dependents, artifact consumers, file overlap, contract impact)
- [ ] Blast radius shown to user before any changes
- [ ] User confirms before proceeding
- [ ] Checkpoint created before any changes
- [ ] Planner invoked to produce revised PLAN.md
- [ ] Dependent phases flagged if incomplete
- [ ] Completed dependent phases warned if affected
- [ ] ROADMAP.md updated with revision note
- [ ] DECISION_LOG.md updated
- [ ] Output: single next action
