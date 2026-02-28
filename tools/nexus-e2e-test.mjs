#!/usr/bin/env node
/**
 * nexus-e2e-test.mjs
 *
 * Fully automated end-to-end test of the Nexus V6 loop.
 *
 * What it does:
 *   1. Creates a fresh temp directory with a git repo
 *   2. Runs `nexus init` CLI to populate .nexus/
 *   3. Writes a toy project PRD (a simple CLI counter app)
 *   4. Launches `claude --print` with a single chained prompt that drives
 *      the FULL loop: /nexus:init → /nexus:plan → /nexus:execute → /nexus:verify → /nexus:unify
 *   5. Streams Claude's output live to the console
 *   6. Parses the output for pass/fail signals from STATE.md
 *   7. Prints a summary of what was created in .nexus/
 *
 * Usage:
 *   node tools/nexus-e2e-test.mjs
 *   node tools/nexus-e2e-test.mjs --keep    # don't delete the test dir on success
 *   node tools/nexus-e2e-test.mjs --dry     # set up the dir but don't run Claude
 *
 * Requirements:
 *   - `claude` CLI must be installed and authenticated
 *   - Nexus must be installed globally: node packages/nexus-cli/dist/index.js install --claude --global
 */

import { spawn, execSync } from 'child_process';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXUS_ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.join(NEXUS_ROOT, 'packages/nexus-cli/dist/index.js');

const KEEP = process.argv.includes('--keep');
const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

// ─── Colours ─────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  green: '\x1b[32m',
  red:   '\x1b[31m',
  cyan:  '\x1b[36m',
  yellow:'\x1b[33m',
  blue:  '\x1b[34m',
};

function log(msg)  { console.log(`${C.cyan}[nexus-e2e]${C.reset} ${msg}`); }
function ok(msg)   { console.log(`${C.green}[nexus-e2e] ✓${C.reset} ${msg}`); }
function warn(msg) { console.log(`${C.yellow}[nexus-e2e] ⚠${C.reset} ${msg}`); }
function fail(msg) { console.error(`${C.red}[nexus-e2e] ✗${C.reset} ${msg}`); }
function hr()      { console.log(`${C.dim}${'─'.repeat(72)}${C.reset}`); }

// ─── The toy project Claude will build ───────────────────────────────────────

// A deliberately tiny, self-contained project so Claude finishes quickly.
// A Node.js CLI counter that:
//   - `counter add <n>` → persists count to ~/.counter-state.json
//   - `counter get`     → prints current count
//   - `counter reset`   → resets to 0
// Intentionally has clear acceptance criteria that Claude can verify exist on disk.

const TOY_PROJECT_PRD = `# Counter CLI — Product Requirements

## Mission
Build a minimal Node.js CLI counter tool. It must be a working deliverable — not a stub.

## Acceptance Criteria (ALL must be true for phase to be complete)

### AC-1: CLI entry point exists
- File \`src/index.mjs\` exists
- File is executable (\`#!/usr/bin/env node\` shebang)
- Exports or calls a \`main()\` function

### AC-2: add command works
- \`node src/index.mjs add 5\` exits 0
- Output contains a number showing the new total
- State is persisted to a JSON file on disk (not in memory only)

### AC-3: get command works
- \`node src/index.mjs get\` exits 0
- Output shows a number (the current count)

### AC-4: reset command works
- \`node src/index.mjs reset\` exits 0
- After reset, \`node src/index.mjs get\` returns 0

### AC-5: Tests exist
- File \`test/counter.test.mjs\` exists
- Tests cover add, get, reset
- Tests can be run with \`node --test test/counter.test.mjs\` (Node built-in test runner, no extra deps)

### AC-6: package.json exists
- Has \`"name": "counter-cli"\`
- Has \`"type": "module"\`
- Has \`"scripts": { "test": "node --test test/counter.test.mjs" }\`

## Out of scope
- No TypeScript, no external dependencies (use Node built-ins only)
- No install to PATH, no publish to npm
- No config file format other than plain JSON
`;

const ROADMAP = `# Counter CLI — Roadmap

## Phase 1: Implementation
**Goal:** Build the complete counter CLI with tests.
**Status:** pending

Tasks:
- Create package.json
- Create src/index.mjs with add/get/reset commands
- Create test/counter.test.mjs

## Acceptance
All AC-1 through AC-6 from PRD.md must pass.
`;

