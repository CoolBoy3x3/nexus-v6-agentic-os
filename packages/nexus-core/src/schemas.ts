import { z } from 'zod';
import type { ProjectSettings, ProjectState } from './types.js';
import { AUTONOMY_LEVELS, TDD_MODES, REVIEW_TIERS, RISK_TIERS, LOOP_POSITIONS, TASK_STATUSES, SCAR_CATEGORIES, AGENT_STATUSES, MESSAGE_TYPES } from './constants.js';

// ─── Reusable primitives ───────────────────────────────────────────────────

export const AutonomyLevelSchema = z.enum(AUTONOMY_LEVELS);
export const TDDModeSchema = z.enum(TDD_MODES);
export const ReviewTierSchema = z.enum(REVIEW_TIERS);
export const RiskTierSchema = z.enum(RISK_TIERS);
export const LoopPositionSchema = z.enum(LOOP_POSITIONS);
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const ScarCategorySchema = z.enum(SCAR_CATEGORIES);
export const AgentStatusSchema = z.enum(AGENT_STATUSES);
export const MessageTypeSchema = z.enum(MESSAGE_TYPES);

// ─── Task schemas ──────────────────────────────────────────────────────────

export const VerificationGapSchema = z.object({
  truth: z.string(),
  status: z.enum(['failed', 'partial']),
  reason: z.string(),
  artifacts: z.array(z.object({ path: z.string(), issue: z.string() })),
  missing: z.array(z.string()),
});

export const VerificationResultSchema = z.object({
  taskId: z.string(),
  timestamp: z.string(),
  status: z.enum(['passed', 'gaps_found', 'human_needed']),
  score: z.string(),
  physicalityOk: z.boolean(),
  deterministicOk: z.boolean(),
  goalBackwardOk: z.boolean(),
  adversarialOk: z.boolean(),
  systemValidationOk: z.boolean(),
  playwrightOk: z.boolean(),
  gaps: z.array(VerificationGapSchema),
  humanItems: z.array(z.object({ description: z.string(), instructions: z.string(), acceptanceCriteria: z.string() })),
  artifacts: z.array(z.string()),
});

export const ScarSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  timestamp: z.string(),
  category: ScarCategorySchema,
  description: z.string(),
  rootCause: z.string(),
  resolution: z.string(),
  preventionRule: z.string(),
  filesAffected: z.array(z.string()),
  rollbackRef: z.string().optional(),
});

export const TaskNodeSchema = z.object({
  id: z.string(),
  phase: z.string(),
  plan: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  riskTier: RiskTierSchema,
  tddMode: TDDModeSchema,
  reviewTier: ReviewTierSchema,
  autonomyLevel: AutonomyLevelSchema,
  dependsOn: z.array(z.string()),
  filesModified: z.array(z.string()),
  rollbackAnchor: z.string().optional(),
  wave: z.number().int().positive(),
  worktreeRef: z.string().optional(),
  verificationResult: VerificationResultSchema.optional(),
  scar: ScarSchema.optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export const TaskGraphSchema = z.object({
  version: z.string(),
  mission: z.string(),
  currentPhase: z.string(),
  tasks: z.array(TaskNodeSchema),
  waves: z.record(z.array(z.string())),
  lastUpdated: z.string(),
});

// ─── Project state schema ──────────────────────────────────────────────────

export const ProjectStateSchema = z.object({
  version: z.string(),
  mission: z.string(),
  currentPhase: z.string(),
  currentPlan: z.string(),
  loopPosition: LoopPositionSchema,
  metrics: z.object({
    phasesComplete: z.number(),
    phasesTotal: z.number(),
    tasksComplete: z.number(),
    tasksTotal: z.number(),
    scarsCount: z.number(),
  }),
  decisions: z.array(z.string()),
  blockers: z.array(z.string()),
  sessionContinuity: z.object({
    lastUpdated: z.string(),
    nextAction: z.string(),
    handoffFile: z.string(),
  }),
});

// ─── Settings schema ───────────────────────────────────────────────────────

export const ProjectSettingsSchema = z.object({
  project: z.object({ name: z.string(), version: z.string() }),
  autonomy: z.object({ default: AutonomyLevelSchema, overrides: z.record(AutonomyLevelSchema) }),
  tdd: z.object({ default: TDDModeSchema, overrides: z.record(TDDModeSchema) }),
  playwright: z.object({ enabled: z.boolean(), mcpPath: z.string() }),
  dashboard: z.object({ port: z.number() }),
  checkpoints: z.object({ beforeHighRisk: z.boolean(), maxRetained: z.number() }),
  notifications: z.object({ onHighRisk: z.boolean(), onCriticalRisk: z.boolean(), onScar: z.boolean() }),
});

// ─── Validation helpers ────────────────────────────────────────────────────

export function validateState(data: unknown): ProjectState {
  return ProjectStateSchema.parse(data) as ProjectState;
}

export function validateSettings(data: unknown): ProjectSettings {
  return ProjectSettingsSchema.parse(data) as ProjectSettings;
}

export function parseScar(data: unknown) {
  return ScarSchema.parse(data);
}

export function parseTaskNode(data: unknown) {
  return TaskNodeSchema.parse(data);
}

export function parseVerificationResult(data: unknown) {
  return VerificationResultSchema.parse(data);
}
