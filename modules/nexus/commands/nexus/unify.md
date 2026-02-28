---
name: unify
description: Close the loop — reconcile plan vs actual, write SUMMARY.md, update governance, then auto-chain to next plan or declare project complete
argument-hint: "[plan-path] [--manual]"
allowed-tools: [Read, Write, Bash, Glob]
---

# nexus:unify

## Purpose

Close the Nexus loop. UNIFY is the mandatory final phase that reconciles what was planned against what was built, creates the permanent SUMMARY.md record, updates all governance files, and — if more phases remain — **auto-chains to `/nexus:plan` for the next phase**.

**This command cannot be skipped.** The loop is not complete until UNIFY runs.

PLAN ✓ → EXECUTE ✓ → VERIFY ✓ → **UNIFY**

Flags:
- `--manual` — disable auto-advance to next plan after loop closure

**Called automatically by `/nexus:verify` on pass. Can also be invoked directly.**

---

## RULE 0

Read `~/.claude/nexus/workflows/unify-phase.md` before executing.

---

## Step 1 — Validate Preconditions

Determine plan path from `$ARGUMENTS` or STATE.md `resume_file`.

1. Confirm PLAN.md exists.
2. Read `verification-report.json`. Confirm `mergeDecision` is `approved`.
   - If `rejected`: "Verification failed. Run /nexus:verify to address gaps."
   - If missing: "No verification report found. Run /nexus:verify first."
3. Confirm TASK_GRAPH.json shows all tasks `complete` or explicitly `deferred`.
   - If incomplete tasks remain: list them and ask "Deliberately deferred? [yes/no]".
     - If yes: update each deferred task's `status` to `"deferred"` in TASK_GRAPH.json, record in SUMMARY.md deferred section, and continue.
     - If no: stop.
4. If SUMMARY.md already exists: "Loop already closed. Run /nexus:progress."

Update STATE.md:
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ✓           ✓         ●
[Unifying — creating SUMMARY.md]
```

---

## Step 2 — Reconcile Plan vs Actual

**For each task in PLAN.md:**
1. Was it completed as specified?
2. Were declared `files_modified` actually modified?
3. Did it satisfy its acceptance criteria?
4. Any deviations from plan?

**For each acceptance criterion:** Check `verification-report.json` → PASS | FAIL | DEFERRED

**Decisions:** Read STATE.md session context for NEXUS_PERMISSION_REQUEST grants and any choices made during execution.

**Scar candidates:** Check TASK_GRAPH.json for tasks that were blocked or retried before completion.

---

## Step 3 — Create SUMMARY.md

Write `.nexus/04-phases/{NN}-{phase-name}/SUMMARY.md`:

```yaml
---
phase: NN-phase-name
plan: 01
status: complete
completed: {ISO timestamp}
duration: {approximate}

subsystem: [primary category]
tags: [tech keywords]

requires:
  - phase: {prior phase}
    provides: {what it provided}
provides:
  - {what this phase delivered}
affects: [future phases that need this context]

tech-stack:
  added: [libraries added]
  patterns: [patterns established]

key-files:
  created: []
  modified: []

key-decisions:
  - "{decision summary}"

patterns-established:
  - "{Pattern: description}"

scars: []

playwright-artifacts:
  flows-run: 0
  screenshots: []
  traces: []
