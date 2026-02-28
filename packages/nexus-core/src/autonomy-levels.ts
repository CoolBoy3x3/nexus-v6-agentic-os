import type { TaskNode, ProjectSettings } from './types.js';
import type { AutonomyLevel } from './constants.js';
import { RISK_TIER_CONFIG } from './constants.js';

/**
 * Checks whether a task is allowed to run autonomously given the project's settings.
 * Returns { allowed: boolean, reason: string }.
 */
export function isAutonomyAllowed(
  task: TaskNode,
  settings: ProjectSettings,
): { allowed: boolean; reason: string } {
  const riskConfig = RISK_TIER_CONFIG[task.riskTier];

  // Critical risk always requires human approval
  if (riskConfig.requiresHumanApproval) {
    return {
      allowed: false,
      reason: `Task is ${task.riskTier} risk — requires explicit human approval before proceeding.`,
    };
  }

  const projectMax = settings.autonomy.overrides[task.phase] ?? settings.autonomy.default;
  const taskLevel = task.autonomyLevel;
  const tierMax = riskConfig.maxAutonomy;

  const levelOrder: AutonomyLevel[] = ['low', 'medium', 'high'];
  const taskIdx = levelOrder.indexOf(taskLevel);
  const projectIdx = levelOrder.indexOf(projectMax);
  const tierIdx = levelOrder.indexOf(tierMax);

  // Guard: if any level value is unrecognized, fail safe (deny autonomy)
  if (taskIdx === -1 || projectIdx === -1 || tierIdx === -1) {
    return {
      allowed: false,
      reason: `Unrecognized autonomy level — task: "${taskLevel}", project: "${projectMax}", tier: "${tierMax}". Denying autonomy as a safety measure.`,
    };
  }

  const effectiveIdx = Math.min(projectIdx, tierIdx);
  const effectiveMax = levelOrder[effectiveIdx]!;

  if (taskIdx > effectiveIdx) {
    return {
      allowed: false,
      reason: `Task requires autonomy level "${taskLevel}" but effective max is "${effectiveMax}" (project: ${projectMax}, risk tier ${task.riskTier}: ${tierMax}).`,
    };
  }

  return { allowed: true, reason: 'Autonomy check passed.' };
}

/**
 * Returns the effective autonomy level — the minimum of project default, task level, and risk tier cap.
 */
export function getEffectiveAutonomy(task: TaskNode, settings: ProjectSettings): AutonomyLevel {
  const levelOrder: AutonomyLevel[] = ['low', 'medium', 'high'];
  const projectMax = settings.autonomy.overrides[task.phase] ?? settings.autonomy.default;
  const tierMax = RISK_TIER_CONFIG[task.riskTier].maxAutonomy;
  const taskLevel = task.autonomyLevel;

  const taskIdx = levelOrder.indexOf(taskLevel);
  const projectIdx = levelOrder.indexOf(projectMax);
  const tierIdx = levelOrder.indexOf(tierMax);

  // Guard: unrecognized values fall back to 'low' (safest)
  if (taskIdx === -1 || projectIdx === -1 || tierIdx === -1) {
    return 'low';
  }

  const effectiveIdx = Math.min(taskIdx, projectIdx, tierIdx);
  return levelOrder[effectiveIdx]!;
}
