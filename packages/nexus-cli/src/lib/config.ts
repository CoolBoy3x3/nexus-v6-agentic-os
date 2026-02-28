import path from 'path';
import fs from 'fs';
import { NEXUS_FILES, resolveNexusRoot } from './paths.js';

export interface NexusConfig {
  /** Project name */
  projectName: string;
  /** Short project description */
  description: string;
  /** Core value statement */
  coreValue: string;
  /** Dashboard server port */
  dashboardPort: number;
  /** Whether to auto-commit checkpoints */
  autoCheckpoint: boolean;
  /** Log level override (silent|error|warn|info|verbose) */
  logLevel: string;
  /** MCP Playwright path (for browser automation) */
  mcpPlaywrightPath: string;
  /** Active runtimes that Nexus is installed into */
  runtimes: string[];
  /** Schema version for future migrations */
  schemaVersion: number;
}

const CONFIG_DEFAULTS: NexusConfig = {
  projectName: '',
  description: '',
  coreValue: '',
  dashboardPort: 7890,
  autoCheckpoint: false,
  logLevel: 'info',
  mcpPlaywrightPath: '',
  runtimes: [],
  schemaVersion: 1,
};

/**
 * Load the Nexus config from `.nexus/01-governance/settings.json`.
 * Missing fields are filled with defaults.
 * Returns defaults if the file does not exist.
 */
export function loadConfig(nexusRoot?: string): NexusConfig {
  const settingsPath = nexusRoot
    ? path.join(nexusRoot, '01-governance', 'settings.json')
    : path.join(process.cwd(), NEXUS_FILES.SETTINGS);

  if (!fs.existsSync(settingsPath)) {
    return { ...CONFIG_DEFAULTS, runtimes: [] };
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<NexusConfig>;
    return {
      ...CONFIG_DEFAULTS,
      ...parsed,
      // Ensure array fields are always fresh copies, never references to CONFIG_DEFAULTS arrays
      runtimes: Array.isArray(parsed.runtimes) ? [...parsed.runtimes] : [],
    };
  } catch {
    return { ...CONFIG_DEFAULTS, runtimes: [] };
  }
}

/**
 * Save a Nexus config object to `.nexus/01-governance/settings.json`.
 * Creates parent directories if they do not exist.
 */
export function saveConfig(config: NexusConfig, nexusRoot?: string): void {
  const root = nexusRoot ?? resolveNexusRoot();
  const govDir = path.join(root, '01-governance');
  const settingsPath = path.join(govDir, 'settings.json');

  fs.mkdirSync(govDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
