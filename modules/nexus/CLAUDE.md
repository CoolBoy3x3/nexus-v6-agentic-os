# NEXUS V6 — AGENT OPERATING FIRMWARE

> Standing orders governing ALL agent behavior in Nexus V6.
> These rules override any other instructions unless explicitly stated otherwise.
> Load this file before executing ANY /nexus:* command.
> Do not summarize, skip, or abbreviate these rules.

**Runtime:** Claude Code (primary). Workflows use `Task(subagent_type=...)` dispatch — Claude Code native. Other runtimes (Codex, Gemini, OpenCode) must adapt dispatch syntax manually.

---

## RULE 0: LOAD BEFORE EXECUTE

**Before ANY /nexus:* command: read the command .md file AND its referenced workflow file.**

NEVER execute Nexus commands from memory or inference — always load the actual files first.
If files cannot be loaded: STOP and inform the user.

This applies to every command, every session, every time. Training memory is a hypothesis. The files are truth.

---

## IMMUTABLE DESIGN LAWS

These cannot be overridden by any command, user instruction, or agent decision.

### LAW 1: FILESYSTEM IS TRUTH

What is on disk is real. Claims, summaries, and SUMMARY.md assertions are not proof.

- NEVER assert a file exists without reading it
- NEVER assert a test passes without running it and reading actual output
- NEVER assert an API works without calling it and reading the response
- NEVER mark a task complete based on what you wrote — verify what is actually on disk
- If you wrote a file, read it back. If you ran a command, read the stdout. Trust nothing you didn't verify.

**Violation example:** "I created the auth module" — without reading the file and confirming it exists with correct content.

---

### LAW 2: ARCHITECTURE IS FIRST-CLASS

The architecture graph is not a nice-to-have. It is mandatory state.

- Every task that touches a module boundary MUST update `.nexus/02-architecture/`
- API contracts are law. No undocumented API changes — ever.
- Before modifying any contract, run contract-diff to detect breaking changes.
- Architecture decisions belong in `DECISION_LOG.md`, not in code comments.
- A stale architecture graph is worse than no graph — it misleads future workers.

**After every task that modifies module boundaries:**
```
□ Update .nexus/02-architecture/modules.json
□ Update .nexus/02-architecture/dependencies.json (if import graph changed)
□ Update .nexus/02-architecture/api_contracts.json (if API surface changed)
□ Update .nexus/02-architecture/data_models.json (if data schema changed)
□ Run contract-diff to detect breaking changes
□ If breaking changes found: record in DECISION_LOG.md with rationale
□ If breaking changes are unintentional: STOP and roll back
```

---

### LAW 3: EVERY ACTION IS REVERSIBLE OR MUST BE APPROVED

- Before any high-risk or critical-risk task: create a checkpoint.
- Irreversible actions (schema migrations, destructive refactors, data purges) require explicit human approval.
- If something goes wrong: STOP immediately. Do not attempt patches. Run `/nexus:recover`.
- "Fix it forward" is forbidden. Roll back and re-plan.
- A checkpoint is a git commit + .nexus/ snapshot. Creating one takes seconds. Never skip it.

---

### LAW 4: VERIFY BEFORE MERGE

No task output merges to main without passing the FULL verification ladder:

```
physicality → deterministic → delta-tests → goal-backward → adversarial → system → [playwright]
```

- The merge-judge agent is the final gate. Not a suggestion. Not optional.
- A passing test suite is not sufficient. All rungs must pass.
- Playwright verification is mandatory when `playwright_required: true` in task frontmatter.
- "Almost passing" is rejected. Every flag must be `true`.

---

### LAW 5: NARROW CONTEXT OVER GIANT CONTEXT

Workers receive context packets, not full repo access. Orchestrators stay lean.

- Never load entire codebase into a worker's context.
- A context packet contains ONLY: declared files, architecture slice, contracts slice, test slice, state digest (≤80 lines), boundaries.
- Orchestrators pass FILE PATHS to workers — workers read their own context. Orchestrators do NOT read file contents on behalf of workers.
- If you need more context: request it explicitly via `<<NEXUS_PERMISSION_REQUEST>>` — do not expand context arbitrarily.

**Why:** At phase 12 of a large project, a worker with full-repo context hallucinates. A lean orchestrator accumulates minimal context across waves. Both stay grounded.

---

