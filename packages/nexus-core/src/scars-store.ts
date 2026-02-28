import { readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Scar } from './types.js';
import type { ScarCategory } from './constants.js';
import { NEXUS_FILES } from './constants.js';

export class ScarsStore {
  constructor(private readonly cwd: string = process.cwd()) {}

  private mdPath(): string { return path.join(this.cwd, NEXUS_FILES.SCARS_MD); }
  private jsonlPath(): string { return path.join(this.cwd, NEXUS_FILES.SCARS_JSONL); }

  async appendScar(scar: Scar): Promise<void> {
    await mkdir(path.dirname(this.mdPath()), { recursive: true });
    await mkdir(path.dirname(this.jsonlPath()), { recursive: true });

    // Append to SCARS.md
    const row = `| ${scar.id} | ${scar.timestamp.slice(0, 10)} | ${scar.category} | ${scar.description} | ${scar.rootCause} | ${scar.resolution} | ${scar.preventionRule} |\n`;

    if (!existsSync(this.mdPath())) {
      const header = `# Scars Register\n> Every failure that taught us something. Scars are not shameful — they are guardrails.\n\n## Active Prevention Rules\n| Rule | Source Scar | Applied Since |\n|------|-------------|---------------|\n\n## Scar Log\n| ID | Date | Category | Description | Root Cause | Resolution | Prevention Rule |\n|----|------|----------|-------------|------------|------------|------------------|\n`;
      await writeFile(this.mdPath(), header + row, 'utf-8');
    } else {
      await appendFile(this.mdPath(), row, 'utf-8');
      // Also update the Active Prevention Rules section
      await this.rebuildPreventionRulesSection();
    }

    // Append to scars.jsonl (append-only — Antigravity audit pattern)
    await appendFile(this.jsonlPath(), JSON.stringify(scar) + '\n', 'utf-8');
  }

  async readAll(): Promise<Scar[]> {
    if (!existsSync(this.jsonlPath())) return [];
    const raw = await readFile(this.jsonlPath(), 'utf-8');
    return raw.split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as Scar]; }
      catch { return []; }
    });
  }

  async readByCategory(category: ScarCategory): Promise<Scar[]> {
    return (await this.readAll()).filter((s) => s.category === category);
  }

  async extractPreventionRules(): Promise<string[]> {
    const scars = await this.readAll();
    const rules = scars.map((s) => s.preventionRule).filter(Boolean);
    return [...new Set(rules)]; // deduplicate
  }

  /**
   * Consolidate scars by category: keep only the most recent scar per category
   * in the Active Prevention Rules section.  Does NOT delete historical scar rows —
   * only collapses the rules table so it stays actionable as the project grows.
   *
   * Call during /nexus:unify to keep SCARS.md readable long-term.
   */
  async consolidateByCategory(): Promise<void> {
    const scars = await this.readAll();
    if (scars.length === 0) return;

    // For each category keep only the newest scar's prevention rule
    const latestByCategory = new Map<string, Scar>();
    for (const scar of scars) {
      const existing = latestByCategory.get(scar.category);
      if (!existing || scar.timestamp > existing.timestamp) {
        latestByCategory.set(scar.category, scar);
      }
    }

    // Rebuild prevention rules section using consolidated set
    if (!existsSync(this.mdPath())) return;
    const current = await readFile(this.mdPath(), 'utf-8');

    const consolidated = [...latestByCategory.values()];
    const rulesTable =
      `## Active Prevention Rules\n| Rule | Source Scar | Applied Since |\n|------|-------------|---------------|\n` +
      consolidated
        .map((s) => `| ${s.preventionRule} | ${s.id} (${s.category}) | ${s.timestamp.slice(0, 10)} |`)
        .join('\n') + '\n\n';

    const updated = current.replace(
      /## Active Prevention Rules[\s\S]*?(?=## Scar Log)/,
      rulesTable,
    );
    await writeFile(this.mdPath(), updated, 'utf-8');
  }

  private async rebuildPreventionRulesSection(): Promise<void> {
    const scars = await this.readAll();
    const rules = scars.map((s) => ({ rule: s.preventionRule, id: s.id, date: s.timestamp.slice(0, 10) }));
    const unique = [...new Map(rules.map((r) => [r.rule, r])).values()];

    if (!existsSync(this.mdPath())) return;
    const current = await readFile(this.mdPath(), 'utf-8');

    const rulesTable = `## Active Prevention Rules\n| Rule | Source Scar | Applied Since |\n|------|-------------|---------------|\n` +
      unique.map((r) => `| ${r.rule} | ${r.id} | ${r.date} |`).join('\n') + '\n\n';

    // Replace the prevention rules section
    const updated = current.replace(
      /## Active Prevention Rules[\s\S]*?(?=## Scar Log)/,
      rulesTable,
    );
    await writeFile(this.mdPath(), updated, 'utf-8');
  }
}
