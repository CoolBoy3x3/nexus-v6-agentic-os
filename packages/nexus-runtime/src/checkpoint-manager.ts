import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { Checkpoint } from '@nexus/core';
import { NEXUS_DIRS } from '@nexus/core';

export class CheckpointManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  private checkpointDir(): string {
    return path.join(this.cwd, NEXUS_DIRS.CHECKPOINTS);
  }

  async create(taskId: string, description: string, filesToStage?: string[]): Promise<Checkpoint> {
    // Collision-safe ID: timestamp + 4 random hex chars + task prefix
    const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    const id = `cp-${Date.now()}-${rand}-${taskId.slice(0, 8)}`;

    // Create a WIP git commit if we're in a git repo.
    // Only stage the declared task files (not git add -A) to avoid accidentally
    // committing unrelated in-progress changes from concurrent tasks.
    let gitRef = 'no-git';
    try {
      if (filesToStage && filesToStage.length > 0) {
        // Stage only the declared files
        execSync(`git add -- ${filesToStage.map((f) => `"${f}"`).join(' ')}`, {
          cwd: this.cwd,
          stdio: 'pipe',
        });
      } else {
        // No specific files: stage all tracked modifications (no new untracked files)
        execSync('git add -u', { cwd: this.cwd, stdio: 'pipe' });
      }
      execSync(`git commit -m "nexus-checkpoint: ${description}" --allow-empty`, {
        cwd: this.cwd,
        stdio: 'pipe',
      });
      gitRef = execSync('git rev-parse HEAD', { cwd: this.cwd }).toString().trim();
    } catch {}

    // Snapshot .nexus/ state (just record key files' content hashes)
    const snapshot = await this.captureStateSnapshot();

    const checkpoint: Checkpoint = {
      id,
      taskId,
      timestamp: new Date().toISOString(),
      gitRef,
      nexusStateSnapshot: snapshot,
      description,
    };

    await mkdir(this.checkpointDir(), { recursive: true });
    await writeFile(
      path.join(this.checkpointDir(), `${id}.json`),
      JSON.stringify(checkpoint, null, 2),
      'utf-8',
    );

    return checkpoint;
  }

  async list(): Promise<Checkpoint[]> {
    const dir = this.checkpointDir();
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    const checkpoints: Checkpoint[] = [];
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      try {
        const raw = await readFile(path.join(dir, f), 'utf-8');
        checkpoints.push(JSON.parse(raw) as Checkpoint);
      } catch {}
    }
    return checkpoints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async get(id: string): Promise<Checkpoint | null> {
    const p = path.join(this.checkpointDir(), `${id}.json`);
    if (!existsSync(p)) return null;
    const raw = await readFile(p, 'utf-8');
    return JSON.parse(raw) as Checkpoint;
  }

  async prune(maxRetained: number = 10): Promise<void> {
    const checkpoints = await this.list();
    if (checkpoints.length <= maxRetained) return;
    const toDelete = checkpoints.slice(0, checkpoints.length - maxRetained);
    for (const cp of toDelete) {
      try {
        await rm(path.join(this.checkpointDir(), `${cp.id}.json`));
      } catch {}
    }
  }

  private async captureStateSnapshot(): Promise<string> {
    // Capture a digest of key .nexus/ state files
    const files = ['.nexus/05-runtime/state.json', '.nexus/05-runtime/TASK_GRAPH.json'];
    const parts: string[] = [];
    for (const f of files) {
      const p = path.join(this.cwd, f);
      if (existsSync(p)) {
        try {
          const content = await readFile(p, 'utf-8');
          parts.push(`=== ${f} ===\n${content.slice(0, 500)}`);
        } catch {}
      }
    }
    return parts.join('\n\n');
  }
}
