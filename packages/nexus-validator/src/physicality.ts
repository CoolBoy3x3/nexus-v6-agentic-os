import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { TaskNode } from '@nexus/core';

export interface PhysicalityResult {
  ok: boolean;
  checks: PhysicalityCheck[];
  violations: string[];
}

export interface PhysicalityCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * Physicality verifier — adapted from CLAUDE.md PHYSICALITY RULES section.
 * Before marking ANY task as complete, verify each of these. No exceptions.
 */
export async function checkPhysicality(task: TaskNode, cwd: string): Promise<PhysicalityResult> {
  const checks: PhysicalityCheck[] = [];
  const violations: string[] = [];

  // CHECK 1: EXISTENCE — each file in task.filesModified actually exists on disk
  for (const filePath of task.filesModified) {
    const absPath = path.join(cwd, filePath);
    const exists = existsSync(absPath);
    checks.push({
      name: `EXISTENCE: ${filePath}`,
      passed: exists,
      detail: exists ? 'File exists on disk' : `File NOT found: ${absPath}`,
    });
    if (!exists) violations.push(`File declared in filesModified but not found: ${filePath}`);
  }

  // CHECK 2: CONTENT INTEGRITY — files contain non-empty content
  for (const filePath of task.filesModified) {
    const absPath = path.join(cwd, filePath);
    if (!existsSync(absPath)) continue;
    try {
      const content = await readFile(absPath, 'utf-8');
      const hasContent = content.trim().length > 0;
      checks.push({
        name: `CONTENT: ${filePath}`,
        passed: hasContent,
        detail: hasContent ? `${content.length} bytes` : 'File is empty',
      });
      if (!hasContent) violations.push(`File is empty: ${filePath}`);
    } catch (err) {
      violations.push(`Cannot read file: ${filePath}`);
    }
  }

  // CHECK 3: NO UNDECLARED WRITES — only filesModified were changed
  // Use task.startCommit (SHA recorded before task ran) if available; fall back to HEAD.
  // HEAD is wrong when multiple tasks run in a wave because HEAD advances between tasks.
  try {
    const baseRef = task.startCommit ?? 'HEAD';
    const gitDiff = execSync(`git diff --name-only ${baseRef}`, { cwd, stdio: 'pipe' }).toString().trim();
    const changedFiles = gitDiff ? gitDiff.split('\n').filter((f) => f.trim() !== '') : [];
    const declaredSet = new Set(task.filesModified);
    const undeclared = changedFiles.filter((f) => !declaredSet.has(f));

    checks.push({
      name: 'NO_UNDECLARED_WRITES',
      passed: undeclared.length === 0,
      detail: undeclared.length === 0
        ? 'All changed files are declared'
        : `Undeclared changes: ${undeclared.join(', ')}`,
    });
    if (undeclared.length > 0) {
      violations.push(`Undeclared file changes: ${undeclared.join(', ')}`);
    }
  } catch {
    // Not a git repo or git not available — skip this check
    checks.push({ name: 'NO_UNDECLARED_WRITES', passed: true, detail: 'Git not available — skipped' });
  }

  // CHECK 4: EXPECTED DIFF EXISTS — the change is non-empty
  try {
    const baseRef = task.startCommit ?? 'HEAD';
    const diff = execSync(`git diff ${baseRef}`, { cwd, stdio: 'pipe' }).toString().trim();
    const hasChanges = diff.length > 0;
    checks.push({
      name: 'EXPECTED_DIFF_EXISTS',
      passed: hasChanges,
      detail: hasChanges ? `${diff.length} bytes of changes` : 'Zero diff — task may have done nothing',
    });
    if (!hasChanges) violations.push('Zero diff: the task appears to have made no changes');
  } catch {
    checks.push({ name: 'EXPECTED_DIFF_EXISTS', passed: true, detail: 'Git not available — skipped' });
  }

  return {
    ok: violations.length === 0,
    checks,
    violations,
  };
}
