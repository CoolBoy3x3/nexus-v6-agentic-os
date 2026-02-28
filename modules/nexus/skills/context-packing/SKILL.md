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

## Context Packet Structure

A context packet is a structured object passed to a worker agent. It contains exactly these components:

### 1. `task`

The full task definition from PLAN.md:

```json
{
  "id": "T02",
  "description": "Implement session middleware that validates JWT tokens from Authorization header. Export validateSession(req, res, next). Return 401 if missing or invalid. Attach decoded user to req.user.",
  "wave": 1,
  "depends_on": [],
  "files_modified": [
    "src/auth/middleware.ts",
    "src/auth/middleware.test.ts"
  ],
  "risk_tier": "high",
  "tdd_mode": "hard",
  "acceptance_criteria": ["AC-3", "AC-4"]
}
```

### 2. `filesContent`

The current content of every file in `task.files_modified`:

```
filesContent: {
  "src/auth/middleware.ts": "(file content — may be empty if new file)",
  "src/auth/middleware.test.ts": "(file content — may be empty if new file)"
}
```

Include files that don't exist yet (worker needs to know to create them, not that they're missing).

### 3. `architectureSlice`

From ARCHITECTURE.md, extract ONLY the sections covering modules that own the files in `task.files_modified`.

**Not the full ARCHITECTURE.md.** If the task modifies `src/auth/middleware.ts`, extract only the `auth` module section, not the entire module map.

Example:
```
architectureSlice: "
## Module: auth
Path: src/auth/
Responsibility: Authentication and session management
Public API: src/auth/index.ts exports: validateSession, createSession, destroySession
Depends on: none
Used by: api (imports validateSession for route protection)

API Boundaries touching this module:
  POST /api/auth/login → src/auth/login.ts
  POST /api/auth/logout → src/auth/logout.ts
  All protected routes → src/auth/middleware.ts (validateSession)
"
```

### 4. `contractsSlice`

From `api_contracts.json`, extract ONLY the contracts referenced by the files in `task.files_modified`.

If the middleware validates JWTs: include the JWT contract definition. Do not include the entire contracts file.

### 5. `testsSlice`

From `test_map.json`, extract ONLY the test file entries for the source files being modified.

This tells the worker what test patterns are already established for this module.

### 6. `stateDigest`

A condensed summary of STATE.md. **Maximum 80 lines.**

Focus on:
- Current phase goal (1-2 sentences)
- Active prevention rules from SCARS.md (copy verbatim — these are constraints)
- Any relevant prior decisions from DECISION_LOG.md (only those that affect this task)
- Accumulated constraints noted in STATE.md

Do NOT include:
- Performance metrics
- Full phase history
- Roadmap details
- Session timestamps

### 7. `boundaries`

The DO NOT CHANGE list from PLAN.md. This is critical — workers must not touch files outside their scope.

```
boundaries: "
DO NOT CHANGE:
  - src/auth/login.ts (modified by T01)
  - src/api/routes.ts (will be modified by T03)
  - Any file not in task.files_modified

DO NOT CHANGE any authentication logic that is currently working.
DO NOT change the session token format — it is defined in api_contracts.json.
"
```

### 8. `tddMode`

From `task.tdd_mode`: `hard | standard | skip`. A simple string, not an object.

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

- [ ] Context packet built with exactly 8 components
- [ ] filesContent contains ONLY files in task.files_modified
- [ ] architectureSlice contains ONLY sections for modules owning modified files
- [ ] contractsSlice contains ONLY contracts referenced by modified files
- [ ] testsSlice contains test mappings for modified source files
- [ ] stateDigest is <= 80 lines and includes active prevention rules
- [ ] boundaries section from PLAN.md included verbatim
- [ ] tddMode string passed correctly
- [ ] No full repo context included
- [ ] No files outside task.files_modified in any slice
