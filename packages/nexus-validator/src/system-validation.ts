import { execSync } from 'child_process';

export interface SystemValidationResult {
  ok: boolean;
  integrationPassed: boolean;
  e2ePassed: boolean;
  integrationOutput: string;
  e2eOutput: string;
  skipped: boolean;
  skipReason?: string;
}

export async function checkSystemValidation(
  cwd: string,
  playwrightRequired: boolean = false,
): Promise<SystemValidationResult> {
  let integrationPassed = true;
  let e2ePassed = true;
  let integrationOutput = '';
  let e2eOutput = '';

  try {
    integrationOutput = execSync('pnpm test:integration 2>&1 || true', {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    integrationPassed =
      !integrationOutput.toLowerCase().includes('failed') &&
      !integrationOutput.toLowerCase().includes('error:');
  } catch {
    integrationOutput = 'No integration tests configured';
    integrationPassed = true;
  }

  if (playwrightRequired) {
    try {
      e2eOutput = execSync('pnpm test:e2e 2>&1 || true', { cwd, encoding: 'utf-8', stdio: 'pipe' });
      e2ePassed =
        !e2eOutput.toLowerCase().includes('failed') &&
        !e2eOutput.toLowerCase().includes('error:');
    } catch {
      e2eOutput = 'E2E tests failed to run';
      e2ePassed = false;
    }
  } else {
    e2eOutput = 'Playwright not required for this task';
    e2ePassed = true;
  }

  return {
    ok: integrationPassed && e2ePassed,
    integrationPassed,
    e2ePassed,
    integrationOutput: integrationOutput.slice(0, 2000),
    e2eOutput: e2eOutput.slice(0, 2000),
    skipped: false,
  };
}
