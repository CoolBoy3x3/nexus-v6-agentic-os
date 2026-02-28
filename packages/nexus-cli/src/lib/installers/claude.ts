import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { spinner } from '../logger.js';
import { getRuntimeConfigDir } from '../runtime-detect.js';

/**
 * Resolve the nexus-v6 root directory by walking up from this file's location.
 * This file lives at: <nexus-v6>/packages/nexus-cli/src/lib/installers/claude.ts
 * (or dist/lib/installers/claude.js at runtime)
 * The modules/nexus/ source lives at: <nexus-v6>/modules/nexus/
 */
function resolveNexusV6Root(): string {
  // import.meta.url points to this compiled file in dist/
  const thisFile = fileURLToPath(import.meta.url);
  // Walk up: installers/ -> lib/ -> dist/ (or src/) -> nexus-cli/ -> packages/ -> nexus-v6/
  let dir = path.dirname(thisFile);
  for (let i = 0; i < 5; i++) {
    // Look for the marker: packages/nexus-cli exists at this level
    if (
      fs.existsSync(path.join(dir, 'packages', 'nexus-cli')) ||
      fs.existsSync(path.join(dir, 'modules'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(
    'Could not locate nexus-v6 root directory. ' +
    'Make sure @nexus/cli is running from within the nexus-v6 installation.'
  );
}

/**
 * Recursively copy all files from src to dest.
 * Creates destination directories as needed.
 * Returns list of copied file paths (relative to dest).
 */
function copyDirRecursive(src: string, dest: string): string[] {
  const copied: string[] = [];
  if (!fs.existsSync(src)) return copied;

  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDirRecursive(srcPath, destPath));
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied.push(destPath);
    }
  }
  return copied;
}

/**
 * Walk a directory and return all .md file paths.
 */
function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Post-process all .md files in a directory:
 * replace the placeholder `~/.claude/nexus/` with the real resolved path.
 */
function rewritePaths(dir: string, actualPath: string): void {
  const mdFiles = findMdFiles(dir);
  const placeholder = '~/.claude/nexus/';
  // Normalise to forward slashes for cross-platform consistency in .md content
  const resolved = actualPath.replace(/\\/g, '/') + '/nexus/';

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(placeholder)) {
      fs.writeFileSync(file, content.replaceAll(placeholder, resolved), 'utf8');
    }
  }
}

/**
 * Detect where @playwright/mcp is installed.
 * Priority: local node_modules → global npm bin → global yarn bin → npx fallback.
 */
function detectPlaywrightMCPBin(): string {
  const exists = fs.existsSync;

  // 1. Local node_modules
  const localCandidates = [
    path.join(process.cwd(), 'node_modules', '.bin', 'playwright-mcp'),
    path.join(process.cwd(), '..', 'node_modules', '.bin', 'playwright-mcp'),
  ];
  for (const c of localCandidates) {
    if (exists(c)) return c;
  }

  // 2. Global npm bin
  try {
    const npmBin = execSync('npm root -g', { timeout: 3000, stdio: 'pipe' }).toString().trim();
    const npmCandidate = path.join(npmBin, '..', '.bin', 'playwright-mcp');
    if (exists(npmCandidate)) return npmCandidate;
  } catch {}

  // 3. Direct binary on PATH — use platform-appropriate command
  try {
    const cmd = process.platform === 'win32' ? 'where playwright-mcp' : 'which playwright-mcp';
    const which = execSync(cmd, { timeout: 3000, stdio: 'pipe' })
      .toString().trim().split('\n')[0]?.trim();
    if (which && exists(which)) return which;
  } catch {}

  // 4. Fall back to npx (always works, downloads on first use)
  return 'npx @playwright/mcp@latest';
}

export class ClaudeInstaller {
  constructor(private readonly isGlobal: boolean, private readonly configDir?: string) {}