## AUTONOMOUS PIPELINE — DEFAULT BEHAVIOR

**Nexus runs the full loop automatically unless blocked.**

The pipeline: `PLAN → EXECUTE → VERIFY → UNIFY → next PLAN → ...`

Auto-advance is the default. Manual intervention only when:
- A task is `BLOCKED` (missing info, permission denied, architectural conflict)
- A verification gap cannot be closed automatically (3 consecutive failures)
- A `critical` risk task requires explicit human approval
- The user passes `--manual` flag to override auto-advance

**The user's entry point is `/nexus:plan [phase]` or `/nexus:progress`.**
The system handles the rest. No manual command chaining required.

---

## COMMAND ROUTING RULES

When the user invokes a `/nexus:*` command, route to the appropriate workflow and agent.
**Always load the relevant workflow file before executing. Never execute from memory alone.**

| Command | Workflow File | Purpose |
|---------|--------------|---------|
| `/nexus:plan [phase]` | `workflows/plan-phase.md` | Full loop: discuss → research → plan → execute → verify → unify |
| `/nexus:execute [plan]` | `workflows/execute-phase.md` | Execute plan waves, auto-chain to verify+unify on success |
| `/nexus:verify [phase]` | `workflows/verify-phase.md` | Run ladder, auto-chain to unify on pass / gap-plan on fail |
| `/nexus:unify [plan]` | `workflows/unify-phase.md` | Close loop, auto-chain to next plan or declare COMPLETE |
| `/nexus:progress [context]` | `workflows/progress-phase.md` | Smart router: orient, show status, output ONE action; --pause to save state |
| `/nexus:recover` | `workflows/recover-phase.md` | Rollback to checkpoint, scar, re-plan |
| `/nexus:revise [phase]` | `workflows/revise-phase.md` | Blast-radius analysis + targeted plan revision |
| `/nexus:map-codebase` | self-contained (no workflow file) | Index codebase into architecture files |
| `/nexus:init` | `workflows/init-project.md` | Initialize .nexus/ workspace |

**Removed commands (folded into /nexus:progress and auto-advance):**
- `/nexus:pause` → use `/nexus:progress --pause`
- `/nexus:resume` → use `/nexus:progress` (reads HANDOFF.md automatically)
- `/nexus:settings` → edit `.nexus/01-governance/settings.json` directly

---

## AUTONOMY LEVELS

Autonomy determines what the system can do without asking the human for approval.
The setting `settings.json → autonomy.default` is the project-wide cap.

### LOW RISK → proceed without asking
Safe to execute autonomously:
- Adding new files that follow established patterns
- Writing new unit tests
- Refactoring within a single, isolated module (no boundary changes)
- Fixing linting/formatting errors
- Documentation updates
- Adding new utility functions with no external dependencies

### MEDIUM RISK → checkpoint first, then proceed without asking
- Modifying existing core logic files
- Adding new API endpoints (not modifying existing ones)
- Adding new database queries (not modifying schema)
- Modifying configuration files
- Adding new dependencies (non-security-sensitive)
- Writing integration tests

### HIGH RISK → create checkpoint, notify human, proceed if no objection within 30s
- Modifying existing API contracts
- Modifying data models
- Changes touching 5 or more files simultaneously
- Upgrading major dependencies
- Modifying authentication flows (not core auth logic)
- Modifying CI/CD pipelines

### CRITICAL RISK → FULL STOP, explicit human approval required
Do NOT proceed without explicit human confirmation:
- Schema migrations (ALTER TABLE, DROP, CREATE TABLE, Prisma schema changes)
- Core authentication logic changes
- Destructive refactors (removing modules, changing fundamental data structures)
- External service integrations with real credentials
- Any action that cannot be rolled back
- Security-sensitive changes (encryption, access control, secrets handling)
- Changing public API contracts consumed by external services

---

## REVIEW TIER LOGIC

| Tier | Meaning | When |
|------|---------|------|
| `none` | No review | Pure docs, formatting, standalone scripts |
| `self` | Worker self-review before NEXUS_COMPLETE | Default for feature work |
| `peer` | Validator agent reviews after self-review | High-risk, shared modules, API changes |
| `adversarial` | Full red-team by verifier agent | Security-touching, payments, PII, public API |

---

## SMART TDD LOGIC

TDD mode is declared in task frontmatter: `tdd_mode: hard|standard|skip`

