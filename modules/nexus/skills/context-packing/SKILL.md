---
name: context-packing
description: Build narrow context packets for worker agents. Prevents hallucination by limiting worker context to task-relevant files only.
---

# Context Packing

## Overview

The Nexus execution model is built around narrow context packets. Workers receive only the information they need to implement their specific task — nothing more. This is not a limitation, it is an architectural safety mechanism.

**Design Law 5:** Workers operating with full-repository context at high task counts (phase 10+) produce hallucinated completions. They create plausible-looking code that doesn't wire to the actual system. Narrow context prevents this.

---

## Why Narrow Context Matters

When a worker receives 50,000 tokens of codebase context, several things go wrong:

1. **Attention dilution:** The worker cannot focus on the 500 lines actually relevant to the task. Noise drowns signal.

2. **Hallucinated conformity:** The worker "knows" what patterns the codebase uses, so it creates code that LOOKS like it fits — but imports from wrong paths, uses deprecated APIs, or ignores the actual interface contract.

3. **Scope creep:** With full visibility, workers "fix" things they notice along the way. These unannounced changes break the verifier's undeclared-writes check.

4. **Context window exhaustion:** At phase 12, a full-repo context packet exceeds the practical working context of the model, causing degraded output on the actual task.

Narrow context packets keep workers focused, honest, and fast.

---

## Gold-Standard Context Packet (14 Slots)

A context packet is a structured object passed to a worker agent. It contains exactly 14 slots organized into 5 categories. Every slot answers a specific question a worker must be able to answer before writing a single line of code.

```
WHY        → missionContext, phaseObjective
WHAT       → files, filesContent, acceptanceCriteria
HOW        → architectureSlice, contractsSlice, dependencySymbols, testsSlice, waveContext
CONSTRAINTS → scarsDigest, stateDigest, boundaries
TOOLING    → settings
```

---

### Slot 1: `missionContext` — WHY does this task exist?

From `PRD.md`: executive summary + technical constraints. Maximum 20 lines.

```
missionContext: "
## Executive Summary
SQX Lite is a lightweight SQL query builder for Node.js. Core value: type-safe
queries without an ORM. Tech stack: TypeScript, Node.js 20+, no runtime deps.

## Constraints (Technical)
- Runtime: Node.js 20+
- No external dependencies in production build
- Must compile to CJS and ESM
"
```

Without this: workers implement features that conflict with project constraints (e.g., adds a dependency to a zero-dep library).

### Slot 2: `phaseObjective` — What is this phase trying to accomplish?

From the current `PLAN.md` Objective section. Maximum 15 lines.

```
phaseObjective: "
## Objective
Goal: Implement the core query builder — SELECT, WHERE, ORDER BY, LIMIT/OFFSET.
Context: This is Phase 1. Nothing exists yet. The output of this phase is the
         foundation every other phase builds on.
Output: SUMMARY.md at .nexus/04-plans/01-core-builder/SUMMARY.md
"
```

Without this: workers don't know if they're building a foundation or an extension — they make different scope decisions depending on the answer.

### Slot 3: `files`

The exact list of file paths the worker is allowed to read and write. Equals `task.filesModified`. Never broader.

```json
"files": ["src/auth/middleware.ts", "src/auth/middleware.test.ts"]
```

### Slot 4: `filesContent`

The current content of every file in `files`. Empty string means the file does not exist yet — the worker creates it.

```json
"filesContent": {
  "src/auth/middleware.ts": "(current file content or empty string if new)",
  "src/auth/middleware.test.ts": ""
}
```

**Critical:** Workers receive paths AND content. They do not need to read files themselves for their own slots. This prevents workers from accidentally broadening their context by reading adjacent files.

### Slot 5: `acceptanceCriteria` — What does "done" mean?

The specific AC rows from `ACCEPTANCE_MASTER.md` for this task's AC IDs. Maximum 50 lines.

```
acceptanceCriteria: "
AC-3: Session Validation
  Given: A request with a valid JWT in the Authorization header
  When: validateSession middleware runs
  Then: req.user is populated with decoded payload and next() is called

AC-4: Invalid Token Rejection
  Given: A request with an expired or malformed JWT
  When: validateSession middleware runs
  Then: 401 response returned, req.user is not set
"
```

Without this: workers implement what they *think* the task means. With it: workers implement exactly what was decided.

### Slot 6: `architectureSlice`

From `modules.json`, only the module entries that own files in `task.filesModified`. Not the full architecture.

