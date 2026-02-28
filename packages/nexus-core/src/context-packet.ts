import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { TaskNode, ContextPacket } from './types.js';
import { NEXUS_FILES } from './constants.js';

export class ContextPacketBuilder {
  constructor(private readonly cwd: string = process.cwd()) {}

  async buildForTask(task: TaskNode): Promise<ContextPacket> {
    const architectureSlice = await this.getArchitectureSlice(task.filesModified);
    const contractsSlice = await this.getContractsSlice(task.filesModified);
    const testsSlice = await this.getTestsSlice(task.filesModified);
    const stateDigest = await this.getStateDigest();
    const boundaries = await this.getBoundaries();

    return {
      taskId: task.id,
      files: task.filesModified,
      architectureSlice,
      contractsSlice,
      testsSlice,
      stateDigest,
      boundaries,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getArchitectureSlice(files: string[]): Promise<Record<string, unknown>> {
    const modulesPath = path.join(this.cwd, NEXUS_FILES.MODULES);
    if (!existsSync(modulesPath)) return {};

    const raw = await readFile(modulesPath, 'utf-8');
    const modules = JSON.parse(raw) as { modules: Array<{ id: string; path?: string; owns?: string[] }> };

    // Filter to modules that own any of the changed files
    const relevant = modules.modules.filter((m) =>
      files.some((f) =>
        (m.path && f.startsWith(m.path)) ||
        (m.owns && m.owns.some((glob) => matchesGlob(f, glob))),
      ),
    );
    return { modules: relevant };
  }

  private async getContractsSlice(files: string[]): Promise<Record<string, unknown>> {
    const contractsPath = path.join(this.cwd, NEXUS_FILES.API_CONTRACTS);
    if (!existsSync(contractsPath)) return {};

    const raw = await readFile(contractsPath, 'utf-8');
    const contracts = JSON.parse(raw) as { contracts: Array<{ id: string; path?: string }> };

    // Filter to contracts whose path overlaps with changed files
    const relevant = contracts.contracts.filter((c) =>
      files.some((f) => c.path && f.includes(path.dirname(c.path))),
    );
    return { contracts: relevant };
  }

  private async getTestsSlice(files: string[]): Promise<string[]> {
    const testMapPath = path.join(this.cwd, NEXUS_FILES.TEST_MAP);
    if (!existsSync(testMapPath)) return [];

    const raw = await readFile(testMapPath, 'utf-8');
    const testMap = JSON.parse(raw) as { testMap: Array<{ sourceFile: string; testFiles: string[] }> };

    const tests = new Set<string>();
    for (const entry of testMap.testMap) {
      if (files.includes(entry.sourceFile)) {
        for (const t of entry.testFiles) tests.add(t);
      }
    }
    return [...tests];
  }

  private async getStateDigest(): Promise<string> {
    const statePath = path.join(this.cwd, NEXUS_FILES.STATE_MD);
    if (!existsSync(statePath)) return '(no STATE.md yet)';

    const raw = await readFile(statePath, 'utf-8');
    // Return first 150 lines — enough to include blockers, decisions, and session continuity
    // without dumping the full file (narrow context rule: orchestrator stays <15% context)
    return raw.split('\n').slice(0, 150).join('\n');
  }

  private async getBoundaries(): Promise<string[]> {
    const settingsPath = path.join(this.cwd, NEXUS_FILES.SETTINGS);
    if (!existsSync(settingsPath)) return [];

    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as { boundaries?: string[] };
    return settings.boundaries ?? [];
  }
}

/** Simple glob matcher for context packet filtering */
function matchesGlob(file: string, glob: string): boolean {
  // Convert glob to regex (basic: ** = anything, * = non-slash)
  const regex = new RegExp(
    '^' + glob.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.') + '$',
  );
  return regex.test(file);
}