// ─── Project CLAUDE.md written into the test dir ─────────────────────────────
//
// Claude Code --print mode auto-loads CLAUDE.md from cwd. We embed both the
// Nexus firmware rules AND the specific task so Claude starts executing
// immediately without needing to reference external files.

function buildProjectClaudeMd(projectDir) {
  const dir = projectDir.replace(/\\/g, '/');
  return `# NEXUS V6 — AUTOMATED E2E TEST

> This file is the standing context for this session.
> You are running the full Nexus governance loop on an automated test project.
> Execute every step autonomously. Do NOT ask for confirmation.
> Do NOT greet the user. Do NOT summarize what you are about to do. JUST DO IT.

## OPERATING RULES

1. **FILESYSTEM IS TRUTH** — Never assert a file exists without reading it. Never assert a test passes without running it. Verify everything physically.
2. **NO STUBS** — Write real, working code. No placeholders, no TODO comments, no empty functions.
3. **TEST-FIRST VERIFICATION** — Run every test command and read the actual stdout. A passing test must produce zero failures in actual output.
4. **COMPLETE ALL FOUR STEPS** — PLAN → EXECUTE → VERIFY → UNIFY. Skipping any step is a failure.
5. **AUTONOMOUS EXECUTION** — Do not ask questions. Do not pause for confirmation. Execute every action.

---

## YOUR TASK

The project is at: ${dir}
The \`.nexus/\` workspace is already initialized. PRD.md and ROADMAP.md are already written.

You must execute the complete **PLAN → EXECUTE → VERIFY → UNIFY** loop for Phase 1.

---

### STEP 1: PLAN

Read \`.nexus/00-mission/PRD.md\` to understand the requirements.

Create:
- Directory: \`.nexus/04-plans/phase-01/\`
- File: \`.nexus/04-plans/phase-01/PLAN.md\`

PLAN.md must contain:
\`\`\`
# Phase 1 Plan — Counter CLI

## Goal
Build a working Node.js CLI counter tool.

## Tasks
| ID | Task | Wave | Risk |
|----|------|------|------|
| T-01 | Create package.json | 1 | low |
| T-02 | Create src/index.mjs | 1 | low |
| T-03 | Create test/counter.test.mjs | 1 | low |
| T-04 | Run tests and verify | 2 | low |

## Acceptance
All AC-1 through AC-6 from PRD.md must be physically verified.
\`\`\`

Then update:
- \`.nexus/01-governance/STATE.md\` — set loop position to "PLAN ✓"
- \`.nexus/01-governance/ROADMAP.md\` — set Phase 1 status to "planned"

---

### STEP 2: EXECUTE

Write these three files. All must be real, working code:

**\`package.json\`** (at project root):
\`\`\`json
{
  "name": "counter-cli",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test test/counter.test.mjs"
  }
}
\`\`\`

**\`src/index.mjs\`**:
- Shebang: \`#!/usr/bin/env node\`
- Commands: \`add <n>\`, \`get\`, \`reset\`
- Persist state to \`~/.counter-state.json\` (use \`os.homedir()\`)
- \`add <n>\`: reads current count, adds n, writes back, prints "Count: <new_total>"
- \`get\`: reads count, prints "Count: <count>"
- \`reset\`: writes 0 to state file, prints "Count reset to 0"

**\`test/counter.test.mjs\`**:
- Use \`import { test } from 'node:test'\` and \`import assert from 'node:assert'\`
- Use \`import { execSync } from 'node:child_process'\`
- Test \`add 5\` returns exit 0 and stdout contains a number
- Test \`get\` returns exit 0 and stdout contains "Count:"
- Test \`reset\` then \`get\` returns "Count: 0"

After creating all files, run: \`node --test test/counter.test.mjs\`
If tests fail, fix the code and re-run until ALL tests pass (zero failures).

Then update:
- \`.nexus/01-governance/STATE.md\` — set loop position to "EXECUTE ✓"

---

### STEP 3: VERIFY

Physically verify every acceptance criterion by running these exact commands:

1. \`node --test test/counter.test.mjs\` — must exit 0, zero failures
2. \`node src/index.mjs add 5\` — must exit 0, output contains a number
3. \`node src/index.mjs get\` — must exit 0, output contains "Count:"
4. \`node src/index.mjs reset\` — must exit 0
5. \`node src/index.mjs get\` — output must contain "Count: 0"

For each command: run it via Bash, read the actual output, confirm it matches.

Then write \`.nexus/04-plans/phase-01/verification-report.md\`:
\`\`\`
# Verification Report — Phase 1

## Status: PASSED

## Checks
- [ ] Tests pass (node --test): PASSED — <paste actual output>
- [ ] add command: PASSED — <paste actual output>
- [ ] get command: PASSED — <paste actual output>
- [ ] reset command: PASSED — <paste actual output>
- [ ] get after reset returns 0: PASSED — <paste actual output>

## All AC-1 through AC-6: VERIFIED
\`\`\`

Update:
- \`.nexus/01-governance/STATE.md\` — set loop position to "VERIFY ✓"

---

### STEP 4: UNIFY

Write \`.nexus/04-plans/phase-01/SUMMARY.md\`:
\`\`\`
# Phase 1 Summary — Counter CLI

## Status: COMPLETE

## Delivered
- package.json: counter-cli, ESM module
- src/index.mjs: add/get/reset commands, JSON persistence
- test/counter.test.mjs: covers all 3 commands

## Verification
All acceptance criteria AC-1 through AC-6 verified.
\`\`\`

Update:
- \`.nexus/01-governance/ROADMAP.md\` — set Phase 1 status to "complete"
- \`.nexus/01-governance/STATE.md\` — set loop position to "UNIFY ✓, PHASE 1 COMPLETE"

Run: \`git add -A && git commit -m "Phase 1 complete — counter CLI"\`

---

## BEGIN NOW

Start with STEP 1. Do not greet. Do not explain. Execute.
`;
}

