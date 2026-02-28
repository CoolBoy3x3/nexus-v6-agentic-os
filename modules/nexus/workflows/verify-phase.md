# Verify Phase Workflow

Implements the 8-rung verification ladder for `/nexus:verify`. Fail-fast on Rungs 1-2. Continue through goal-backward and adversarial. Merge-judge issues final verdict.

**On pass: auto-chains to `/nexus:unify`. On fail: auto-invokes `/nexus:plan --gaps`.**

---

## Load Context

1. Resolve plan path from $ARGUMENTS or STATE.md
2. Read PLAN.md: extract must_haves, playwright_required, tasks (paths only — no file contents)
3. Build list of all modified files from TASK_GRAPH.json
4. Verify loop position is EXECUTE ✓
5. Update STATE.md: loop position VERIFY ●

---

## Rung 1 — Physicality (FAIL-FAST)

For each file in `task.files_modified` across all tasks:
1. Existence: `ls -la {file}` — missing = FAIL
2. Non-empty: `wc -l {file}` — <10 lines for source = FAIL (stub)
3. Undeclared writes: `git diff --name-only HEAD~{task_count}` — any file in diff but NOT in any `files_modified` = WARNING

If Rung 1 fails: record all failures, output gap report, **STOP**.

---

## Rung 2 — Deterministic (FAIL-FAST)

Dispatch validator (paths only):
```
Task(
  subagent_type="nexus-validator",
  prompt="
    Read ~/.claude/agents/nexus/validator.md for your role.

    Run deterministic checks on these files: {files_modified list}

    Read .nexus/01-governance/settings.json for the project's commands:
      - lint:       settings.commands.lint      (default: "npm run lint")
      - typecheck:  settings.commands.typecheck  (default: "npx tsc --noEmit")
      - format:     settings.commands.format_check (default: "npx prettier --check .")
      - test:       settings.commands.test       (default: "npm test")

    1. {settings.commands.lint} (zero warnings)
    2. {settings.commands.typecheck} (zero type errors)
    3. {settings.commands.format_check} (zero reformats)
    4. {settings.commands.test} {test files from test_map.json} (zero failures, zero skips)

    Capture full stdout/stderr. Return ## DETERMINISTIC PASSED or ## DETERMINISTIC FAILED.
  "
)
```

If Rung 2 fails: record with exact error output, **STOP**.

---

## Rung 3 — Delta Tests (NON-BLOCKING)

Run broader module test suite for all modules containing modified files:
```bash
npm test {module directories} --coverage
```

Failures are recorded as gaps but do NOT stop the ladder.

---

## Rung 4 — Goal-Backward (BLOCKING on gaps)

Dispatch verifier (paths only):
```
Task(
  subagent_type="nexus-verifier",
  prompt="
    Read ~/.claude/agents/nexus/verifier.md for your role.

    Verify must_haves from: .nexus/04-phases/{phase}/PLAN.md

    For each truth in must_haves.truths: can the codebase deliver this? (wired + callable)
    For each artifact in must_haves.artifacts:
      - EXISTS: file on disk
      - SUBSTANTIVE: not a stub
      - WIRED: imported, called, return value used

    Stub patterns: return null/[]/{}  TODO/FIXME in impl  throw NotImplemented
                   console.log as only side effect  preventDefault() only

    For each key_link: verify the from->to->via connection in actual code.

    Files to read: {files_modified list}
    Return ## GOAL-BACKWARD PASSED or ## GOAL-BACKWARD GAPS with specific list.
  "
)
```

Gaps found: record, continue to Rung 5. Gaps block merge-judge.

---

## Rung 5 — Adversarial (BLOCKING on blocker severity)

Dispatch verifier in red-team mode (paths only):
```
Task(
  subagent_type="nexus-verifier",
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

Blocker-severity findings block merge-judge. Warning/info are recorded only.

---

## Rung 6 — System Validation

Run if integration/E2E tests are configured:
```bash
npm run test:integration 2>/dev/null || true
npm run test:e2e 2>/dev/null || true
```

Failures = gaps. Not configured = INFO (not blocking).

---

## Rung 7 — Playwright Validation

If `playwright_required: false` in PLAN.md: skip rung, mark `playwrightOk: true` (not required).

If `playwright_required: true`:

1. Read `settings.json → playwright.mcpPath`.
   - If `mcpPath` is non-empty (including `"npx @playwright/mcp@latest"`): proceed to step 2.
   - If `mcpPath` is empty or missing:
     - **Try auto-detection first:** read `~/.claude/nexus/playwright-detect.json` (or the runtime-equivalent path for Gemini/OpenCode). If `mcpPath` is present, write it into `settings.json → playwright.mcpPath` and proceed.
     - If auto-detection also yields nothing, prompt:
       ```
       ✗ PLAYWRIGHT REQUIRED but no MCP path configured.

       [1] Use npx (no install needed): sets mcpPath = "npx @playwright/mcp@latest"
       [2] Install globally first: npm install -g @playwright/mcp  (then re-run verify)
       [3] Set path manually in settings.json → playwright.mcpPath
       [4] Skip this rung (creates a gap — plan will not pass merge-judge)
       ```
       - Choice [1]: write `"npx @playwright/mcp@latest"` to settings.json and proceed.
       - Choice [2]: stop, user re-runs verify after install.
       - Choice [3]: stop, wait for user to edit settings.json, user re-runs verify.
       - Choice [4]: mark `playwrightOk: false`, record gap, continue to Rung 8.
   - If `mcpPath` is set but `playwright.enabled: false`: log `ℹ playwright.enabled is false but playwright_required is true in PLAN.md — proceeding anyway` and continue.

2. Connect to Playwright MCP at `mcpPath`.
3. Run flow specs from `.nexus/08-playwright/flow-specs/` tagged for this phase.
4. Capture: screenshot + trace + (video if flow >30s). Write to `.nexus/07-artifacts/`.
5. If any flow fails: mark `playwrightOk: false`. Artifacts are Scar evidence — do not discard.

---

## Rung 8 — Merge-Judge (Final Gate)

Dispatch merge-judge with results summary (NOT full file contents):
```
Task(
  subagent_type="nexus-merge-judge",
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

## Write verification-report.json

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

## Output and Auto-Advance

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

If `auto_advance: true` (default):
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

If `auto_advance: true` (default):
```
Auto-creating gap-closure plan in 3s... (type "stop" to pause)
```
Invoke `/nexus:plan --gaps`. Plan creates targeted gap-closure plan, then auto-executes and re-verifies.
