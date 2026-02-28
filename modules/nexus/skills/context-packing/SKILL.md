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

## Gold-Standard Context Packet (10 Slots)

A context packet is a structured object passed to a worker agent. It contains exactly 10 slots — no more, no less. Every slot has a strict scope rule.

### Slot 1: `files`

The exact list of file paths the worker is allowed to read and write. Equals `task.filesModified`. Never broader.

```json
"files": ["src/auth/middleware.ts", "src/auth/middleware.test.ts"]
```

### Slot 2: `filesContent`

The current content of every file in `files`. Empty string means the file does not exist yet — the worker creates it.

```json
"filesContent": {
  "src/auth/middleware.ts": "(current file content or empty string if new)",
  "src/auth/middleware.test.ts": ""
}
```

**Critical:** Workers receive paths AND content. They do not need to read files themselves for their own slots. This prevents workers from accidentally broadening their context by reading adjacent files.

### Slot 3: `architectureSlice`

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

### Slot 4: `contractsSlice`

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

### Slot 5: `dependencySymbols`

Exported symbol names from files this task **imports but does not own**. Gives workers the interface without loading full files. Built from `symbols.json` + `ownership.json`.

```json
"dependencySymbols": {
  "src/shared/jwt.ts": ["signToken", "verifyToken", "JWTPayload"],
  "src/db/users.ts": ["findUserById", "UserRecord"]
}
```

**Why this matters:** Without this slot, workers either guess at interfaces (producing type errors) or request permission to read dependency files (slowing execution). This slot eliminates both failure modes.

### Slot 6: `testsSlice`

Test file paths mapped to the source files being modified. From `test_map.json`.

```json
"testsSlice": ["src/auth/middleware.test.ts", "src/auth/__integration__/middleware.int.test.ts"]
```

### Slot 7: `scarsDigest`

**Only the Active Prevention Rules table from SCARS.md.** Maximum 30 lines. These are non-negotiable constraints — the same mistake cannot happen twice.

```
scarsDigest: "
## Active Prevention Rules
| Rule | Applies To | Constraint |
|------|-----------|-----------|
| SCAR-001 | src/auth/ | Always verify DB call wired before marking auth complete |
| SCAR-003 | */middleware* | Never trust req.user without null check — JWT decode can return null |
"
```

Do NOT include full scar descriptions, timestamps, or root cause analysis — just the prevention rules table.

### Slot 8: `acceptanceCriteria`

The specific AC rows from `ACCEPTANCE_MASTER.md` that this task must satisfy. Maximum 50 lines. Only the IDs listed in `task.acceptanceCriteria`.

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

### Slot 9: `stateDigest`

First 150 lines of `STATE.md`. Covers: current loop position, phase goal, recent decisions, blockers. Not the full history.

### Slot 10: `boundaries`

The DO NOT CHANGE list verbatim from `PLAN.md`. Workers must never write to files outside `task.filesModified`.

```
boundaries: [
  "src/auth/login.ts — modified by T01, do not touch",
  "src/api/routes.ts — will be modified by T03, do not touch"
]
```

---

## Why All 10 Slots Are Necessary

| Without this slot | Failure mode |
|------------------|-------------|
| No `filesContent` | Worker reads own files — may accidentally broaden context |
| No `dependencySymbols` | Worker guesses interfaces → type errors, or requests permission reads → slow |
| No `scarsDigest` | Worker repeats past failures — same bug introduced twice |
| No `acceptanceCriteria` | Worker doesn't know what "done" means — implements wrong behavior |
| No `tddMode` | Worker defaults to no tests or wrong TDD discipline for risk level |

The 10-slot packet is a gold standard — every slot has a failure mode it prevents.

---

## How to Build a Context Packet

The mission-controller builds context packets before dispatching each worker.

### Building `filesContent`

```typescript
const filesContent = {};
for (const filePath of task.files_modified) {
  try {
    filesContent[filePath] = readFile(filePath);
  } catch {
    filesContent[filePath] = ''; // File doesn't exist yet — worker creates it
  }
}
```

### Building `architectureSlice`

1. Read ARCHITECTURE.md
2. Identify which modules own the files in `task.files_modified`
   - Check the module map: which module's path contains the file?
3. Extract only those module sections
4. Include only the API boundaries that involve those modules

### Building `contractsSlice`

1. Read `api_contracts.json`
2. For each file in `task.files_modified`, check if it appears in any contract's `path` or related files
3. Extract only the relevant contracts

### Building `testsSlice`

1. Read `test_map.json`
2. Find entries where `sourceFile` matches a file in `task.files_modified`
3. Return those entries

### Building `stateDigest`

1. Read STATE.md in full
2. Extract:
   - "Current Phase Goal:" section (if present)
   - All rows from SCARS.md "Active Prevention Rules" table
   - Any DECISION_LOG.md entries that are relevant to this task's files
3. Limit to 80 lines
4. Include the hard limit note: "Do not ask for more context — request with NEXUS_PERMISSION_REQUEST if truly needed"

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

**Making the stateDigest too long:** 80 lines is the maximum. Beyond that, the worker's attention is diluted. Be ruthless about what's included.

**Forgetting to include the test file in filesContent:** If `task.files_modified` includes a test file, include its current content (or empty string if new) in `filesContent`.

---

## Success Criteria

- [ ] Context packet built with exactly 10 slots
- [ ] `files` == task.filesModified exactly, never broader
- [ ] `filesContent` has an entry for every file in `files` (empty string for new files)
- [ ] `architectureSlice` contains ONLY modules owning the modified files
- [ ] `contractsSlice` contains ONLY contracts overlapping with modified files
- [ ] `dependencySymbols` contains exported symbols from imported-but-not-owned files
- [ ] `testsSlice` contains test file paths for modified source files
- [ ] `scarsDigest` contains ONLY the Active Prevention Rules table, ≤30 lines
- [ ] `acceptanceCriteria` contains ONLY the AC rows linked to this task, ≤50 lines
- [ ] `stateDigest` is ≤150 lines of STATE.md
- [ ] `boundaries` contains the DO NOT CHANGE list verbatim
- [ ] `tddMode` and `riskTier` present at top level
- [ ] No full repo context included anywhere
- [ ] No files outside task.filesModified in any slot
