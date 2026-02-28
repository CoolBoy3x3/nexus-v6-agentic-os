import { execSync } from 'child_process';
import path from 'path';

export interface DeterministicResult {
  ok: boolean;
  lintPassed: boolean;
  typecheckPassed: boolean;
  testsPassed: boolean;
  lintOutput: string;
  typecheckOutput: string;
  testOutput: string;
}

/**
 * Deterministic validator: runs lint, typecheck, and test suite.
 * Reads actual stdout/stderr. Does not assume anything passes.
 */
export async function checkDeterministic(cwd: string): Promise<DeterministicResult> {
  let lintPassed = true;
  let typecheckPassed = true;
  let testsPassed = true;
  let lintOutput = '';
  let typecheckOutput = '';
  let testOutput = '';

  // Run lint
  try {
    lintOutput = execSync('pnpm lint 2>&1 || true', { cwd, encoding: 'utf-8', stdio: 'pipe' });
    lintPassed = !lintOutput.toLowerCase().includes('error');
  } catch (err) {
    lintOutput = err instanceof Error ? err.message : String(err);
    lintPassed = false;
  }

  // Run typecheck
  try {
    typecheckOutput = execSync('pnpm typecheck 2>&1 || true', { cwd, encoding: 'utf-8', stdio: 'pipe' });
    typecheckPassed = !typecheckOutput.toLowerCase().includes('error ts');
  } catch (err) {
    typecheckOutput = err instanceof Error ? err.message : String(err);
    typecheckPassed = false;
  }

  // Run tests
  try {
    testOutput = execSync('pnpm test 2>&1 || true', { cwd, encoding: 'utf-8', stdio: 'pipe' });
    testsPassed =
      !testOutput.toLowerCase().includes('failed') &&
      !testOutput.toLowerCase().includes('error') &&
      (testOutput.toLowerCase().includes('passed') || testOutput.toLowerCase().includes('✓'));
  } catch (err) {
    testOutput = err instanceof Error ? err.message : String(err);
    testsPassed = false;
  }

  return {
    ok: lintPassed && typecheckPassed && testsPassed,
    lintPassed,
    typecheckPassed,
    testsPassed,
    lintOutput: lintOutput.slice(0, 2000),
    typecheckOutput: typecheckOutput.slice(0, 2000),
    testOutput: testOutput.slice(0, 2000),
  };
}
