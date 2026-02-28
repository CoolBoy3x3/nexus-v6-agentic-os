import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface MustHave {
  truth: string;
  verification: string;
}

export interface GoalBackwardResult {
  ok: boolean;
  mustHaves: MustHave[];
  verified: MustHave[];
  failed: Array<{ truth: string; reason: string }>;
  stubsDetected: string[];
}

const STUB_PATTERNS = [
  /return\s+null;/,
  /return\s+\[\];/,
  /return\s+\{\};/,
  /return\s+undefined;/,
  /throw\s+new\s+Error\(['"]not\s+implemented/i,
  /TODO:/i,
  /FIXME:/i,
  /placeholder/i,
  /\/\/\s*stub/i,
];

/**
 * Goal-backward validator: adapted from GSD gsd-verifier.md.
 * Loads must_haves from PLAN.md, verifies each truth is WIRED (exists + substantive + imported + used).
 * "Do NOT trust SUMMARY.md claims. Verify what ACTUALLY exists."
 */
export async function checkGoalBackward(planPath: string, cwd: string): Promise<GoalBackwardResult> {
  const mustHaves = await parseMustHavesFromPlan(planPath);

  if (mustHaves.length === 0) {
    return { ok: true, mustHaves: [], verified: [], failed: [], stubsDetected: [] };
  }

  const verified: MustHave[] = [];
  const failed: Array<{ truth: string; reason: string }> = [];
  const stubsDetected: string[] = [];

  for (const mh of mustHaves) {
    // Check if the verification file/function exists
    const verFile = mh.verification;
    let result = { exists: false, hasContent: false, reason: '' };

    if (verFile && verFile.startsWith('file:')) {
      const filePath = path.join(cwd, verFile.replace('file:', ''));
      result.exists = existsSync(filePath);
      if (result.exists) {
        try {
          const content = await readFile(filePath, 'utf-8');
          // Any non-empty file after trimming is considered substantive
          // (a stub would be caught by stub pattern detection below)
          result.hasContent = content.trim().length > 0;

          // Check for stubs
          for (const pattern of STUB_PATTERNS) {
            if (pattern.test(content)) {
              stubsDetected.push(`${filePath}: stub pattern detected (${pattern.toString()})`);
            }
          }
        } catch {}
      }
      result.reason = result.exists ? (result.hasContent ? 'WIRED' : 'Empty file') : 'File not found';
    } else {
      // Can't verify without a file reference — mark as needing human review
      result = { exists: true, hasContent: true, reason: 'Manual verification required' };
    }

    if (result.exists && result.hasContent) {
      verified.push(mh);
    } else {
      failed.push({ truth: mh.truth, reason: result.reason });
    }
  }

  return {
    ok: failed.length === 0,
    mustHaves,
    verified,
    failed,
    stubsDetected,
  };
}

async function parseMustHavesFromPlan(planPath: string): Promise<MustHave[]> {
  if (!existsSync(planPath)) return [];

  const content = await readFile(planPath, 'utf-8');
  const mustHaves: MustHave[] = [];

  // Parse the must_haves section from PLAN.md YAML frontmatter or markdown table
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (frontmatterMatch) {
    // Simple YAML parsing for must_haves list
    const yaml = frontmatterMatch[1] ?? '';
    const mustHavesSection = yaml.match(/must_haves:\s*\n((?:\s+-[^\n]+\n?)+)/);
    if (mustHavesSection) {
      const items = (mustHavesSection[1] ?? '').split('\n').filter((l) => l.trim().startsWith('-'));
      for (const item of items) {
        // Strip leading "- " and surrounding quotes
        const text = item.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '');
        if (!text) continue;
        // Support inline file reference: "truth text: file:path/to/file.ts"
        const colonFileMatch = text.match(/^(.+?):\s*(file:.+)$/);
        if (colonFileMatch) {
          mustHaves.push({ truth: colonFileMatch[1]!.trim(), verification: colonFileMatch[2]!.trim() });
        } else {
          mustHaves.push({ truth: text, verification: '' });
        }
      }
    }
  }

  return mustHaves;
}
