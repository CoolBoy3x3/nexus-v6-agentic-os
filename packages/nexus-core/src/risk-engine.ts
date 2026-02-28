import type { TaskNode } from './types.js';
import type { RiskTier, TDDMode, ReviewTier } from './constants.js';

const CRITICAL_KEYWORDS = [
  'migration', 'schema migration', 'alter table', 'drop table', 'drop column',
  'auth', 'authentication', 'authorization', 'password', 'secret', 'encryption',
  'permission', 'access control', 'token', 'jwt', 'oauth',
  'irreversible', 'destructive', 'purge', 'truncate',
];

const HIGH_RISK_FILES = [
  'api_contracts', 'data_models', 'dependencies', 'auth', 'middleware/auth',
  'schema', 'migration', '.env',
];

/**
 * Calculates the risk tier for a task based on its characteristics.
 * Risk determines required safeguards (checkpoint, human approval, adversarial review).
 */
export function calculateRisk(task: Partial<TaskNode>): RiskTier {
  const desc = (task.description ?? '').toLowerCase();
  const files = task.filesModified ?? [];

  // Critical: schema migrations, auth changes, irreversible actions
  if (CRITICAL_KEYWORDS.some((kw) => desc.includes(kw))) return 'critical';
  if (files.some((f) => f.includes('migration') || f.includes('schema') || f.match(/\.(sql|prisma)$/))) {
    return 'critical';
  }

  // High: contract changes, 5+ files, high-risk file patterns
  if (files.length >= 5) return 'high';
  if (files.some((f) => HIGH_RISK_FILES.some((hrf) => f.includes(hrf)))) return 'high';
  if (desc.includes('refactor') && files.length >= 3) return 'high';

  // Medium: core logic modifications, 2+ files, new endpoints
  if (files.length >= 2) return 'medium';
  if (desc.includes('endpoint') || desc.includes('api') || desc.includes('route')) return 'medium';
  if (desc.includes('config') || desc.includes('configuration')) return 'medium';

  return 'low';
}

/**
 * Suggests the appropriate TDD mode for a task.
 * Workers should declare this explicitly in task frontmatter.
 */
export function suggestTDDMode(task: Partial<TaskNode>): TDDMode {
  const desc = (task.description ?? '').toLowerCase();
  const files = task.filesModified ?? [];

  // Skip: pure docs, config, generated code
  if (files.every((f) => f.match(/\.(md|json|yaml|yml|toml|env)$/) || f.includes('generated'))) {
    return 'skip';
  }
  if (desc.includes('documentation') || desc.includes('readme') || desc.includes('config only')) {
    return 'skip';
  }

  // Hard: new features, bug fixes, regressions
  if (desc.includes('bug') || desc.includes('fix') || desc.includes('regression') || desc.includes('feature')) {
    return 'hard';
  }

  return 'standard';
}

/**
 * Suggests the review tier for a task.
 */
export function suggestReviewTier(task: Partial<TaskNode>): ReviewTier {
  const risk = calculateRisk(task);
  if (risk === 'critical' || risk === 'high') return 'adversarial';
  if (risk === 'medium') return 'peer';

  const files = task.filesModified ?? [];
  if (files.some((f) => f.includes('shared') || f.includes('common') || f.includes('utils'))) {
    return 'peer';
  }

  const desc = (task.description ?? '').toLowerCase();
  if (desc.match(/^(documentation|readme|comment|format|lint)/)) return 'none';

  return 'self';
}
