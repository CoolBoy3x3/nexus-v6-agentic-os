# Nexus V6 — Release Checklist

> Use this checklist for every Nexus release. All items must be checked before publishing.

---

## Pre-Release Checklist

### Build Verification

- [ ] `pnpm build` passes with zero errors
  ```bash
  pnpm build
  echo "Exit code: $?"
  ```

- [ ] `pnpm test` passes — all unit and integration tests green
  ```bash
  pnpm test
  echo "Exit code: $?"
  ```

- [ ] `pnpm lint` passes with zero errors (warnings are acceptable if pre-existing)
  ```bash
  pnpm lint
  ```

- [ ] `pnpm typecheck` passes — no TypeScript errors
  ```bash
  pnpm typecheck
  ```

- [ ] `nexus doctor` returns green on the framework repo itself
  ```bash
  nexus doctor
  # Expected: 0 errors
  ```

- [ ] No `console.log` debug statements left in production code paths
  ```bash
  grep -r "console\.log" packages/*/src/ --include="*.ts" | grep -v "\.test\." | grep -v "// debug"
  # Expected: empty output
  ```

- [ ] All package `package.json` files have correct `version` fields matching the release version

---

### Schema Validation

Nexus ships 8 JSON schemas that must all be valid before release:

- [ ] `packages/nexus-core/schemas/task.schema.json` — valid JSON Schema, passes ajv validation
- [ ] `packages/nexus-core/schemas/wave.schema.json` — valid JSON Schema
- [ ] `packages/nexus-core/schemas/modules.schema.json` — valid JSON Schema
- [ ] `packages/nexus-core/schemas/dependencies.schema.json` — valid JSON Schema
- [ ] `packages/nexus-core/schemas/api-contracts.schema.json` — valid JSON Schema
- [ ] `packages/nexus-core/schemas/migration-map.schema.json` — valid JSON Schema
- [ ] `packages/nexus-core/schemas/flow-spec.schema.json` — valid JSON Schema
- [ ] `packages/nexus-core/schemas/context-packet.schema.json` — valid JSON Schema

Run schema validation:
```bash
nexus validate-schemas --all
# Expected: 8/8 schemas valid
```

---

## Install Smoke Test

Run this test in a clean temp directory with no existing Nexus state.

### Step 1: Install Globally

```bash
# Use a temporary npm prefix to avoid polluting global
mkdir /tmp/nexus-smoke-test
cd /tmp/nexus-smoke-test

npm install -g nexus-cli@<VERSION>
nexus --version
# Expected: <VERSION>
```

### Step 2: Install All Runtimes

```bash
nexus install --all --global
# Expected: Successfully installed 4 runtime integrations
```

### Step 3: Doctor After Install

```bash
nexus doctor --global
# Expected: No errors
# Acceptable: Warnings about runtimes not being installed (claude, codex, etc.)
```

- [ ] `nexus install --all --global` completes without errors
- [ ] `nexus doctor --global` returns 0 errors
- [ ] Claude Code commands are present in `~/.claude/commands/` (if claude is installed)
- [ ] `nexus --version` outputs the correct version

---

## Toy Project Walkthrough

Run this full walkthrough in a clean directory to verify the governance loop end-to-end.

### Setup

```bash
mkdir /tmp/nexus-toy-project
cd /tmp/nexus-toy-project
git init
pnpm init -y
```

### Step 1: Init

```bash
nexus init
# Expected: .nexus/ directory created with template files

nexus doctor
# Expected: Warnings about empty mission files, 0 errors
```

- [ ] `.nexus/` directory was created
- [ ] All 9 numbered subdirectories present (`00-mission/` through `08-playwright/`)
- [ ] Template files populated with placeholder content
- [ ] `nexus doctor` returns 0 errors (warnings about empty mission files are ok)

### Step 2: Plan

Populate the mission files with a trivial project:

```bash
# Write a minimal PRD
cat > .nexus/00-mission/PRD.md << 'EOF'
# Toy Project PRD
Create a hello-world TypeScript function in src/hello.ts that exports a function
greet(name: string): string returning "Hello, {name}!".
EOF

# Write minimal acceptance criteria
cat > .nexus/00-mission/ACCEPTANCE_MASTER.md << 'EOF'
# Acceptance Criteria
[MUST] AC-01: Given a name string, when greet() is called, then it returns "Hello, {name}!"
[MUST] AC-02: The greet function is exported from src/hello.ts
EOF

# Write minimal roadmap
cat > .nexus/00-mission/ROADMAP.md << 'EOF'
phase_1:
  goal: Create the hello world function
  tasks:
    - Create src/hello.ts with greet function
    - Create tests/hello.test.ts with unit tests
  risk_tier: low
  tdd_mode: true
  playwright_required: false
EOF

nexus plan --phase phase_1
# Expected: Tasks generated in .nexus/04-tasks/backlog/
```

