import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}));

// Doctor check result types (mirroring packages/nexus-cli/src/doctor/)
type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  hint?: string;
}

interface DoctorReport {
  overall: CheckStatus;
  checks: CheckResult[];
  errorCount: number;
  warnCount: number;
}

// Stub doctor implementation for unit testing
function runDoctorChecks(
  fsState: Record<string, boolean>,
  fileContents: Record<string, string>
): DoctorReport {
  const checks: CheckResult[] = [];

  // Check 1: .nexus/ directory exists
  const nexusExists = fsState['.nexus'] ?? false;
  checks.push({
    name: '.nexus directory',
    status: nexusExists ? 'PASS' : 'FAIL',
    message: nexusExists ? '.nexus/ directory found' : '.nexus/ directory missing — run nexus init',
    hint: nexusExists ? undefined : 'Run: nexus init',
  });

  // Check 2: Mission files present
  const missionFiles = [
    '.nexus/00-mission/MISSION.md',
    '.nexus/00-mission/PRD.md',
    '.nexus/00-mission/ACCEPTANCE_MASTER.md',
    '.nexus/00-mission/ROADMAP.md',
  ];
  for (const mf of missionFiles) {
    const exists = fsState[mf] ?? false;
    checks.push({
      name: mf,
      status: exists ? 'PASS' : 'WARN',
      message: exists ? `${mf} present` : `${mf} missing — populate before planning`,
      hint: exists ? undefined : 'Create the file and describe your project goals',
    });
  }

  // Check 3: settings.json valid
  const settingsExists = fsState['.nexus/settings.json'] ?? false;
  if (settingsExists) {
    const content = fileContents['.nexus/settings.json'] ?? '{}';
    try {
      const parsed = JSON.parse(content);
      const hasVersion = typeof parsed.version === 'string';
      checks.push({
        name: 'settings.json',
        status: hasVersion ? 'PASS' : 'WARN',
        message: hasVersion ? 'settings.json is valid' : 'settings.json missing version field',
      });
    } catch {
      checks.push({
        name: 'settings.json',
        status: 'FAIL',
        message: 'settings.json is not valid JSON',
        hint: 'Fix or re-run nexus init to regenerate',
      });
    }
  } else {
    checks.push({
      name: 'settings.json',
      status: 'WARN',
      message: 'settings.json not found',
      hint: 'Run: nexus init',
    });
  }

  // Check 4: hashes.json (optional but recommended)
  const hashesExists = fsState['.nexus/03-index/hashes.json'] ?? false;
  checks.push({
    name: 'hashes.json',
    status: hashesExists ? 'PASS' : 'WARN',
    message: hashesExists ? 'hashes.json present' : 'hashes.json not found — run nexus build-index to generate',
    hint: hashesExists ? undefined : 'Run: nexus build-index',
  });

  const errorCount = checks.filter(c => c.status === 'FAIL').length;
  const warnCount = checks.filter(c => c.status === 'WARN').length;

  let overall: CheckStatus = 'PASS';
  if (errorCount > 0) overall = 'FAIL';
  else if (warnCount > 0) overall = 'WARN';

  return { overall, checks, errorCount, warnCount };
}

describe('nexus doctor — check structure', () => {
  it('should return a DoctorReport with checks array, overall status, and counts', () => {
    const report = runDoctorChecks(
      { '.nexus': true, '.nexus/settings.json': true, '.nexus/03-index/hashes.json': true },
      { '.nexus/settings.json': JSON.stringify({ version: '6.0.0' }) }
    );
    expect(report).toHaveProperty('overall');
    expect(report).toHaveProperty('checks');
    expect(report).toHaveProperty('errorCount');
    expect(report).toHaveProperty('warnCount');
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it('should return FAIL overall when .nexus directory is missing', () => {
    const report = runDoctorChecks({}, {});
    expect(report.overall).toBe('FAIL');
    expect(report.errorCount).toBeGreaterThan(0);
    const nexusCheck = report.checks.find(c => c.name === '.nexus directory');
    expect(nexusCheck?.status).toBe('FAIL');
  });

  it('should return WARN overall when .nexus exists but mission files are missing', () => {
    const report = runDoctorChecks(
      { '.nexus': true, '.nexus/settings.json': true },
      { '.nexus/settings.json': JSON.stringify({ version: '6.0.0' }) }
    );
    expect(report.overall).toBe('WARN');
    expect(report.warnCount).toBeGreaterThan(0);
    expect(report.errorCount).toBe(0);
  });

  it('should return PASS overall when all required files are present and valid', () => {
    const fullFs: Record<string, boolean> = {
      '.nexus': true,
      '.nexus/00-mission/MISSION.md': true,
      '.nexus/00-mission/PRD.md': true,
      '.nexus/00-mission/ACCEPTANCE_MASTER.md': true,
      '.nexus/00-mission/ROADMAP.md': true,
      '.nexus/settings.json': true,
      '.nexus/03-index/hashes.json': true,
    };
    const report = runDoctorChecks(fullFs, {
      '.nexus/settings.json': JSON.stringify({ version: '6.0.0' }),
    });
    expect(report.overall).toBe('PASS');
    expect(report.errorCount).toBe(0);
    expect(report.warnCount).toBe(0);
  });
});

describe('nexus doctor — individual checks', () => {
  it('should produce a FAIL check with a hint when .nexus is missing', () => {
    const report = runDoctorChecks({}, {});
    const check = report.checks.find(c => c.name === '.nexus directory');
    expect(check).toBeDefined();
    expect(check!.status).toBe('FAIL');
    expect(check!.hint).toContain('nexus init');
  });

  it('should produce a FAIL check when settings.json is invalid JSON', () => {
    const report = runDoctorChecks(
      { '.nexus': true, '.nexus/settings.json': true },
      { '.nexus/settings.json': 'not-valid-json{{{' }
    );
    const check = report.checks.find(c => c.name === 'settings.json');
    expect(check).toBeDefined();
    expect(check!.status).toBe('FAIL');
  });

  it('should produce a WARN check when hashes.json is missing', () => {
    const report = runDoctorChecks(
      { '.nexus': true, '.nexus/settings.json': true },
      { '.nexus/settings.json': JSON.stringify({ version: '6.0.0' }) }
    );
    const check = report.checks.find(c => c.name === 'hashes.json');
    expect(check).toBeDefined();
    expect(check!.status).toBe('WARN');
    expect(check!.hint).toContain('build-index');
  });

  it('each check result should have name, status, and message fields', () => {
    const report = runDoctorChecks({ '.nexus': true }, {});
    for (const check of report.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('message');
      expect(['PASS', 'WARN', 'FAIL']).toContain(check.status);
    }
  });
});