### hard TDD
> Iron law: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"

1. Write the failing test FIRST
2. Run it — watch it fail — confirm it fails for the RIGHT reason
3. Write the MINIMUM production code to make it pass
4. Run tests — confirm they pass
5. Refactor for quality — tests must still pass
6. Commit: test + implementation together

**If you wrote implementation before the test:** Delete the implementation. Start over with the test.

### standard TDD
1. Write implementation
2. Write test alongside (concurrent, not after)
3. Tests MUST pass before task is marked complete
4. No merging with failing tests

### skip TDD
No tests required. Must be explicitly declared: `tdd_mode: skip`
Only for: throwaway prototypes, pure config files, docs, generated/scaffolded code.

**NEVER skip TDD without explicit `tdd_mode: skip` in task frontmatter.**

---

## PHYSICALITY RULES

Before marking ANY task as complete, verify each of these. No exceptions.

```
□ EXISTENCE: Each file in task.filesModified actually exists on disk
  → Read each file. Do not trust that you created it — verify.

□ CONTENT INTEGRITY: Files contain what you expect
  → Spot-check key sections. Silent overwrites happen.

□ NO UNDECLARED WRITES: Only files in task.filesModified were changed
  → Run: git diff --name-only
  → Any file not in filesModified appearing in git diff = VIOLATION

□ EXPECTED DIFF EXISTS: The change is non-empty and meaningful
  → git diff must show actual changes, not just whitespace
  → A zero-diff = the task did nothing

□ TESTS RUN AND PASS: If tdd_mode is not skip, tests must pass
  → Run the actual test suite. Read the actual output. Do not assume.

□ LINTING PASSES: No lint errors introduced
  → Run the project linter. Fix errors before marking complete.
```

---

## WORKER DEVIATION RULES

**Workers WILL discover work not in the plan.** Apply these rules automatically. No orchestrator permission needed for Rules 1–3.

### RULE 1: Auto-fix bugs
**Trigger:** Code doesn't work as intended (broken behavior, errors, incorrect output)
**Examples:** Wrong queries, logic errors, type errors, null pointer exceptions, broken validation, security vulnerabilities, race conditions, memory leaks

### RULE 2: Auto-add missing critical functionality
**Trigger:** Code missing essential features for correctness, security, or basic operation
**Examples:** Missing error handling, no input validation, no auth on protected routes, missing authorization, no CSRF/CORS, no rate limiting, missing DB indexes, no error logging
**Critical = required for correct/secure/performant operation.** Not features — correctness requirements.

### RULE 3: Auto-fix blocking issues
**Trigger:** Something prevents completing the current task
**Examples:** Missing dependency, wrong types, broken imports, build config error, circular dependency

### RULE 4: Stop for architectural changes
**Trigger:** Fix requires significant structural modification
**Examples:** New DB table, major schema changes, new service layer, switching libraries, breaking API changes
**Action:** STOP → emit NEXUS_BLOCKED with what was found, proposed change, why needed, alternatives.

### RULE PRIORITY
1. Rule 4 applies → STOP (architectural decision)
2. Rules 1–3 apply → Fix automatically
3. Genuinely unsure → Rule 4 (ask)

### SCOPE BOUNDARY
Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing issues in unrelated files → log to `deferred-items.md`, do NOT fix.

### FIX ATTEMPT LIMIT
After 3 auto-fix attempts on a single task: STOP fixing. Document remaining issues under "Deferred Issues". Continue. Do NOT attempt fix #4.

---

## AUTOMATION-FIRST RULES

**Claude automates everything with CLI/API. Checkpoints are for verification and decisions, not manual work.**

1. **If Claude can run it, Claude runs it.** Never ask the user to execute CLI commands, start servers, or run builds.
2. **Claude sets up the verification environment.** Start dev servers, seed databases, configure env vars BEFORE any checkpoint.
3. **Users only do what requires human judgment.** Visual checks, UX evaluation, "does this feel right?"
4. **Secrets come from user, automation comes from Claude.** Ask for API keys, then Claude uses them via CLI.
5. **Never present a checkpoint with a broken verification environment.** Fix the server first, then ask.

**Auth gates are not failures.** When Claude hits an auth error: recognize it as a gate, stop, emit `checkpoint:human-action`, provide exact auth steps, verify, retry.

---

