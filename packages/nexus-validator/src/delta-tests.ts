import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { TaskNode } from '@nexus/core';
import { NEXUS_FILES } from '@nexus/core';

export interface DeltaTestResult {
  ok: boolean;
  testsRun: string[];
  passed: boolean;
  output: string;
  skipped: boolean;
  skipReason?: string;
}

/**
 * Delta test runner: loads test_map.json, runs only tests covering changed files.
 * More targeted than running the full suite.
 */
export async function runDeltaTests(task: TaskNode, cwd: string): Promise<DeltaTestResult> {
  if (task.tddMode === 'skip') {
    return { ok: true, testsRun: [], passed: true, output: '', skipped: true, skipReason: 'tdd_mode: skip' };
  }

  const testMapPath = path.join(cwd, NEXUS_FILES.TEST_MAP);
  if (!existsSync(testMapPath)) {
    return { ok: true, testsRun: [], passed: true, output: '', skipped: true, skipReason: 'No test_map.json found' };
  }

  const raw = await readFile(testMapPath, 'utf-8');
  const testMap = JSON.parse(raw) as Record<string, { sourceFile: string; testFiles: string[] }>;

  // Find test files for changed source files
  const testFiles = new Set<string>();
  for (const changed of task.filesModified) {
    const entry = testMap[changed];
    if (entry) {
      entry.testFiles.forEach((f) => testFiles.add(f));
    }
  }

  if (testFiles.size === 0) {
    return { ok: true, testsRun: [], passed: true, output: 'No test files mapped to changed files', skipped: true };
  }

  const testsToRun = Array.from(testFiles);
  let output = '';
  let passed = true;

  try {
    // Quote each path to handle spaces in filenames
    const testArgs = testsToRun.map((p) => `"${p}"`).join(' ');
    output = execSync(`pnpm vitest run ${testArgs} 2>&1 || true`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    passed =
      !output.toLowerCase().includes('failed') &&
      (output.toLowerCase().includes('passed') || output.toLowerCase().includes('✓'));
  } catch (err) {
    output = err instanceof Error ? err.message : String(err);
    passed = false;
  }

  return {
    ok: passed,
    testsRun: testsToRun,
    passed,
    output: output.slice(0, 3000),
    skipped: false,
  };
}
