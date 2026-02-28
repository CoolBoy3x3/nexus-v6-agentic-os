---
name: verify
description: Run the full verification ladder, then auto-chain to unify on pass or auto-plan gaps on fail
argument-hint: "[plan-path] [--manual]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# nexus:verify

## Purpose

Run the 8-rung Nexus verification ladder. Fail-fast on physicality and deterministic. Continue through goal-backward and adversarial. Merge-judge issues final verdict. On pass: auto-chains to `/nexus:unify`. On fail: auto-invokes `/nexus:plan --gaps` to create a targeted fix plan.

PLAN ✓ → EXECUTE ✓ → **VERIFY** → UNIFY

Flags:
- `--manual` — disable auto-advance to unify/gap-plan after verification

**Called automatically by `/nexus:execute`. Can also be invoked directly.**

---

## RULE 0

Read `~/.claude/nexus/workflows/verify-phase.md` before executing.

---

## Step 1 — Load Context

Determine plan path from `$ARGUMENTS` or STATE.md `resume_file`.

Read:
- PLAN.md: `must_haves`, `tasks`, `playwright_required`, `phase`
- TASK_GRAPH.json: all modified files across all tasks
- STATE.md: confirm loop position is EXECUTE ✓

If not EXECUTE ✓: "Run /nexus:execute first."

Update STATE.md:
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ✓           ●         ○
[Verifying — Rung 1: Physicality]
```

---

## Step 2 — The Verification Ladder

### Rung 1 — Physicality (FAIL-FAST)

For each file in `task.files_modified` across all tasks:

1. Existence: `ls -la {file}` — missing = FAIL
2. Non-empty: `wc -l {file}` — <10 lines for source = FAIL (stub)
3. Undeclared writes: `git diff --name-only HEAD~{task_count}` — any file in diff but NOT in any `files_modified` = WARNING
4. Hash integrity: if re-verifying, check current sizes vs prior verification-report.json

If Rung 1 fails: record all failures, output gap report, **STOP**.

```
RUNG 1 FAILED — Physicality
══════════════════════════════
Missing: src/auth/login.ts (declared in T01, not found on disk)
Stub: src/auth/session.ts (3 lines — not substantive)