- [ ] `nexus plan` completes without errors
- [ ] At least 1 task file present in `.nexus/04-tasks/backlog/`
- [ ] Task files have valid YAML frontmatter (id, title, wave, files_to_touch)

### Step 3: Execute

```bash
nexus execute --wave 1
# Expected: Tasks executed, files created
```

- [ ] `nexus execute` completes without errors
- [ ] `src/hello.ts` exists with non-zero content
- [ ] Tasks moved to `.nexus/04-tasks/done/`
- [ ] Checkpoint created in `.nexus/06-checkpoints/`

### Step 4: Verify

```bash
nexus verify
# Expected: All checks pass
```

- [ ] Physicality check: PASS
- [ ] Goal-backward check: PASS
- [ ] Type check: PASS
- [ ] Tests: PASS
- [ ] Overall: VERIFY PASS

### Step 5: Unify

```bash
nexus unify
# Expected: Merged to main, changelog entry added
```

- [ ] `nexus unify` completes without errors
- [ ] Git commit created with nexus commit format
- [ ] `CHANGELOG.md` updated (or created)

---

## Version Bump Procedure

### Determine the New Version

Nexus follows semantic versioning. Determine the version bump type:

- **Patch** (e.g., 6.0.0 -> 6.0.1): Bug fixes, no new features, no breaking changes
- **Minor** (e.g., 6.0.0 -> 6.1.0): New features, no breaking changes
- **Major** (e.g., 6.0.0 -> 7.0.0): Breaking changes (schema changes, CLI flag changes, API removals)

### Bump Version

```bash
# From the nexus-v6 repo root
pnpm version patch   # or minor or major
# This runs the version script which updates all package.json files atomically
```

- [ ] All `packages/*/package.json` files have the new version
- [ ] Root `package.json` has the new version
- [ ] `packages/nexus-core/src/version.ts` has the new version string
- [ ] Version bump committed to git with message `chore: bump version to X.Y.Z`

### Tag the Release

```bash
git tag v<VERSION>
git push origin v<VERSION>
```

- [ ] Git tag created and pushed
- [ ] CI pipeline triggered for the tag

---

## Changelog Entry Requirements

Every release must have a changelog entry in `CHANGELOG.md` at the root of the repo.

### Required Sections

Each entry must have:

- [ ] **Version header** with date: `## [X.Y.Z] — YYYY-MM-DD`
- [ ] **Breaking Changes** section (if any): list every breaking change with migration instructions
- [ ] **New Features** section (if any): list new capabilities
- [ ] **Bug Fixes** section (if any): list bugs fixed with issue/PR references
- [ ] **Internal Changes** section (if any): refactors, dependency updates, etc.

### Entry Format

```markdown
## [6.1.0] — 2026-02-28

### Breaking Changes
None.

### New Features
- `nexus-validator`: Added Playwright 3-consecutive-pass promotion rule (#142)
- `nexus-cli`: Added `nexus reset-flow-passes` command (#143)
- `docs/`: Added PLAYWRIGHT_MCP.md guide

### Bug Fixes
- `nexus-runtime`: Fixed race condition in wave scheduler when 2+ tasks finish simultaneously (#139)
- `nexus-cli`: Fixed `nexus doctor` false positive for missing hashes.json (#140)

### Internal Changes
- Updated `@playwright/mcp-server` to 1.2.0
- Updated `vitest` to 3.0.0
```

- [ ] Changelog entry written and follows the required format
- [ ] All referenced issue/PR numbers are accurate and link to merged PRs
- [ ] Breaking changes have migration guides (link to migration doc if long)
- [ ] Date is correct (today's date for the release)

---

## Post-Release Verification

After publishing to npm:

- [ ] `npm install -g nexus-cli@<VERSION>` installs the correct version
- [ ] `nexus --version` outputs `<VERSION>`
- [ ] GitHub release created with changelog entry as body
- [ ] Internal team notified via standard communication channel
- [ ] Documentation site updated (if separate from this repo)
