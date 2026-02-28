import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { TaskNode, ContextPacket } from './types.js';
import { NEXUS_FILES } from './constants.js';

export class ContextPacketBuilder {
  constructor(private readonly cwd: string = process.cwd()) {}

  async buildForTask(task: TaskNode, allTasks?: TaskNode[]): Promise<ContextPacket> {
    // All slots built in parallel — no slot depends on another
    const [
      missionContext,
      phaseObjective,
      filesContent,
      acceptanceCriteria,
      architectureSlice,
      contractsSlice,
      dependencySymbols,
      testsSlice,
      waveContext,
      scarsDigest,
      stateDigest,
      boundaries,
    ] = await Promise.all([
      this.getMissionContext(),
      this.getPhaseObjective(task),
      this.getFilesContent(task.filesModified),
      this.getAcceptanceCriteria(task),
      this.getArchitectureSlice(task.filesModified),
      this.getContractsSlice(task.filesModified),
      this.getDependencySymbols(task.filesModified),
      this.getTestsSlice(task.filesModified),
      this.getWaveContext(task, allTasks ?? []),
      this.getScarsDigest(),
      this.getStateDigest(),
      this.getBoundaries(),
    ]);

    return {
      taskId: task.id,
      tddMode: task.tddMode,
      riskTier: task.riskTier,
      generatedAt: new Date().toISOString(),
      missionContext,
      phaseObjective,
      files: task.filesModified,
      filesContent,
      acceptanceCriteria,
      architectureSlice,
      contractsSlice,
      dependencySymbols,
      testsSlice,
      waveContext,
      scarsDigest,
      stateDigest,
      boundaries,
    };
  }

  // ── Slot 1: Mission context (WHY does this task exist) ──────────────────

  private async getMissionContext(): Promise<string> {
    const prdPath = path.join(this.cwd, '.nexus', '00-mission', 'PRD.md');
    if (!existsSync(prdPath)) return '(no PRD.md found — mission context unavailable)';

    try {
      const raw = await readFile(prdPath, 'utf-8');
      const lines = raw.split('\n');

      // Extract Executive Summary + Constraints (tech stack) — cap at 20 lines
      const summaryStart = lines.findIndex((l) => l.includes('Executive Summary'));
      const constraintsStart = lines.findIndex((l) => l.includes('## Constraints'));

      const parts: string[] = [];
      if (summaryStart !== -1) {
        // Take up to 8 lines from executive summary
        parts.push(...lines.slice(summaryStart, summaryStart + 8));
      }
      if (constraintsStart !== -1) {
        // Take technical constraints section, up to 8 lines
        parts.push('', ...lines.slice(constraintsStart, constraintsStart + 8));
      }

      return parts.slice(0, 20).join('\n').trim() || '(PRD.md has no Executive Summary or Constraints section)';
    } catch {
      return '(could not read PRD.md)';
    }
  }

  // ── Slot 2: Phase objective (WHY this phase, HOW task serves it) ─────────

