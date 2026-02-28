---
phase: NN-phase-name
plan: 01
status: complete
completed: YYYY-MM-DDTHH:MM:SSZ
duration: Xmin

subsystem: [auth | payments | ui | api | database | infra | testing]
tags: [searchable tech keywords: jwt, stripe, react, postgres]

requires:
  - phase: [prior phase]
    provides: [what that phase built that this uses]
provides:
  - [what this phase delivered]
  - [another deliverable]
affects: [future phase names that will need this context]

tech-stack:
  added: [libraries added during this phase]
  patterns: [architectural patterns established]

key-files:
  created:
    - path/to/created-file.ts
  modified:
    - path/to/modified-file.ts

key-decisions:
  - "Decision: brief description"

patterns-established:
  - "Pattern: description"

scars: []

playwright-artifacts:
  flows-run: 0
  screenshots: []
  traces: []
---

# Phase NN: Phase Name — Plan 01 Summary

**[Substantive one-liner: what actually shipped — not "phase complete" but specific, e.g., "JWT auth with refresh rotation and Redis session store protecting all /api routes"]**

---

## Performance

| Metric | Value |
|--------|-------|
| Duration | [time] |
| Started | [ISO timestamp] |
| Completed | [ISO timestamp] |
| Tasks | [N] completed |
| Files modified | [N] |
| Scars recorded | [N] |

---

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: [Name] | PASS / FAIL | [Specific evidence — file:line, test name, etc.] |
| AC-2: [Name] | PASS / FAIL | [Evidence] |

---

## What Was Built

[Narrative description of what was implemented, key design choices, and how it fits into the overall system]

---

## Files Created / Modified

| File | Change | Purpose |
|------|--------|---------|
| `path/to/file.ts` | Created | [What it does] |
| `path/to/other.ts` | Modified | [What changed and why] |

---

## Tasks Summary

| Task | Status | Notes |
|------|--------|-------|
| T01: [name] | complete | [Any notable details] |
| T02: [name] | complete | |

---

## Decisions Made

| Decision | Rationale | Impact | Reversible |
|----------|-----------|--------|------------|
| [What was decided] | [Why] | [Effect on future phases] | [R]/[I] |

Or: "None — followed plan as specified."

---

## Deviations from Plan

[Any tasks that differed from their specification, approaches that changed, scope that shifted]

Or: "None — plan executed exactly as written."

---

## Scar Entries

| Scar ID | Task | Failure | Root Cause | Prevention Rule |
|---------|------|---------|------------|-----------------|
| SCAR-N | T01 | [what went wrong] | [why] | [rule to prevent recurrence] |

Or: "None — all tasks completed on first attempt."

---

## Architecture Changes

**New modules added:**
- [None | module name: path]

**API contracts registered:**
- [None | CONTRACT-ID: description]

**Module boundary changes:**
- [None | description of what changed]

**Architecture rebuild needed:** [Yes — run /nexus:map-codebase | No]

---

## Playwright Artifacts

[If playwright_required: true — list flows run, screenshots, traces]
[If not required: "Not applicable for this phase."]

---

## Next Phase Readiness

**Ready:**
- [What's available for the next phase to build on]

**Concerns:**
- [Potential issues for future phases]
- [Technical debt introduced]

**Blockers:**
- [None | specific blocker]

---

*Phase: NN-phase-name, Plan: 01*
*Completed: [YYYY-MM-DD]*
