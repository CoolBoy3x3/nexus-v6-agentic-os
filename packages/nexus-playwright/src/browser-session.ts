import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_DIRS } from '@nexus/core';

export interface BrowserSessionState {
  sessionId: string;
  startedAt: string;
  lastActionAt: string;
  currentUrl: string;
  isActive: boolean;
  actionCount: number;
}

export class BrowserSession {
  private state: BrowserSessionState | null = null;
  private readonly sessionPath: string;

  constructor(private readonly cwd: string = process.cwd()) {
    this.sessionPath = path.join(cwd, NEXUS_DIRS.PLAYWRIGHT, 'session-state.json');
  }

  async start(): Promise<BrowserSessionState> {
    const sessionId = `session-${Date.now()}`;
    this.state = {
      sessionId,
      startedAt: new Date().toISOString(),
      lastActionAt: new Date().toISOString(),
      currentUrl: 'about:blank',
      isActive: true,
      actionCount: 0,
    };
    await this.persist();
    return this.state;
  }

  async stop(): Promise<void> {
    if (this.state) {
      this.state.isActive = false;
      await this.persist();
    }
    this.state = null;
  }

  async recordAction(url?: string): Promise<void> {
    if (!this.state) return;
    this.state.lastActionAt = new Date().toISOString();
    this.state.actionCount++;
    if (url) this.state.currentUrl = url;
    await this.persist();
  }

  isHealthy(): boolean {
    if (!this.state?.isActive) return false;
    const lastAction = new Date(this.state.lastActionAt).getTime();
    return Date.now() - lastAction < 300_000; // 5-minute timeout
  }

  async loadExisting(): Promise<BrowserSessionState | null> {
    if (!existsSync(this.sessionPath)) return null;
    try {
      const raw = await readFile(this.sessionPath, 'utf-8');
      this.state = JSON.parse(raw) as BrowserSessionState;
      return this.state;
    } catch {
      return null;
    }
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.sessionPath), { recursive: true });
    await writeFile(this.sessionPath, JSON.stringify(this.state, null, 2), 'utf-8');
  }
}