Stop: Return to /nexus:execute.
══════════════════════════════
```

### Rung 2 — Deterministic (FAIL-FAST)

Dispatch validator (paths only):

```
Task(
  subagent_type="nexus-validator",
  description="Deterministic checks",
  prompt="
    Read ~/.claude/agents/nexus/validator.md for your role.

    Run deterministic checks on these files: {files_modified list}

    1. npm run lint (zero warnings)
    2. npx tsc --noEmit (zero type errors)
    3. Prettier check mode (zero reformats)
    4. npm test {test files from test_map.json} (zero failures, zero skips)

    Capture full stdout/stderr. Return ## DETERMINISTIC PASSED or ## DETERMINISTIC FAILED.
  "
)
```

If Rung 2 fails: record with exact error output, **STOP**.

### Rung 3 — Delta Tests (NON-BLOCKING)

Run broader module test suite for all modules containing modified files:

```bash
npm test {module directories} --coverage
```

Failures are recorded as gaps but do NOT stop the ladder.

### Rung 4 — Goal-Backward (BLOCKING on gaps)

**AC-N source:** Acceptance criteria (AC-1, AC-2, …) are defined in the `acceptance_criteria` table in PLAN.md — NOT in a separate file. The verifier reads them directly from PLAN.md alongside `must_haves`.

Dispatch verifier (paths only):

```
Task(
  subagent_type="nexus-verifier",
  description="Goal-backward verification",
  prompt="
    Read ~/.claude/agents/nexus/verifier.md for your role.

    Verify must_haves AND acceptance_criteria from: .nexus/04-phases/{phase}/PLAN.md

    AC-N IDs are in the acceptance_criteria table in PLAN.md (not a separate file).

    For each truth in must_haves.truths: can the codebase deliver this? (wired + callable)
    For each artifact in must_haves.artifacts:
      - EXISTS: file on disk
      - SUBSTANTIVE: not a stub
      - WIRED: imported, called, return value used

    For each AC-N in acceptance_criteria: verify the criterion is demonstrably met in code.

    Stub patterns: return null/[]/{}  TODO/FIXME in impl  throw NotImplemented
                   console.log as only side effect  preventDefault() only

    For each key_link: verify the from->to->via connection in actual code.

    Files to read: {files_modified list}
    Return ## GOAL-BACKWARD PASSED or ## GOAL-BACKWARD GAPS with specific list.
  "
)
```

Gaps found: record, continue to Rung 5. Gaps block merge-judge.

### Rung 5 — Adversarial (BLOCKING on blocker severity)

Dispatch verifier in red-team mode (paths only):

```
Task(
  subagent_type="nexus-verifier",
  description="Adversarial review",
  prompt="
    Read ~/.claude/agents/nexus/verifier.md for your role.

    Red-team review. For each file in: {files_modified list}

    Check all 7 categories:
    1. Unhandled edge cases: null inputs, empty collections, bounds
    2. Missing error paths: async without try/catch, API without error handling
    3. Dev artifacts: TODO/FIXME/HACK in prod code, console.log in prod paths, hardcoded localhost
    4. Shortcuts: as any silencing real errors, empty catch, !, setTimeout-as-mutex
    5. Missing input validation at system boundaries: HTTP handlers, unescaped user input
    6. N+1: loops with DB queries, fetch-list-then-each
    7. Security: hardcoded secrets, user input in exec/eval, SQL interpolation, missing auth checks

    Severity: blocker | warning | info
    Return ## ADVERSARIAL PASSED or ## ADVERSARIAL FINDINGS (file:line:severity:description).
  "
)
```

Blocker-severity findings block merge-judge. Warning/info are recorded.

### Rung 6 — System Validation

Run if integration/E2E tests are configured:

```bash
npm run test:integration 2>/dev/null || true
npm run test:e2e 2>/dev/null || true
```

Failures = gaps. Not configured = INFO (not blocking).

### Rung 7 — Playwright Validation

Run ONLY if `playwright_required: true` in PLAN.md. Skip with `playwrightOk: true` (not required) if false.

**MCP path resolution (in order):**
1. Read `settings.json → playwright.mcpPath` — if non-empty, use it.
2. If empty: read `~/.claude/nexus/playwright-detect.json` (or runtime-equivalent) — auto-write to settings.json and use.
3. If still empty: prompt user with options (use npx / install globally / set manually / skip rung).
4. `npx @playwright/mcp@latest` is always valid (downloads on first use) — never require a binary path.

Connect to Playwright MCP. Run flow specs from `.nexus/08-playwright/flow-specs/` tagged for this phase. Capture screenshot + trace + (video if >30s). Write to `.nexus/07-artifacts/`.

### Rung 8 — Merge-Judge (Final Gate)

Dispatch merge-judge with results summary (NOT full file contents):

```
Task(
  subagent_type="nexus-merge-judge",
  description="Merge judge for {phase}",
  prompt="
    Read ~/.claude/agents/nexus/merge-judge.md for your role.

    Merge decision for Phase {N}: {name}.

    physicalityOk: {true/false}
    deterministicOk: {true/false}
    goalBackwardOk: {true/false} — {gap count} gaps
    adversarialOk: {true/false} — {blocker count} blockers
    systemOk: {true/false | not_applicable}
    playwrightOk: {true/false | not_required}

    ALL must be true for approval.
    Return ## MERGE APPROVED or ## MERGE REJECTED with notes.
  "
)
```

---

## Step 3 — Write verification-report.json

Write `.nexus/04-phases/{phase}/verification-report.json`:

```json
{
  "phase": "{phase}",
  "verified": "{ISO timestamp}",
  "status": "passed | gaps_found | rejected",
  "score": "{truths_verified}/{total_truths}",
  "rungs": {
    "physicality": { "ok": true, "failures": [] },
    "deterministic": { "ok": true, "failures": [] },
    "deltaTests": { "ok": true, "failures": [] },
    "goalBackward": { "ok": true, "gaps": [] },
    "adversarial": { "ok": true, "findings": [] },
    "system": { "ok": true, "failures": [] },
    "playwright": { "ok": true, "notRequired": false }
  },
  "mergeDecision": "approved | rejected",
  "gaps": []
}
```

---

## Step 4 — Output and Auto-Advance

**If PASSED:**

Update STATE.md: VERIFY ✓.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► VERIFICATION PASSED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase {N}: {Name} | APPROVED

✓ Physicality  ✓ Deterministic  ✓ Goal-backward
✓ Adversarial  ✓ System  {✓/— Playwright}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If `--manual` OR `auto_advance: false`:
```
▶ NEXT: /nexus:unify   Type "go" to proceed.
```

If `auto_advance: true`:
```
Auto-advancing to UNIFY in 3s... (type "stop" to pause)
```
Invoke `/nexus:unify {plan-path}`.

**If FAILED:**

Write provisional scars to SCARS.md for each blocking gap:
```
| SCAR-{N} (provisional) | {date} | verify-failure | {gap} | {likely cause} | {prevention rule} |
```

Update STATE.md: VERIFY ● (gaps).

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► VERIFICATION FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REJECTED — {N} gaps found

{Gap list with file:line references}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If `--manual` OR `auto_advance: false`:
```
▶ NEXT: /nexus:plan --gaps
```

If `auto_advance: true`:
```
Auto-creating gap-closure plan in 3s... (type "stop" to pause)
```

**Before invoking `/nexus:plan --gaps`, check the iteration guard:**

```bash
cat .nexus/04-phases/{phase}/gap-closure-state.json 2>/dev/null
```

Read `iterations`. If `iterations >= 3`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► GAP-CLOSURE LIMIT REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The same verification gaps have recurred {N} times.
Auto-advance is disabled. Human review required.

Root cause clues:
- .nexus/04-phases/{phase}/verification-report.json  (recurring gaps)
- .nexus/01-governance/SCARS.md  (prevention rules)

Options:
  [1] Examine gaps and provide guidance
  [2] Skip this phase (mark as deferred)
  [3] Force reset iteration count (resets counter only — does not fix gaps)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Stop auto-advance. Wait for human.

Otherwise (iterations < 3): write/increment `gap-closure-state.json` and invoke `/nexus:plan --gaps`.
Plan creates targeted gap-closure plan, then auto-executes and re-verifies.

---

## Anti-Patterns

**Skipping rungs:** Every rung runs every time. "It's probably fine" is not verification.

**Delta-test failures as blocking:** Rung 3 records gaps but does not stop the ladder.

**Manually writing gap tasks:** Use `/nexus:plan --gaps` — it reads verification-report.json and creates properly scoped tasks.

**Passing with adversarial warnings ignored:** Warnings are recorded. Only blocker-severity items fail the adversarial rung.

---

## Success Criteria

- [ ] verify-phase.md loaded (RULE 0)
- [ ] All 8 rungs run in order
- [ ] Fail-fast at Rung 1 and 2
- [ ] Goal-backward checks all must_haves (truths, artifacts, key_links)
- [ ] Stub detection runs on all files
- [ ] Adversarial checks all 7 categories
- [ ] verification-report.json written
- [ ] Merge-judge issues final decision
- [ ] On failure: provisional scars written
- [ ] STATE.md: VERIFY ✓ or VERIFY ●
- [ ] On pass: auto-advanced to /nexus:unify
- [ ] On fail: auto-invoked /nexus:plan --gaps
