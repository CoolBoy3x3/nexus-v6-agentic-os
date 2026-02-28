import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { TaskNode, VerificationResult } from '@nexus/core';
import { NEXUS_DIRS } from '@nexus/core';
import { checkPhysicality } from './physicality.js';
import { checkDeterministic } from './deterministic.js';
import { runDeltaTests } from './delta-tests.js';
import { checkGoalBackward } from './goal-backward.js';
import { checkAdversarial } from './adversarial.js';
import { checkSystemValidation } from './system-validation.js';

export interface VerificationOptions {
  planPath?: string;
  playwrightRequired?: boolean;
  skipStages?: Array<'physicality' | 'deterministic' | 'delta' | 'goal' | 'adversarial' | 'system'>;
}

/**
 * Full verification ladder runner.
 * Sequence: physicality → deterministic → delta-tests → goal-backward → adversarial → system
 */
export async function runVerificationLadder(
  task: TaskNode,
  cwd: string,
  opts: VerificationOptions = {},
): Promise<VerificationResult> {
  const timestamp = new Date().toISOString();
  const gaps: VerificationResult['gaps'] = [];
  let physicalityOk = true;
  let deterministicOk = true;
  let goalBackwardOk = true;
  let adversarialOk = true;
  let systemValidationOk = true;
  // playwrightOk: true unless playwright is required AND system validation (which runs E2E) failed
  let playwrightOk = true;

  const skip = opts.skipStages ?? [];

  if (!skip.includes('physicality')) {
    const phys = await checkPhysicality(task, cwd);
    physicalityOk = phys.ok;
    if (!phys.ok) {
      gaps.push({
        truth: 'Physical file existence and content integrity',
        status: 'failed',
        reason: phys.violations.join('; '),
        artifacts: [],
        missing: phys.violations,
      });
    }
  }

  if (!skip.includes('deterministic')) {
    const det = await checkDeterministic(cwd);
    deterministicOk = det.ok;
    if (!det.ok) {
      const reasons = [];
      if (!det.lintPassed) reasons.push('Lint failed');
      if (!det.typecheckPassed) reasons.push('TypeCheck failed');
      if (!det.testsPassed) reasons.push('Tests failed');
      gaps.push({
        truth: 'Lint, typecheck, and tests all pass',
        status: 'failed',
        reason: reasons.join('; '),
        artifacts: [],
        missing: reasons,
      });
    }
  }

  if (!skip.includes('delta') && task.tddMode !== 'skip') {
    const delta = await runDeltaTests(task, cwd);
    if (!delta.skipped && !delta.ok) {
      deterministicOk = false;
      gaps.push({
        truth: 'Delta tests pass for changed files',
        status: 'failed',
        reason: 'Delta tests failed: ' + delta.output.slice(0, 200),
        artifacts: [],
        missing: [`Tests failed for: ${delta.testsRun.join(', ')}`],
      });
    }
  }

  if (!skip.includes('goal') && opts.planPath) {
    const goal = await checkGoalBackward(opts.planPath, cwd);
    goalBackwardOk = goal.ok;
    if (!goal.ok) {
      gaps.push({
        truth: 'All must-have acceptance criteria met',
        status: 'failed',
        reason: goal.failed.map((f) => `${f.truth}: ${f.reason}`).join('; '),
        artifacts: [],
        missing: goal.failed.map((f) => f.truth),
      });
    }
  }

  if (!skip.includes('adversarial')) {
    const adv = await checkAdversarial(task, cwd);
    adversarialOk = adv.ok;
    if (!adv.ok) {
      gaps.push({
        truth: 'No high-severity adversarial findings',
        status: 'failed',
        reason: adv.findings
          .filter((f) => f.severity === 'high')
          .map((f) => f.detail)
          .join('; '),
        artifacts: [],
        missing: adv.findings.filter((f) => f.severity === 'high').map((f) => f.detail),
      });
    }
  }

  if (!skip.includes('system')) {
    const sys = await checkSystemValidation(cwd, opts.playwrightRequired ?? false);
    systemValidationOk = sys.ok;
    // If playwright is required, its result is captured inside systemValidation (E2E rung)
    if (opts.playwrightRequired && !sys.e2ePassed) playwrightOk = false;
    if (!sys.ok) {
      gaps.push({
        truth: 'Integration and E2E tests pass',
        status: 'failed',
        reason: !sys.integrationPassed
          ? sys.integrationOutput.slice(0, 200)
          : sys.e2eOutput.slice(0, 200),
        artifacts: [],
        missing: [],
      });
    }
  }

  const allOk =
    physicalityOk &&
    deterministicOk &&
    goalBackwardOk &&
    adversarialOk &&
    systemValidationOk &&
    playwrightOk;
  const passedCount = [
    physicalityOk,
    deterministicOk,
    goalBackwardOk,
    adversarialOk,
    systemValidationOk,
    playwrightOk,
  ].filter(Boolean).length;

  const result: VerificationResult = {
    taskId: task.id,
    timestamp,
    status: allOk ? 'passed' : gaps.length > 0 ? 'gaps_found' : 'human_needed',
    score: `${passedCount}/6 must-haves verified`,
    physicalityOk,
    deterministicOk,
    goalBackwardOk,
    adversarialOk,
    systemValidationOk,
    playwrightOk,
    gaps,
    humanItems: [],
    artifacts: [],
  };

  const reportDir = path.join(cwd, NEXUS_DIRS.PLANS);
  await mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `verification-report-${task.id}.json`);
  await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf-8');

  return result;
}
