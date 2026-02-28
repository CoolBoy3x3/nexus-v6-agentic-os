import type { TaskNode } from '@nexus/core';
import { TaskGraphManager } from '@nexus/core';

export interface WaveSchedule {
  wave: number;
  tasks: TaskNode[];
}

export class Scheduler {
  constructor(private readonly graphManager: TaskGraphManager) {}

  async getNextWave(): Promise<WaveSchedule | null> {
    const graph = await this.graphManager.load();
    const readyNodes = this.graphManager.getReadyNodes(graph);

    if (readyNodes.length === 0) {
      const pending = graph.tasks.filter((t) => t.status === 'pending' || t.status === 'blocked');
      if (pending.length === 0) return null; // All done

      const deadlocked = this.graphManager.detectDeadlock(graph);
      if (deadlocked.length > 0) {
        throw new Error(`Deadlock detected in tasks: ${deadlocked.join(', ')}`);
      }

      return null;
    }

    const waveNum = readyNodes[0]!.wave;
    const waveTasks = readyNodes.filter((t) => t.wave === waveNum);

    return { wave: waveNum, tasks: waveTasks };
  }

  /**
   * Mark tasks as worker-complete in the task graph.
   * Note: verification flags are all false — this is a placeholder until the
   * VERIFY phase runs and updates the graph with real VerificationResult data.
   */
  async markWaveComplete(taskIds: string[]): Promise<void> {
    const graph = await this.graphManager.load();
    const timestamp = new Date().toISOString();
    for (const id of taskIds) {
      this.graphManager.markCompleted(graph, id, {
        taskId: id,
        timestamp,
        status: 'passed',
        score: 'worker-complete/awaiting-verify',
        physicalityOk: false,
        deterministicOk: false,
        goalBackwardOk: false,
        adversarialOk: false,
        systemValidationOk: false,
        playwrightOk: false,
        gaps: [],
        humanItems: [],
        artifacts: [],
      });
    }
    await this.graphManager.save(graph);
  }
}
