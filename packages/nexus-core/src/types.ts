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

/**
 * Gold-standard narrow context packet passed to each worker agent.
 * Workers receive ONLY what their task needs — never the full codebase.
 *
 * The 14 slots answer every question a worker must answer before writing code:
 *   WHY        — missionContext, phaseObjective
 *   WHAT       — files, filesContent, acceptanceCriteria
 *   HOW        — architectureSlice, contractsSlice, dependencySymbols, testsSlice, waveContext
 *   CONSTRAINTS — scarsDigest, stateDigest, boundaries
 *   TOOLING    — settings
 *   DISCIPLINE — tddMode, riskTier (top-level)
 */
export interface ContextPacket {
  // Identity
  taskId: string;
  tddMode: TDDMode;         // hard | standard | skip — governs testing discipline
  riskTier: RiskTier;       // gates checkpoint and review behavior
  generatedAt: string;

  // ── WHY ──────────────────────────────────────────────────────────────────

  // Slot 1: Mission context — what the project is, core value, tech stack
  // Source: PRD.md executive summary + constraints, ≤20 lines
  // Answers: "Why does this task exist at all?"
  missionContext: string;

  // Slot 2: Phase objective — what this phase is trying to achieve and why now
  // Source: current PLAN.md Objective section (Goal + Context + Output), ≤15 lines
  // Answers: "What is the phase trying to accomplish? How does my task serve that?"
  phaseObjective: string;

  // ── WHAT ─────────────────────────────────────────────────────────────────

  // Slot 3: File paths the worker is allowed to read and write
  // == task.filesModified exactly, never broader
  files: string[];

  // Slot 4: Current content of every file in `files`
  // Empty string = file does not exist yet, worker must create it
  filesContent: Record<string, string>;

  // Slot 5: Acceptance criteria for this task (Given/When/Then rows only)
  // Source: ACCEPTANCE_MASTER.md rows for task.acceptanceCriteria IDs, ≤50 lines
  // Answers: "What does 'done' actually mean for this specific task?"
  acceptanceCriteria: string;

  // ── HOW ──────────────────────────────────────────────────────────────────

  // Slot 6: Architecture — only module entries that own files in `files`
  // Source: modules.json filtered to relevant modules
  architectureSlice: Record<string, unknown>;

  // Slot 7: API contracts — only contracts whose path overlaps with `files`
  // Source: api_contracts.json filtered to relevant contracts
  contractsSlice: Record<string, unknown>;

  // Slot 8: Dependency symbols — exported symbol names from files this task
  // imports but does NOT own. Interface without loading full files.
  // Source: symbols.json + ownership.json — filePath → exported symbol names
  // Answers: "What can I call from the files I depend on?"
  dependencySymbols: Record<string, string[]>;

  // Slot 9: Test file paths for the source files being modified
  // Source: test_map.json filtered to relevant source files
  testsSlice: string[];

  // Slot 10: Wave context — compact summary of what prior waves built
  // Source: completed tasks in waves < this task's wave, ≤30 lines
  // Answers: "What was just built that I am building on top of?"
  waveContext: string;

  // ── CONSTRAINTS ──────────────────────────────────────────────────────────

  // Slot 11: Active prevention rules only from SCARS.md, ≤30 lines
  // NON-NEGOTIABLE — the same mistake cannot happen twice
  scarsDigest: string;

  // Slot 12: Loop position, recent decisions, blockers
  // Source: first 150 lines of STATE.md
  stateDigest: string;

  // Slot 13: Files the worker must never touch
  // Source: Boundaries section from PLAN.md verbatim
  boundaries: string[];

  // ── TOOLING ───────────────────────────────────────────────────────────────

  // Slot 14: Project tool commands — how to run tests, lint, typecheck in this project
  // Source: settings.json commands section
  // Answers: "What exact commands do I run to verify my work?"
  settings: {
    commands: {
      test: string;        // e.g. "npm test" or "pnpm vitest"
      lint: string;        // e.g. "npm run lint"
      typecheck: string;   // e.g. "npx tsc --noEmit"
      build?: string;      // e.g. "npm run build"
    };
    auto_advance: boolean; // governs checkpoint auto-approve behavior
    parallelization: boolean;
  };
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