## CHECKPOINT TYPES

Three types, in order of frequency:

| Type | Frequency | Trigger | Auto-mode |
|------|-----------|---------|-----------|
| `checkpoint:human-verify` | 90% | Visual/functional check after automation | Auto-approve |
| `checkpoint:decision` | 9% | Human must choose implementation direction | Auto-select option 1 |
| `checkpoint:human-action` | 1% | Auth gate or truly unavoidable manual step | ALWAYS stops |

**Auto-mode behavior** (when `settings.auto_advance: true`):
- human-verify → `⚡ Auto-approved: [what-built]` — continue
- decision → `⚡ Auto-selected: [option 1 name]` — embed decision, continue
- human-action → ALWAYS stop. Auth gates cannot be automated.

**Checkpoint display format** (╔═══╗ box — used for all 3 types):
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: [Verification / Decision / Action Required]
╚═══════════════════════════════════════════════════════╝
Progress: {N}/{M} | Task: {id}: {description}
[Type-specific content — built/decision/auth steps]
────────────────────────────────────────────────────────
→ YOUR ACTION: [approved / select 1 or 2 / done]
────────────────────────────────────────────────────────
```

---

## RECOVERY RULES

### When a task fails during execution:
1. STOP immediately. Output `<<NEXUS_BLOCKED: task failed — {description}>>`
2. Do not attempt to patch forward
3. Orchestrator triggers rollback to last checkpoint
4. Record the failure as a Scar in `.nexus/01-governance/SCARS.md`
5. Extract ONE concrete prevention rule from the failure
6. Re-plan the task with the prevention rule applied
7. Do NOT retry the same approach more than 3 times

### When verification fails:
1. Do NOT merge
2. Record verification gaps in `verification-report.json`
3. Auto-invoke gap-closure: `/nexus:plan --gaps` creates targeted fix plan
4. Re-verify from the beginning — do not skip steps

### The 3-consecutive-failures rule:
> If you have failed 3 consecutive times on the same issue, STOP.
> This is an architectural problem, not a patch problem.
> Send `<<NEXUS_BLOCKED: 3 consecutive failures — architectural issue>>`
> Escalate to the architect agent. Do not continue patching.

### Root-cause requirement:
> Never fix a bug without identifying the root cause first.
> A fix without root cause is a guess. Guesses create new bugs.
> Evidence: read the actual error, run the actual code, trace the actual call stack.

---

## REQUIRED SKILLS PER WORK TYPE

If `.nexus/01-governance/settings.json` contains a `required_skills` map, skills are mandatory:

```json
"required_skills": {
  "auth": ["smart-tdd"],
  "payments": ["smart-tdd", "adversarial-review"],
  "data-migration": ["rollback-discipline"],
  "ui": ["playwright-browser-validation"],
  "debugging": ["systematic-debugging"]
}
```

**Before executing any plan:** check the plan's work type tags against `required_skills`.
If a required skill is not loaded: BLOCK execution, list which skills to load.
**Override:** user types "override" — logs the deviation, proceeds with warning.

---

## PLAYWRIGHT USAGE RULES

### WHEN to use Playwright:
- Any task modifying UI components visible to users
- Any task modifying user flows (login, checkout, onboarding, form submission)
- Any task marked `playwright_required: true`
- Any task involving visual regression risk
- Any AC including "user can see/click/fill"

### HOW to use Playwright:
1. Connect to Playwright MCP server (path from `settings.json`)
2. Load relevant flow spec from `.nexus/08-playwright/flow-specs/`
3. Execute the flow
4. Capture ALL artifacts: screenshot + trace + (video if long flow)
5. Write artifacts to `.nexus/07-artifacts/` via artifact-writer
6. If flow FAILS: artifacts are Scar evidence. Do not discard.
7. If flow PASSES: artifacts are merge-judge proof.

### Promoting to stable tests:
When a flow has passed 3+ consecutive verification runs → promote to `.nexus/08-playwright/generated-tests/`

---

## CONTEXT PACKING RULES

### What a context packet contains:
- `task`: only the current task definition (inline JSON)
- `files_modified`: exact file paths — worker reads actual content itself at execution time
- `architectureSlice`: worker reads `modules.json` and filters to entries whose `files` overlap with `files_modified` — NOT the full ARCHITECTURE.md
- `contractsSlice`: worker reads `api_contracts.json` and filters to entries whose `file` matches `files_modified` — NOT all contracts
- `testsSlice`: worker reads `test_map.json` and filters to entries whose `source` matches `files_modified`
- `stateDigest`: first 80 lines of STATE.md — not the full file
- `scars`: only the "Active Prevention Rules" table from SCARS.md — not full history
- `settings`: `settings.json` — for `commands.test`, `commands.lint`, `commands.typecheck`
- `boundaries`: DO NOT TOUCH list from the plan — inline, not a file read
- `tddMode`: `hard | standard | skip`

### What the orchestrator MUST NOT do:
- Read file contents to build context packets — pass paths only
- Accumulate file contents across waves
- Load ARCHITECTURE.md or pass it to workers — workers filter modules.json themselves

### What workers MUST NOT do:
- Request files not in their context packet (use NEXUS_PERMISSION_REQUEST)
- Modify files not in `task.files_modified`
- Load the full codebase to "understand context"
- Ignore the boundaries list

---

## WORKER COMMUNICATION TAGS

Workers communicate via structured paired open/close tags with JSON bodies. The orchestrator parses these in real-time.

```
<<NEXUS_STATUS>>
{"message": "Implementing auth middleware (step 2/4)"}
<</NEXUS_STATUS>>

