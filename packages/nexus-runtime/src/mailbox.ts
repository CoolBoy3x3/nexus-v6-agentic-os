/**
 * File-based mailbox for inter-agent communication.
 *
 * Direct TypeScript port of Antigravity's scripts/core/mailbox.py.
 * Each agent has its own inbox directory. Messages are individual JSON files
 * to avoid locking issues. Atomic writes via temp+rename pattern.
 */
import { readFile, writeFile, mkdir, rename, unlink, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import type { Message, MessageType } from '@nexus/core';

const BASE_DIR_DEFAULT = '.nexus/mailboxes';

export class Mailbox {
  private readonly inboxDir: string;
  private readonly processedDir: string;

  constructor(
    private readonly agentName: string,
    private readonly baseDir: string = BASE_DIR_DEFAULT,
  ) {
    this.inboxDir = path.join(baseDir, agentName, 'inbox');
    this.processedDir = path.join(baseDir, agentName, 'processed');
  }

  async init(): Promise<void> {
    await mkdir(this.inboxDir, { recursive: true });
    await mkdir(this.processedDir, { recursive: true });
  }

  async send(
    recipient: string,
    msgType: MessageType,
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<Message> {
    const msgId = randomBytes(4).toString('hex');
    const timestamp = Date.now();
    const msg: Message = {
      msgId,
      sender: this.agentName,
      recipient,
      msgType,
      content,
      timestamp,
      metadata,
    };

    const targetInbox = path.join(this.baseDir, recipient, 'inbox');
    await mkdir(targetInbox, { recursive: true });

    const filename = `${timestamp}-${msgId}.json`;
    const filepath = path.join(targetInbox, filename);

    // Atomic write: write to temp file then rename
    const tmpPath = filepath + '.tmp';
    try {
      await writeFile(tmpPath, JSON.stringify(msg), 'utf-8');
      await rename(tmpPath, filepath);
    } catch (err) {
      // Clean up temp file on error
      try { await unlink(tmpPath); } catch {}
      throw err;
    }

    return msg;
  }

  async broadcast(
    allAgents: string[],
    msgType: MessageType,
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<Message[]> {
    const messages: Message[] = [];
    for (const agent of allAgents) {
      if (agent !== this.agentName) {
        const msg = await this.send(agent, msgType, content, metadata);
        messages.push(msg);
      }
    }
    return messages;
  }

  async poll(): Promise<Message[]> {
    if (!existsSync(this.inboxDir)) return [];

    const files = await readdir(this.inboxDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

    const messages: Message[] = [];
    for (const filename of jsonFiles) {
      const filepath = path.join(this.inboxDir, filename);
      try {
        const raw = await readFile(filepath, 'utf-8');
        const msg = JSON.parse(raw) as Message;
        messages.push(msg);
        // Move to processed
        const processedPath = path.join(this.processedDir, filename);
        await mkdir(this.processedDir, { recursive: true });
        await rename(filepath, processedPath);
      } catch {
        // Skip corrupted/missing files
        continue;
      }
    }

    return messages;
  }

  async hasMessages(): Promise<boolean> {
    if (!existsSync(this.inboxDir)) return false;
    const files = await readdir(this.inboxDir);
    return files.some((f) => f.endsWith('.json'));
  }

  async writeHeartbeat(): Promise<void> {
    const heartbeatPath = path.join(this.baseDir, this.agentName, 'heartbeat');
    await mkdir(path.dirname(heartbeatPath), { recursive: true });
    try {
      await writeFile(heartbeatPath, String(Date.now()), 'utf-8');
    } catch {}
  }

  async readHeartbeat(agentName: string): Promise<number | null> {
    const heartbeatPath = path.join(this.baseDir, agentName, 'heartbeat');
    if (!existsSync(heartbeatPath)) return null;
    try {
      const raw = await readFile(heartbeatPath, 'utf-8');
      const ts = parseFloat(raw.trim());
      return Number.isFinite(ts) ? ts : null;
    } catch {
      return null;
    }
  }

  async cleanupProcessed(maxAgeMs: number = 3_600_000): Promise<void> {
    if (!existsSync(this.processedDir)) return;
    const files = await readdir(this.processedDir);
    const now = Date.now();
    for (const filename of files) {
      if (!filename.endsWith('.json')) continue;
      const filepath = path.join(this.processedDir, filename);
      try {
        const stats = await stat(filepath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await unlink(filepath);
        }
      } catch {}
    }
  }

  async getMessageCount(): Promise<{ unread: number; processed: number }> {
    let unread = 0;
    let processed = 0;
    if (existsSync(this.inboxDir)) {
      const files = await readdir(this.inboxDir);
      unread = files.filter((f) => f.endsWith('.json')).length;
    }
    if (existsSync(this.processedDir)) {
      const files = await readdir(this.processedDir);
      processed = files.filter((f) => f.endsWith('.json')).length;
    }
    return { unread, processed };
  }
}

export async function getAllMessages(baseDir: string = BASE_DIR_DEFAULT): Promise<Message[]> {
  if (!existsSync(baseDir)) return [];
  const messages: Message[] = [];
  try {
    const agentDirs = await readdir(baseDir);
    for (const agentDir of agentDirs) {
      const processedDir = path.join(baseDir, agentDir, 'processed');
      if (!existsSync(processedDir)) continue;
      const files = await readdir(processedDir);
      for (const filename of files.filter((f) => f.endsWith('.json'))) {
        try {
          const raw = await readFile(path.join(processedDir, filename), 'utf-8');
          messages.push(JSON.parse(raw) as Message);
        } catch {}
      }
    }
  } catch {}
  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}
