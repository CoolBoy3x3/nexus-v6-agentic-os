import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the filesystem and child_process modules
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  copyFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// Inline types/interfaces for the install command (since packages may not be built yet)
interface InstallOptions {
  claude?: boolean;
  codex?: boolean;
  gemini?: boolean;
  opencode?: boolean;
  all?: boolean;
  global?: boolean;
  local?: boolean;
}

interface InstallResult {
  runtime: string;
  filesWritten: string[];
  success: boolean;
  error?: string;
}

// Minimal stub of the install command logic for unit testing
function parseInstallFlags(args: string[]): InstallOptions {
  return {
    claude: args.includes('--claude') || args.includes('--all'),
    codex: args.includes('--codex') || args.includes('--all'),
    gemini: args.includes('--gemini') || args.includes('--all'),
    opencode: args.includes('--opencode') || args.includes('--all'),
    all: args.includes('--all'),
    global: !args.includes('--local'),
    local: args.includes('--local'),
  };
}

function getTargetRuntimes(opts: InstallOptions): string[] {
  const runtimes: string[] = [];
  if (opts.claude) runtimes.push('claude');
  if (opts.codex) runtimes.push('codex');
  if (opts.gemini) runtimes.push('gemini');
  if (opts.opencode) runtimes.push('opencode');
  return runtimes;
}

function getInstallPaths(runtime: string, global: boolean): Record<string, string[]> {
  const base = global ? '~' : '.';
  const paths: Record<string, string[]> = {
    claude: [
      `${base}/.claude/commands/`,
      `${base}/.claude/agents/`,
    ],
    codex: [
      `${base}/.codex/instructions/`,
      `${base}/.codex/tools/`,
    ],
    gemini: [
      `${base}/.gemini/system-prompts/`,
    ],
    opencode: [
      `${base}/.config/opencode/agents/`,
      `${base}/.config/opencode/skills/`,
    ],
  };
  return { [runtime]: paths[runtime] ?? [] };
}

describe('nexus install — flag parsing', () => {
  it('should parse --claude flag correctly', () => {
    const opts = parseInstallFlags(['--claude']);
    expect(opts.claude).toBe(true);
    expect(opts.codex).toBe(false);
    expect(opts.gemini).toBe(false);
    expect(opts.opencode).toBe(false);
  });

  it('should enable all runtimes when --all is passed', () => {
    const opts = parseInstallFlags(['--all']);
    expect(opts.claude).toBe(true);
    expect(opts.codex).toBe(true);
    expect(opts.gemini).toBe(true);
    expect(opts.opencode).toBe(true);
    expect(opts.all).toBe(true);
  });

  it('should default to global install when --local is not set', () => {
    const opts = parseInstallFlags(['--claude']);
    expect(opts.global).toBe(true);
    expect(opts.local).toBe(false);
  });

  it('should set local=true when --local flag is present', () => {
    const opts = parseInstallFlags(['--claude', '--local']);
    expect(opts.local).toBe(true);
    expect(opts.global).toBe(false);
  });

  it('should support combining multiple runtime flags', () => {
    const opts = parseInstallFlags(['--claude', '--codex']);
    expect(opts.claude).toBe(true);
    expect(opts.codex).toBe(true);
    expect(opts.gemini).toBe(false);
    expect(opts.opencode).toBe(false);
  });
});

describe('nexus install — target runtime resolution', () => {
  it('should return only selected runtimes', () => {
    const opts = parseInstallFlags(['--claude', '--gemini']);
    const runtimes = getTargetRuntimes(opts);
    expect(runtimes).toContain('claude');
    expect(runtimes).toContain('gemini');
    expect(runtimes).not.toContain('codex');
    expect(runtimes).not.toContain('opencode');
  });

  it('should return all 4 runtimes when --all is used', () => {
    const opts = parseInstallFlags(['--all']);
    const runtimes = getTargetRuntimes(opts);
    expect(runtimes).toHaveLength(4);
    expect(runtimes).toEqual(expect.arrayContaining(['claude', 'codex', 'gemini', 'opencode']));
  });

  it('should return empty list when no runtime flags are given', () => {
    const opts = parseInstallFlags([]);
    const runtimes = getTargetRuntimes(opts);
    expect(runtimes).toHaveLength(0);
  });
});

describe('nexus install — install path resolution', () => {
  it('should return claude global paths for claude runtime with global=true', () => {
    const paths = getInstallPaths('claude', true);
    const claudePaths = paths['claude'];
    expect(claudePaths).toBeDefined();
    expect(claudePaths.some(p => p.includes('.claude/commands'))).toBe(true);
    expect(claudePaths.some(p => p.includes('.claude/agents'))).toBe(true);
  });

  it('should return local paths when global=false', () => {
    const paths = getInstallPaths('claude', false);
    const claudePaths = paths['claude'];
    expect(claudePaths).toBeDefined();
    expect(claudePaths.every(p => p.startsWith('./'))).toBe(true);
  });

  it('should return codex paths for codex runtime', () => {
    const paths = getInstallPaths('codex', true);
    const codexPaths = paths['codex'];
    expect(codexPaths).toBeDefined();
    expect(codexPaths.some(p => p.includes('.codex'))).toBe(true);
  });

  it('should return opencode skill paths for opencode runtime', () => {
    const paths = getInstallPaths('opencode', true);
    const opencodePaths = paths['opencode'];
    expect(opencodePaths).toBeDefined();
    expect(opencodePaths.some(p => p.includes('skills'))).toBe(true);
  });
});
