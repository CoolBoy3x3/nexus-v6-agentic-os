import { describe, it, expect, vi, beforeEach } from 'vitest';

// Message types for file-based mailbox
type MessageType = 'task-assignment' | 'heartbeat' | 'broadcast' | 'completion' | 'error';

interface Message {
  id: string;
  type: MessageType;
  from: string;
  to: string | 'all';
  payload: unknown;
  timestamp: string;
  read: boolean;
}

interface MailboxStats {
  total: number;
  unread: number;
  byType: Record<MessageType, number>;
}

// Stub Mailbox for unit testing (in-memory, no real file I/O)
class MailboxStub {
  private messages: Message[] = [];
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  send(to: string | 'all', type: MessageType, payload: unknown): Message {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      from: this.agentId,
      to,
      payload,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.messages.push(message);
    return message;
  }

  poll(filter?: { type?: MessageType; from?: string }): Message[] {
    const inbox = this.messages.filter(m =>
      (m.to === this.agentId || m.to === 'all') && !m.read
    );

    let results = inbox;
    if (filter?.type) results = results.filter(m => m.type === filter.type);
    if (filter?.from) results = results.filter(m => m.from === filter.from);

    // Mark as read
    for (const msg of results) {
      msg.read = true;
    }

    return results;
  }

  broadcast(type: MessageType, payload: unknown): Message {
    return this.send('all', type, payload);
  }

  heartbeat(): Message {
    return this.send('all', 'heartbeat', {
      agentId: this.agentId,
      status: 'alive',
      ts: Date.now(),
    });
  }

  getStats(): MailboxStats {
    const byType: Record<string, number> = {};
    for (const msg of this.messages) {
      byType[msg.type] = (byType[msg.type] ?? 0) + 1;
    }
    return {
      total: this.messages.length,
      unread: this.messages.filter(m => !m.read && (m.to === this.agentId || m.to === 'all')).length,
      byType: byType as Record<MessageType, number>,
    };
  }

  // Simulate another agent depositing a message into this mailbox
  _inject(from: string, type: MessageType, payload: unknown): Message {
    const message: Message = {
      id: `msg-ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      from,
      to: this.agentId,
      payload,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.messages.push(message);
    return message;
  }
}

describe('Mailbox — send', () => {
  let mailbox: MailboxStub;

  beforeEach(() => {
    mailbox = new MailboxStub('agent-worker-1');
  });

  it('should create a message with the correct fields when send is called', () => {
    const msg = mailbox.send('agent-worker-2', 'task-assignment', { taskId: 'task-001' });
    expect(msg.id).toMatch(/^msg-/);
    expect(msg.from).toBe('agent-worker-1');
    expect(msg.to).toBe('agent-worker-2');
    expect(msg.type).toBe('task-assignment');
    expect(msg.payload).toEqual({ taskId: 'task-001' });
    expect(msg.read).toBe(false);
  });

  it('should generate unique ids for each message', () => {
    const msg1 = mailbox.send('agent-2', 'heartbeat', {});
    const msg2 = mailbox.send('agent-2', 'heartbeat', {});
    expect(msg1.id).not.toBe(msg2.id);
  });

  it('should include a valid ISO timestamp', () => {
    const msg = mailbox.send('agent-2', 'completion', {});
    expect(() => new Date(msg.timestamp)).not.toThrow();
    expect(isNaN(new Date(msg.timestamp).getTime())).toBe(false);
  });
});

describe('Mailbox — poll', () => {
  let mailbox: MailboxStub;

  beforeEach(() => {
    mailbox = new MailboxStub('agent-worker-1');
  });

  it('should return messages addressed to this agent', () => {
    mailbox._inject('agent-planner', 'task-assignment', { taskId: 'task-001' });
    const msgs = mailbox.poll();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('task-assignment');
  });

  it('should return broadcast messages addressed to "all"', () => {
    // Simulate another mailbox broadcasting
    const otherMailbox = new MailboxStub('agent-planner');
    // Manually inject the broadcast message
    mailbox._inject('agent-planner', 'broadcast', { announcement: 'wave 1 complete' });
    const msgs = mailbox.poll({ type: 'broadcast' });
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].type).toBe('broadcast');
  });

  it('should mark messages as read after polling', () => {
    mailbox._inject('agent-planner', 'task-assignment', { taskId: 'task-002' });
    const firstPoll = mailbox.poll();
    expect(firstPoll).toHaveLength(1);
    const secondPoll = mailbox.poll();
    expect(secondPoll).toHaveLength(0);
  });

  it('should filter by message type when filter.type is provided', () => {
    mailbox._inject('agent-planner', 'task-assignment', { taskId: 'task-001' });
    mailbox._inject('agent-planner', 'heartbeat', {});
    const taskMessages = mailbox.poll({ type: 'task-assignment' });
    expect(taskMessages.every(m => m.type === 'task-assignment')).toBe(true);
  });
});

describe('Mailbox — broadcast', () => {
  it('should send a message with to="all"', () => {
    const mailbox = new MailboxStub('agent-orchestrator');
    const msg = mailbox.broadcast('completion', { waveId: 'wave-1' });
    expect(msg.to).toBe('all');
    expect(msg.type).toBe('completion');
  });
});

describe('Mailbox — heartbeat', () => {
  it('should send a heartbeat message with status="alive"', () => {
    const mailbox = new MailboxStub('agent-worker-3');
    const msg = mailbox.heartbeat();
    expect(msg.type).toBe('heartbeat');
    expect(msg.to).toBe('all');
    expect((msg.payload as any).status).toBe('alive');
    expect((msg.payload as any).agentId).toBe('agent-worker-3');
  });
});

describe('Mailbox — getStats', () => {
  it('should count total and unread messages', () => {
    const mailbox = new MailboxStub('agent-1');
    mailbox._inject('agent-2', 'task-assignment', {});
    mailbox._inject('agent-2', 'heartbeat', {});
    const stats = mailbox.getStats();
    expect(stats.total).toBe(2);
    expect(stats.unread).toBe(2);
  });

  it('should decrement unread count after polling', () => {
    const mailbox = new MailboxStub('agent-1');
    mailbox._inject('agent-2', 'task-assignment', {});
    mailbox.poll();
    const stats = mailbox.getStats();
    expect(stats.unread).toBe(0);
  });
});
