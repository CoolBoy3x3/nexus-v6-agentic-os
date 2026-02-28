---
phase: NN-phase-name
plan: 01
status: draft              # draft | approved | complete
risk_tier: medium          # low | medium | high | critical
tdd_mode: standard         # hard | standard | skip
review_tier: self          # self | peer | architect
playwright_required: false
checkpoint_before: false
wave_count: 1

must_haves:
  truths:
    - "Observable behavior 1 — what a user can do when this is done"
    - "Observable behavior 2 — another testable outcome"
  artifacts:
    - path: "src/path/to/file.ts"
      provides: "What this file delivers to the system"
    - path: "src/path/to/file.test.ts"
      provides: "Tests covering the above file"
  key_links:
    - from: "ConsumerFile.tsx"
      to: "src/path/to/file.ts"
      via: "import and function call in useEffect"
    - from: "src/api/routes.ts"
      to: "src/path/to/handler.ts"
      via: "route registration POST /api/endpoint"
---

# Phase NN: Phase Name — Plan 01

## Objective

**Goal:** {One sentence describing what this plan achieves}

**Context:** {Why this work is needed now}

**Output:** SUMMARY.md at `.nexus/04-phases/NN-phase-name/SUMMARY.md`

---

## Acceptance Criteria

| ID | Given | When | Then |
|----|-------|------|------|
| AC-1 | {precondition} | {action} | {expected outcome} |
| AC-2 | {precondition} | {action} | {expected outcome} |

---

## Tasks

### T01: {Task Description}

**Wave:** 1
**Depends on:** none
**Risk tier:** medium
**TDD mode:** standard

**Files modified:**
- `src/path/to/implementation.ts`
- `src/path/to/implementation.test.ts`

**Action:**
{Specific description of what to implement. Must be specific enough that a worker can implement it without interpretation. Include function signatures, expected behaviors, error handling requirements.}

**Acceptance criteria:** AC-1, AC-2

---

### T02: {Task Description}

**Wave:** 1
**Depends on:** none
**Risk tier:** low
**TDD mode:** standard

**Files modified:**
- `src/path/to/other.ts`
- `src/path/to/other.test.ts`

**Action:**
{Specific description.}

**Acceptance criteria:** AC-2

---

### T03: {Task Description}

**Wave:** 2
**Depends on:** T01, T02
**Risk tier:** medium
**TDD mode:** standard

**Files modified:**
- `src/path/to/integration.ts`
- `src/path/to/integration.test.ts`

**Action:**
{Specific description. Must reference outputs of T01 and T02.}

**Acceptance criteria:** AC-1, AC-2

---

## Boundaries

**DO NOT CHANGE:**
- `{path/to/protected/file.ts}` — {reason it must not be touched}
- `{path/to/another/protected.ts}` — {reason}

**DO NOT:**
- {Specific thing to avoid — e.g., "do not change the session token format"}
- {Another constraint}

**SCOPE LIMIT:**
This plan implements {scope}. It does NOT implement {explicitly out of scope items}.

---

## Verification

After all tasks complete, the verifier will check:

1. All files in `must_haves.artifacts` exist and are substantive
2. All `must_haves.key_links` are WIRED (imported, called, return value used)
3. All acceptance criteria are met per verification-report.json
4. No stub patterns in any modified file
5. Lint clean, type check clean, all tests passing
