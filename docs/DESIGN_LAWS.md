# Nexus V6 — The 5 Immutable Design Laws

> These laws are not guidelines. They are invariants enforced in code.
> Violating them will cause the governance loop to halt.

---

## Overview

Nexus V6 is built on five immutable design laws that govern how all agents — human or AI — interact
with a Nexus-managed project. These laws were derived from observed failure modes in unconstrained AI
coding workflows: hallucinated file writes, silent architectural drift, irreversible destructive
operations, premature merges, and context bloat leading to incoherent output.

Every law addresses a specific class of failure. Together they form a complete safety envelope for
agentic software development.

The laws are embedded in:
- `CLAUDE.md` at the root of every Nexus-managed project (agent instructions)
- `packages/nexus-validator/src/` (enforcement in code)
- `packages/nexus-runtime/src/` (enforcement in execution)
- This document (rationale and deep-dive)

---

## Law 1: FILESYSTEM IS TRUTH

### Statement

> Verify what is on disk. Never trust what an agent says it wrote.

### Rationale

AI coding agents frequently report success when they have not actually written files. This happens due
to context window limitations, early termination, or internal state inconsistencies. An agent that
says "I created src/auth/login.ts" may have only planned to create it, or may have written it to a
different path, or may have written an empty file.

The only reliable source of truth is the filesystem. Nexus enforces this by reading every file
mentioned in a task's `files_to_touch` list after every execution and comparing:

1. **Existence** — the file must exist at the exact path specified
2. **Non-emptiness** — the file must have content (size > 0 bytes)
3. **Hash match** — the SHA256 hash of the file must differ from the pre-task hash (i.e., the file
   was actually modified, not just touched)
4. **Content semantics** — for TypeScript files, a basic parse check ensures the file is valid source
   code and not a placeholder comment

### Implementation

The `PhysicalityChecker` in `packages/nexus-validator/src/physicality.ts` implements this law.
It is called as the first step in the VERIFY phase. If any file fails the physicality check, the
entire verify run halts immediately with a PHYSICALITY_FAILURE result.

```
PHYSICALITY CHECK FLOW:
  for each file in task.files_to_touch:
    1. stat(file)           -> must not throw ENOENT
    2. stat.size > 0        -> must be true
    3. sha256(file)         -> must != pre_task_hash[file]
    4. parse(file)          -> must produce valid AST (TS/JS only)

  if any check fails:
    -> write gap to .nexus/05-context/gaps/
    -> set task status = BLOCKED
    -> emit NEXUS_BLOCKED
    -> halt
```

### Common Violations

- **Stub files**: Agent writes `// TODO: implement` as the entire file content. Detected by
  content semantics check.
- **Wrong path**: Agent creates `src/Auth/login.ts` instead of `src/auth/login.ts`. Detected by
  existence check (case-sensitive on Linux/Mac).
- **Unchanged file**: Agent touches a file but makes no meaningful changes. Detected by hash check.
- **Directory instead of file**: Agent creates a directory where a file was expected. Detected by
  existence check (stat returns directory entry).

### What To Do When This Law Is Violated

1. Check `.nexus/05-context/gaps/` for the gap report
2. Look at the actual path — is there a case mismatch or typo?
3. Check the file contents — is it a stub?
4. Re-run the failed task with the gap report as additional context
5. The rollback manager will have preserved the pre-task state

---

## Law 2: ARCHITECTURE IS FIRST-CLASS

### Statement

> Module boundaries are mandatory state. Every cross-boundary import must be declared in
> .nexus/02-architecture/dependencies.json.

### Rationale

As codebases grow, the most expensive problem is architectural drift: code that starts with clean
module boundaries gradually accumulates cross-cutting dependencies until the architecture is a ball
of mud. Traditional linters catch syntax errors; they do not catch architectural erosion.