---
```

**Body sections:**

### What Was Built
A substantive one-liner. Not "Phase complete" — but "JWT authentication with refresh token rotation, session store in Redis, middleware protecting all /api routes."

### Acceptance Criteria Results
| Criterion | Status | Evidence |
|-----------|--------|----------|

### Files Created / Modified
| File | Change | Purpose |
|------|--------|---------|

### Tasks Summary
| Task | Status | Notes |
|------|--------|-------|

### Decisions Made
| Decision | Rationale | Impact | Reversible |
|----------|-----------|--------|------------|

### Deviations from Plan
What differed from PLAN.md, why, and whether beneficial or problematic. If none: "None — plan executed exactly as written."

### Scar Entries
| Scar ID | Task | Failure | Root Cause | Prevention Rule |
|---------|------|---------|------------|-----------------|

If no failures: "None — all tasks completed on first attempt."

### Architecture Changes
New modules, API contracts, data model changes, boundary changes (triggers architecture rebuild flag).

### Playwright Artifacts
List flows run, screenshots, traces if playwright ran. Otherwise: "Not applicable."

### Next Phase Readiness
What's available for the next phase. Concerns. Blockers or "None."

---

## Step 4 — Update Governance Files

**DECISION_LOG.md:** Append each decision from SUMMARY.md to `.nexus/02-architecture/DECISION_LOG.md`.

**SCARS.md:** If SUMMARY.md has scar entries:
1. Add each to SCARS.md Scar Log table
2. Add prevention rule to Active Prevention Rules table at top of SCARS.md
3. Increment STATE.md `scar_count`

**Promote provisional scars:** If verify wrote provisional SCAR entries to SCARS.md, confirm them now (remove `(provisional)` tag and fill in resolution notes).

**SCARS.md consolidation:** After updating the scar log, consolidate the Active Prevention Rules table by category — keep only the most recent rule per category so the table stays actionable:

```
Call scarsStore.consolidateByCategory()
— or —
For each category in SCARS.md, keep only the row with the latest date.
```

**Gap-closure counter reset:** If this phase had any gap-closure iterations, delete its counter file now that the loop is successfully closed:

```bash
rm -f .nexus/04-phases/{NN}-{phase-name}/gap-closure-state.json
```

This allows fresh gap-closure iterations if the phase is ever re-opened.

**ARCHITECTURE.md:** Always update `.nexus/02-architecture/ARCHITECTURE.md`:
- Modules table: any new modules
- API Contracts section: new/changed endpoints
- Data Models section: new schemas
- Key Decisions section: link to DECISION_LOG entries

If major boundary changes: add architecture rebuild flag to STATE.md:
```
Architecture note: Phase {N} changed module boundaries.
Run /nexus:map-codebase before next /nexus:plan.
```

---

## Step 5 — Create HANDOFF.md

Write `.nexus/01-governance/HANDOFF.md`:

```markdown
# HANDOFF — {project_name}

**Created:** {ISO timestamp}
**Last completed phase:** Phase {N} — {Phase Name}
**Loop position:** UNIFY ✓ (loop closed)

## What Was Just Built

{One-liner from SUMMARY.md}

## Current State

- Phases complete: {N} of {total}
- Tasks complete: {task_count} total
- Scars recorded: {scar_count}

## Next Action

{If more phases: "Run /nexus:plan to begin Phase {N+1}: {next phase name}."}
{If last phase: "All phases complete. Run /nexus:progress."}

## Active Prevention Rules

{Copy from SCARS.md Active Prevention Rules — or "None yet"}

## Architecture State

{2-3 sentence summary of modules and data flow}

## Key Files

{5 most important files with one-line descriptions}
```

---

## Step 6 — Update STATE.md and ROADMAP.md

**STATE.md:** Set loop position UNIFY ✓. Update scar_count. Update session continuity.

```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ✓           ✓         ✓
[Loop complete — ready for next /nexus:plan]
```

**ROADMAP.md:** Update phase status from `in-progress` to `complete`. Add completion date and outcome note.

---

## Step 7 — Output and Auto-Advance

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► LOOP CLOSED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase {N}: {Phase Name} | COMPLETE

PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ✓           ✓         ✓

{What was built — one-liner}

Decisions: {count} | Scars: {count}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If more phases remain in ROADMAP.md:**

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

**If this was the last phase:**

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

**Vague summaries:** "It worked" is not acceptable. Document files created, acceptance criteria results, and decisions specifically.

**Partial updates:** Update ALL of: SUMMARY.md, STATE.md, DECISION_LOG.md, SCARS.md, ARCHITECTURE.md, HANDOFF.md, ROADMAP.md. Never leave partial.

**Skipping UNIFY for small changes:** No plan is too small to close the loop.

**Auto-advancing without phase transition:** ROADMAP.md must be updated to `complete` BEFORE invoking next `/nexus:plan`. This is the mandatory transition gate.

---

## Success Criteria

- [ ] unify-phase.md loaded (RULE 0)
- [ ] Preconditions validated (verification-report approved)
- [ ] Plan vs actual reconciled
- [ ] SUMMARY.md created — substantive one-liner, all sections complete
- [ ] DECISION_LOG.md updated
- [ ] SCARS.md updated (provisional scars confirmed or "None")
- [ ] SCARS.md Active Prevention Rules consolidated by category
- [ ] ARCHITECTURE.md updated
- [ ] HANDOFF.md written
- [ ] STATE.md: UNIFY ✓, scar_count updated
- [ ] ROADMAP.md: phase = complete
- [ ] Gap-closure counter deleted on successful close
- [ ] If more phases: auto-advanced to /nexus:plan (or "go" prompt)
- [ ] If last phase: PROJECT COMPLETE output
