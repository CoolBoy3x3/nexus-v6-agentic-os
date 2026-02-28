import { describe, it, expect, vi, beforeEach } from 'vitest';

// Types for the full system validation ladder
type CheckName =
  | 'physicality'
  | 'goal-backward'
  | 'contracts'
  | 'architecture'
  | 'typecheck'
  | 'lint'
  | 'tests'
  | 'playwright';

type CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'PENDING';

interface LadderCheckResult {
  name: CheckName;
  status: CheckStatus;
  durationMs: number;
  details?: string;
}

interface SystemValidationResult {
  overall: 'PASS' | 'FAIL';
  sessionId: string;
  timestamp: string;
  waveId: string;
  checks: LadderCheckResult[];
  failedAt?: CheckName;
}

// Stub SystemValidator for unit testing
class SystemValidatorStub {
  private checkFns: Map<CheckName, () => Promise<{ status: CheckStatus; details?: string }>> =
    new Map();

  registerCheck(
    name: CheckName,
    fn: () => Promise<{ status: CheckStatus; details?: string }>
  ): void {
    this.checkFns.set(name, fn);
  }

  async runLadder(
    waveId: string,
    sessionId: string,
    playwrightRequired: boolean
  ): Promise<SystemValidationResult> {
    const orderedChecks: CheckName[] = [
      'physicality',
      'goal-backward',
      'contracts',
      'architecture',
      'typecheck',
      'lint',
      'tests',
    ];
    if (playwrightRequired) orderedChecks.push('playwright');

    const results: LadderCheckResult[] = [];
    let failedAt: CheckName | undefined;

    for (const checkName of orderedChecks) {
      const fn = this.checkFns.get(checkName);
      if (!fn) {
        results.push({ name: checkName, status: 'SKIPPED', durationMs: 0 });
        continue;
      }

      const start = Date.now();
      try {
        const { status, details } = await fn();
        const durationMs = Date.now() - start;
        results.push({ name: checkName, status, durationMs, details });

        if (status === 'FAIL') {
          failedAt = checkName;
          // Add remaining checks as PENDING (short-circuit)
          for (const remaining of orderedChecks.slice(orderedChecks.indexOf(checkName) + 1)) {
            results.push({ name: remaining, status: 'PENDING', durationMs: 0 });
          }
          break;
        }
      } catch (err) {
        const durationMs = Date.now() - start;
        results.push({ name: checkName, status: 'FAIL', durationMs, details: String(err) });
        failedAt = checkName;
        break;
      }
    }

    const overall = failedAt ? 'FAIL' : 'PASS';

    return {
      overall,
      sessionId,
      timestamp: new Date().toISOString(),
      waveId,
      checks: results,
      failedAt,
    };
  }
}

describe('SystemValidator — result structure', () => {
  let validator: SystemValidatorStub;

  beforeEach(() => {
    validator = new SystemValidatorStub();
    // Register all checks as passing by default
    const passFn = async () => ({ status: 'PASS' as CheckStatus });
    validator.registerCheck('physicality', passFn);
    validator.registerCheck('goal-backward', passFn);
    validator.registerCheck('contracts', passFn);
    validator.registerCheck('architecture', passFn);
    validator.registerCheck('typecheck', passFn);
    validator.registerCheck('lint', passFn);
    validator.registerCheck('tests', passFn);
  });

  it('should return a SystemValidationResult with required fields', async () => {
    const result = await validator.runLadder('wave-1', 'session-abc', false);
    expect(result).toHaveProperty('overall');
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('waveId');
    expect(result).toHaveProperty('checks');
    expect(Array.isArray(result.checks)).toBe(true);
  });

  it('should return overall=PASS when all checks pass', async () => {
    const result = await validator.runLadder('wave-1', 'session-abc', false);
    expect(result.overall).toBe('PASS');
    expect(result.failedAt).toBeUndefined();
  });

  it('should include 7 check results when playwright is not required', async () => {
    const result = await validator.runLadder('wave-1', 'session-abc', false);
    expect(result.checks).toHaveLength(7);
  });

  it('should include 8 check results when playwright is required', async () => {
    validator.registerCheck('playwright', async () => ({ status: 'PASS' }));
    const result = await validator.runLadder('wave-1', 'session-abc', true);
    expect(result.checks).toHaveLength(8);
    const playwrightCheck = result.checks.find(c => c.name === 'playwright');
    expect(playwrightCheck).toBeDefined();
  });

  it('should include waveId and sessionId in the result', async () => {
    const result = await validator.runLadder('wave-3', 'session-xyz', false);
    expect(result.waveId).toBe('wave-3');
    expect(result.sessionId).toBe('session-xyz');
  });
});

describe('SystemValidator — short-circuit on failure', () => {
  let validator: SystemValidatorStub;

  beforeEach(() => {
    validator = new SystemValidatorStub();
  });

  it('should stop at physicality and mark remaining checks as PENDING', async () => {
    validator.registerCheck('physicality', async () => ({ status: 'FAIL', details: 'src/foo.ts missing' }));
    validator.registerCheck('goal-backward', async () => ({ status: 'PASS' }));
    validator.registerCheck('contracts', async () => ({ status: 'PASS' }));
    validator.registerCheck('architecture', async () => ({ status: 'PASS' }));
    validator.registerCheck('typecheck', async () => ({ status: 'PASS' }));
    validator.registerCheck('lint', async () => ({ status: 'PASS' }));
    validator.registerCheck('tests', async () => ({ status: 'PASS' }));

    const result = await validator.runLadder('wave-1', 'sess-1', false);
    expect(result.overall).toBe('FAIL');
    expect(result.failedAt).toBe('physicality');

    const physicalityCheck = result.checks.find(c => c.name === 'physicality');
    expect(physicalityCheck?.status).toBe('FAIL');

    const pendingChecks = result.checks.filter(c => c.status === 'PENDING');
    expect(pendingChecks.length).toBeGreaterThan(0);
  });

  it('should set failedAt to the first failing check name', async () => {
    validator.registerCheck('physicality', async () => ({ status: 'PASS' }));
    validator.registerCheck('goal-backward', async () => ({ status: 'FAIL', details: 'Stub found' }));
    validator.registerCheck('contracts', async () => ({ status: 'PASS' }));
    validator.registerCheck('architecture', async () => ({ status: 'PASS' }));
    validator.registerCheck('typecheck', async () => ({ status: 'PASS' }));
    validator.registerCheck('lint', async () => ({ status: 'PASS' }));
    validator.registerCheck('tests', async () => ({ status: 'PASS' }));

    const result = await validator.runLadder('wave-1', 'sess-1', false);
    expect(result.failedAt).toBe('goal-backward');
  });

  it('should include durationMs for each completed check', async () => {
    const passFn = async () => ({ status: 'PASS' as CheckStatus });
    ['physicality', 'goal-backward', 'contracts', 'architecture', 'typecheck', 'lint', 'tests'].forEach(name => {
      validator.registerCheck(name as CheckName, passFn);
    });

    const result = await validator.runLadder('wave-1', 'sess-1', false);
    for (const check of result.checks.filter(c => c.status !== 'PENDING')) {
      expect(typeof check.durationMs).toBe('number');
      expect(check.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