<<NEXUS_COMPLETE>>
{"filesModified": ["src/middleware/auth.ts"], "summary": "...", "deviations": ["[Rule 2 - Missing] Added input validation"], "deferredIssues": []}
<</NEXUS_COMPLETE>>

<<NEXUS_BLOCKED>>
{"reason": "Missing dependency foo@3.x not in package.json"}
<</NEXUS_BLOCKED>>

<<NEXUS_PERMISSION_REQUEST>>
{"path": "src/config/secrets.ts", "reason": "Need to check key format"}
<</NEXUS_PERMISSION_REQUEST>>
```

**Rules:** Exact tag names, `<<TAG>>` / `<</TAG>>` format, valid JSON body, never embed `>>` in values.

---

## SCAR SYSTEM

Scars are permanent records of failures that taught us something.

### When to create a scar:
- Any task requiring rollback
- Any verification failure (not just a typo fix)
- 3+ consecutive fixes failing
- Any architectural assumption proving wrong

### Scar format:
```
| {id} | {date} | {category} | {description} | {root cause} | {prevention rule} |
```

### Prevention rules:
Every scar MUST extract ONE concrete prevention rule.
Prevention rules accumulate. They feed into future planning as standing constraints.
Workers receive active prevention rules in their stateDigest.

---

## HANDOFF AND RESUME

### Automatic on session end:
1. Save all in-progress work to disk
2. Update `.nexus/01-governance/STATE.md` session continuity section
3. Auto-generate `HANDOFF-{YYYY-MM-DD}.md`

### On session start:
1. Run `/nexus:progress` — it reads HANDOFF.md + STATE.md automatically
2. Outputs EXACTLY ONE next action
3. Proceeds when user confirms (or auto-proceeds if `auto_advance: true`)

---

## DO NOT

1. Do NOT execute commands from memory — always load the file first (RULE 0)
2. Do NOT read file contents for context packets — pass paths to workers
3. Do NOT let workers scan the entire repo — use context packets
4. Do NOT mark a task complete without running the actual verification commands
5. Do NOT fix forward — roll back and re-plan
6. Do NOT ignore blockers — surface them, don't work around them
7. Do NOT skip UNIFY — every loop must close, no orphan plans
8. Do NOT start a high/critical task without a checkpoint
9. Do NOT summarize SUMMARY.md as proof — verify what actually exists in code
10. Do NOT attempt a 4th fix after 3 consecutive failures — escalate to architect
11. Do NOT bypass the merge-judge — it is the final gate, not a suggestion
12. Do NOT run `/nexus:pause` or `/nexus:resume` as separate commands — use `/nexus:progress`
13. Do NOT ask the user to start servers, run builds, or execute CLI commands — Claude automates all of this
14. Do NOT present a checkpoint with a broken verification environment — fix the server first
15. Do NOT treat auth errors as failures — they are gates; emit checkpoint:human-action
16. Do NOT fix pre-existing issues in unrelated files during task execution — log to deferred-items.md
17. Do NOT make architectural changes (new tables, new services) without Rule 4 stop and user approval
