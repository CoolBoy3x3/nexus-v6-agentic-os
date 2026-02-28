/**
 * Playwright bridge — runtime-aware.
 *
 * Each AI runtime has a different mechanism for browser automation:
 *
 *   Claude     → MCP via `--mcp-config` flag + `mcp__playwright__*` tools
 *   Gemini CLI → MCP via `--mcp-server` flag + `mcp__playwright__*` tools
 *   OpenCode   → MCP via `opencode.json` mcpServers config (written at install time)
 *   Codex      → No MCP support; uses a thin `nexus-playwright-runner.mjs` Node script
 *                called through the Bash tool directly.
 *
 * At dispatch time worker-cell.ts calls `buildMCPArgs()` to inject the right
 * flags/env for the current runtime, and includes the right prompt instructions
 * via `buildPlaywrightInstructions()`.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ProjectSettings } from '@nexus/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlaywrightRuntime = 'claude' | 'gemini' | 'opencode' | 'codex';

export interface PlaywrightAction {
  type: 'navigate' | 'screenshot' | 'click' | 'fill' | 'trace-start' | 'trace-stop' | 'evaluate';
  url?: string;
  selector?: string;
  value?: string;
  script?: string;
  outputPath?: string;
}

export interface PlaywrightActionResult {
  success: boolean;
  action: PlaywrightAction;
  output?: string;
  screenshotPath?: string;
  tracePath?: string;
  error?: string;
  timestamp: string;
}

export interface MCPClientConfig {
  mcpPath: string;   // resolved path to @playwright/mcp or 'npx'
  cwd: string;
  headless: boolean;
  runtime: PlaywrightRuntime;
}

/** Shape of a Claude MCP config file (mcpServers field) */
interface ClaudeMCPConfig {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
}

/** Shape of OpenCode's opencode.json mcpServers entry */
interface OpenCodeMCPEntry {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// ─── Config loading ───────────────────────────────────────────────────────────

export async function loadMCPConfig(cwd: string, runtime?: PlaywrightRuntime): Promise<MCPClientConfig> {
  const settingsPath = path.join(cwd, '.nexus/01-governance/settings.json');
  let mcpPath = process.env['NEXUS_MCP_PLAYWRIGHT_PATH'] ?? '';
  let headless = true;

  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw) as ProjectSettings;
      if (settings.playwright?.mcpPath) mcpPath = settings.playwright.mcpPath;
    } catch {}
  }

  // Resolve @playwright/mcp binary if not explicitly set
  if (!mcpPath) mcpPath = resolvePlaywrightMCPBin();

  const detectedRuntime: PlaywrightRuntime =
    runtime ??
    (process.env['NEXUS_RUNTIME'] as PlaywrightRuntime | undefined) ??
    'claude';

  return { mcpPath, cwd, headless, runtime: detectedRuntime };
}

/**
 * Try to find the @playwright/mcp CLI — prefers a local install over global.
 * Falls back to `npx @playwright/mcp@latest` which works without prior install.
 */
