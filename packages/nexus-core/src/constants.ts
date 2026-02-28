// Autonomy levels — controls what agents can do without human approval
export const AUTONOMY_LEVELS = ['low', 'medium', 'high'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

// Risk tiers — determines required safeguards per task
export const RISK_TIERS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const RISK_TIER_CONFIG = {
  low: {
    maxAutonomy: 'high' as AutonomyLevel,
    requiresCheckpoint: false,
    requiresHumanApproval: false,
    requiresAdversarialReview: false,
    description: 'New files, tests, docs, formatting — safe to proceed autonomously',
  },
  medium: {
    maxAutonomy: 'high' as AutonomyLevel,
    requiresCheckpoint: true,
    requiresHumanApproval: false,
    requiresAdversarialReview: false,
    description: 'Core logic modifications, new API endpoints — checkpoint before proceeding',
  },
  high: {
    maxAutonomy: 'medium' as AutonomyLevel,
    requiresCheckpoint: true,
    requiresHumanApproval: false,
    requiresAdversarialReview: true,
    description: 'Contract changes, 5+ file edits, dependency upgrades — must notify + checkpoint',
  },
  critical: {
    maxAutonomy: 'low' as AutonomyLevel,
    requiresCheckpoint: true,
    requiresHumanApproval: true,
    requiresAdversarialReview: true,
    description: 'Schema migrations, auth changes, irreversible actions — human approval required',
  },
} as const;

// TDD modes — governs test-writing discipline
export const TDD_MODES = ['hard', 'standard', 'skip'] as const;
export type TDDMode = (typeof TDD_MODES)[number];

export const TDD_MODE_CONFIG = {
  hard: {
    description: 'Failing test FIRST. No exceptions. Iron law from superpowers:smart-tdd.',
    requiresFailingTestFirst: true,
    allowSkip: false,
  },
  standard: {
    description: 'Write test alongside implementation. Must pass before task complete.',
    requiresFailingTestFirst: false,
    allowSkip: false,
  },
  skip: {
    description:
      'No tests required. Must be explicitly declared. Only for prototypes/config/generated code.',
    requiresFailingTestFirst: false,
    allowSkip: true,
  },
} as const;

// Review tiers — depth of review required before merge
export const REVIEW_TIERS = ['none', 'self', 'peer', 'adversarial'] as const;
export type ReviewTier = (typeof REVIEW_TIERS)[number];

// Agent status — tracks lifecycle of worker cells
export const AGENT_STATUSES = [
  'pending',
  'running',
  'idle',
  'completed',
  'failed',
  'shutdown',
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// Message types for inter-agent mailbox
export const MESSAGE_TYPES = [
  'direct',
  'broadcast',
  'status_update',
  'shutdown_request',
  'shutdown_response',
  'permission_request',
  'permission_response',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

// Loop positions — Nexus 4-step governance loop
export const LOOP_POSITIONS = [
  'pre-plan',
  'planning',
  'executing',
  'verifying',
  'unifying',
  'complete',
] as const;
export type LoopPosition = (typeof LOOP_POSITIONS)[number];

// .nexus/ directory structure
export const NEXUS_DIRS = {
  ROOT: '.nexus',
  MISSION: '.nexus/00-mission',
  GOVERNANCE: '.nexus/01-governance',
  ARCHITECTURE: '.nexus/02-architecture',
  INDEX: '.nexus/03-index',
  PLANS: '.nexus/04-plans',
  RUNTIME: '.nexus/05-runtime',
  CHECKPOINTS: '.nexus/06-checkpoints',
  ARTIFACTS: '.nexus/07-artifacts',
  PLAYWRIGHT: '.nexus/08-playwright',
} as const;

// Scar categories — must stay in sync with nexus-dashboard/src/views/scars.ts and nexus-schemas/schemas/scars.schema.json
export const SCAR_CATEGORIES = [
  'logic',
  'integration',
  'performance',
  'security',
  'ux',
  'data',
  'test',
  'other',
] as const;
export type ScarCategory = (typeof SCAR_CATEGORIES)[number];

// Streaming side-effect tags for worker communication.
// Format: <<TAG>> ... <</TAG>>  (closing tag uses forward-slash prefix, NOT <<END_TAG>>)
// This matches the prompt shown to workers and the parser in worker-cell.ts.
export const WORKER_TAGS = {
  STATUS: {
    open: '<<NEXUS_STATUS>>',
    close: '<</NEXUS_STATUS>>',
  },
  COMPLETE: {
    open: '<<NEXUS_COMPLETE>>',
    close: '<</NEXUS_COMPLETE>>',
  },
  BLOCKED: {
    open: '<<NEXUS_BLOCKED>>',
    close: '<</NEXUS_BLOCKED>>',
  },
  PERMISSION: {
    open: '<<NEXUS_PERMISSION_REQUEST>>',
    close: '<</NEXUS_PERMISSION_REQUEST>>',
  },
} as const;

// Task statuses — lifecycle states for individual task nodes
export const TASK_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
  'superseded',
  'deferred',  // Intentionally skipped during unify — will be re-planned or dropped
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Version of the Nexus state format
export const NEXUS_STATE_VERSION = '6.0.0';

// Default values
export const DEFAULTS = {
  autonomyLevel: 'medium' as AutonomyLevel,
  tddMode: 'standard' as TDDMode,
  reviewTier: 'self' as ReviewTier,
  riskTier: 'low' as RiskTier,
  maxWorkers: 3,
  dashboardPort: 7890,
  logLevel: 'info',
} as const;

// File paths within .nexus/
export const NEXUS_FILES = {
  MISSION: '.nexus/00-mission/MISSION.md',
  STATE_MD: '.nexus/01-governance/STATE.md',
  DECISION_LOG_MD: '.nexus/01-governance/DECISION_LOG.md',
  SCARS_MD: '.nexus/01-governance/SCARS.md',
  SETTINGS: '.nexus/01-governance/settings.json',
  MODULES: '.nexus/02-architecture/modules.json',
  API_CONTRACTS: '.nexus/02-architecture/api_contracts.json',
  DATA_MODELS: '.nexus/02-architecture/data_models.json',
  DEPENDENCIES: '.nexus/02-architecture/dependencies.json',
  FILE_MAP: '.nexus/03-index/file_map.json',
  TEST_MAP: '.nexus/03-index/test_map.json',
  STATE_JSON: '.nexus/05-runtime/state.json',
  TASK_GRAPH: '.nexus/05-runtime/TASK_GRAPH.json',
  DECISIONS_JSONL: '.nexus/05-runtime/decisions.jsonl',
  SCARS_JSONL: '.nexus/05-runtime/scars.jsonl',
} as const;