// ─── Short trigger prompt (all real instructions are in CLAUDE.md) ────────────

function buildMasterPrompt() {
  return `Execute the task described in CLAUDE.md. Start with STEP 1 (PLAN) immediately.`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runSync(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit', ...opts });
  } catch (err) {
    if (!opts.allowFail) throw err;
    return null;
  }
}

async function runClaude(prompt, projectDir) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format', 'text',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
      '--dangerously-skip-permissions',
      '--max-turns', '80',
      '-p', prompt,
    ];

    log(`Spawning: claude --print --output-format text --dangerously-skip-permissions --max-turns 80 ...`);
    hr();

    const proc = spawn('claude', args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    let fullOutput = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      fullOutput += text;
      // Stream output live — print every line as it arrives
      process.stdout.write(text);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      if (VERBOSE) process.stderr.write(`${C.dim}[stderr] ${text}${C.reset}`);
    });

    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`claude exited with code ${code}`));
      } else {
        resolve({ output: fullOutput, result: fullOutput.slice(-500) });
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}\nMake sure the claude CLI is installed and in PATH.`));
    });
  });
}

// ─── Assertions ──────────────────────────────────────────────────────────────

async function assertFileExists(filePath, label) {
  if (existsSync(filePath)) {
    ok(`${label} — ${path.basename(filePath)}`);
    return true;
  }
  fail(`${label} — NOT FOUND: ${filePath}`);
  return false;
}

async function assertFileContains(filePath, pattern, label) {
  if (!existsSync(filePath)) {
    fail(`${label} — file missing: ${filePath}`);
    return false;
  }
  const content = await readFile(filePath, 'utf-8');
  const matches = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (matches) {
    ok(`${label}`);
    return true;
  }
  fail(`${label} — pattern not found in ${path.basename(filePath)}: ${pattern}`);
  if (VERBOSE) console.log(`  Content preview: ${content.slice(0, 300)}`);
  return false;
}

function assertCommand(cmd, cwd, label) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', cwd, timeout: 30000, stdio: 'pipe' });
    ok(`${label} — exited 0`);
    if (VERBOSE) console.log(`  Output: ${out.slice(0, 200)}`);
    return { passed: true, output: out };
  } catch (err) {
    fail(`${label} — FAILED (exit ${err.status}): ${(err.stderr || err.message).slice(0, 200)}`);
    return { passed: false, output: '' };
  }
}

// ─── Summary tree ────────────────────────────────────────────────────────────

function printDirTree(dir, prefix = '', maxDepth = 3, depth = 0) {
  if (depth >= maxDepth || !existsSync(dir)) return;
  const entries = readdirSync(dir).sort();
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i];
    const fullPath = path.join(dir, name);
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└─' : '├─';
    const isDir = statSync(fullPath).isDirectory();
    console.log(`${C.dim}${prefix}${connector} ${isDir ? C.cyan : C.reset}${name}${C.reset}`);
    if (isDir) {
      printDirTree(fullPath, prefix + (isLast ? '   ' : '│  '), maxDepth, depth + 1);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   Nexus V6 — Automated E2E Test              ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════╝${C.reset}\n`);

  // ── 0. Pre-flight ──────────────────────────────────────────────────────────

  log('Pre-flight checks...');

  if (!existsSync(CLI_BIN)) {
    fail(`CLI not built. Run: cd ${NEXUS_ROOT} && pnpm build`);
    process.exit(1);
  }

  // Check claude CLI
  try {
    execSync('claude --version', { stdio: 'pipe', timeout: 5000 });
    ok('claude CLI found');
  } catch {
    fail('claude CLI not found in PATH. Install Claude Code first.');
    process.exit(1);
  }

  // Check Nexus is installed in ~/.claude
  const commandsDir = path.join(process.env['USERPROFILE'] || process.env['HOME'] || '', '.claude', 'commands', 'nexus');
  if (!existsSync(commandsDir)) {
    log('Nexus not installed in ~/.claude — installing now...');
    runSync(`node "${CLI_BIN}" install --claude --global`, { quiet: true });
  }
  ok('Nexus commands found in ~/.claude');

  // ── 1. Create test project dir ─────────────────────────────────────────────

  const testDir = path.join(tmpdir(), `nexus-e2e-${Date.now()}`);
  log(`Creating test project at: ${testDir}`);
  await mkdir(testDir, { recursive: true });

  // Git init (required for worktrees and checkpoints)
  runSync('git init', { cwd: testDir, quiet: true });
  runSync('git config user.email "nexus-test@example.com"', { cwd: testDir, quiet: true });
  runSync('git config user.name "Nexus E2E Test"', { cwd: testDir, quiet: true });
  ok('Git repo initialized');

  // ── 2. Run nexus init CLI ──────────────────────────────────────────────────

  log('Running nexus init...');
  runSync(`node "${CLI_BIN}" init --name "counter-cli" --description "Minimal CLI counter"`, {
    cwd: testDir,
    quiet: !VERBOSE,
  });

  const nexusDir = path.join(testDir, '.nexus');
  if (!existsSync(nexusDir)) {
    fail('.nexus/ was not created by nexus init');
    process.exit(1);
  }
  ok('.nexus/ workspace created');

  // ── 3. Write the toy project spec ─────────────────────────────────────────

  await writeFile(path.join(testDir, '.nexus/00-mission/PRD.md'), TOY_PROJECT_PRD, 'utf-8');
  await writeFile(path.join(testDir, '.nexus/01-governance/ROADMAP.md'), ROADMAP, 'utf-8');
  ok('PRD.md and ROADMAP.md written');

  hr();
  log('Test project structure:');
  printDirTree(nexusDir, '  ', 3);
  hr();

  // ── 4. Write CLAUDE.md into the test project dir ──────────────────────────
  //
  // Claude Code --print mode auto-loads CLAUDE.md from cwd.
  // We embed both the Nexus firmware rules AND the specific task so Claude
  // starts executing immediately without needing to reference external files.

  const claudeMdContent = buildProjectClaudeMd(testDir);
  await writeFile(path.join(testDir, 'CLAUDE.md'), claudeMdContent, 'utf-8');
  ok(`CLAUDE.md written to test project (${claudeMdContent.length} chars)`);

  // Short trigger prompt — all real instructions are in CLAUDE.md
  const prompt = buildMasterPrompt();
  log(`Master prompt: "${prompt}"`);

  if (DRY) {
    warn('--dry flag set — skipping Claude invocation');
    log(`Test dir preserved at: ${testDir}`);
    log(`To manually run the test: cd "${testDir}" && claude --print --dangerously-skip-permissions -p "${prompt}"`);
    log(`Or interactively:         cd "${testDir}" && claude`);
    process.exit(0);
  }

  // ── 5. Run Claude ──────────────────────────────────────────────────────────

  log('Launching Claude — this will take several minutes...');
  log('Watch for tool calls below:\n');

  const startTime = Date.now();
  let claudeError = null;

  try {
    await runClaude(prompt, testDir);
  } catch (err) {
    claudeError = err;
    fail(`Claude invocation error: ${err.message}`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  hr();
  log(`Claude finished in ${elapsed}s`);

  // ── 6. Assertions ──────────────────────────────────────────────────────────

  console.log(`\n${C.bold}Verifying results...${C.reset}\n`);

  let passed = 0;
  let failed = 0;

  async function check(result) {
    if (result === true || (result && result.passed)) passed++;
    else failed++;
  }

  // .nexus governance files
  await check(await assertFileExists(path.join(testDir, '.nexus/04-plans/phase-01/PLAN.md'), 'PLAN.md created'));
  await check(await assertFileContains(path.join(testDir, '.nexus/04-plans/phase-01/PLAN.md'), /wave/i, 'PLAN.md has wave assignments'));
  await check(await assertFileContains(path.join(testDir, '.nexus/01-governance/STATE.md'), /complete/i, 'STATE.md shows loop complete'));
  await check(await assertFileExists(path.join(testDir, '.nexus/04-plans/phase-01/SUMMARY.md'), 'SUMMARY.md written'));
  await check(await assertFileExists(path.join(testDir, '.nexus/04-plans/phase-01/verification-report.md'), 'Verification report written'));

  // Source files
  await check(await assertFileExists(path.join(testDir, 'package.json'), 'package.json created'));
  await check(await assertFileContains(path.join(testDir, 'package.json'), '"counter-cli"', 'package.json has correct name'));
  await check(await assertFileContains(path.join(testDir, 'package.json'), '"module"', 'package.json has type:module'));
  await check(await assertFileExists(path.join(testDir, 'src/index.mjs'), 'src/index.mjs created'));
  await check(await assertFileContains(path.join(testDir, 'src/index.mjs'), '#!/usr/bin/env node', 'index.mjs has shebang'));
  await check(await assertFileContains(path.join(testDir, 'src/index.mjs'), /add|get|reset/i, 'index.mjs has commands'));
  await check(await assertFileExists(path.join(testDir, 'test/counter.test.mjs'), 'test/counter.test.mjs created'));

  // Functional tests — run the actual CLI
  console.log('');
  log('Running functional checks...');
  const testResult = assertCommand('node --test test/counter.test.mjs', testDir, 'Tests pass');
  await check(testResult);
  const addResult = assertCommand('node src/index.mjs add 5', testDir, 'counter add 5 works');
  await check(addResult);
  await check(assertCommand('node src/index.mjs get', testDir, 'counter get works'));
  await check(assertCommand('node src/index.mjs reset', testDir, 'counter reset works'));

  // Git state
  try {
    const gitLog = execSync('git log --oneline', { cwd: testDir, encoding: 'utf8', stdio: 'pipe' });
    if (gitLog.includes('Phase 1') || gitLog.trim().length > 0) {
      ok('Git commit exists');
      passed++;
    } else {
      warn('No git commits found (non-fatal)');
    }
  } catch {
    warn('Could not read git log (non-fatal)');
  }

  // ── 7. Summary ─────────────────────────────────────────────────────────────

  hr();
  console.log(`\n${C.bold}Final project tree:${C.reset}`);
  console.log(`${C.dim}${testDir}${C.reset}`);
  printDirTree(testDir, '  ', 4);

  hr();
  console.log(`\n${C.bold}Results: ${passed} passed, ${failed} failed${C.reset}`);

  if (failed === 0 && !claudeError) {
    console.log(`\n${C.bold}${C.green}✓ E2E TEST PASSED${C.reset} — Full PLAN→EXECUTE→VERIFY→UNIFY loop complete.\n`);
  } else {
    console.log(`\n${C.bold}${C.red}✗ E2E TEST FAILED${C.reset} — ${failed} assertion(s) failed.\n`);
    if (claudeError) {
      console.log(`  Claude error: ${claudeError.message}\n`);
    }
  }

  // Keep or clean up
  if (KEEP || failed > 0) {
    log(`Test directory preserved at: ${testDir}`);
    log(`Inspect with: cd "${testDir}"`);
    if (existsSync(path.join(testDir, '.nexus/01-governance/STATE.md'))) {
      const state = await readFile(path.join(testDir, '.nexus/01-governance/STATE.md'), 'utf-8');
      console.log(`\n${C.bold}STATE.md:${C.reset}\n${C.dim}${state.slice(0, 800)}${C.reset}`);
    }
  } else {
    log('Cleaning up test directory...');
    await rm(testDir, { recursive: true, force: true });
  }

  process.exit(failed > 0 || claudeError ? 1 : 0);
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
