import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { TaskNode, ProjectSettings } from '@nexus/core';
import { StateStore, TaskGraphManager, ScarsStore, isAutonomyAllowed, RISK_TIER_CONFIG } from '@nexus/core';
import { CheckpointManager } from './checkpoint-manager.js';
import { Scheduler } from './scheduler.js';
import { WorkerCell } from './worker-cell.js';
import { HeartbeatMonitor } from './heartbeat.js';
import { MergeJudge } from './merge-judge.js';

export interface OrchestratorOptions {
  cwd?: string;
  dryRun?: boolean;
  maxConcurrent?: number;
}

/** Maximum gap-closure iterations before escalating to human */
export const MAX_GAP_CLOSURE_ITERATIONS = 3;

/**
 * Orchestrator: manages the PLAN→EXECUTE→VERIFY→UNIFY loop.
 * Synthesized from Antigravity orchestrator.py lifecycle + PAUL loop governance.
 *
 * Key principle: orchestrator coordinates, never touches code directly.
 */
export class Orchestrator {
  private readonly stateStore: StateStore;
  private readonly graphManager: TaskGraphManager;
  private readonly checkpointManager: CheckpointManager;
  private readonly scheduler: Scheduler;
  private readonly workerCell: WorkerCell;
  private readonly heartbeat: HeartbeatMonitor;
  private readonly scarsStore: ScarsStore;
  private readonly mergeJudge: MergeJudge;
  private readonly cwd: string;

  constructor(options: OrchestratorOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.stateStore = new StateStore(this.cwd);
    this.graphManager = new TaskGraphManager(this.cwd);
    this.checkpointManager = new CheckpointManager(this.cwd);
    this.scheduler = new Scheduler(this.graphManager);
    this.workerCell = new WorkerCell(this.cwd);
    this.heartbeat = new HeartbeatMonitor('orchestrator', this.cwd);
    this.scarsStore = new ScarsStore(this.cwd);
    this.mergeJudge = new MergeJudge();
  }

  async executePhase(settings: ProjectSettings): Promise<void> {
    await this.stateStore.updateLoopPosition('executing');
    await this.heartbeat.beat('running', undefined, 'Starting phase execution');

    let waveSchedule = await this.scheduler.getNextWave();

    while (waveSchedule !== null) {
      console.log(`\n[Orchestrator] Executing wave ${waveSchedule.wave} (${waveSchedule.tasks.length} tasks)`);

      // Check if any tasks need checkpoint first
      const criticalTasks = waveSchedule.tasks.filter(
        (t) => RISK_TIER_CONFIG[t.riskTier].requiresCheckpoint,
      );

      if (criticalTasks.length > 0) {
        console.log(`[Orchestrator] Creating checkpoint before ${criticalTasks.length} high-risk tasks...`);
        await this.checkpointManager.create(
          waveSchedule.tasks.map((t) => t.id).join(','),
          `Pre-wave-${waveSchedule.wave} checkpoint`,
        );
      }

      // Execute tasks in this wave, capped at maxParallelWorkers (default 5)
      const maxConcurrent = settings.pipeline?.maxParallelWorkers ?? 5;
      const results = await this.runCapped(
        waveSchedule.tasks,
        (task) => this.executeTask(task, settings),
        maxConcurrent,
      );

      // Process results
      const completedIds: string[] = [];
      for (const result of results) {
        if (result.status === 'completed') {
          await this.stateStore.updateMetrics({ tasksComplete: 0 }); // increments on save
          completedIds.push(result.taskId);
        } else if (result.status === 'blocked') {
          await this.stateStore.addBlocker(result.blockerMessage ?? `Task ${result.taskId} blocked`);
          console.error(`[Orchestrator] Task ${result.taskId} blocked: ${result.blockerMessage}`);
        }
      }

      if (completedIds.length > 0) {
        await this.scheduler.markWaveComplete(completedIds);
      }

      // Get next wave
      waveSchedule = await this.scheduler.getNextWave();
    }

    await this.stateStore.updateLoopPosition('verifying');
    await this.heartbeat.beat('idle', undefined, 'Phase execution complete, ready for verify');
  }

  /**
   * Read the current gap-closure iteration count from the phase state file.
   * Returns 0 if no state exists yet.
   */
  async getGapClosureCount(phaseDir: string): Promise<number> {
    const statePath = path.join(this.cwd, phaseDir, 'gap-closure-state.json');
    if (!existsSync(statePath)) return 0;
    try {
      const raw = await readFile(statePath, 'utf-8');
      const obj = JSON.parse(raw) as { iterations?: number };
      return typeof obj.iterations === 'number' ? obj.iterations : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Increment and persist the gap-closure iteration counter.
   * Throws if the count reaches MAX_GAP_CLOSURE_ITERATIONS — caller must escalate.
   */
  async bumpGapClosureCount(phaseDir: string): Promise<number> {
    const count = (await this.getGapClosureCount(phaseDir)) + 1;
    const statePath = path.join(this.cwd, phaseDir, 'gap-closure-state.json');
    await writeFile(statePath, JSON.stringify({ iterations: count, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    if (count >= MAX_GAP_CLOSURE_ITERATIONS) {
      throw new Error(
        `Gap-closure loop limit reached (${MAX_GAP_CLOSURE_ITERATIONS} iterations). ` +
        `The same verification gaps keep recurring. Human review required. ` +
        `Check .nexus/01-governance/SCARS.md and .nexus/04-phases/${phaseDir}/verification-report.json for root cause.`
      );
    }
    return count;
  }

  private async runCapped<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    maxConcurrent: number,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += maxConcurrent) {
      const batch = items.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  private async executeTask(task: TaskNode, settings: ProjectSettings): Promise<{
    taskId: string;
    status: 'completed' | 'failed' | 'blocked';
    blockerMessage?: string;
  }> {
    // Check autonomy
    if (!isAutonomyAllowed(task, settings)) {
      return {
        taskId: task.id,
        status: 'blocked',
        blockerMessage: `Task requires human approval (risk: ${task.riskTier}, autonomy: ${task.autonomyLevel})`,
      };
    }

    await this.heartbeat.beat('running', task.id, `Executing task: ${task.description}`);

    // Capture HEAD before execution so physicality verifier can diff against the correct ref
    try {
      const { execSync } = await import('child_process');
      task.startCommit = execSync('git rev-parse HEAD', { cwd: this.cwd, stdio: 'pipe' }).toString().trim();
    } catch {
      // Not a git repo or git unavailable — physicality will fall back to HEAD
    }

    try {
      const result = await this.workerCell.execute(task);
      return { taskId: task.id, status: result.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Task ${task.id} failed: ${message}`);
      return { taskId: task.id, status: 'failed', blockerMessage: message };
    }
  }
}
