import { describe, it, expect, vi, beforeEach } from 'vitest';

// Types for goal-backward validation
interface AcceptanceCriterion {
  id: string;
  text: string;
  mustHave: boolean;
}

interface StubDetection {
  file: string;
  functionName: string;
  evidence: string;
  line: number;
}

type GoalBackwardStatus = 'PASS' | 'FAIL';

interface GoalBackwardResult {
  overall: GoalBackwardStatus;
  missingCriteria: AcceptanceCriterion[];
  stubs: StubDetection[];
  coveredCriteria: string[];
}

// Stub patterns that indicate a function is not properly implemented
const STUB_PATTERNS = [
  /throw new Error\(['"]not implemented['"]\)/i,
  /throw new Error\(['"]TODO['"]\)/i,
  /\/\/\s*TODO:/i,
  /return null;?\s*\/\/\s*stub/i,
  /return undefined;?\s*\/\/\s*stub/i,
];

function isStubBody(body: string): boolean {
  return STUB_PATTERNS.some(pattern => pattern.test(body));
}

// Stub GoalBackwardChecker for unit testing
class GoalBackwardCheckerStub {
  checkStubs(sourceFiles: Record<string, string>): StubDetection[] {
    const stubs: StubDetection[] = [];

    for (const [file, content] of Object.entries(sourceFiles)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isStubBody(line)) {
          // Try to find the enclosing function name
          let functionName = 'unknown';
          for (let j = i; j >= 0; j--) {
            const match = lines[j].match(/(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/);
            if (match) {
              functionName = match[1] || match[2] || 'unknown';
              break;
            }
          }
          stubs.push({
            file,
            functionName,
            evidence: line.trim(),
            line: i + 1,
          });
        }
      }
    }

    return stubs;
  }

  parseMustHaveCriteria(acceptanceMasterContent: string): AcceptanceCriterion[] {
    const lines = acceptanceMasterContent.split('\n');
    const criteria: AcceptanceCriterion[] = [];

    for (const line of lines) {
      const mustMatch = line.match(/\[MUST\]\s*(AC-\d+):\s*(.+)/);
      if (mustMatch) {
        criteria.push({
          id: mustMatch[1],
          text: mustMatch[2].trim(),
          mustHave: true,
        });
      }
      const shouldMatch = line.match(/\[SHOULD\]\s*(AC-\d+):\s*(.+)/);
      if (shouldMatch) {
        criteria.push({
          id: shouldMatch[1],
          text: shouldMatch[2].trim(),
          mustHave: false,
        });
      }
    }

    return criteria;
  }

  check(
    taskCriteriaIds: string[],
    allCriteria: AcceptanceCriterion[],
    sourceFiles: Record<string, string>
  ): GoalBackwardResult {
    const stubs = this.checkStubs(sourceFiles);
    const mustHave = allCriteria.filter(c => c.mustHave && taskCriteriaIds.includes(c.id));
    const coveredCriteria = taskCriteriaIds.filter(id => allCriteria.some(c => c.id === id));
    const missingCriteria = mustHave.filter(c => !taskCriteriaIds.includes(c.id));

    const overall: GoalBackwardStatus = stubs.length === 0 && missingCriteria.length === 0
      ? 'PASS'
      : 'FAIL';

    return { overall, missingCriteria, stubs, coveredCriteria };
  }
}

describe('GoalBackwardChecker — must-have parsing', () => {
  let checker: GoalBackwardCheckerStub;

  beforeEach(() => {
    checker = new GoalBackwardCheckerStub();
  });

  it('should parse [MUST] criteria from acceptance master content', () => {
    const content = `
# Acceptance Criteria

[MUST] AC-01: Given a valid JWT, when validateToken is called, then it returns the payload
[MUST] AC-02: Given an expired JWT, when validateToken is called, then it throws TokenExpiredError
[SHOULD] AC-03: Given an invalid signature, it should log a warning
`;
    const criteria = checker.parseMustHaveCriteria(content);
    const mustHave = criteria.filter(c => c.mustHave);
    expect(mustHave).toHaveLength(2);
    expect(mustHave[0].id).toBe('AC-01');
    expect(mustHave[1].id).toBe('AC-02');
  });

  it('should parse [SHOULD] criteria as non-must-have', () => {
    const content = `[SHOULD] AC-03: Given an invalid signature, it should log a warning\n`;
    const criteria = checker.parseMustHaveCriteria(content);
    expect(criteria[0].mustHave).toBe(false);
  });

  it('should return empty array for content with no criteria', () => {
    const criteria = checker.parseMustHaveCriteria('# Acceptance Criteria\n\nNo criteria yet.\n');
    expect(criteria).toHaveLength(0);
  });
});

describe('GoalBackwardChecker — stub detection', () => {
  let checker: GoalBackwardCheckerStub;

  beforeEach(() => {
    checker = new GoalBackwardCheckerStub();
  });

  it('should detect "throw new Error(not implemented)" as a stub', () => {
    const files = {
      'src/auth/jwt.ts': `
export function validateToken(token: string) {
  throw new Error('not implemented');
}
`,
    };
    const stubs = checker.checkStubs(files);
    expect(stubs.length).toBeGreaterThan(0);
    expect(stubs[0].file).toBe('src/auth/jwt.ts');
    expect(stubs[0].evidence).toContain('not implemented');
  });

  it('should detect "// TODO:" comments as stub indicators', () => {
    const files = {
      'src/payments/stripe.ts': `
export function chargeCard(amount: number) {
  // TODO: implement Stripe integration
}
`,
    };
    const stubs = checker.checkStubs(files);
    expect(stubs.length).toBeGreaterThan(0);
  });

  it('should not flag a properly implemented function as a stub', () => {
    const files = {
      'src/auth/jwt.ts': `
import jwt from 'jsonwebtoken';
export function validateToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!);
}
`,
    };
    const stubs = checker.checkStubs(files);
    expect(stubs).toHaveLength(0);
  });

  it('should detect stubs across multiple files', () => {
    const files = {
      'src/auth/jwt.ts': `function validate() { throw new Error('not implemented'); }`,
      'src/payments/stripe.ts': `function charge() { throw new Error('not implemented'); }`,
    };
    const stubs = checker.checkStubs(files);
    expect(stubs.length).toBe(2);
  });
});

describe('GoalBackwardChecker — overall check', () => {
  let checker: GoalBackwardCheckerStub;

  beforeEach(() => {
    checker = new GoalBackwardCheckerStub();
  });

  it('should return PASS when no stubs and all criteria are covered', () => {
    const criteria: AcceptanceCriterion[] = [
      { id: 'AC-01', text: 'Some criterion', mustHave: true },
    ];
    const result = checker.check(
      ['AC-01'],
      criteria,
      { 'src/auth.ts': 'export function authenticate() { return true; }' }
    );
    expect(result.overall).toBe('PASS');
    expect(result.stubs).toHaveLength(0);
    expect(result.missingCriteria).toHaveLength(0);
  });

  it('should return FAIL when stubs are detected', () => {
    const criteria: AcceptanceCriterion[] = [
      { id: 'AC-01', text: 'Some criterion', mustHave: true },
    ];
    const result = checker.check(
      ['AC-01'],
      criteria,
      { 'src/auth.ts': "export function authenticate() { throw new Error('not implemented'); }" }
    );
    expect(result.overall).toBe('FAIL');
    expect(result.stubs.length).toBeGreaterThan(0);
  });
});
