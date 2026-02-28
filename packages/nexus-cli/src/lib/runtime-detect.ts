import { homedir } from 'os';
import path from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

export type Runtime = 'claude' | 'codex' | 'gemini' | 'opencode';

function xdgConfigHome(): string {
  return process.env['XDG_CONFIG_HOME'] ?? path.join(homedir(), '.config');
}

/** Silently check if a CLI binary is on PATH */
function hasBinary(name: string): boolean {
  try {
    execSync(`${name} --version`, { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export function detectInstalledRuntimes(): Runtime[] {
  const runtimes: Runtime[] = [];

  // Claude Code — ~/.claude or CLAUDE_CONFIG_DIR
  const claudeDir = process.env['CLAUDE_CONFIG_DIR'] ?? path.join(homedir(), '.claude');
  if (existsSync(claudeDir) || hasBinary('claude')) {
    runtimes.push('claude');
  }

  // Codex — ~/.codex or CODEX_HOME env or `codex` binary
  const codexDir = process.env['CODEX_HOME'] ?? path.join(homedir(), '.codex');
  if (existsSync(codexDir) || process.env['CODEX_HOME'] || hasBinary('codex')) {
    runtimes.push('codex');
  }

  // Gemini CLI — ~/.gemini or GEMINI_CONFIG_DIR or `gemini` binary
  const geminiDir = process.env['GEMINI_CONFIG_DIR'] ?? path.join(homedir(), '.gemini');
  if (existsSync(geminiDir) || process.env['GEMINI_CONFIG_DIR'] || hasBinary('gemini')) {
    runtimes.push('gemini');
  }

  // OpenCode — XDG: ~/.config/opencode or OPENCODE_CONFIG_DIR or `opencode` binary
  const opencodeDir =
    process.env['OPENCODE_CONFIG_DIR'] ??
    path.join(xdgConfigHome(), 'opencode');
  if (existsSync(opencodeDir) || process.env['OPENCODE_CONFIG_DIR'] || hasBinary('opencode')) {
    runtimes.push('opencode');
  }

  return runtimes;
}

export function getRuntimeConfigDir(runtime: Runtime, isGlobal: boolean, configDir?: string): string {
  if (configDir) return configDir;

  if (isGlobal) {
    switch (runtime) {
      case 'claude':
        return process.env['CLAUDE_CONFIG_DIR'] ?? path.join(homedir(), '.claude');
      case 'codex':
        return process.env['CODEX_HOME'] ?? path.join(homedir(), '.codex');
      case 'gemini':
        return process.env['GEMINI_CONFIG_DIR'] ?? path.join(homedir(), '.gemini');
      case 'opencode':
        return process.env['OPENCODE_CONFIG_DIR'] ?? path.join(xdgConfigHome(), 'opencode');
    }
  }

  // Local — project-level config
  switch (runtime) {
    case 'claude':   return path.join(process.cwd(), '.claude');
    case 'codex':    return process.cwd(); // AGENTS.md goes in project root
    case 'gemini':   return path.join(process.cwd(), '.gemini');
    case 'opencode': return path.join(process.cwd(), '.opencode');
  }
}

/** Return the CLI binary name for dispatching worker tasks */
export function getRuntimeBinary(runtime: Runtime): string {
  const map: Record<Runtime, string> = {
    claude:   'claude',
    codex:    'codex',
    gemini:   'gemini',
    opencode: 'opencode',
  };
  return map[runtime];
}

/** Detect which runtime CLI is available for programmatic dispatch */
export function detectActiveRuntime(): Runtime | null {
  // Check explicit env override first
  const explicit = process.env['NEXUS_RUNTIME'] as Runtime | undefined;
  if (explicit && ['claude', 'codex', 'gemini', 'opencode'].includes(explicit)) {
    return explicit;
  }

  // Check binaries in preference order
  const order: Runtime[] = ['claude', 'codex', 'opencode', 'gemini'];
  for (const runtime of order) {
    if (hasBinary(getRuntimeBinary(runtime))) return runtime;
  }
  return null;
}