  private async getPhaseObjective(task: TaskNode): Promise<string> {
    // Find the current phase PLAN.md
    const planDir = path.join(this.cwd, '.nexus', '04-plans');
    if (!existsSync(planDir)) return '(no plans directory found)';

    try {
      const { readdirSync } = await import('fs');
      const phases = readdirSync(planDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith(task.phase))
        .map((e) => e.name);

      const phaseDir = phases[0] ? path.join(planDir, phases[0]) : path.join(planDir, task.phase);
      const planPath = path.join(phaseDir, 'PLAN.md');
      if (!existsSync(planPath)) return '(no PLAN.md found for this phase)';

      const raw = await readFile(planPath, 'utf-8');
      const lines = raw.split('\n');

      // Extract the Objective section
      const objStart = lines.findIndex((l) => l.match(/^## Objective/));
      if (objStart === -1) return '(no Objective section in PLAN.md)';

      // Take up to next ## section or 15 lines
      const objEnd = lines.findIndex((l, i) => i > objStart && l.startsWith('## '));
      const end = objEnd === -1 ? objStart + 15 : Math.min(objEnd, objStart + 15);

      return lines.slice(objStart, end).join('\n').trim();
    } catch {
      return '(could not read phase PLAN.md)';
    }
  }

  // ── Slot 10: Wave context (what prior waves built) ───────────────────────

  private async getWaveContext(task: TaskNode, allTasks: TaskNode[]): Promise<string> {
    if (task.wave <= 1 || allTasks.length === 0) {
      return '(Wave 1 — no prior wave output to build on)';
    }

    // Completed tasks from prior waves only
    const priorWaveTasks = allTasks.filter(
      (t) => t.wave < task.wave && t.status === 'completed',
    );

    if (priorWaveTasks.length === 0) {
      return `(Wave ${task.wave} — prior waves have no completed tasks yet)`;
    }

    const lines: string[] = [`Prior wave completions (available to build on):`];
    for (const t of priorWaveTasks) {
      lines.push(`  Wave ${t.wave} | ${t.id}: ${t.description}`);
      if (t.filesModified.length > 0) {
        lines.push(`    Files: ${t.filesModified.join(', ')}`);
      }
    }

    // Cap at 30 lines
    return lines.slice(0, 30).join('\n');
  }

  // ── Slot 4: File contents ────────────────────────────────────────────────

  private async getFilesContent(files: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    await Promise.all(
      files.map(async (f) => {
        const fullPath = path.join(this.cwd, f);
        try {
          result[f] = existsSync(fullPath) ? await readFile(fullPath, 'utf-8') : '';
        } catch {
          result[f] = ''; // treat unreadable as new file
        }
      }),
    );
    return result;
  }

  // ── Slot 3: Architecture slice ───────────────────────────────────────────

  private async getArchitectureSlice(files: string[]): Promise<Record<string, unknown>> {
    const modulesPath = path.join(this.cwd, NEXUS_FILES.MODULES);
    if (!existsSync(modulesPath)) return {};

    try {
      const raw = await readFile(modulesPath, 'utf-8');
      const modules = JSON.parse(raw) as { modules: Array<{ id: string; path?: string; owns?: string[] }> };

      const relevant = modules.modules.filter((m) =>
        files.some((f) =>
          (m.path && (f.startsWith(m.path) || f.startsWith(m.path + '/'))) ||
          (m.owns && m.owns.some((glob) => matchesGlob(f, glob))),
        ),
      );
      return { modules: relevant };
    } catch {
      return {};
    }
  }

  // ── Slot 4: Contracts slice ──────────────────────────────────────────────

  private async getContractsSlice(files: string[]): Promise<Record<string, unknown>> {
    const contractsPath = path.join(this.cwd, NEXUS_FILES.API_CONTRACTS);
    if (!existsSync(contractsPath)) return {};

    try {
      const raw = await readFile(contractsPath, 'utf-8');
      const contracts = JSON.parse(raw) as { contracts: Array<{ id: string; path?: string; file?: string }> };

      const relevant = contracts.contracts.filter((c) => {
        const contractFile = c.file ?? c.path ?? '';
        return files.some(
          (f) => contractFile && (f === contractFile || f.startsWith(path.dirname(contractFile) + '/')),
        );
      });
      return { contracts: relevant };
    } catch {
      return {};
    }
  }

  // ── Slot 5: Dependency symbols ───────────────────────────────────────────
  // Provides exported symbol names from files this task IMPORTS but doesn't own.
  // Workers get the interface without having to read the full file.

  private async getDependencySymbols(files: string[]): Promise<Record<string, string[]>> {
    const symbolsPath = path.join(this.cwd, NEXUS_FILES.SYMBOLS);
    if (!existsSync(symbolsPath)) return {};

    try {
      const raw = await readFile(symbolsPath, 'utf-8');
      const symbolMap = JSON.parse(raw) as { symbols: Array<{ file: string; exports: string[] }> };

      const ownershipPath = path.join(this.cwd, NEXUS_FILES.OWNERSHIP);
      const depFiles = new Set<string>();

      if (existsSync(ownershipPath)) {
        const ownershipRaw = await readFile(ownershipPath, 'utf-8');
        const ownership = JSON.parse(ownershipRaw) as {
          files: Array<{ path: string; imports: string[] }>;
        };
        for (const entry of ownership.files) {
          if (files.includes(entry.path)) {
            for (const imp of entry.imports) depFiles.add(imp);
          }
        }
      }

      // Only return symbols for dependency files, not the task's own files
      const result: Record<string, string[]> = {};
      for (const sym of symbolMap.symbols) {
        if (depFiles.has(sym.file) && !files.includes(sym.file)) {
          result[sym.file] = sym.exports;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  // ── Slot 6: Tests slice ──────────────────────────────────────────────────

  private async getTestsSlice(files: string[]): Promise<string[]> {
    const testMapPath = path.join(this.cwd, NEXUS_FILES.TEST_MAP);
    if (!existsSync(testMapPath)) return [];

    try {
      const raw = await readFile(testMapPath, 'utf-8');
      const testMap = JSON.parse(raw) as { testMap: Array<{ sourceFile: string; testFiles: string[] }> };

      const tests = new Set<string>();
      for (const entry of testMap.testMap) {
        if (files.includes(entry.sourceFile)) {
          for (const t of entry.testFiles) tests.add(t);
        }
      }
      return [...tests];
    } catch {
      return [];
    }
  }

  // ── Slot 7: Scars digest (active prevention rules only) ──────────────────

  private async getScarsDigest(): Promise<string> {
    const scarsPath = path.join(this.cwd, NEXUS_FILES.SCARS_MD);
    if (!existsSync(scarsPath)) return '(no active prevention rules)';

    try {
      const raw = await readFile(scarsPath, 'utf-8');
      // Extract only the "Active Prevention Rules" section
      const match = raw.match(/## Active Prevention Rules[\s\S]*?(?=\n## |\n---|\z)/);
      if (!match) return '(no active prevention rules section found)';

      // Cap at 30 lines — beyond that is noise, not signal
      return match[0].split('\n').slice(0, 30).join('\n');
    } catch {
      return '(could not read SCARS.md)';
    }
  }

  // ── Slot 8: Acceptance criteria for this task ────────────────────────────

  private async getAcceptanceCriteria(task: TaskNode): Promise<string> {
    // Task must have acceptanceCriteria IDs to look up — if not, return empty
    const acIds: string[] = (task as unknown as { acceptanceCriteria?: string[] }).acceptanceCriteria ?? [];
    if (acIds.length === 0) return '(no acceptance criteria linked to this task)';

    const acPath = path.join(this.cwd, 'nexus', '00-mission', 'ACCEPTANCE_MASTER.md');
    if (!existsSync(acPath)) return '(ACCEPTANCE_MASTER.md not found)';

    try {
      const raw = await readFile(acPath, 'utf-8');
      const lines = raw.split('\n');
      const extracted: string[] = [];

      for (const id of acIds) {
        // Find the AC block by ID (e.g. "AC-3" heading or table row)
        const startIdx = lines.findIndex((l) => l.includes(id));
        if (startIdx === -1) continue;
        // Take up to 10 lines per AC (Given/When/Then block)
        extracted.push(...lines.slice(startIdx, startIdx + 10));
        extracted.push('');
      }

      // Cap at 50 lines total
      return extracted.slice(0, 50).join('\n').trim() || '(no matching AC rows found)';
    } catch {
      return '(could not read ACCEPTANCE_MASTER.md)';
    }
  }

  // ── Slot 9: State digest (loop position + decisions) ────────────────────

  private async getStateDigest(): Promise<string> {
    const statePath = path.join(this.cwd, NEXUS_FILES.STATE_MD);
    if (!existsSync(statePath)) return '(no STATE.md yet)';

    try {
      const raw = await readFile(statePath, 'utf-8');
      // 150 lines covers loop position, recent decisions, blockers — not full history
      return raw.split('\n').slice(0, 150).join('\n');
    } catch {
      return '(could not read STATE.md)';
    }
  }

  // ── Slot 10: Boundaries ──────────────────────────────────────────────────

  private async getBoundaries(): Promise<string[]> {
    const settingsPath = path.join(this.cwd, NEXUS_FILES.SETTINGS);
    if (!existsSync(settingsPath)) return [];

    try {
      const raw = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw) as { boundaries?: string[] };
      return settings.boundaries ?? [];
    } catch {
      return [];
    }
  }
}

/** Simple glob matcher for context packet filtering */
function matchesGlob(file: string, glob: string): boolean {
  const regex = new RegExp(
    '^' + glob.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.') + '$',
  );
  return regex.test(file);
}
