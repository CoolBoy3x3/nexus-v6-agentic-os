import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { TaskNode } from '@nexus/core';

export interface AdversarialResult {
  ok: boolean;
  findings: AdversarialFinding[];
  riskScore: number; // 0-10
}

export interface AdversarialFinding {
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high';
  category: string;
  detail: string;
}

const SUSPICIOUS_PATTERNS: Array<{
  pattern: RegExp;
  category: string;
  severity: AdversarialFinding['severity'];
  detail: string;
}> = [
  { pattern: /TODO:/i, category: 'incomplete', severity: 'medium', detail: 'TODO comment — may indicate unfinished implementation' },
  { pattern: /FIXME:/i, category: 'incomplete', severity: 'high', detail: 'FIXME comment — known bug left unresolved' },
  { pattern: /HACK:/i, category: 'code-smell', severity: 'medium', detail: 'HACK comment — suspicious shortcut' },
  { pattern: /any\s+as\s+any/i, category: 'type-safety', severity: 'medium', detail: 'Double-any cast — type safety bypassed' },
  { pattern: /eslint-disable/i, category: 'lint-bypass', severity: 'medium', detail: 'ESLint disable comment' },
  { pattern: /console\.log\(/i, category: 'debug-code', severity: 'low', detail: 'console.log left in production code' },
  { pattern: /password\s*=\s*['"][^'"]+['"]/i, category: 'secret-hardcoded', severity: 'high', detail: 'Hardcoded password detected' },
  { pattern: /secret\s*=\s*['"][^'"]+['"]/i, category: 'secret-hardcoded', severity: 'high', detail: 'Hardcoded secret detected' },
  { pattern: /api_key\s*=\s*['"][^'"]+['"]/i, category: 'secret-hardcoded', severity: 'high', detail: 'Hardcoded API key detected' },
  { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/i, category: 'swallowed-error', severity: 'high', detail: 'Empty catch block — error silently swallowed' },
  { pattern: /\.find\([^)]+\)\./i, category: 'null-deref', severity: 'medium', detail: '.find() result used without null check' },
];

export async function checkAdversarial(task: TaskNode, cwd: string): Promise<AdversarialResult> {
  const findings: AdversarialFinding[] = [];

  for (const filePath of task.filesModified) {
    const absPath = path.join(cwd, filePath);
    if (!existsSync(absPath)) continue;

    let content: string;
    try {
      content = await readFile(absPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const { pattern, category, severity, detail } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(line)) {
          findings.push({ file: filePath, line: i + 1, severity, category, detail });
        }
      }
    }
  }

  const scoreMap: Record<AdversarialFinding['severity'], number> = { low: 1, medium: 3, high: 7 };
  const riskScore = Math.min(
    10,
    findings.reduce((sum, f) => sum + scoreMap[f.severity], 0),
  );

  const highFindings = findings.filter((f) => f.severity === 'high');

  return {
    ok: highFindings.length === 0,
    findings,
    riskScore,
  };
}
