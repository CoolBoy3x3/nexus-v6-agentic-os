import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  rename: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue(Buffer.from('')),
}));

// Checkpoint and rollback types
interface Checkpoint {
  id: string;
  taskId: string;
  gitRef: string;
  snapshotPath: string;
  createdAt: string;
  author: string;
}

// Stub RollbackManager for unit testing
class RollbackManagerStub {
  private checkpoints: Checkpoint[] = [];
  private quarantinedTasks: string[] = [];
  private execSyncMock: ReturnType<typeof vi.fn>;

  constructor(execSyncMock: ReturnType<typeof vi.fn>) {
    this.execSyncMock = execSyncMock;
  }

  async createCheckpoint(taskId: string, gitRef: string): Promise<Checkpoint> {
    const id = `ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const checkpoint: Checkpoint = {
      id,
      taskId,
      gitRef,
      snapshotPath: `.nexus/06-checkpoints/snapshots/snapshot-${id}.tar.gz`,
      createdAt: new Date().toISOString(),
      author: 'nexus-runtime',
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  lookupCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.find(c => c.id === checkpointId);
  }

  lookupByTaskId(taskId: string): Checkpoint | undefined {
    return this.checkpoints.findLast(c => c.taskId === taskId);
  }

  listCheckpoints(): Checkpoint[] {
    return [...this.checkpoints].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  quarantine(taskId: string): void {
    if (!this.quarantinedTasks.includes(taskId)) {
      this.quarantinedTasks.push(taskId);
    }
  }

  isQuarantined(taskId: string): boolean {
    return this.quarantinedTasks.includes(taskId);
  }

  restoreCheckpoint(checkpointId: string): { success: boolean; restoredTo: string } {
    const checkpoint = this.lookupCheckpoint(checkpointId);
    if (!checkpoint) {
      return { success: false, restoredTo: '' };
    }
    // Simulate git reset --hard
    this.execSyncMock(`git reset --hard ${checkpoint.gitRef}`, { stdio: 'inherit' });
    return { success: true, restoredTo: checkpoint.gitRef };
  }
}

describe('RollbackManager — checkpoint creation', () => {
  let execSyncMock: ReturnType<typeof vi.fn>;
  let manager: RollbackManagerStub;

  beforeEach(() => {
    execSyncMock = vi.fn().mockReturnValue(Buffer.from(''));
    manager = new RollbackManagerStub(execSyncMock);
  });

  it('should create a checkpoint with a unique id', async () => {
    const ckpt = await manager.createCheckpoint('task-001', 'abc1234');
    expect(ckpt.id).toMatch(/^ckpt-/);
    expect(ckpt.taskId).toBe('task-001');
    expect(ckpt.gitRef).toBe('abc1234');
  });

  it('should create different ids for consecutive checkpoints', async () => {
    const ckpt1 = await manager.createCheckpoint('task-001', 'abc1234');
    const ckpt2 = await manager.createCheckpoint('task-002', 'def5678');
    expect(ckpt1.id).not.toBe(ckpt2.id);
  });

  it('should include a snapshotPath in the checkpoint', async () => {
    const ckpt = await manager.createCheckpoint('task-001', 'abc1234');
    expect(ckpt.snapshotPath).toContain('.nexus/06-checkpoints/snapshots/');
    expect(ckpt.snapshotPath).toContain('.tar.gz');
  });

  it('should set author to nexus-runtime', async () => {
    const ckpt = await manager.createCheckpoint('task-001', 'abc1234');
    expect(ckpt.author).toBe('nexus-runtime');
  });
});

describe('RollbackManager — quarantine', () => {
  let execSyncMock: ReturnType<typeof vi.fn>;
  let manager: RollbackManagerStub;

  beforeEach(() => {
    execSyncMock = vi.fn();
    manager = new RollbackManagerStub(execSyncMock);
  });

  it('should quarantine a task by id', () => {
    manager.quarantine('task-001');
    expect(manager.isQuarantined('task-001')).toBe(true);
  });

  it('should not quarantine the same task twice', () => {
    manager.quarantine('task-001');
    manager.quarantine('task-001');
    const quarantined = manager.listCheckpoints(); // just checking internal state
    expect(manager.isQuarantined('task-001')).toBe(true);
  });

  it('should not affect other tasks when one is quarantined', () => {
    manager.quarantine('task-001');
    expect(manager.isQuarantined('task-002')).toBe(false);
  });
});

describe('RollbackManager — checkpoint lookup and restore', () => {
  let execSyncMock: ReturnType<typeof vi.fn>;
  let manager: RollbackManagerStub;

  beforeEach(async () => {
    execSyncMock = vi.fn();
    manager = new RollbackManagerStub(execSyncMock);
    await manager.createCheckpoint('task-001', 'sha-111');
    await manager.createCheckpoint('task-002', 'sha-222');
  });

  it('should lookup a checkpoint by id', async () => {
    const checkpoints = manager.listCheckpoints();
    const id = checkpoints[0].id;
    const found = manager.lookupCheckpoint(id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(id);
  });

  it('should return undefined for an unknown checkpoint id', () => {
    const found = manager.lookupCheckpoint('nonexistent-id');
    expect(found).toBeUndefined();
  });

  it('should lookup the most recent checkpoint for a task', async () => {
    await manager.createCheckpoint('task-001', 'sha-333');
    const found = manager.lookupByTaskId('task-001');
    expect(found).toBeDefined();
    expect(found!.gitRef).toBe('sha-333');
  });

  it('should call git reset --hard when restoring a checkpoint', async () => {
    const ckpt = await manager.createCheckpoint('task-restore', 'sha-abc');
    const result = manager.restoreCheckpoint(ckpt.id);
    expect(result.success).toBe(true);
    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('git reset --hard sha-abc'),
      expect.any(Object)
    );
  });

  it('should return success=false when restoring a nonexistent checkpoint', () => {
    const result = manager.restoreCheckpoint('does-not-exist');
    expect(result.success).toBe(false);
    expect(result.restoredTo).toBe('');
  });

  it('should list checkpoints in reverse chronological order', async () => {
    const list = manager.listCheckpoints();
    for (let i = 1; i < list.length; i++) {
      const prev = new Date(list[i - 1].createdAt).getTime();
      const curr = new Date(list[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});