Nexus treats the module dependency graph as a first-class artifact that must be explicitly maintained.
When a task requires importing from another module, that dependency must be declared in the
architecture files before the import is written. The dependency analyzer runs after every execution
and compares the declared dependency graph against the actual import graph. Any undeclared
cross-module import is a violation.

### What Counts as a Module Boundary

A module boundary is defined in `.nexus/02-architecture/modules.json`. Each module entry specifies:
- `id` — unique identifier (e.g., "auth", "payments", "notifications")
- `rootPath` — directory path that contains the module
- `exports` — the public interface (files that other modules may import)
- `allowedImporters` — which other modules may import from this module
- `owner` — team or agent responsible for this module

Any import from `rootPath` of module A into `rootPath` of module B that is not listed in
`allowedImporters` is a boundary violation.

### Implementation

The `DependencyAnalyzer` in `packages/nexus-graph/src/dependency-analyzer.ts` builds the actual
import graph by parsing TypeScript source files. It is called during the build-architecture step and
again during VERIFY.

The `ContractChecker` in `packages/nexus-validator/src/contract-check.ts` compares the actual graph
against the declared graph and reports violations.

```
ARCHITECTURE CHECK FLOW:
  1. Parse all .ts files for import statements
  2. Resolve each import to its owning module
  3. For each cross-module import (A -> B):
     a. Is A listed in B.allowedImporters? -> PASS
     b. Otherwise -> VIOLATION
  4. Report all violations as architecture gaps
  5. If any violations -> VERIFY fails
```

### Special Case: Cycle Detection

The dependency analyzer also detects circular imports between modules. Cycles are always
violations, even if both modules list each other in `allowedImporters`. Circular module dependencies
prevent independent deployment and make refactoring exponentially harder.

When a cycle is detected:
- The cycle path is printed: `auth -> user -> auth`
- All tasks that introduced the cycle are quarantined
- A re-plan is required that introduces an intermediary module or shared interface

### What To Do When This Law Is Violated

1. Examine the violation: which two modules are crossing boundaries?
2. Decide: is this a real architectural relationship or a mistake?
3. If real: update `.nexus/02-architecture/modules.json` to declare the dependency
4. If mistake: refactor the code to remove the cross-boundary import
5. Re-run `nexus build-architecture` to refresh the dependency graph

---

## Law 3: EVERY ACTION IS REVERSIBLE OR MUST BE APPROVED

### Statement

> Before any operation that modifies state, create a checkpoint. For operations that cannot be
> reversed, require explicit human approval.

### Rationale

Agents make mistakes. Even well-constrained agents operating with narrow context packets occasionally
misunderstand a task or introduce a regression. The difference between a recoverable mistake and a
catastrophic one is whether a checkpoint exists.

Nexus creates a git-tagged checkpoint before every task execution. The checkpoint includes:
- A git commit of the current state
- A snapshot of `.nexus/` at that point in time
- A record of which task is about to run

If anything goes wrong, `nexus rollback <checkpoint-id>` restores both the source code and the
`.nexus/` workspace to their exact pre-task state.

For operations that cannot be reversed — such as external API calls, database schema drops,
infrastructure provisioning, or publishing packages — Nexus emits NEXUS_APPROVAL_REQUIRED and halts.
A human must explicitly approve the operation before Nexus proceeds.

### Checkpoint Format

Checkpoints are stored in `.nexus/06-checkpoints/refs/` as JSON files:

```json
{
  "id": "ckpt-20260228-142301-a3f9",
  "taskId": "task-0042",
  "gitRef": "refs/nexus/checkpoints/ckpt-20260228-142301-a3f9",
  "snapshotPath": ".nexus/06-checkpoints/snapshots/snapshot-20260228-142301.tar.gz",
  "createdAt": "2026-02-28T14:23:01Z",
  "author": "nexus-runtime"
}
```

### Forbidden Operations

The list of forbidden operations (requiring human approval) is stored in
`.nexus/01-constraints/forbidden_ops.json`. Default entries:

- `DROP TABLE` / `DROP DATABASE` — destructive database operations
- `git push --force` — force push to remote branches
- `npm publish` / `pnpm publish` — package publishing
- External HTTP calls with write methods (POST, PUT, DELETE, PATCH) to production URLs
- `rm -rf` on paths outside the project directory
- Any operation on files outside the project root

### What To Do When a Forbidden Operation Is Required

1. Nexus will halt with NEXUS_APPROVAL_REQUIRED
2. The gap report will describe exactly what operation needs approval
3. A human reviews the operation and confirms it is intended
4. The human runs `nexus approve <approval-id>` to proceed
5. The operation is logged with the approver's identity and timestamp

---

## Law 4: VERIFY BEFORE MERGE

### Statement

> The full verification ladder must pass completely before any code is merged to the main branch.
> There is no bypass.

### Rationale

The most common failure mode in AI-assisted development is merging code that "looks right" without
running tests. Agents are optimistic: they produce code that appears correct based on their training
data, but may have subtle logic errors, missing edge case handling, or integration problems that only
surface when the full test suite runs.

Nexus enforces a mandatory verification ladder that must pass in its entirety before the unify command
will execute. The ladder runs checks in order of increasing cost, stopping at the first failure:

```
VERIFICATION LADDER (in order):
  1. Physicality        (< 1 second)   -- files exist and are non-empty
  2. Goal-backward      (< 5 seconds)  -- acceptance criteria are met
  3. Contract check     (< 5 seconds)  -- API contracts not regressed
  4. Architecture check (< 10 seconds) -- no undeclared module boundaries crossed
  5. Type check         (< 60 seconds) -- tsc --noEmit passes
  6. Lint               (< 30 seconds) -- eslint passes
  7. Unit tests         (varies)       -- vitest run passes
  8. Playwright         (varies)       -- if playwright_required: true
```

The unify command reads `.nexus/05-context/verify-result.json` and will refuse to proceed if:
- The file does not exist (verify has not been run in this session)
- The `status` field is not `PASS`
- The `sessionId` does not match the current session

This prevents a common workaround: running verify, getting a failure, manually editing the result
file, and then running unify. The session ID changes every time a new Nexus session starts.

### The Goal-Backward Check

The goal-backward check deserves special attention. It is not a test runner — it is a semantic
validator that reads the acceptance criteria from `.nexus/00-mission/ACCEPTANCE_MASTER.md` and
checks whether the code satisfies them.

The checker looks for:
1. **Must-have criteria** — criteria marked with `[MUST]` in the acceptance file. Every such
   criterion must be addressed by at least one non-stub function in the codebase.
2. **Stub detection** — functions that contain only `throw new Error("not implemented")`,
   `// TODO`, `return null`, or empty bodies are flagged as stubs and do not count as implementations.
3. **Coverage mapping** — the task's `acceptance_criteria` list is compared against the must-have
   list to ensure no criterion was silently dropped.

### What To Do When This Law Is Violated

If unify refuses because verify has not passed:
1. Run `nexus verify` to see the full ladder output
2. Address each failure in the gap report
3. Re-run `nexus verify` until all checks pass
4. Only then run `nexus unify`

Never manually edit verify result files. The session ID mechanism will catch this.

---

## Law 5: NARROW CONTEXT OVER GIANT CONTEXT

### Statement

> Each worker agent receives only the context it needs for its specific task. Monolithic context
> dumps are forbidden.

### Rationale

Large language models degrade in performance as context grows. The larger the context window, the
more likely the model is to:
- Focus on irrelevant information and produce off-topic changes
- Miss specific instructions buried in thousands of lines of context
- Hallucinate file contents based on pattern-matching rather than actual file reads
- Produce inconsistent output due to attention diffusion

Nexus addresses this by constructing **context packets** — highly targeted bundles of information
assembled specifically for each task. A context packet contains only:

1. The task description and acceptance criteria
2. The source files listed in `files_to_touch`
3. The interfaces (types and function signatures) of modules the task imports from
4. The relevant section of the acceptance master file
5. The architectural rules for the modules being modified
6. The specific gap report if this is a re-execution after a verify failure

