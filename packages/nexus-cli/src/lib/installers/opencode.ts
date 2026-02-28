import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { spinner } from '../logger.js';
import { writeOpenCodeMCPConfig } from '@nexus/playwright';

function resolveNexusV6Root(): string {
  const thisFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(thisFile);
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'packages', 'nexus-cli')) || fs.existsSync(path.join(dir, 'modules'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error('Could not locate nexus-v6 root directory.');
}

function copyDirRecursive(src: string, dest: string): string[] {
  const copied: string[] = [];
  if (!fs.existsSync(src)) return copied;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copied.push(...copyDirRecursive(srcPath, destPath));
    else { fs.copyFileSync(srcPath, destPath); copied.push(destPath); }
  }
  return copied;
}

function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findMdFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function rewritePaths(dir: string, opencodeDir: string): void {
  const resolved = opencodeDir.replace(/\\/g, '/') + '/nexus/';
  for (const file of findMdFiles(dir)) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const p of ['~/.opencode/nexus/', '~/.claude/nexus/']) {
      if (content.includes(p)) { content = content.replaceAll(p, resolved); changed = true; }
    }
    if (changed) fs.writeFileSync(file, content, 'utf8');
  }
}

function xdgConfigHome(): string {
  return process.env['XDG_CONFIG_HOME'] ?? path.join(homedir(), '.config');
}

export class OpenCodeInstaller {
  constructor(private readonly isGlobal: boolean, private readonly configDir?: string) {}

  private getOpenCodeDir(): string {
    if (this.configDir) return this.configDir;
    if (this.isGlobal) {
      return (
        process.env['OPENCODE_CONFIG_DIR'] ??
        (process.env['OPENCODE_CONFIG'] ? path.dirname(process.env['OPENCODE_CONFIG']) : null) ??
        path.join(xdgConfigHome(), 'opencode')
      );
    }
    return path.join(process.cwd(), '.opencode');
  }

  async install(): Promise<void> {
    const opencodeDir = this.getOpenCodeDir();
    const nexusV6Root = resolveNexusV6Root();
    const modulesRoot = path.join(nexusV6Root, 'modules', 'nexus');

    const sp = spinner('Installing Nexus into OpenCode...');
    fs.mkdirSync(opencodeDir, { recursive: true });

    let totalFiles = 0;
    for (const [src, dest, label] of [
      [path.join(modulesRoot, 'commands', 'nexus'), path.join(opencodeDir, 'nexus', 'commands'),  'commands/'],
      [path.join(modulesRoot, 'agents'),            path.join(opencodeDir, 'nexus', 'agents'),    'agents/'],
      [path.join(modulesRoot, 'skills'),            path.join(opencodeDir, 'nexus', 'skills'),    'skills/'],
      [path.join(modulesRoot, 'workflows'),         path.join(opencodeDir, 'nexus', 'workflows'), 'workflows/'],
      [path.join(modulesRoot, 'templates'),         path.join(opencodeDir, 'nexus', 'templates'), 'templates/'],
    ] as [string, string, string][]) {
      sp.text = `Copying ${label}`;
      totalFiles += copyDirRecursive(src, dest).length;
    }

    // Adapt CLAUDE.md → INSTRUCTIONS.md (OpenCode convention)
    // OpenCode reads INSTRUCTIONS.md as global system context
    const claudeMdSrc = path.join(modulesRoot, 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc)) {
      let content = fs.readFileSync(claudeMdSrc, 'utf8');
      content = content
        .replace(/\/nexus:/g, '/nexus-')          // OpenCode uses /cmd syntax
        .replace(/CLAUDE\.md/g, 'INSTRUCTIONS.md')
        .replace(/Claude Code/gi, 'OpenCode')
        .replace(/~\/.claude\//g, opencodeDir.replace(/\\/g, '/') + '/nexus/');
      const nexusMd = path.join(opencodeDir, 'nexus', 'INSTRUCTIONS.md');
      fs.mkdirSync(path.dirname(nexusMd), { recursive: true });
      fs.writeFileSync(nexusMd, content, 'utf8');
      totalFiles++;
    }

    // OpenCode reads INSTRUCTIONS.md from project root or config dir
    // Write a loader that imports the full nexus INSTRUCTIONS
    const instructionsPath = path.join(opencodeDir, 'INSTRUCTIONS.md');
    const nexusRef = path.join(opencodeDir, 'nexus', 'INSTRUCTIONS.md').replace(/\\/g, '/');
    if (!fs.existsSync(instructionsPath)) {
      const loader = `# Nexus V6 — OpenCode Instructions\n\nNexus module installed at: \`${nexusRef}\`\n\nSee that file for full operating firmware.\n\n**Command prefix:** \`/nexus-<cmd>\`  e.g. \`/nexus-init\`, \`/nexus-plan\`\n`;
      fs.writeFileSync(instructionsPath, loader, 'utf8');
      totalFiles++;
    }

    sp.text = 'Rewriting path references...';
    rewritePaths(path.join(opencodeDir, 'nexus'), opencodeDir);

    // Write opencode.json with Playwright MCP server config
    // OpenCode reads this automatically — no extra CLI flags needed at dispatch time
    sp.text = 'Writing Playwright MCP config (opencode.json)...';
    await writeOpenCodeMCPConfig(opencodeDir, 'npx @playwright/mcp@latest', true);
    totalFiles++;

    sp.succeed(`Nexus installed into OpenCode (${totalFiles} files) → ${opencodeDir}`);
  }

  async uninstall(): Promise<void> {
    const opencodeDir = this.getOpenCodeDir();
    const sp = spinner('Uninstalling Nexus from OpenCode...');

    const nexusDir = path.join(opencodeDir, 'nexus');
    if (fs.existsSync(nexusDir)) fs.rmSync(nexusDir, { recursive: true, force: true });

    const instructionsPath = path.join(opencodeDir, 'INSTRUCTIONS.md');
    if (fs.existsSync(instructionsPath)) {
      const content = fs.readFileSync(instructionsPath, 'utf8');
      if (content.includes('Nexus V6')) fs.unlinkSync(instructionsPath);
    }

    sp.succeed(`Nexus uninstalled from OpenCode → ${opencodeDir}`);
  }
}
