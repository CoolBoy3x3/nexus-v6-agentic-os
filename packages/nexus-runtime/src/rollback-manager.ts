import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import type { Checkpoint } from '@nexus/core';
import { CheckpointManager } from './checkpoint-manager.js';

export interface RollbackResult {
  success: boolean;
  checkpointId: string;
  gitRef: string;
  message: string;
  quarantinePath?: string;
}

export class RollbackManager {
  private readonly checkpointManager: CheckpointManager;

  constructor(private readonly cwd: string = process.cwd()) {
    this.checkpointManager = new CheckpointManager(cwd);
  }

  async rollback(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = await this.checkpointManager.get(checkpointId);
    if (!checkpoint) {
      return { success: false, checkpointId, gitRef: '', message: `Checkpoint ${checkpointId} not found` };
    }

    // Quarantine current changes before rollback
    const quarantinePath = await this.quarantineCurrentChanges(checkpointId);

    try {
      if (checkpoint.gitRef !== 'no-git') {
        execSync(`git reset --hard ${checkpoint.gitRef}`, { cwd: this.cwd, stdio: 'pipe' });
      }

      const result: RollbackResult = {
        success: true,
        checkpointId,
        gitRef: checkpoint.gitRef,
        message: `Rolled back to checkpoint ${checkpointId}: ${checkpoint.description}`,
      };
      if (quarantinePath !== undefined) result.quarantinePath = quarantinePath;
      return result;
    } catch (err) {
      const result: RollbackResult = {
        success: false,
        checkpointId,
        gitRef: checkpoint.gitRef,
        message: `Rollback failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      if (quarantinePath !== undefined) result.quarantinePath = quarantinePath;
      return result;
    }
  }

  private async quarantineCurrentChanges(checkpointId: string): Promise<string | undefined> {
    const quarantineDir = path.join(this.cwd, '.nexus/06-checkpoints/quarantine');
    await mkdir(quarantineDir, { recursive: true });

    try {
      // Get current diff
      const diff = execSync('git diff HEAD', { cwd: this.cwd }).toString();
      if (diff.trim()) {
        const quarantinePath = path.join(quarantineDir, `pre-rollback-${checkpointId}-${Date.now()}.patch`);
        await writeFile(quarantinePath, diff, 'utf-8');
        return quarantinePath;
      }
    } catch {}
    return undefined;
  }
}