  private getClaudeDir(): string {
    if (this.configDir) return this.configDir;

    if (this.isGlobal) {
      // Honour CLAUDE_CONFIG_DIR env var, falling back to ~/.claude
      if (process.env['CLAUDE_CONFIG_DIR']) {
        return process.env['CLAUDE_CONFIG_DIR'];
      }
      return path.join(homedir(), '.claude');
    }

    // Local install: .claude/ in the current working directory
    return path.join(process.cwd(), '.claude');
  }

  async install(): Promise<void> {
    const claudeDir = this.getClaudeDir();
    const nexusV6Root = resolveNexusV6Root();
    const modulesRoot = path.join(nexusV6Root, 'modules', 'nexus');

    const sp = spinner('Installing Nexus into Claude Code...');

    // Ensure Claude config dir exists
    fs.mkdirSync(claudeDir, { recursive: true });

    const tasks: Array<{ src: string; dest: string; label: string }> = [
      {
        src: path.join(modulesRoot, 'commands', 'nexus'),
        dest: path.join(claudeDir, 'commands', 'nexus'),
        label: 'commands/nexus/',
      },
      {
        src: path.join(modulesRoot, 'agents'),
        dest: path.join(claudeDir, 'agents', 'nexus'),
        label: 'agents/nexus/',
      },
      {
        src: path.join(modulesRoot, 'skills'),
        dest: path.join(claudeDir, 'skills', 'nexus'),
        label: 'skills/nexus/',
      },
      {
        src: path.join(modulesRoot, 'workflows'),
        dest: path.join(claudeDir, 'nexus', 'workflows'),
        label: 'nexus/workflows/',
      },
    ];

    let totalFiles = 0;

    for (const task of tasks) {
      sp.text = `Copying ${task.label}`;
      const copied = copyDirRecursive(task.src, task.dest);
      totalFiles += copied.length;
      for (const f of copied) {
        sp.text = `  Copied: ${path.relative(claudeDir, f)}`;
      }
    }

    // Copy CLAUDE.md
    const claudeMdSrc = path.join(modulesRoot, 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc)) {
      const claudeMdDest = path.join(claudeDir, 'nexus', 'CLAUDE.md');
      fs.mkdirSync(path.dirname(claudeMdDest), { recursive: true });
      fs.copyFileSync(claudeMdSrc, claudeMdDest);
      totalFiles++;
      sp.text = `Copied CLAUDE.md`;
    }

    // Post-process: rewrite path placeholders in all installed .md files
    sp.text = 'Rewriting path references in .md files...';
    rewritePaths(claudeDir, claudeDir);

    // Write a nexus/playwright-detect.json with the auto-detected path so
    // new projects can copy it into their settings.json playwright.mcpPath.
    // This is advisory — projects override it in their own settings.json.
    const detectedMCPPath = detectPlaywrightMCPBin();
    const detectPath = path.join(claudeDir, 'nexus', 'playwright-detect.json');
    fs.mkdirSync(path.dirname(detectPath), { recursive: true });
    fs.writeFileSync(
      detectPath,
      JSON.stringify({ mcpPath: detectedMCPPath, detectedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );

    sp.succeed(`Nexus installed into Claude Code (${totalFiles} files) → ${claudeDir}`);
    if (detectedMCPPath !== 'npx @playwright/mcp@latest') {
      console.log(`  Playwright MCP detected: ${detectedMCPPath}`);
    } else {
      console.log(`  Playwright MCP: will use 'npx @playwright/mcp@latest' (install @playwright/mcp to use a local binary)`);
    }
  }

  async uninstall(): Promise<void> {
    const claudeDir = this.getClaudeDir();
    const sp = spinner('Uninstalling Nexus from Claude Code...');

    const dirs = [
      path.join(claudeDir, 'commands', 'nexus'),
      path.join(claudeDir, 'agents', 'nexus'),
      path.join(claudeDir, 'skills', 'nexus'),
      path.join(claudeDir, 'nexus'),
    ];

    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        sp.text = `Removing ${dir}`;
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    sp.succeed('Nexus uninstalled from Claude Code.');
  }
}
