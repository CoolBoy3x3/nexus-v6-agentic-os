import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  taskId: string;
  createdAt: string;
}

export class WorktreeManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  async create(taskId: string): Promise<WorktreeInfo> {
    const sanitized = taskId.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 30);
    const branch = `nexus-task-${sanitized}-${Date.now()}`;
    const worktreePath = path.join(this.cwd, `.nexus/worktrees/${branch}`);

    await mkdir(path.dirname(worktreePath), { recursive: true });

    // Safety: check we're in a git repo
    try {
      execSync('git rev-parse --git-dir', { cwd: this.cwd, stdio: 'pipe' });
    } catch {
      throw new Error('WorktreeManager: not in a git repository');
    }

    // Safety: verify .nexus/worktrees is in .gitignore before creating
    try {
      execSync('git check-ignore -q .nexus/worktrees', { cwd: this.cwd, stdio: 'pipe' });
    } catch {
      throw new Error(
        'WorktreeManager: .nexus/worktrees is not in .gitignore — add ".nexus/" or ".nexus/worktrees/" to .gitignore and commit before creating worktrees'
      );
    }

    execSync(`git worktree add ${worktreePath} -b ${branch}`, {
      cwd: this.cwd,
      stdio: 'pipe',
    });

    return {
      path: worktreePath,
      branch,
      taskId,
      createdAt: new Date().toISOString(),
    };
  }

  async cleanup(worktreeInfo: WorktreeInfo): Promise<void> {
    try {
      execSync(`git worktree remove ${worktreeInfo.path} --force`, {
        cwd: this.cwd,
        stdio: 'pipe',
      });
      execSync(`git branch -D ${worktreeInfo.branch}`, {
        cwd: this.cwd,
        stdio: 'pipe',
      });
    } catch {}
  }

  async cleanupAll(): Promise<void> {
    try {
      execSync('git worktree prune', { cwd: this.cwd, stdio: 'pipe' });
    } catch {}
  }
}
