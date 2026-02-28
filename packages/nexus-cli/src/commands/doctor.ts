import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { logger } from '../lib/logger.js';

type CheckStatus = 'pass' | 'fail' | 'warn';

interface CheckResult {
  label: string;
  status: CheckStatus;
  detail?: string;
}

function checkNodeVersion(): CheckResult {
  const major = parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (major >= 20) {
    return { label: 'Node.js version', status: 'pass', detail: `v${process.versions.node}` };
  }
  return {
    label: 'Node.js version',
    status: 'fail',
    detail: `v${process.versions.node} (requires >= 20)`,
  };
}

function checkCommand(cmd: string, label: string): CheckResult {
  try {
    const out = execSync(`${cmd} --version 2>&1`, { encoding: 'utf8', timeout: 5000 }).trim();
    const r: CheckResult = { label, status: 'pass' };
    r.detail = out.split('\n')[0] ?? '';
    return r;
  } catch {
    return { label, status: 'fail', detail: 'not found in PATH' };
  }
}

function checkPnpm(): CheckResult {
  return checkCommand('pnpm', 'pnpm');
}

function checkGit(): CheckResult {
  return checkCommand('git', 'git');
}

function checkGitWorktree(): CheckResult {
  try {
    execSync('git worktree list', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
    return { label: 'git worktree support', status: 'pass' };
  } catch {
    return { label: 'git worktree support', status: 'fail', detail: 'git worktree list failed' };
  }
}

function checkRuntimeDirs(): CheckResult[] {
  const results: CheckResult[] = [];

  const dirs: Array<{ label: string; path: string }> = [
    { label: '.claude/ writable', path: path.join(homedir(), '.claude') },
    { label: '.gemini/ writable', path: path.join(homedir(), '.gemini') },
    { label: '.codex/ writable', path: path.join(homedir(), '.codex') },
    { label: '.opencode/ writable', path: path.join(homedir(), '.opencode') },
  ];

  for (const { label, path: dirPath } of dirs) {
    if (!fs.existsSync(dirPath)) {
      results.push({ label, status: 'warn', detail: 'directory not found (runtime not installed)' });
      continue;
    }
    try {
      const testFile = path.join(dirPath, '.nexus-doctor-test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);
      results.push({ label, status: 'pass', detail: dirPath });
    } catch {
      results.push({ label, status: 'fail', detail: `${dirPath} is not writable` });
    }
  }

  return results;
}

function checkPlaywrightMcp(): CheckResult {
  const mcpPath = process.env['NEXUS_MCP_PLAYWRIGHT_PATH'];
  if (!mcpPath) {
    return {
      label: 'Playwright MCP',
      status: 'warn',
      detail: 'NEXUS_MCP_PLAYWRIGHT_PATH not set (optional)',
    };
  }
  if (fs.existsSync(mcpPath)) {
    return { label: 'Playwright MCP', status: 'pass', detail: mcpPath };
  }
  return {
    label: 'Playwright MCP',
    status: 'fail',
    detail: `Path not found: ${mcpPath}`,
  };
}

function checkDotEnv(): CheckResult {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    return { label: '.env file', status: 'pass', detail: envPath };
  }
  return { label: '.env file', status: 'warn', detail: '.env not found (may be required)' };
}

function statusIcon(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return chalk.green('✓');
    case 'fail':
      return chalk.red('✗');
    case 'warn':
      return chalk.yellow('⚠');
  }
}

function statusColor(status: CheckStatus, text: string): string {
  switch (status) {
    case 'pass':
      return chalk.green(text);
    case 'fail':
      return chalk.red(text);
    case 'warn':
      return chalk.yellow(text);
  }
}

export async function doctorCommand(): Promise<void> {
  logger.header('Nexus V6 — Doctor');

  const checks: CheckResult[] = [
    checkNodeVersion(),
    checkPnpm(),
    checkGit(),
    checkGitWorktree(),
    ...checkRuntimeDirs(),
    checkPlaywrightMcp(),
    checkDotEnv(),
  ];

  const labelWidth = Math.max(...checks.map(c => c.label.length)) + 2;

  console.log('');
  for (const check of checks) {
    const label = check.label.padEnd(labelWidth);
    const icon = statusIcon(check.status);
    const detail = check.detail ? chalk.dim(` — ${check.detail}`) : '';
    console.log(`  ${icon}  ${statusColor(check.status, label)}${detail}`);
  }
  console.log('');

  const failures = checks.filter(c => c.status === 'fail');
  const warnings = checks.filter(c => c.status === 'warn');

  if (failures.length > 0) {
    logger.error(
      `${failures.length} check(s) failed. Fix the issues above before using Nexus.`
    );
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn(`${warnings.length} warning(s). These are optional but recommended.`);
  } else {
    logger.done('All checks passed. Nexus V6 is ready.');
  }
}
