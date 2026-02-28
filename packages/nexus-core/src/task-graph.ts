import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { TaskNode, TaskGraph, VerificationResult, Scar } from './types.js';
import { NEXUS_FILES, NEXUS_STATE_VERSION } from './constants.js';

export class TaskGraphManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  private graphPath(): string {
    return path.join(this.cwd, NEXUS_FILES.TASK_GRAPH);
  }

  async load(): Promise<TaskGraph> {
    const p = this.graphPath();
    if (!existsSync(p)) {
      return { version: NEXUS_STATE_VERSION, mission: '', currentPhase: '', tasks: [], waves: {}, lastUpdated: new Date().toISOString() };
    }
    const raw = await readFile(p, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TaskGraph>;
    // Normalize: guard against empty/partial files (e.g. `{}`)
    return {
      version: parsed.version ?? NEXUS_STATE_VERSION,
      mission: parsed.mission ?? '',
      currentPhase: parsed.currentPhase ?? '',
      tasks: parsed.tasks ?? [],
      waves: parsed.waves ?? {},
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
    };
  }

  async save(graph: TaskGraph): Promise<void> {
    const p = this.graphPath();
    await mkdir(path.dirname(p), { recursive: true });
    graph.lastUpdated = new Date().toISOString();
    await writeFile(p, JSON.stringify(graph, null, 2), 'utf-8');
  }

  /**
   * Mutation methods below modify the graph IN MEMORY only.
   * Callers MUST call save(graph) after all mutations are applied.
   * Pattern: const graph = await load(); markCompleted(graph, id, r); await save(graph);
   */

  addNode(graph: TaskGraph, node: TaskNode): TaskGraph {
    graph.tasks.push(node);
    const waveKey = String(node.wave);
    if (!graph.waves[waveKey]) graph.waves[waveKey] = [];
    graph.waves[waveKey]!.push(node.id);
    return graph;
  }

  private updateTask(graph: TaskGraph, id: string, patch: Partial<TaskNode>): TaskGraph {
    const idx = graph.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Task not found: ${id}`);
    graph.tasks[idx] = { ...graph.tasks[idx]!, ...patch };
    return graph;
  }

  markRunning(graph: TaskGraph, id: string, worktreeRef: string): TaskGraph {
    return this.updateTask(graph, id, { status: 'running', worktreeRef, startedAt: new Date().toISOString() });
  }

  markCompleted(graph: TaskGraph, id: string, result: VerificationResult): TaskGraph {
    return this.updateTask(graph, id, { status: 'completed', verificationResult: result, completedAt: new Date().toISOString() });
  }

  markFailed(graph: TaskGraph, id: string, scar: Scar): TaskGraph {
    return this.updateTask(graph, id, { status: 'failed', scar, completedAt: new Date().toISOString() });
  }

  markBlocked(graph: TaskGraph, id: string, _reason: string): TaskGraph {
    return this.updateTask(graph, id, { status: 'blocked' });
  }

  supersede(graph: TaskGraph, id: string, replacementId: string): TaskGraph {
    graph = this.updateTask(graph, id, { status: 'superseded' });
    // Link replacement
    const replacement = graph.tasks.find((t) => t.id === replacementId);
    if (replacement) {
      replacement.dependsOn = [...new Set([...replacement.dependsOn, id])];
    }
    return graph;
  }

  attachRollbackAnchor(graph: TaskGraph, id: string, checkpointId: string): TaskGraph {
    return this.updateTask(graph, id, { rollbackAnchor: checkpointId });
  }

  getReadyNodes(graph: TaskGraph): TaskNode[] {
    const completed = new Set(graph.tasks.filter((t) => t.status === 'completed').map((t) => t.id));
    return graph.tasks.filter(
      (t) => t.status === 'pending' && t.dependsOn.every((dep) => completed.has(dep)),
    );
  }

  getWave(graph: TaskGraph, waveNum: number): TaskNode[] {
    const ids = new Set(graph.waves[String(waveNum)] ?? []);
    return graph.tasks.filter((t) => ids.has(t.id));
  }

  detectDeadlock(graph: TaskGraph): string[] {
    // Simple cycle detection via DFS
    const pending = graph.tasks.filter((t) => t.status === 'pending' || t.status === 'blocked');
    const pendingIds = new Set(pending.map((t) => t.id));
    const deadlocked: string[] = [];

    for (const task of pending) {
      // A task is deadlocked if all its deps are either failed/blocked/pending with no ready path
      const allDepsBlocked = task.dependsOn.every((dep) => {
        const depTask = graph.tasks.find((t) => t.id === dep);
        return depTask && (depTask.status === 'failed' || depTask.status === 'blocked' || pendingIds.has(dep));
      });
      if (allDepsBlocked && task.dependsOn.length > 0) deadlocked.push(task.id);
    }
    return deadlocked;
  }

  getSummary(graph: TaskGraph): { pending: number; running: number; completed: number; failed: number; blocked: number } {
    const counts = { pending: 0, running: 0, completed: 0, failed: 0, blocked: 0 };
    for (const t of graph.tasks) {
      if (t.status in counts) (counts as Record<string, number>)[t.status]!++;
    }
    return counts;
  }
}
