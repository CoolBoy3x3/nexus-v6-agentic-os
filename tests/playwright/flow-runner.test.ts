import { describe, it, expect, vi, beforeEach } from 'vitest';

// FlowSpec types (matching nexus-playwright/src/flow-runner.ts)
type StepAction =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'screenshot'
  | 'waitForURL'
  | 'assertVisible'
  | 'assertText'
  | 'assertURL'
  | 'hover'
  | 'select';

interface FlowStep {
  action: StepAction;
  selector?: string;
  url?: string;
  value?: string;
  name?: string;
  message?: string;
  expected?: string;
  timeout?: number;
}

interface FlowAssertion {
  type: 'url' | 'visible' | 'text';
  selector?: string;
  expected?: string;
  description: string;
}

interface FlowSpec {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  timeout: number;
  steps: FlowStep[];
  assertions: FlowAssertion[];
}

type FlowRunStatus = 'PASS' | 'FAIL' | 'ERROR';

interface FlowRunResult {
  flowId: string;
  status: FlowRunStatus;
  stepsCompleted: number;
  totalSteps: number;
  failedStep?: number;
  errorMessage?: string;
  durationMs: number;
}

// Stub FlowRunner for unit testing
class FlowRunnerStub {
  private flowSpecs: Map<string, FlowSpec> = new Map();
  private stepExecutor: (step: FlowStep, baseUrl: string) => Promise<{ success: boolean; error?: string }>;

  constructor(
    stepExecutor: (step: FlowStep, baseUrl: string) => Promise<{ success: boolean; error?: string }>
  ) {
    this.stepExecutor = stepExecutor;
  }

  loadFlowSpec(id: string, spec: FlowSpec): void {
    this.flowSpecs.set(id, spec);
  }

  listFlows(): FlowSpec[] {
    return Array.from(this.flowSpecs.values());
  }

  getFlow(id: string): FlowSpec | undefined {
    return this.flowSpecs.get(id);
  }

  async runFlow(id: string): Promise<FlowRunResult> {
    const spec = this.flowSpecs.get(id);
    if (!spec) {
      return {
        flowId: id,
        status: 'ERROR',
        stepsCompleted: 0,
        totalSteps: 0,
        errorMessage: `Flow not found: ${id}`,
        durationMs: 0,
      };
    }

    const start = Date.now();
    let stepsCompleted = 0;

    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i];
      const { success, error } = await this.stepExecutor(step, spec.baseUrl);
      if (success) {
        stepsCompleted++;
      } else {
        return {
          flowId: id,
          status: 'FAIL',
          stepsCompleted,
          totalSteps: spec.steps.length,
          failedStep: i + 1,
          errorMessage: error,
          durationMs: Date.now() - start,
        };
      }
    }

    return {
      flowId: id,
      status: 'PASS',
      stepsCompleted,
      totalSteps: spec.steps.length,
      durationMs: Date.now() - start,
    };
  }
}

const sampleSpec: FlowSpec = {
  id: 'login-happy-path',
  name: 'Login Happy Path',
  description: 'User logs in with valid credentials',
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  steps: [
    { action: 'navigate', url: '/login' },
    { action: 'fill', selector: '[data-testid="email"]', value: 'test@example.com' },
    { action: 'fill', selector: '[data-testid="password"]', value: 'password123' },
    { action: 'click', selector: '[data-testid="login-button"]' },
    { action: 'waitForURL', url: '/dashboard', timeout: 5000 },
    { action: 'screenshot', name: 'dashboard-after-login' },
    { action: 'assertVisible', selector: '[data-testid="user-menu"]', message: 'User menu visible' },
  ],
  assertions: [
    { type: 'url', expected: '/dashboard', description: 'Lands on dashboard' },
    { type: 'visible', selector: '[data-testid="user-menu"]', description: 'User menu shown' },
  ],
};

describe('FlowRunner — loadFlowSpec and listFlows', () => {
  it('should load a flow spec and retrieve it by id', () => {
    const runner = new FlowRunnerStub(async () => ({ success: true }));
    runner.loadFlowSpec('login-happy-path', sampleSpec);
    const spec = runner.getFlow('login-happy-path');
    expect(spec).toBeDefined();
    expect(spec!.id).toBe('login-happy-path');
    expect(spec!.name).toBe('Login Happy Path');
  });

  it('should list all loaded flow specs', () => {
    const runner = new FlowRunnerStub(async () => ({ success: true }));
    runner.loadFlowSpec('login-happy-path', sampleSpec);
    runner.loadFlowSpec('signup-flow', { ...sampleSpec, id: 'signup-flow', name: 'Signup Flow' });
    const flows = runner.listFlows();
    expect(flows).toHaveLength(2);
    expect(flows.map(f => f.id)).toContain('login-happy-path');
    expect(flows.map(f => f.id)).toContain('signup-flow');
  });

  it('should return undefined for an unknown flow id', () => {
    const runner = new FlowRunnerStub(async () => ({ success: true }));
    const spec = runner.getFlow('nonexistent-flow');
    expect(spec).toBeUndefined();
  });
});

describe('FlowRunner — runFlow', () => {
  it('should return PASS when all steps succeed', async () => {
    const runner = new FlowRunnerStub(async () => ({ success: true }));
    runner.loadFlowSpec('login-happy-path', sampleSpec);
    const result = await runner.runFlow('login-happy-path');
    expect(result.status).toBe('PASS');
    expect(result.stepsCompleted).toBe(sampleSpec.steps.length);
    expect(result.totalSteps).toBe(sampleSpec.steps.length);
  });

  it('should return FAIL when a step fails, with the step number and error', async () => {
    let callCount = 0;
    const runner = new FlowRunnerStub(async () => {
      callCount++;
      // Fail on step 4 (login button click)
      if (callCount === 4) return { success: false, error: 'Element not found: [data-testid="login-button"]' };
      return { success: true };
    });
    runner.loadFlowSpec('login-happy-path', sampleSpec);
    const result = await runner.runFlow('login-happy-path');
    expect(result.status).toBe('FAIL');
    expect(result.failedStep).toBe(4);
    expect(result.stepsCompleted).toBe(3);
    expect(result.errorMessage).toContain('login-button');
  });

  it('should return ERROR when flow id is not found', async () => {
    const runner = new FlowRunnerStub(async () => ({ success: true }));
    const result = await runner.runFlow('does-not-exist');
    expect(result.status).toBe('ERROR');
    expect(result.errorMessage).toContain('does-not-exist');
    expect(result.stepsCompleted).toBe(0);
  });

  it('should include durationMs in the result', async () => {
    const runner = new FlowRunnerStub(async () => ({ success: true }));
    runner.loadFlowSpec('login-happy-path', sampleSpec);
    const result = await runner.runFlow('login-happy-path');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should track stepsCompleted accurately on partial failure', async () => {
    let callCount = 0;
    const runner = new FlowRunnerStub(async () => {
      callCount++;
      if (callCount === 2) return { success: false, error: 'Fill failed' };
      return { success: true };
    });
    runner.loadFlowSpec('login-happy-path', sampleSpec);
    const result = await runner.runFlow('login-happy-path');
    expect(result.stepsCompleted).toBe(1); // Only step 1 completed before step 2 failed
  });
});
