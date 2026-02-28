---
name: map-codebase
description: Analyze the codebase and populate .nexus/02-architecture/ and .nexus/03-index/ with structured knowledge
argument-hint: "[focus: tech|arch|quality|concerns|all]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# nexus:map-codebase

## RULE 0

This command is self-contained — the full workflow is defined in the steps below. Read this entire file before executing. Do not execute from memory or inference.

---

## Purpose

Analyze the codebase and populate the Nexus architecture and index files. Run this when starting a project on an existing codebase, after major architecture changes, or when planning accuracy has degraded because the index is stale.

The outputs of this command are consumed by the planner agent when building context packets. Accurate architecture files mean accurate plans. Stale files mean workers operating on wrong assumptions.

---

## Step 1 — Determine Focus

If `$ARGUMENTS` provided, it should be one of: `tech`, `arch`, `quality`, `concerns`, or `all`.

If not provided or `all`: run all four analysis passes.

| Focus | Analysis | Output Files |
|-------|----------|-------------|
| `tech` | Technology stack, dependencies, external integrations | ARCHITECTURE.md (stack section), `modules.json` |
| `arch` | Module boundaries, data flow, entry points | ARCHITECTURE.md (full), `modules.json`, `dependencies.json`, `services.json` |
| `quality` | Code conventions, testing patterns, coverage gaps | `test_map.json` |
| `concerns` | Technical debt, fragile areas, security considerations | SCARS.md (concerns section) |
| `all` | All four passes | All of the above |

---

## Step 2 — Announce and Begin

```
════════════════════════════════════════
  MAPPING CODEBASE
════════════════════════════════════════

Focus: {focus}
Starting {N} analysis pass(es)...

Pass 1: Technology Stack
Pass 2: Architecture & Module Boundaries
Pass 3: Code Quality & Testing
Pass 4: Concerns & Technical Debt
════════════════════════════════════════
```

---

## Step 3 — Dispatch Architect Agent

Dispatch the architect agent for each focus area. The architect performs the actual analysis.

For each focus in the selected set, dispatch with:
- Focus area identifier
- Output paths for `.nexus/02-architecture/` and `.nexus/03-index/`
- The current `.nexus/01-governance/settings.json` (for project tech stack hints)

The architect agent writes directly to the output files. This command monitors and reports results.

---

## Step 4 — Tech Pass

The architect's tech pass will:

1. Read `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod` / `pyproject.toml`
2. Identify: runtime, package manager, frameworks, key dependencies
3. List external integrations (APIs, databases, auth providers)
4. Check for config files: `tsconfig.json`, `.nvmrc`, linting configs
5. **Never read `.env` files or credential files** — note their existence only

Output:
- Update the "Overview" and "Module Map" sections of `ARCHITECTURE.md`
- Populate `services.json` with detected services

---

## Step 5 — Architecture Pass

The architect's arch pass will:

1. Map directory structure to module boundaries
2. Identify entry points (server.ts, index.ts, app.tsx, main.py, etc.)
3. Trace import patterns to understand layering
4. Identify API contracts (REST endpoints, GraphQL schema, RPC services)
5. Map data flow: client → API → service → database

Output:
- Complete `ARCHITECTURE.md` with module map, data flow, API boundaries
- Populate `modules.json` with boundary definitions
- Populate `dependencies.json` with inter-module edges
- Populate `api_contracts.json` with detected contracts
- Populate `data_models.json` if ORM or schema files are found

---

## Step 6 — Quality Pass

The architect's quality pass will:

1. Read test configuration files
2. Map test files to source files (for `test_map.json`)
3. Identify untested modules
4. Check for linting and formatting configs
5. Sample source files for convention patterns

Output:
- Populate `test_map.json` with source → test mappings
- Add a "Testing" section to ARCHITECTURE.md (if it doesn't exist)

---

## Step 7 — Concerns Pass

The architect's concerns pass will:

1. Scan for TODO/FIXME/HACK/XXX comments
2. Identify large files (> 500 lines) as complexity hotspots
3. Check for security footguns (hardcoded secrets patterns, unvalidated inputs)
4. Look for N+1 patterns
5. Identify circular dependencies

Output:
- Add findings to a "Concerns" section in ARCHITECTURE.md
- If concerns are severe enough to be scars, add them to SCARS.md

---

## Step 8 — Update Timestamps

After all passes complete, update the `lastAnalyzed` timestamps in all JSON files:

```json
{ "lastAnalyzed": "{ISO timestamp}" }
```

Update STATE.md to note when the codebase was last mapped:
```
Architecture last mapped: {ISO timestamp}
Architecture rebuild needed: false
```

---

## Step 9 — Display Summary

```
════════════════════════════════════════
  CODEBASE MAPPED
════════════════════════════════════════

Analysis complete. {N} passes run.

Discoveries:

Tech Stack:
  Runtime: {runtime + version}
  Framework: {framework + version}
  Key dependencies: {N} identified
  External services: {N} found

Architecture:
  Modules identified: {N}
  API contracts: {N}
  Data models: {N}
  Dependency edges: {N}
  Circular dependencies: {0 | N — WARNING if > 0}

Quality:
  Test coverage: {test files} test files mapping {source files} source files
  Untested modules: {N}

Concerns:
  TODO/FIXME comments: {N}
  Large files (>500 lines): {N}
  Security flags: {N}

Files written:
  .nexus/02-architecture/ARCHITECTURE.md
  .nexus/02-architecture/modules.json
  .nexus/02-architecture/dependencies.json
  .nexus/02-architecture/services.json
  .nexus/02-architecture/api_contracts.json
  .nexus/02-architecture/data_models.json
  .nexus/03-index/test_map.json
  .nexus/03-index/files.json
  .nexus/03-index/symbols.json

════════════════════════════════════════
  NEXT ACTION: Run /nexus:plan to start planning
════════════════════════════════════════
```

---

## Error Handling

**No source files found:** "No source files detected. Make sure you're running this from the project root."

**Cannot read package.json (not found):** Note in ARCHITECTURE.md that the package manifest was not found. Continue with other analysis.

**Architect agent times out on large codebase:** Run passes one at a time rather than all-at-once. Report which passes succeeded.

---

## Success Criteria

- [ ] Tech, arch, quality, and concerns passes all run (or selected subset)
- [ ] ARCHITECTURE.md updated with stack, module map, data flow
- [ ] modules.json populated with boundary definitions
- [ ] dependencies.json populated with inter-module edges
- [ ] api_contracts.json populated with detected contracts
- [ ] test_map.json populated with source → test mappings
- [ ] files.json populated with analyzed file metadata
- [ ] All JSON lastAnalyzed timestamps updated
- [ ] STATE.md updated: architecture rebuild needed = false
- [ ] Summary displayed
- [ ] Output: single next action
