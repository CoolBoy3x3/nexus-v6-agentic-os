import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { spinner } from '../logger.js';

const NEXUS_SECTION_START = '<!-- nexus:start -->';
const NEXUS_SECTION_END = '<!-- nexus:end -->';

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

function buildAgentsMdSection(commandsDir: string, nexusModulesDir: string): string {
  const commands: string[] = [];
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir)) {
      if (f.endsWith('.md')) commands.push(f.replace('.md', ''));
    }
  }
  const skillLines = commands.map((c) => `- \`$nexus-${c}\` — run nexus ${c}`).join('\n');
  const p = nexusModulesDir.replace(/\\/g, '/');
  return `${NEXUS_SECTION_START}
## Nexus V6

Agentic project-intelligence framework. Full docs: \`${p}/CODEX.md\`

### Skills
${skillLines || '- `$nexus-init` — initialise .nexus/ in this project'}

### Governance Loop: PLAN → EXECUTE → VERIFY → UNIFY

### Browser / Playwright (Codex — no MCP)
Use the Bash tool:
\`\`\`
node ${p}/tools/nexus-playwright-runner.mjs navigate <url>
node ${p}/tools/nexus-playwright-runner.mjs screenshot <url> <output.png>
node ${p}/tools/nexus-playwright-runner.mjs click <url> <selector>
node ${p}/tools/nexus-playwright-runner.mjs fill <url> <selector> <value>
\`\`\`
Prerequisite: \`npm i -D playwright && npx playwright install chromium\`
${NEXUS_SECTION_END}`;
}

export class CodexInstaller {
  constructor(private readonly isGlobal: boolean, private readonly configDir?: string) {}

  private getCodexDir(): string {
    if (this.configDir) return this.configDir;
    return this.isGlobal
      ? (process.env['CODEX_HOME'] ?? path.join(homedir(), '.codex'))
      : process.cwd();
  }

  async install(): Promise<void> {
    const codexDir = this.getCodexDir();
    const nexusV6Root = resolveNexusV6Root();
    const modulesRoot = path.join(nexusV6Root, 'modules', 'nexus');
    const nexusModulesDir = path.join(codexDir, '.nexus-modules');

    const sp = spinner('Installing Nexus into Codex...');
    fs.mkdirSync(codexDir, { recursive: true });

    let totalFiles = 0;
    for (const [src, label] of [
      [path.join(modulesRoot, 'commands', 'nexus'), 'commands'],
      [path.join(modulesRoot, 'agents'),            'agents'],
      [path.join(modulesRoot, 'skills'),            'skills'],
      [path.join(modulesRoot, 'workflows'),         'workflows'],
      [path.join(modulesRoot, 'templates'),         'templates'],
      [path.join(modulesRoot, 'tools'),             'tools'],
    ] as [string, string][]) {
      sp.text = `Copying ${label}/`;
      totalFiles += copyDirRecursive(src, path.join(nexusModulesDir, label)).length;
    }

    // Adapt CLAUDE.md → CODEX.md with Codex-specific syntax
    const claudeMdSrc = path.join(modulesRoot, 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc)) {
      let content = fs.readFileSync(claudeMdSrc, 'utf8');
      content = content
        .replace(/\/nexus:/g, '$nexus-')
        .replace(/CLAUDE\.md/g, 'CODEX.md')
        .replace(/Claude Code/gi, 'Codex')
        .replace(/~\/.claude\//g, nexusModulesDir.replace(/\\/g, '/') + '/');
      fs.mkdirSync(nexusModulesDir, { recursive: true });
      fs.writeFileSync(path.join(nexusModulesDir, 'CODEX.md'), content, 'utf8');
      totalFiles++;
    }

    // Write/update AGENTS.md
    sp.text = 'Updating AGENTS.md...';
    const agentsMdPath = path.join(codexDir, 'AGENTS.md');
    const section = buildAgentsMdSection(path.join(modulesRoot, 'commands', 'nexus'), nexusModulesDir);
    let existing = fs.existsSync(agentsMdPath) ? fs.readFileSync(agentsMdPath, 'utf8') : '';

    if (existing.includes(NEXUS_SECTION_START)) {
      const s = existing.indexOf(NEXUS_SECTION_START);
      const e = existing.indexOf(NEXUS_SECTION_END);
      existing = e !== -1
        ? existing.slice(0, s) + section + existing.slice(e + NEXUS_SECTION_END.length)
        : existing.slice(0, s) + section;
    } else {
      existing = existing ? existing.trimEnd() + '\n\n' + section : section;
    }
    fs.writeFileSync(agentsMdPath, existing + '\n', 'utf8');

    sp.succeed(`Nexus installed into Codex (${totalFiles} files + AGENTS.md) → ${codexDir}`);
  }

  async uninstall(): Promise<void> {
    const codexDir = this.getCodexDir();
    const sp = spinner('Uninstalling Nexus from Codex...');

    const nexusModulesDir = path.join(codexDir, '.nexus-modules');
    if (fs.existsSync(nexusModulesDir)) fs.rmSync(nexusModulesDir, { recursive: true, force: true });

    const agentsMdPath = path.join(codexDir, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
      let content = fs.readFileSync(agentsMdPath, 'utf8');
      if (content.includes(NEXUS_SECTION_START)) {
        const s = content.indexOf(NEXUS_SECTION_START);
        const e = content.indexOf(NEXUS_SECTION_END);
        content = e !== -1
          ? (content.slice(0, s).trimEnd() + '\n' + content.slice(e + NEXUS_SECTION_END.length).trimStart()).trim()
          : content.slice(0, s).trimEnd();
        if (content.trim()) fs.writeFileSync(agentsMdPath, content + '\n', 'utf8');
        else fs.unlinkSync(agentsMdPath);
      }
    }

    sp.succeed('Nexus uninstalled from Codex.');
  }
}
