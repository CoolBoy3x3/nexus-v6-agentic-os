import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { spinner } from '../logger.js';

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

function rewritePaths(dir: string, nexusDir: string): void {
  const resolved = nexusDir.replace(/\\/g, '/') + '/nexus/';
  for (const file of findMdFiles(dir)) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const placeholder of ['~/.gemini/nexus/', '~/.claude/nexus/']) {
      if (content.includes(placeholder)) { content = content.replaceAll(placeholder, resolved); changed = true; }
    }
    if (changed) fs.writeFileSync(file, content, 'utf8');
  }
}

export class GeminiInstaller {
  constructor(private readonly isGlobal: boolean, private readonly configDir?: string) {}

  private getGeminiDir(): string {
    if (this.configDir) return this.configDir;
    return this.isGlobal
      ? (process.env['GEMINI_CONFIG_DIR'] ?? path.join(homedir(), '.gemini'))
      : path.join(process.cwd(), '.gemini');
  }

  async install(): Promise<void> {
    const geminiDir = this.getGeminiDir();
    const nexusV6Root = resolveNexusV6Root();
    const modulesRoot = path.join(nexusV6Root, 'modules', 'nexus');

    const sp = spinner('Installing Nexus into Gemini CLI...');
    fs.mkdirSync(geminiDir, { recursive: true });

    let totalFiles = 0;
    for (const [src, dest, label] of [
      [path.join(modulesRoot, 'commands', 'nexus'), path.join(geminiDir, 'nexus', 'commands'),  'commands/'],
      [path.join(modulesRoot, 'agents'),            path.join(geminiDir, 'nexus', 'agents'),    'agents/'],
      [path.join(modulesRoot, 'skills'),            path.join(geminiDir, 'nexus', 'skills'),    'skills/'],
      [path.join(modulesRoot, 'workflows'),         path.join(geminiDir, 'nexus', 'workflows'), 'workflows/'],
      [path.join(modulesRoot, 'templates'),         path.join(geminiDir, 'nexus', 'templates'), 'templates/'],
    ] as [string, string, string][]) {
      sp.text = `Copying ${label}`;
      totalFiles += copyDirRecursive(src, dest).length;
    }

    // Adapt CLAUDE.md → GEMINI.md with Gemini-specific syntax (@nexus-cmd)
    const claudeMdSrc = path.join(modulesRoot, 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc)) {
      let content = fs.readFileSync(claudeMdSrc, 'utf8');
      content = content
        .replace(/\/nexus:/g, '@nexus-')
        .replace(/CLAUDE\.md/g, 'GEMINI.md')
        .replace(/Claude Code/gi, 'Gemini CLI')
        .replace(/~\/.claude\//g, geminiDir.replace(/\\/g, '/') + '/nexus/');
      const dest = path.join(geminiDir, 'nexus', 'GEMINI.md');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf8');
      totalFiles++;
    }

    // Gemini uses GEMINI.md in project root as system context
    // Write a loader stub that references the installed nexus module
    const geminiMdPath = path.join(geminiDir, 'GEMINI.md');
    const nexusRef = path.join(geminiDir, 'nexus', 'GEMINI.md').replace(/\\/g, '/');
    const loaderContent = `# Nexus V6 — Gemini CLI Context\n\nNexus module installed at: \`${nexusRef}\`\n\nSee \`${nexusRef}\` for full operating firmware and command list.\n\n**Command prefix:** \`@nexus-<cmd>\`  e.g. \`@nexus-init\`, \`@nexus-plan\`\n`;
    if (!fs.existsSync(geminiMdPath)) {
      fs.writeFileSync(geminiMdPath, loaderContent, 'utf8');
      totalFiles++;
    }

    sp.text = 'Rewriting path references...';
    rewritePaths(path.join(geminiDir, 'nexus'), geminiDir);

    sp.succeed(`Nexus installed into Gemini CLI (${totalFiles} files) → ${geminiDir}`);
  }

  async uninstall(): Promise<void> {
    const geminiDir = this.getGeminiDir();
    const sp = spinner('Uninstalling Nexus from Gemini CLI...');

    const nexusDir = path.join(geminiDir, 'nexus');
    if (fs.existsSync(nexusDir)) fs.rmSync(nexusDir, { recursive: true, force: true });

    const geminiMdPath = path.join(geminiDir, 'GEMINI.md');
    if (fs.existsSync(geminiMdPath)) {
      const content = fs.readFileSync(geminiMdPath, 'utf8');
      if (content.includes('Nexus V6')) fs.unlinkSync(geminiMdPath);
    }

    sp.succeed(`Nexus uninstalled from Gemini CLI → ${geminiDir}`);
  }
}
