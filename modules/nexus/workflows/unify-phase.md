# Unify Phase Workflow

Implements the loop-closing logic for `/nexus:unify`. Reconcile plan vs actual, create SUMMARY.md, update all governance files, and — if more phases remain — auto-chain to the next `/nexus:plan`.

---

## Preconditions

1. Verify PLAN.md exists
2. Verify verification-report.json exists with `mergeDecision: approved`
3. Verify TASK_GRAPH.json shows all tasks `complete` or explicitly `deferred`
4. If SUMMARY.md already exists: loop is already closed. Stop.
5. Update STATE.md: loop position UNIFY ●

---

## Reconcile Plan vs Actual

For each task in PLAN.md:
- Was it completed as specified?
- Were declared files actually modified?
- Any deviations from the described approach?

For each acceptance criterion:
- Was it met per verification-report.json?
- Status: PASS | FAIL | DEFERRED

Extract from STATE.md session context:
- Decisions made during execution
- NEXUS_PERMISSION_REQUEST grants (broader scope needed)
- Blockers resolved

Scar candidates: tasks that were blocked or retried before completion.

---

## Create SUMMARY.md

Write `.nexus/04-phases/{NN}-{name}/SUMMARY.md` with YAML frontmatter:

```yaml
---
phase: NN-phase-name
plan: 01
status: complete
completed: {ISO timestamp}
duration: {approximate}
subsystem: []
tags: []
requires: []
provides: []
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified: []
key-decisions: []
patterns-established: []
scars: []
playwright-artifacts:
  flows-run: 0
  screenshots: []
  traces: []
---
```

Body sections (all required):
1. **What Was Built** — substantive one-liner + narrative
2. **Acceptance Criteria Results** — table with PASS/FAIL/DEFERRED
3. **Files Created / Modified** — table
4. **Tasks Summary** — table
5. **Decisions Made** — table or "None"
6. **Deviations from Plan** — narrative or "None — plan executed exactly as written"
7. **Scar Entries** — table or "None — all tasks completed on first attempt"
8. **Architecture Changes** — new modules, contracts, boundary changes
9. **Playwright Artifacts** — if playwright ran
10. **Next Phase Readiness** — ready state, concerns, blockers

---

## Update DECISION_LOG.md

For each decision in SUMMARY.md "Decisions Made":
Append row to `.nexus/02-architecture/DECISION_LOG.md`.

---

## Update SCARS.md

If SUMMARY.md has scar entries:
1. Add each to SCARS.md Scar Log table
2. Add prevention rule to Active Prevention Rules table at top
3. Increment STATE.md `scar_count`

**Promote provisional scars:** If verify wrote `(provisional)` scar entries, confirm them now — remove `(provisional)` tag, fill in resolution notes.

---

## Update ARCHITECTURE.md

Always update `.nexus/02-architecture/ARCHITECTURE.md`:
- Modules table: any new modules
- API Contracts: new/changed endpoints
- Data Models: new schemas
- Key Decisions: link to DECISION_LOG entries

If major boundary changes: add to STATE.md:
```
Architecture note: Phase {N} changed module boundaries.
Run /nexus:map-codebase before next /nexus:plan.
```

---

## Create HANDOFF.md

Write `.nexus/01-governance/HANDOFF.md` for session continuity.

---

## Update STATE.md and ROADMAP.md

Set loop position UNIFY ✓:
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ✓           ✓         ✓
[Loop complete — ready for next /nexus:plan]
```

Update ROADMAP.md phase status from `in-progress` to `complete`. Add completion date and outcome note.

---

## Auto-Advance

**Check ROADMAP.md for remaining phases.**

If more phases remain with status `pending` or `not-started`:

If `--manual` OR `auto_advance: false`:
```
▶ NEXT: /nexus:plan   (Phase {N+1}: {next phase name})
  Type "go" to proceed.
```

If `auto_advance: true` (default):
```
Auto-advancing to next phase in 5s... (type "stop" to pause)
```
Invoke `/nexus:plan` for the next phase.

If this was the last phase:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► PROJECT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All {N} phases complete.

Ship it or add new phases to ROADMAP.md.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Anti-Patterns

**Skipping SUMMARY.md:** Every completed plan MUST have a SUMMARY.md. No exceptions.

**Partial updates:** Update ALL of: SUMMARY.md, STATE.md, DECISION_LOG.md, SCARS.md, ARCHITECTURE.md, HANDOFF.md, ROADMAP.md.

**Auto-advancing without updating ROADMAP.md:** ROADMAP.md must show `complete` BEFORE the next plan starts. This is the mandatory phase transition gate.

**Skipping UNIFY for small changes:** No plan is too small. UNIFY takes 5 minutes and prevents context loss.
