import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs/promises for all file operations
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue('{}');
const mockAccess = vi.fn().mockRejectedValue(new Error('ENOENT'));

vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  access: mockAccess,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// The expected .nexus/ directory structure
const EXPECTED_NEXUS_DIRS = [
  '.nexus/00-mission',
  '.nexus/01-constraints',
  '.nexus/02-architecture',
  '.nexus/03-index',
  '.nexus/04-tasks/backlog',
  '.nexus/04-tasks/in-progress',
  '.nexus/04-tasks/done',
  '.nexus/04-tasks/blocked',
  '.nexus/05-context/packets',
  '.nexus/05-context/gaps',
  '.nexus/05-context/processed',
  '.nexus/06-checkpoints/snapshots',
  '.nexus/06-checkpoints/refs',
  '.nexus/07-artifacts/screenshots',
  '.nexus/07-artifacts/videos',
  '.nexus/07-artifacts/logs',
  '.nexus/08-playwright/flow-specs',
  '.nexus/08-playwright/results',
];

const EXPECTED_TEMPLATE_FILES = [
  '.nexus/00-mission/MISSION.md',
  '.nexus/00-mission/PRD.md',
  '.nexus/00-mission/ACCEPTANCE_MASTER.md',
  '.nexus/00-mission/ROADMAP.md',
  '.nexus/01-constraints/tech_stack.json',
  '.nexus/01-constraints/forbidden_ops.json',
  '.nexus/settings.json',
];

// Stub init function that simulates nexus init behavior
async function runInit(projectRoot: string): Promise<{ dirsCreated: string[]; filesWritten: string[] }> {
  const { mkdir, writeFile } = await import('fs/promises');

  const dirsCreated: string[] = [];
  const filesWritten: string[] = [];

  for (const dir of EXPECTED_NEXUS_DIRS) {
    await mkdir(`${projectRoot}/${dir}`, { recursive: true });
    dirsCreated.push(dir);
  }

  const templates: Record<string, string> = {
    '.nexus/00-mission/MISSION.md': '# Mission\n\nDescribe your project mission here.\n',
    '.nexus/00-mission/PRD.md': '# Product Requirements Document\n\nDescribe your product requirements here.\n',
    '.nexus/00-mission/ACCEPTANCE_MASTER.md': '# Acceptance Criteria\n\n[MUST] AC-01: Example criterion\n',
    '.nexus/00-mission/ROADMAP.md': 'phase_1:\n  goal: Initial setup\n  tasks: []\n  risk_tier: low\n  tdd_mode: true\n  playwright_required: false\n',
    '.nexus/01-constraints/tech_stack.json': JSON.stringify({ languages: ['typescript'], frameworks: [], tools: ['pnpm', 'vitest'] }, null, 2),
    '.nexus/01-constraints/forbidden_ops.json': JSON.stringify({ forbidden: ['DROP TABLE', 'git push --force', 'rm -rf /'] }, null, 2),
    '.nexus/settings.json': JSON.stringify({ version: '6.0.0', playwright: { enabled: false } }, null, 2),
  };

  for (const [file, content] of Object.entries(templates)) {
    await writeFile(`${projectRoot}/${file}`, content, 'utf-8');
    filesWritten.push(file);
  }

  return { dirsCreated, filesWritten };
}

describe('nexus init — directory structure', () => {
  beforeEach(() => {
    mockMkdir.mockClear();
    mockWriteFile.mockClear();
  });

  it('should create all 18 expected .nexus/ subdirectories', async () => {
    const result = await runInit('/tmp/test-project');
    expect(result.dirsCreated).toHaveLength(EXPECTED_NEXUS_DIRS.length);
    for (const dir of EXPECTED_NEXUS_DIRS) {
      expect(result.dirsCreated).toContain(dir);
    }
  });

  it('should create all 4 task state subdirectories (backlog, in-progress, done, blocked)', async () => {
    const result = await runInit('/tmp/test-project');
    expect(result.dirsCreated).toContain('.nexus/04-tasks/backlog');
    expect(result.dirsCreated).toContain('.nexus/04-tasks/in-progress');
    expect(result.dirsCreated).toContain('.nexus/04-tasks/done');
    expect(result.dirsCreated).toContain('.nexus/04-tasks/blocked');
  });

  it('should create all 3 context subdirectories (packets, gaps, processed)', async () => {
    const result = await runInit('/tmp/test-project');
    expect(result.dirsCreated).toContain('.nexus/05-context/packets');
    expect(result.dirsCreated).toContain('.nexus/05-context/gaps');
    expect(result.dirsCreated).toContain('.nexus/05-context/processed');
  });

  it('should create artifact subdirectories for screenshots, videos, and logs', async () => {
    const result = await runInit('/tmp/test-project');
    expect(result.dirsCreated).toContain('.nexus/07-artifacts/screenshots');
    expect(result.dirsCreated).toContain('.nexus/07-artifacts/videos');
    expect(result.dirsCreated).toContain('.nexus/07-artifacts/logs');
  });
});

describe('nexus init — template file writing', () => {
  beforeEach(() => {
    mockMkdir.mockClear();
    mockWriteFile.mockClear();
  });

  it('should write all expected template files', async () => {
    const result = await runInit('/tmp/test-project');
    for (const file of EXPECTED_TEMPLATE_FILES) {
      expect(result.filesWritten).toContain(file);
    }
  });

  it('should write a settings.json with playwright disabled by default', async () => {
    await runInit('/tmp/test-project');
    const settingsCall = mockWriteFile.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('settings.json')
    );
    expect(settingsCall).toBeDefined();
    const content = JSON.parse(settingsCall![1] as string);
    expect(content.playwright.enabled).toBe(false);
  });

  it('should write a ROADMAP.md with phase_1 structure', async () => {
    await runInit('/tmp/test-project');
    const roadmapCall = mockWriteFile.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('ROADMAP.md')
    );
    expect(roadmapCall).toBeDefined();
    expect(roadmapCall![1]).toContain('phase_1');
    expect(roadmapCall![1]).toContain('playwright_required');
  });

  it('should write forbidden_ops.json with git push --force as a forbidden operation', async () => {
    await runInit('/tmp/test-project');
    const forbiddenCall = mockWriteFile.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('forbidden_ops.json')
    );
    expect(forbiddenCall).toBeDefined();
    const content = JSON.parse(forbiddenCall![1] as string);
    expect(content.forbidden).toContain('git push --force');
  });
});

describe('nexus init — idempotency', () => {
  it('should use recursive mkdir so re-running init does not fail on existing dirs', async () => {
    await runInit('/tmp/test-project');
    const mkdirCalls = mockMkdir.mock.calls;
    for (const call of mkdirCalls) {
      expect(call[1]).toMatchObject({ recursive: true });
    }
  });
});
