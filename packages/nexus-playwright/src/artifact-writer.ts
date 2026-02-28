import { writeFile, readFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_DIRS } from '@nexus/core';

export interface ArtifactMetadata {
  taskId: string;
  type: 'screenshot' | 'trace' | 'video' | 'log' | 'bug-repro';
  filename: string;
  path: string;
  capturedAt: string;
  url?: string;
  description?: string;
  flowName?: string;
}

export interface ArtifactIndex {
  taskId: string;
  artifacts: ArtifactMetadata[];
  updatedAt: string;
}

export class ArtifactWriter {
  constructor(private readonly cwd: string = process.cwd()) {}

  private artifactsDir(taskId: string): string {
    return path.join(this.cwd, NEXUS_DIRS.ARTIFACTS, taskId);
  }

  private indexPath(taskId: string): string {
    return path.join(this.artifactsDir(taskId), 'index.json');
  }

  async writeScreenshot(
    taskId: string,
    screenshotData: Buffer | string,
    filename: string,
    meta: Partial<ArtifactMetadata> = {},
  ): Promise<ArtifactMetadata> {
    const dir = this.artifactsDir(taskId);
    await mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await writeFile(filepath, screenshotData);

    const artifact: ArtifactMetadata = {
      taskId,
      type: 'screenshot',
      filename,
      path: filepath,
      capturedAt: new Date().toISOString(),
      ...meta,
    };
    await this.appendToIndex(taskId, artifact);
    return artifact;
  }

  async writeTrace(
    taskId: string,
    sourcePath: string,
    filename: string,
    meta: Partial<ArtifactMetadata> = {},
  ): Promise<ArtifactMetadata> {
    const dir = this.artifactsDir(taskId);
    await mkdir(dir, { recursive: true });
    const destPath = path.join(dir, filename);

    if (existsSync(sourcePath)) {
      await copyFile(sourcePath, destPath);
    }

    const artifact: ArtifactMetadata = {
      taskId,
      type: 'trace',
      filename,
      path: destPath,
      capturedAt: new Date().toISOString(),
      ...meta,
    };
    await this.appendToIndex(taskId, artifact);
    return artifact;
  }

  async writeLog(taskId: string, content: string, filename: string): Promise<ArtifactMetadata> {
    const dir = this.artifactsDir(taskId);
    await mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await writeFile(filepath, content, 'utf-8');

    const artifact: ArtifactMetadata = {
      taskId,
      type: 'log',
      filename,
      path: filepath,
      capturedAt: new Date().toISOString(),
    };
    await this.appendToIndex(taskId, artifact);
    return artifact;
  }

  async getIndex(taskId: string): Promise<ArtifactIndex> {
    const indexPath = this.indexPath(taskId);
    if (!existsSync(indexPath)) return { taskId, artifacts: [], updatedAt: new Date().toISOString() };
    const raw = await readFile(indexPath, 'utf-8');
    return JSON.parse(raw) as ArtifactIndex;
  }

  private async appendToIndex(taskId: string, artifact: ArtifactMetadata): Promise<void> {
    const indexPath = this.indexPath(taskId);
    let index: ArtifactIndex = { taskId, artifacts: [], updatedAt: '' };
    if (existsSync(indexPath)) {
      try {
        const raw = await readFile(indexPath, 'utf-8');
        index = JSON.parse(raw) as ArtifactIndex;
      } catch {}
    }
    index.artifacts.push(artifact);
    index.updatedAt = new Date().toISOString();
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
}
