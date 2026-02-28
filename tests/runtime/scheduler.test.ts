import { describe, it, expect, vi, beforeEach } from 'vitest';

// Task and Wave types (matching nexus-runtime domain types)
type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked';

interface Task {
  id: string;
  title: string;
  wave: number;
  dependencies: string[];
  status: TaskStatus;
}

interface Wave {
  waveNumber: number;
  tasks: Task[];
  canRunInParallel: boolean;
}

// Minimal scheduler stub for unit testing wave-based scheduling
class SchedulerStub {
  private tasks: Task[];

  constructor(tasks: Task[]) {
    this.tasks = [...tasks];
  }

  getNextWave(): Wave | null {
    const pendingTasks = this.tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) return null;

    // Find the lowest wave number among pending tasks whose dependencies are all done
    const completedIds = new Set(
      this.tasks.filter(t => t.status === 'done').map(t => t.id)
    );

    const readyTasks = pendingTasks.filter(t =>
      t.dependencies.every(dep => completedIds.has(dep))
    );

    if (readyTasks.length === 0) return null;

    const waveNumber = Math.min(...readyTasks.map(t => t.wave));
    const waveTasks = readyTasks.filter(t => t.wave === waveNumber);

    return {
      waveNumber,
      tasks: waveTasks,
      canRunInParallel: waveTasks.length > 1,
    };
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const taskMap = new Map(this.tasks.map(t => [t.id, t]));

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (taskId: string, path: string[]): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return false;

      for (const dep of task.dependencies) {
        if (!visited.has(dep)) {
          if (dfs(dep, [...path, dep])) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          cycles.push([...path, dep]);
          return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of this.tasks) {
      if (!visited.has(task.id)) {
        dfs(task.id, [task.id]);
      }
    }

    return cycles;
  }

  markDone(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) task.status = 'done';
  }

  markBlocked(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) task.status = 'blocked';
  }
}

describe('Scheduler — getNextWave', () => {
  it('should return wave 1 tasks when no dependencies exist', () => {
    const tasks: Task[] = [
      { id: 'task-001', title: 'Setup types', wave: 1, dependencies: [], status: 'pending' },
      { id: 'task-002', title: 'Setup utils', wave: 1, dependencies: [], status: 'pending' },
      { id: 'task-003', title: 'Implement feature', wave: 2, dependencies: ['task-001', 'task-002'], status: 'pending' },
    ];
    const scheduler = new SchedulerStub(tasks);
    const wave = scheduler.getNextWave();

    expect(wave).not.toBeNull();
    expect(wave!.waveNumber).toBe(1);
    expect(wave!.tasks).toHaveLength(2);
    expect(wave!.canRunInParallel).toBe(true);
  });

  it('should only return wave 2 tasks after wave 1 tasks are done', () => {
    const tasks: Task[] = [
      { id: 'task-001', title: 'Setup types', wave: 1, dependencies: [], status: 'done' },
      { id: 'task-002', title: 'Setup utils', wave: 1, dependencies: [], status: 'done' },
      { id: 'task-003', title: 'Implement feature', wave: 2, dependencies: ['task-001', 'task-002'], status: 'pending' },
    ];
    const scheduler = new SchedulerStub(tasks);
    const wave = scheduler.getNextWave();

    expect(wave).not.toBeNull();
    expect(wave!.waveNumber).toBe(2);
    expect(wave!.tasks).toHaveLength(1);
    expect(wave!.tasks[0].id).toBe('task-003');
  });

  it('should return null when all tasks are done', () => {
    const tasks: Task[] = [
      { id: 'task-001', title: 'Setup types', wave: 1, dependencies: [], status: 'done' },
      { id: 'task-002', title: 'Setup utils', wave: 1, dependencies: [], status: 'done' },
    ];
    const scheduler = new SchedulerStub(tasks);
    const wave = scheduler.getNextWave();
    expect(wave).toBeNull();
  });

  it('should return null when pending tasks have unmet dependencies', () => {
    const tasks: Task[] = [
      { id: 'task-001', title: 'Setup types', wave: 1, dependencies: [], status: 'pending' },
      { id: 'task-002', title: 'Depends on task-001', wave: 2, dependencies: ['task-001'], status: 'pending' },
    ];
    // Mark task-001 as blocked (failed)
    tasks[0].status = 'blocked';
    const scheduler = new SchedulerStub(tasks);
    const wave = scheduler.getNextWave();
    // task-002 can't run because task-001 never became done
    expect(wave).toBeNull();
  });

  it('should mark a task done and then surface its dependents', () => {
    const tasks: Task[] = [
      { id: 'task-001', title: 'Foundation', wave: 1, dependencies: [], status: 'pending' },
      { id: 'task-002', title: 'Feature', wave: 2, dependencies: ['task-001'], status: 'pending' },
    ];
    const scheduler = new SchedulerStub(tasks);

    const wave1 = scheduler.getNextWave();
    expect(wave1!.waveNumber).toBe(1);

    scheduler.markDone('task-001');

    const wave2 = scheduler.getNextWave();
    expect(wave2!.waveNumber).toBe(2);
    expect(wave2!.tasks[0].id).toBe('task-002');
  });
});

describe('Scheduler — deadlock detection', () => {
  it('should detect a direct cycle between two tasks (A depends on B, B depends on A)', () => {
    const tasks: Task[] = [
      { id: 'task-A', title: 'Task A', wave: 1, dependencies: ['task-B'], status: 'pending' },
      { id: 'task-B', title: 'Task B', wave: 1, dependencies: ['task-A'], status: 'pending' },
    ];
    const scheduler = new SchedulerStub(tasks);
    const cycles = scheduler.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect a three-way cycle (A -> B -> C -> A)', () => {
    const tasks: Task[] = [
      { id: 'task-A', title: 'Task A', wave: 1, dependencies: ['task-C'], status: 'pending' },
      { id: 'task-B', title: 'Task B', wave: 2, dependencies: ['task-A'], status: 'pending' },
      { id: 'task-C', title: 'Task C', wave: 3, dependencies: ['task-B'], status: 'pending' },
    ];
    const scheduler = new SchedulerStub(tasks);
    const cycles = scheduler.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should return empty cycles array for a valid acyclic task graph', () => {
    const tasks: Task[] = [
      { id: 'task-001', title: 'Foundation', wave: 1, dependencies: [], status: 'pending' },
      { id: 'task-002', title: 'Feature', wave: 2, dependencies: ['task-001'], status: 'pending' },
      { id: 'task-003', title: 'Test', wave: 3, dependencies: ['task-002'], status: 'pending' },
    ];
    const scheduler = new SchedulerStub(tasks);
    const cycles = scheduler.detectCycles();
    expect(cycles).toHaveLength(0);
  });
});
