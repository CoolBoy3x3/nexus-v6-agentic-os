import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ProjectState, ProjectSettings } from './types.js';
import type { LoopPosition } from './constants.js';
import { NEXUS_STATE_VERSION, NEXUS_FILES } from './constants.js';

export class StateStore {
  constructor(private readonly cwd: string = process.cwd()) {}

  private stateMdPath(): string {
    return path.join(this.cwd, NEXUS_FILES.STATE_MD);
  }

  private stateJsonPath(): string {
    return path.join(this.cwd, NEXUS_FILES.STATE_JSON);
  }

  async readState(): Promise<ProjectState> {
    const jsonPath = this.stateJsonPath();
    if (existsSync(jsonPath)) {
      const raw = await readFile(jsonPath, 'utf-8');
      return JSON.parse(raw) as ProjectState;
    }
    // Bootstrap empty state
    return {
      version: NEXUS_STATE_VERSION,
      mission: '',
      currentPhase: '',
      currentPlan: '',
      loopPosition: 'pre-plan',
      metrics: { phasesComplete: 0, phasesTotal: 0, tasksComplete: 0, tasksTotal: 0, scarsCount: 0 },
      decisions: [],
      blockers: [],
      sessionContinuity: { lastUpdated: new Date().toISOString(), nextAction: 'Run /nexus:init', handoffFile: '' },
    };
  }

  async writeState(state: ProjectState): Promise<void> {
    const jsonPath = this.stateJsonPath();
    await mkdir(path.dirname(jsonPath), { recursive: true });
    // Write machine-readable state
    await writeFile(jsonPath, JSON.stringify(state, null, 2), 'utf-8');
    // Write human-readable STATE.md
    const mdPath = this.stateMdPath();
    await mkdir(path.dirname(mdPath), { recursive: true });
    await writeFile(mdPath, this.generateStateMarkdown(state), 'utf-8');
  }

  async updateLoopPosition(pos: LoopPosition): Promise<void> {
    const state = await this.readState();
    state.loopPosition = pos;
    await this.writeState(state);
  }

  async updateCurrentPhase(phase: string, plan: string): Promise<void> {
    const state = await this.readState();
    state.currentPhase = phase;
    state.currentPlan = plan;
    await this.writeState(state);
  }

  async addDecision(decision: string): Promise<void> {
    const state = await this.readState();
    state.decisions.push(decision);
    // Keep only last 20 in the digest
    if (state.decisions.length > 20) state.decisions = state.decisions.slice(-20);
    await this.writeState(state);
  }

  async addBlocker(blocker: string): Promise<void> {
    const state = await this.readState();
    if (!state.blockers.includes(blocker)) state.blockers.push(blocker);
    await this.writeState(state);
  }

  async clearBlocker(blocker: string): Promise<void> {
    const state = await this.readState();
    state.blockers = state.blockers.filter((b) => b !== blocker);
    await this.writeState(state);
  }

  async updateSessionContinuity(next: string, handoffFile = ''): Promise<void> {
    const state = await this.readState();
    state.sessionContinuity = { lastUpdated: new Date().toISOString(), nextAction: next, handoffFile };
    await this.writeState(state);
  }

  async updateMetrics(partial: Partial<ProjectState['metrics']>): Promise<void> {
    const state = await this.readState();
    state.metrics = { ...state.metrics, ...partial };
    await this.writeState(state);
  }

  private loopVisual(pos: LoopPosition): string {
    const steps: LoopPosition[] = ['planning', 'executing', 'verifying', 'unifying'];
    const labels = ['PLAN', 'EXECUTE', 'VERIFY', 'UNIFY'];
    const marks = steps.map((s, i) => {
      if (s === pos) return `(${labels[i] ?? ''})`;
      const idx = steps.indexOf(pos);
      return idx !== -1 && i < idx ? `✓ ${labels[i] ?? ''}` : `○ ${labels[i] ?? ''}`;
    });
    return `  ${marks.join(' ──▶ ')}`;
  }

  private generateStateMarkdown(state: ProjectState): string {
    const loop = this.loopVisual(state.loopPosition);
    const scarsLine = state.metrics.scarsCount > 0
      ? `⚠ Scars: ${state.metrics.scarsCount} — review SCARS.md for prevention rules`
      : '✓ No scars yet';
    const blockersSection = state.blockers.length > 0
      ? `\n### 🚫 Active Blockers\n${state.blockers.map((b) => `- ${b}`).join('\n')}\n`
      : '';
    const decisionsSection = state.decisions.length > 0
      ? `\n### Key Decisions\n${state.decisions.map((d) => `- ${d}`).join('\n')}\n`
      : '';

    return `# Nexus Project State
> Auto-generated. Do not edit manually — update via /nexus:* commands.
> Source of truth: .nexus/05-runtime/state.json

## Current Position
- **Phase:** ${state.currentPhase || '(not started)'}
- **Plan:** ${state.currentPlan || '(none)'}
- **Mission:** ${state.mission || '(not set)'}

## Loop Position
\`\`\`
════════════════════════════════════════════════════
${loop}
════════════════════════════════════════════════════
\`\`\`

## Progress
- Phases: ${state.metrics.phasesComplete}/${state.metrics.phasesTotal}
- Tasks: ${state.metrics.tasksComplete}/${state.metrics.tasksTotal}
- ${scarsLine}
${blockersSection}${decisionsSection}
## Session Continuity
- **Last Updated:** ${state.sessionContinuity.lastUpdated}
- **Next Action:** ${state.sessionContinuity.nextAction}
- **Handoff File:** ${state.sessionContinuity.handoffFile || '(none)'}

---
*Run \`/nexus:progress\` for the single recommended next action.*
*Run \`/nexus:resume\` to restore full context from last handoff.*
`;
  }
}