Context packets are stored in `.nexus/05-context/packets/` as JSON files. Each worker agent reads
its packet before starting work.

### Context Packet Structure

```json
{
  "packetId": "ctx-task-0042-wave-2",
  "taskId": "task-0042",
  "task": {
    "title": "Implement JWT validation middleware",
    "description": "...",
    "files_to_touch": ["src/auth/jwt.ts", "src/middleware/auth.ts"],
    "acceptance_criteria": ["AC-07", "AC-08"]
  },
  "sourceFiles": {
    "src/auth/jwt.ts": "... current file content ...",
    "src/middleware/auth.ts": "... current file content ..."
  },
  "interfaces": {
    "src/types/user.ts": "export interface User { id: string; role: Role; }"
  },
  "acceptanceCriteria": [
    { "id": "AC-07", "text": "Given a valid JWT, when the middleware runs, then the request proceeds" },
    { "id": "AC-08", "text": "Given an expired JWT, when the middleware runs, then 401 is returned" }
  ],
  "architectureRules": {
    "auth": { "allowedImporters": ["api", "gateway"], "forbiddenImports": ["payments"] }
  },
  "gapReport": null
}
```

### Maximum Context Packet Size

The context packet builder enforces a maximum size of 100KB per packet. If a task's context would
exceed this limit:

1. The task is split into smaller sub-tasks
2. Each sub-task receives its own context packet
3. The sub-tasks are added to the next wave with dependencies on each other

This automatic splitting ensures that no worker ever receives a context dump that would degrade its
performance.

### What To Do When a Context Packet Is Too Large

If `build-index` or the planner reports that a context packet exceeds 100KB:

1. Run `nexus doctor` — it will identify which files are contributing the most to packet size
2. Consider whether the task can be split:
   - Can the interface and implementation be separate tasks?
   - Can the task be decomposed by feature rather than by file?
3. If a single file genuinely exceeds the limit, consider whether the file itself violates the
   Single Responsibility Principle and should be split

---

## Summary Table

| Law | What It Prevents | Enforced By | Bypass? |
|-----|-----------------|-------------|---------|
| 1. Filesystem Is Truth | Hallucinated writes, stub files | PhysicalityChecker in VERIFY | None |
| 2. Architecture Is First-Class | Boundary creep, cycles | DependencyAnalyzer in VERIFY | Update modules.json |
| 3. Every Action Reversible | Irreversible disasters | RollbackManager in EXECUTE | Human approval |
| 4. Verify Before Merge | Broken main branch | Unify reads verify result | None |
| 5. Narrow Context | Context bloat, hallucination | ContextPacketBuilder in PLAN | None |

---

## Enforcement Matrix

The following table shows at which phase each law is enforced:

```
                 | PLAN | EXECUTE | VERIFY | UNIFY
-----------------+------+---------+--------+-------
Law 1: FS Truth  |      |         |   X    |
Law 2: Arch      |  X   |         |   X    |
Law 3: Reversible|      |   X     |        |
Law 4: Verify    |      |         |        |  X
Law 5: Narrow Ctx|  X   |         |        |
```

Laws 1 and 2 are checked during VERIFY, but Law 2 is also enforced proactively during PLAN by
refusing to create tasks that obviously cross module boundaries based on the declared architecture.

Law 5 is enforced during PLAN when context packets are assembled. It may also trigger task splitting
which reshapes the wave structure.

---

## Amending the Laws

The laws themselves can only be changed by modifying the Nexus framework source code. They cannot be
overridden by project-level configuration, CLAUDE.md instructions, or agent directives.

If you believe a law needs an exception for a specific project, the correct path is:
1. Open an issue in the nexus-v6 repository describing the use case
2. The Nexus team will evaluate whether the law needs a refinement
3. If approved, the law is refined in source and a new framework version is released

There is no per-project override mechanism. This is intentional.