function resolvePlaywrightMCPBin(): string {
  // Check local node_modules first (project or monorepo root)
  const candidates = [
    path.join(process.cwd(), 'node_modules', '.bin', 'playwright-mcp'),
    path.join(process.cwd(), '..', 'node_modules', '.bin', 'playwright-mcp'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Global install
  return 'npx @playwright/mcp@latest';
}

// ─── MCP config file generation ──────────────────────────────────────────────

/**
 * Write (or update) a Claude MCP config JSON file that declares
 * the `playwright` server. Returns the path to the written file.
 *
 * Claude workers receive this via `claude --mcp-config <path>`.
 */
export async function writeClaudeMCPConfig(cwd: string, mcpPath: string, headless: boolean): Promise<string> {
  const configDir = path.join(cwd, '.nexus', '05-runtime');
  await mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, 'mcp-playwright.json');

  const [cmd, ...args] = mcpPath.startsWith('npx')
    ? ['npx', '@playwright/mcp@latest', ...(headless ? ['--headless'] : [])]
    : [mcpPath, ...(headless ? ['--headless'] : [])];

  const config: ClaudeMCPConfig = {
    mcpServers: {
      playwright: {
        command: cmd!,
        args,
      },
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

/**
 * Write (or merge) the `playwright` MCP server into OpenCode's `opencode.json`.
 * OpenCode reads this from the config dir automatically.
 */
export async function writeOpenCodeMCPConfig(opencodeDir: string, mcpPath: string, headless: boolean): Promise<void> {
  const configPath = path.join(opencodeDir, 'opencode.json');
  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try { existing = JSON.parse(await readFile(configPath, 'utf-8')) as Record<string, unknown>; } catch {}
  }

  const [cmd, ...args] = mcpPath.startsWith('npx')
    ? ['npx', '@playwright/mcp@latest', ...(headless ? ['--headless'] : [])]
    : [mcpPath, ...(headless ? ['--headless'] : [])];

  const playwrightEntry: OpenCodeMCPEntry = { type: 'stdio', command: cmd!, args };

  const mcpServers = (existing['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  mcpServers['playwright'] = playwrightEntry;
  existing['mcpServers'] = mcpServers;

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
}

// ─── Worker dispatch helpers ──────────────────────────────────────────────────

/**
 * Returns extra CLI args to inject into the worker dispatch command so the
 * runtime loads the Playwright MCP server.
 *
 * For Claude: `['--mcp-config', '<path>']`
 * For Gemini: `['--mcp-server', 'npx @playwright/mcp@latest --headless']`
 * For OpenCode: `[]`  (already configured via opencode.json at install time)
 * For Codex:   `[]`  (no MCP — uses playwright-runner.mjs via Bash tool)
 */
export async function buildMCPArgs(
  config: MCPClientConfig,
): Promise<string[]> {
  switch (config.runtime) {
    case 'claude': {
      const configPath = await writeClaudeMCPConfig(config.cwd, config.mcpPath, config.headless);
      return ['--mcp-config', configPath];
    }
    case 'gemini': {
      const serverCmd = config.mcpPath.startsWith('npx')
        ? `npx @playwright/mcp@latest${config.headless ? ' --headless' : ''}`
        : `${config.mcpPath}${config.headless ? ' --headless' : ''}`;
      return ['--mcp-server', serverCmd];
    }
    case 'opencode':
      // opencode.json was written at install time by OpenCodeInstaller
      return [];
    case 'codex':
      // Codex has no MCP; workers use the playwright-runner.mjs script via Bash
      return [];
  }
}

/**
 * Returns the snippet to append to the worker prompt so it knows HOW to
 * invoke Playwright for the current runtime.
 *
 * Claude/Gemini/OpenCode: use mcp__playwright__* tools
 * Codex: use Bash tool to call nexus-playwright-runner.mjs
 */
export function buildPlaywrightInstructions(config: MCPClientConfig, artifactDir: string): string {
  const screenshotDir = path.join(artifactDir, 'screenshots').replace(/\\/g, '/');

  if (config.runtime === 'codex') {
    return `
## Browser / Playwright
You do NOT have MCP tools. Use the Bash tool to run browser actions:
\`\`\`
node .nexus/tools/nexus-playwright-runner.mjs navigate <url>
node .nexus/tools/nexus-playwright-runner.mjs screenshot <url> ${screenshotDir}/screenshot.png
node .nexus/tools/nexus-playwright-runner.mjs click <url> <css-selector>
node .nexus/tools/nexus-playwright-runner.mjs fill <url> <css-selector> <value>
\`\`\`
The runner exits 0 on success, 1 on failure. Output is JSON on stdout.
Screenshots are saved to: ${screenshotDir}
`;
  }

  // MCP-capable runtimes (claude, gemini, opencode)
  const toolPrefix = 'mcp__playwright__';
  return `
## Browser / Playwright
Use the MCP Playwright tools (prefix: \`${toolPrefix}\`):
- \`${toolPrefix}navigate\` — navigate to a URL
- \`${toolPrefix}screenshot\` — capture a screenshot (save to ${screenshotDir}/)
- \`${toolPrefix}click\` — click a CSS selector
- \`${toolPrefix}fill\` — fill an input field
- \`${toolPrefix}evaluate\` — run JavaScript in the page
- \`${toolPrefix}startTrace\` / \`${toolPrefix}stopTrace\` — record a trace

Always save screenshots to: ${screenshotDir}
`;
}

// ─── MCPPlaywrightClient (retained for FlowRunner compatibility) ──────────────

export class MCPPlaywrightClient {
  private config: MCPClientConfig | null = null;

  constructor(private readonly cwd: string = process.cwd()) {}

  async init(runtime?: PlaywrightRuntime): Promise<void> {
    this.config = await loadMCPConfig(this.cwd, runtime);
  }

  isConfigured(): boolean {
    return Boolean(this.config?.mcpPath);
  }

  getConfig(): MCPClientConfig | null {
    return this.config;
  }

  getMCPPath(): string {
    return this.config?.mcpPath ?? '';
  }

  /** Build extra CLI args for worker dispatch */
  async getMCPArgs(): Promise<string[]> {
    if (!this.config) return [];
    return buildMCPArgs(this.config);
  }

  /** Build Playwright instructions to append to the worker prompt */
  getPlaywrightInstructions(artifactDir: string): string {
    if (!this.config) return '';
    return buildPlaywrightInstructions(this.config, artifactDir);
  }

  buildActionSpec(action: PlaywrightAction): Record<string, unknown> {
    return {
      tool: this.config?.runtime === 'codex' ? 'bash-playwright-runner' : 'mcp__playwright__' + action.type,
      mcpPath: this.config?.mcpPath,
      action: action.type,
      params: {
        url: action.url,
        selector: action.selector,
        value: action.value,
        script: action.script,
        outputPath: action.outputPath,
      },
    };
  }

  createResult(action: PlaywrightAction, success: boolean, detail: Partial<PlaywrightActionResult> = {}): PlaywrightActionResult {
    return {
      success,
      action,
      timestamp: new Date().toISOString(),
      ...detail,
    };
  }
}