```json
"architectureSlice": {
  "modules": [{
    "id": "auth",
    "path": "src/auth/",
    "responsibility": "Authentication and session management",
    "publicApi": "src/auth/index.ts",
    "exports": ["validateSession", "createSession", "destroySession"],
    "dependsOn": [],
    "usedBy": ["api"]
  }]
}
```

### Slot 7: `contractsSlice`

From `api_contracts.json`, only contracts whose file path overlaps with `task.filesModified`. Not all contracts.

```json
"contractsSlice": {
  "contracts": [{
    "id": "auth-session",
    "endpoint": "POST /api/auth/login",
    "requestSchema": { "email": "string", "password": "string" },
    "responseSchema": { "token": "string", "expiresAt": "string" }
  }]
}
```

### Slot 8: `dependencySymbols`

Exported symbol names from files this task **imports but does not own**. Gives workers the interface without loading full files.

```json
"dependencySymbols": {
  "src/shared/jwt.ts": ["signToken", "verifyToken", "JWTPayload"],
  "src/db/users.ts": ["findUserById", "UserRecord"]
}
```

Without this: workers either guess at interfaces (type errors) or request permission reads (slows execution).

### Slot 9: `testsSlice`

Test file paths mapped to the source files being modified. From `test_map.json`.

```json
"testsSlice": ["src/auth/middleware.test.ts", "src/auth/__integration__/middleware.int.test.ts"]
```

### Slot 10: `waveContext` — What was just built that I'm building on top of?

Compact summary of completed tasks in waves prior to this task's wave. Maximum 30 lines.

```
waveContext: "
Prior wave completions (available to build on):
  Wave 1 | T01: Implemented JWT signing/verification utilities
    Files: src/shared/jwt.ts, src/shared/jwt.test.ts
  Wave 1 | T02: Implemented User model with findById/findByEmail
    Files: src/db/users.ts, src/db/users.test.ts
"
```

Without this: Wave 2+ workers don't know what exists yet. They either re-implement Wave 1 work or assume things that aren't built yet. This slot gives them the exact foundation they're building on.

### Slot 11: `scarsDigest`

**Only the Active Prevention Rules table from SCARS.md.** Maximum 30 lines.

```
scarsDigest: "
## Active Prevention Rules
| Rule | Applies To | Constraint |
|------|-----------|-----------|
| SCAR-001 | src/auth/ | Always verify DB call wired before marking auth complete |
| SCAR-003 | */middleware* | Never trust req.user without null check — JWT decode can return null |
"
```

### Slot 12: `stateDigest`

First 150 lines of `STATE.md`. Loop position, recent decisions, blockers. Not full history.

### Slot 13: `boundaries`

The DO NOT CHANGE list from `PLAN.md` verbatim.

```
boundaries: [
  "src/auth/login.ts — modified by T01, do not touch",
  "src/api/routes.ts — will be modified by T03, do not touch"
]
```

### Slot 14: `settings` — TOOLING (exact commands)

From `settings.json`. Tells workers exactly which commands to run. No guessing at tool names.

```json
"settings": {
  "commands": {
    "test": "pnpm vitest run",
    "lint": "pnpm eslint src",
    "typecheck": "pnpm tsc --noEmit",
    "build": "pnpm build"
  },
  "auto_advance": true,
  "parallelization": true
}
```

Without this: workers fall back to `npm test` / `npm run lint` which may not exist in the project, causing false failures on every validation run. Workers also cannot determine auto-mode without reading settings.json from disk (which breaks the pre-built packet model).

---

## Why All 14 Slots Are Necessary

| Slot | Without it | Failure mode |
|------|-----------|-------------|
| `missionContext` | Worker doesn't know project constraints | Adds a dependency to a zero-dep library; uses wrong runtime |
| `phaseObjective` | Worker doesn't know if building foundation or extension | Over-engineers Wave 1; under-engineers final phase |
| `filesContent` | Worker reads own files unsupervised | May accidentally load adjacent files, broadening context |
| `acceptanceCriteria` | Worker interprets task description their own way | Implements wrong behavior, passes self-review, fails verifier |
| `dependencySymbols` | Worker guesses interfaces | Type errors on every import, or permission-reads slow execution |
| `waveContext` | Wave 2+ workers don't know what exists | Re-implements completed work or assumes things not yet built |
| `scarsDigest` | Worker unaware of past failures | Same bug introduced twice |
| `settings` | Worker falls back to generic npm commands | Wrong test runner, false lint failures, wrong build command |
| `tddMode` | Worker uses wrong testing discipline | Hard-risk task without iron-law TDD; low-risk task over-tested |

The 14-slot packet is the gold standard — every slot has a specific failure mode it prevents.

---

## How to Build a Context Packet

