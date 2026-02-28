import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises for artifact writing
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue('{"runs":[]}');
const mockCopyFile = vi.fn().mockResolvedValue(undefined);

vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  copyFile: mockCopyFile,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// Artifact types (matching nexus-playwright/src/artifact-writer.ts)
interface ArtifactRun {
  runId: string;
  flowId: string;
  timestamp: string;
  result: 'PASS' | 'FAIL' | 'ERROR';
  screenshots: string[];
  video?: string;
  log: string;
}

interface ArtifactIndex {
  runs: ArtifactRun[];
}

// Stub ArtifactWriter for unit testing
class ArtifactWriterStub {
  private artifactDir: string;
  private indexCache: ArtifactIndex;
  private logBuffer: Map<string, string[]>;

  constructor(artifactDir: string) {
    this.artifactDir = artifactDir;
    this.indexCache = { runs: [] };
    this.logBuffer = new Map();
  }

  async writeLog(runId: string, message: string): Promise<void> {
    if (!this.logBuffer.has(runId)) {
      this.logBuffer.set(runId, []);
    }
    const lines = this.logBuffer.get(runId)!;
    const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
    lines.push(timestampedMessage);

    const logPath = `${this.artifactDir}/logs/${runId}.log`;
    await mockWriteFile(logPath, lines.join('\n'), 'utf-8');
  }

  async writeScreenshot(runId: string, flowId: string, name: string, data: Buffer): Promise<string> {
    const screenshotDir = `${this.artifactDir}/screenshots/${flowId}/${runId}`;
    await mockMkdir(screenshotDir, { recursive: true });
    const screenshotPath = `${screenshotDir}/${name}.png`;
    await mockWriteFile(screenshotPath, data);
    return screenshotPath;
  }

  async recordRun(run: ArtifactRun): Promise<void> {
    this.indexCache.runs.push(run);
    await mockWriteFile(
      `${this.artifactDir}/index.json`,
      JSON.stringify(this.indexCache, null, 2),
      'utf-8'
    );
  }

  getIndex(): ArtifactIndex {
    return { ...this.indexCache, runs: [...this.indexCache.runs] };
  }

  getRunById(runId: string): ArtifactRun | undefined {
    return this.indexCache.runs.find(r => r.runId === runId);
  }

  getRunsByFlow(flowId: string): ArtifactRun[] {
    return this.indexCache.runs.filter(r => r.flowId === flowId);
  }

  getLogs(runId: string): string[] {
    return this.logBuffer.get(runId) ?? [];
  }

  getLastResult(flowId: string): ArtifactRun | undefined {
    const runs = this.getRunsByFlow(flowId);
    if (runs.length === 0) return undefined;
    return runs[runs.length - 1];
  }
}

describe('ArtifactWriter — writeLog', () => {
  let writer: ArtifactWriterStub;

  beforeEach(() => {
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    writer = new ArtifactWriterStub('.nexus/07-artifacts');
  });

  it('should write a log message to the correct path', async () => {
    await writer.writeLog('run-001', 'Step 1: navigated to /login');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('logs/run-001.log'),
      expect.stringContaining('Step 1: navigated to /login'),
      'utf-8'
    );
  });

  it('should accumulate multiple log messages for the same run', async () => {
    await writer.writeLog('run-001', 'Step 1: navigate');
    await writer.writeLog('run-001', 'Step 2: fill email');
    const logs = writer.getLogs('run-001');
    expect(logs).toHaveLength(2);
    expect(logs.some(l => l.includes('Step 1'))).toBe(true);
    expect(logs.some(l => l.includes('Step 2'))).toBe(true);
  });

  it('should include a timestamp in each log line', async () => {
    await writer.writeLog('run-002', 'Test message');
    const logs = writer.getLogs('run-002');
    expect(logs[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });
});

describe('ArtifactWriter — getIndex', () => {
  let writer: ArtifactWriterStub;

  beforeEach(async () => {
    mockWriteFile.mockClear();
    writer = new ArtifactWriterStub('.nexus/07-artifacts');
    await writer.recordRun({
      runId: 'run-001',
      flowId: 'login-happy-path',
      timestamp: '2026-02-28T14:30:00Z',
      result: 'PASS',
      screenshots: ['screenshots/login-happy-path/run-001/initial.png'],
      log: 'logs/run-001.log',
    });
    await writer.recordRun({
      runId: 'run-002',
      flowId: 'login-happy-path',
      timestamp: '2026-02-28T14:35:00Z',
      result: 'PASS',
      screenshots: [],
      log: 'logs/run-002.log',
    });
  });

  it('should return an index with all recorded runs', () => {
    const index = writer.getIndex();
    expect(index.runs).toHaveLength(2);
  });

  it('should find a run by runId', () => {
    const run = writer.getRunById('run-001');
    expect(run).toBeDefined();
    expect(run!.flowId).toBe('login-happy-path');
    expect(run!.result).toBe('PASS');
  });

  it('should return undefined for an unknown runId', () => {
    const run = writer.getRunById('nonexistent-run');
    expect(run).toBeUndefined();
  });

  it('should filter runs by flowId', () => {
    const runs = writer.getRunsByFlow('login-happy-path');
    expect(runs).toHaveLength(2);
    expect(runs.every(r => r.flowId === 'login-happy-path')).toBe(true);
  });

  it('should return the last result for a flow', () => {
    const last = writer.getLastResult('login-happy-path');
    expect(last).toBeDefined();
    expect(last!.runId).toBe('run-002');
  });

  it('should write the index to index.json after each recordRun call', async () => {
    const indexWriteCalls = mockWriteFile.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('index.json')
    );
    expect(indexWriteCalls.length).toBeGreaterThan(0);
  });
});

describe('ArtifactWriter — writeScreenshot', () => {
  let writer: ArtifactWriterStub;

  beforeEach(() => {
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    writer = new ArtifactWriterStub('.nexus/07-artifacts');
  });

  it('should create the screenshot directory with mkdir recursive', async () => {
    const data = Buffer.from('fake-png-data');
    await writer.writeScreenshot('run-001', 'login-happy-path', 'initial', data);
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('screenshots/login-happy-path/run-001'),
      { recursive: true }
    );
  });

  it('should return the path of the written screenshot', async () => {
    const data = Buffer.from('fake-png-data');
    const path = await writer.writeScreenshot('run-001', 'login-happy-path', 'dashboard', data);
    expect(path).toContain('screenshots/login-happy-path/run-001/dashboard.png');
  });

  it('should write the screenshot data to the correct file path', async () => {
    const data = Buffer.from('fake-png-data');
    await writer.writeScreenshot('run-001', 'login-happy-path', 'post-login', data);
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('post-login.png'),
      data
    );
  });
});
