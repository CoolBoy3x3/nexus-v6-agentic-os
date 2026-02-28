import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import type { HeartbeatEntry, AgentStatus } from '@nexus/core';
import { Mailbox } from './mailbox.js';

const HEARTBEAT_TIMEOUT_MS = 30_000; // 30 seconds

export class HeartbeatMonitor {
  private readonly mailbox: Mailbox;

  constructor(
    private readonly agentName: string,
    private readonly cwd: string = process.cwd(),
    baseDir?: string,
  ) {
    this.mailbox = new Mailbox(agentName, baseDir ?? path.join(cwd, '.nexus/mailboxes'));
  }

  async beat(status: AgentStatus, taskId?: string, detail?: string): Promise<void> {
    await this.mailbox.writeHeartbeat();
    const entry: HeartbeatEntry = { agentName: this.agentName, timestamp: Date.now(), status };
    if (taskId !== undefined) entry.taskId = taskId;
    if (detail !== undefined) entry.detail = detail;
    await this.appendAudit(entry);
  }

  async isAlive(agentName: string): Promise<boolean> {
    const ts = await this.mailbox.readHeartbeat(agentName);
    if (ts === null) return false;
    return Date.now() - ts < HEARTBEAT_TIMEOUT_MS;
  }

  private async appendAudit(entry: HeartbeatEntry): Promise<void> {
    const auditPath = path.join(this.cwd, '.nexus/05-runtime/mission-log.jsonl');
    await mkdir(path.dirname(auditPath), { recursive: true });
    await appendFile(auditPath, JSON.stringify(entry) + '\n', 'utf-8');
  }
}
