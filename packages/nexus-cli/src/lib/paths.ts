import path from 'path';

export const NEXUS_ROOT = '.nexus';

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

export const NEXUS_FILES = {
  STATE: '.nexus/01-governance/STATE.md',
  ROADMAP: '.nexus/01-governance/ROADMAP.md',
  HANDOFF: '.nexus/01-governance',  // + /HANDOFF-{date}.md
  DECISION_LOG: '.nexus/01-governance/DECISION_LOG.md',
  SCARS: '.nexus/01-governance/SCARS.md',
  SETTINGS: '.nexus/01-governance/settings.json',
  ARCHITECTURE: '.nexus/02-architecture/ARCHITECTURE.md',
  MODULES: '.nexus/02-architecture/modules.json',
  DEPENDENCIES: '.nexus/02-architecture/dependencies.json',
  SERVICES: '.nexus/02-architecture/services.json',
  API_CONTRACTS: '.nexus/02-architecture/api_contracts.json',
  DATA_MODELS: '.nexus/02-architecture/data_models.json',
  EVENT_FLOWS: '.nexus/02-architecture/event_flows.json',
  FILES: '.nexus/03-index/files.json',
  SYMBOLS: '.nexus/03-index/symbols.json',
  OWNERSHIP: '.nexus/03-index/ownership.json',
  TEST_MAP: '.nexus/03-index/test_map.json',
  MIGRATION_MAP: '.nexus/03-index/migration_map.json',
  TASK_GRAPH: '.nexus/05-runtime/TASK_GRAPH.json',
  MISSION_LOG: '.nexus/05-runtime/mission-log.jsonl',
  HEARTBEATS: '.nexus/05-runtime/heartbeats.json',
} as const;

export function nexusPath(...parts: string[]): string {
  return path.join(NEXUS_ROOT, ...parts);
}

export function resolveNexusRoot(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), NEXUS_ROOT);
}
