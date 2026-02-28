import { readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Decision } from './types.js';
import { NEXUS_FILES } from './constants.js';

export class DecisionLog {
  constructor(private readonly cwd: string = process.cwd()) {}

  private mdPath(): string { return path.join(this.cwd, NEXUS_FILES.DECISION_LOG_MD); }
  private jsonlPath(): string { return path.join(this.cwd, NEXUS_FILES.DECISIONS_JSONL); }

  async append(decision: Decision): Promise<void> {
    // Ensure directories
    await mkdir(path.dirname(this.mdPath()), { recursive: true });
    await mkdir(path.dirname(this.jsonlPath()), { recursive: true });

    // Append to DECISION_LOG.md as a table row
    const rev = decision.reversible ? '[R]' : '[I]';
    const row = `| ${decision.id} | ${decision.timestamp.slice(0, 10)} | ${decision.phase} | ${decision.description} | ${decision.rationale} | ${decision.impact} | ${rev} |\n`;

    if (!existsSync(this.mdPath())) {
      const header = `# Decision Log\n\n## Reversibility Legend\n- [R] Reversible\n- [I] Irreversible\n\n## Log\n| ID | Date | Phase | Decision | Rationale | Impact | Reversible |\n|----|------|-------|----------|-----------|--------|------------|\n`;
      await writeFile(this.mdPath(), header + row, 'utf-8');
    } else {
      await appendFile(this.mdPath(), row, 'utf-8');
    }

    // Append to decisions.jsonl (append-only audit trail — from Antigravity audit.py pattern)
    await appendFile(this.jsonlPath(), JSON.stringify(decision) + '\n', 'utf-8');
  }

  async readAll(): Promise<Decision[]> {
    if (!existsSync(this.jsonlPath())) return [];
    const raw = await readFile(this.jsonlPath(), 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try { return [JSON.parse(line) as Decision]; }
        catch { return []; }
      });
  }

  async readForPhase(phase: string): Promise<Decision[]> {
    const all = await this.readAll();
    return all.filter((d) => d.phase === phase);
  }
}
