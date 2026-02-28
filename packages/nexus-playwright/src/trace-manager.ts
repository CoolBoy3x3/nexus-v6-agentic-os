import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_DIRS } from '@nexus/core';

export interface TraceBundle {
  id: string;
  taskId: string;
  flowName: string;
  tracePath: string;
  metadata: Record<string, unknown>;
  capturedAt: string;
  status: 'pass' | 'fail' | 'unknown';
}

export class TraceManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  private tracesDir(): string {
    return path.join(this.cwd, NEXUS_DIRS.PLAYWRIGHT, 'traces');
  }

  private manifestPath(): string {
    return path.join(this.tracesDir(), 'manifest.json');
  }

  async record(bundle: Omit<TraceBundle, 'id' | 'capturedAt'>): Promise<TraceBundle> {
    const id = `trace-${Date.now()}-${bundle.taskId.slice(0, 8)}`;
    const trace: TraceBundle = {
      ...bundle,
      id,
      capturedAt: new Date().toISOString(),
    };

    await mkdir(this.tracesDir(), { recursive: true });
    await this.appendToManifest(trace);
    return trace;
  }

  async getByFlow(flowName: string): Promise<TraceBundle[]> {
    const manifest = await this.loadManifest();
    return manifest.filter((t) => t.flowName === flowName);
  }

  async getConsecutivePasses(flowName: string): Promise<number> {
    const traces = await this.getByFlow(flowName);
    const recent = traces.slice(-10).reverse(); // Last 10, most recent first
    let count = 0;
    for (const t of recent) {
      if (t.status === 'pass') count++;
      else break;
    }
    return count;
  }

  private async loadManifest(): Promise<TraceBundle[]> {
    if (!existsSync(this.manifestPath())) return [];
    try {
      const raw = await readFile(this.manifestPath(), 'utf-8');
      return JSON.parse(raw) as TraceBundle[];
    } catch {
      return [];
    }
  }

  private async appendToManifest(trace: TraceBundle): Promise<void> {
    const manifest = await this.loadManifest();
    manifest.push(trace);
    await writeFile(this.manifestPath(), JSON.stringify(manifest, null, 2), 'utf-8');
  }
}
