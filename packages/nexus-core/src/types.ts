import type {
  RiskTier,
  TDDMode,
  ReviewTier,
  AutonomyLevel,
  AgentStatus,
  MessageType,
  ScarCategory,
  LoopPosition,
  TaskStatus,
} from './constants.js';

// ─── Task Graph ────────────────────────────────────────────────────────────

export interface TaskNode {
  id: string;
  phase: string;
  plan: string;
  description: string;
  status: TaskStatus;
  riskTier: RiskTier;
  tddMode: TDDMode;
  reviewTier: ReviewTier;
  autonomyLevel: AutonomyLevel;
  dependsOn: string[];
  filesModified: string[];
  rollbackAnchor?: string; // checkpoint ID created before this task
  startCommit?: string;   // git HEAD SHA at the moment this task started — used by physicality verifier
  wave: number;
  worktreeRef?: string;
  verificationResult?: VerificationResult;
  scar?: Scar;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskGraph {
  version: string;
  mission: string;
  currentPhase: string;
  tasks: TaskNode[];
  waves: Record<string, string[]>; // wave number → task IDs
  lastUpdated: string;
}

// ─── Verification ──────────────────────────────────────────────────────────

export interface VerificationResult {
  taskId: string;
  timestamp: string;
  status: 'passed' | 'gaps_found' | 'human_needed';
  score: string; // "N/M must-haves verified"
  physicalityOk: boolean;
  deterministicOk: boolean;
  goalBackwardOk: boolean;
  adversarialOk: boolean;
  systemValidationOk: boolean;
  playwrightOk: boolean;
  gaps: VerificationGap[];
  humanItems: HumanVerificationItem[];
  artifacts: string[]; // paths to screenshots/traces
}

export interface VerificationGap {
  truth: string;
  status: 'failed' | 'partial';
  reason: string;
  artifacts: Array<{ path: string; issue: string }>;
  missing: string[];
}

export interface HumanVerificationItem {
  description: string;
  instructions: string;
  acceptanceCriteria: string;
}

// ─── Scars & Decisions ─────────────────────────────────────────────────────

export interface Scar {
  id: string;
  taskId: string;
  timestamp: string;
  category: ScarCategory;
  description: string;
  rootCause: string;
  resolution: string;
  preventionRule: string; // standing instruction extracted from failure
  filesAffected: string[];
  rollbackRef?: string;
}

export interface Decision {
  id: string;
  timestamp: string;
  phase: string;
  description: string;
  rationale: string;
  impact: string;
  alternatives: string[];
  reversible: boolean;
  rollbackPath?: string;
}

// ─── Context Packet (narrow context for workers) ───────────────────────────

export interface ContextPacket {
  taskId: string;
  files: string[]; // only relevant files — NOT full repo
  architectureSlice: Record<string, unknown>; // only relevant module entries
  contractsSlice: Record<string, unknown>; // only contracts for affected APIs
  testsSlice: string[]; // only test files for affected modules
  stateDigest: string; // first 150 lines of STATE.md — not the full file
  boundaries: string[]; // DO NOT TOUCH list
  generatedAt: string;
}

// ─── Merge Decision ────────────────────────────────────────────────────────

export interface MergeDecision {
  taskId: string;
  timestamp: string;
  verdict: 'approved' | 'rejected' | 'needs-revision';
  physicalityVerified: boolean;
  deterministicVerified: boolean;
  goalVerified: boolean;
  adversarialCleared: boolean;
  playwrightVerified: boolean;
  rejectionReasons: string[];
  approvedBy: 'merge-judge-agent';
}

// ─── Agent Identity & Messaging ────────────────────────────────────────────

export interface AgentIdentity {
  name: string;
  agentId: string;
  teamName: string;
  status: AgentStatus;
  startTime: number;
  heartbeat: number;
}

export interface Message {
  msgId: string;
  sender: string;
  recipient: string;
  msgType: MessageType;
  content: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// ─── Checkpoints ───────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string;
  taskId: string;
  timestamp: string;
  gitRef: string; // git commit hash before task
  nexusStateSnapshot: string; // serialized .nexus/ state digest
  description: string;
}

// ─── Project State ─────────────────────────────────────────────────────────

export interface ProjectState {
  version: string;
  mission: string;
  currentPhase: string;
  currentPlan: string;
  loopPosition: LoopPosition;
  metrics: {
    phasesComplete: number;
    phasesTotal: number;
    tasksComplete: number;
    tasksTotal: number;
    scarsCount: number;
  };
  decisions: string[]; // brief summaries for STATE.md digest
  blockers: string[];
  sessionContinuity: {
    lastUpdated: string;
    nextAction: string;
    handoffFile: string;
  };
}

// ─── Project Settings ──────────────────────────────────────────────────────

export interface ProjectSettings {
  project: { name: string; version: string };
  pipeline: { auto_advance: boolean; parallelization: boolean; maxParallelWorkers: number };
  autonomy: { default: AutonomyLevel; overrides: Record<string, AutonomyLevel> };
  tdd: { default: TDDMode; overrides: Record<string, TDDMode> };
  playwright: { enabled: boolean; mcpPath: string };
  dashboard: { port: number };
  checkpoints: { beforeHighRisk: boolean; maxRetained: number };
  notifications: { onHighRisk: boolean; onCriticalRisk: boolean; onScar: boolean };
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  project: { name: '', version: '0.1.0' },
  pipeline: { auto_advance: true, parallelization: true, maxParallelWorkers: 5 },
  autonomy: { default: 'medium', overrides: {} },
  tdd: { default: 'standard', overrides: {} },
  playwright: { enabled: false, mcpPath: '' },
  dashboard: { port: 7890 },
  checkpoints: { beforeHighRisk: true, maxRetained: 10 },
  notifications: { onHighRisk: true, onCriticalRisk: true, onScar: true },
};

// ─── Audit Trail ───────────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: number;
  missionId: string;
  agentName: string;
  event: string;
  detail: string;
  status: AgentStatus;
}

// ─── Heartbeat ─────────────────────────────────────────────────────────────

export interface HeartbeatEntry {
  agentName: string;
  timestamp: number;
  status: AgentStatus;
  taskId?: string;
  detail?: string;
}