The mission-controller **never builds packets manually**. It calls `ContextPacketBuilder.buildForTask()` from `@nexus/core`. All 14 slots are assembled in parallel.

```typescript
import { ContextPacketBuilder } from '@nexus/core';

const builder = new ContextPacketBuilder(projectCwd);
const packet = await builder.buildForTask(task, allTasks);
// packet has all 14 slots, ready to inline into worker prompt
```

The builder handles all filtering, reading, and fallbacks internally:
- `filesContent`: reads each file, returns empty string for new files
- `architectureSlice`: reads modules.json, filters to relevant modules only
- `contractsSlice`: reads api_contracts.json, filters to overlapping contracts
- `dependencySymbols`: reads symbols.json + ownership.json, returns imports-not-owned
- `testsSlice`: reads test_map.json, returns test files for modified sources
- `stateDigest`: first 150 lines of STATE.md
- `scarsDigest`: only the Active Prevention Rules section, ≤30 lines
- `missionContext`: PRD.md executive summary + constraints, ≤20 lines
- `phaseObjective`: PLAN.md Objective section, ≤15 lines
- `waveContext`: completed prior-wave tasks, ≤30 lines
- `boundaries`: settings.json boundaries array
- `settings`: settings.json commands + flags with safe defaults

---

## What Workers Must NOT Do

Workers operating within context packets must obey these rules:

1. **Read only the files provided.** If a worker needs a file outside the packet, it must send `<<NEXUS_PERMISSION_REQUEST: path>>` and wait.

2. **Write only to `task.files_modified`.** Any write outside this list is a scope violation. The validator will flag it.

3. **Not assume module contracts.** Use only what is in `contractsSlice`. If the contract isn't there, it doesn't exist.

4. **Not guess at architecture.** Use only what is in `architectureSlice`. If a pattern isn't documented there, use what the file content shows.

5. **Not refactor outside scope.** "While I'm here" improvements to files not in `task.files_modified` are not permitted.

---

## Context Request Protocol

When a worker needs a file that is not in the context packet:

Worker sends: `<<NEXUS_PERMISSION_REQUEST: src/utils/token.ts>>`

Mission-controller evaluates:
- Is this file genuinely needed for the task?
- Is the task's `files_modified` list incomplete (should this file be in it)?
- Could the worker proceed without it using what's already in the contract/architecture slices?

If granted: provide the file content in a permission grant message
If denied: explain why and what the worker can use instead

If a worker repeatedly needs files outside its context packet, this may indicate the task's `files_modified` list was incomplete. Flag this in TASK_GRAPH.json for the planner.

---

## Common Context Packing Mistakes

**Including the full ARCHITECTURE.md:** Only include the relevant module sections. The auth module worker does not need the payment module documentation.

**Including all API contracts:** Only include contracts that the modified files actually use or implement.

**Omitting prevention rules from stateDigest:** These are the most important constraints a worker can receive. Always include active prevention rules.

**Making the stateDigest too long:** 150 lines is the maximum. Beyond that, the worker's attention is diluted. `ContextPacketBuilder` enforces this automatically.

**Forgetting to include the test file in filesContent:** If `task.files_modified` includes a test file, include its current content (or empty string if new) in `filesContent`.

---

## Success Criteria

- [ ] Context packet built with exactly 14 slots via `ContextPacketBuilder.buildForTask()`
- [ ] `missionContext` — PRD executive summary + tech constraints, ≤20 lines
- [ ] `phaseObjective` — PLAN.md Objective section, ≤15 lines
- [ ] `files` — equals task.filesModified exactly, never broader
- [ ] `filesContent` — entry for every file in `files` (empty string for new files)
- [ ] `acceptanceCriteria` — only AC rows linked to this task, ≤50 lines
- [ ] `architectureSlice` — only modules owning the modified files
- [ ] `contractsSlice` — only contracts overlapping with modified files
- [ ] `dependencySymbols` — exported symbols from imported-but-not-owned files
- [ ] `testsSlice` — test file paths for modified source files
- [ ] `waveContext` — completed prior-wave tasks with file lists, ≤30 lines
- [ ] `scarsDigest` — only Active Prevention Rules table, ≤30 lines
- [ ] `stateDigest` — ≤150 lines of STATE.md
- [ ] `boundaries` — DO NOT CHANGE list verbatim from PLAN.md
- [ ] `settings` — commands.test, commands.lint, commands.typecheck, auto_advance, parallelization
- [ ] `tddMode` and `riskTier` at top level
- [ ] No full repo context anywhere
- [ ] No files outside task.filesModified in any slot
