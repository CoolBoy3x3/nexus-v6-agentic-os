import { mkdir, writeFile, copyFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Template directory — relative to installed package
const TEMPLATES_DIR = path.resolve(__dirname, '../../../../modules/nexus/templates');

const NEXUS_DIRS = [
  '.nexus/00-mission',
  '.nexus/01-governance',
  '.nexus/02-architecture',
  '.nexus/03-index',
  '.nexus/04-plans',
  '.nexus/05-runtime',
  '.nexus/06-checkpoints',
  '.nexus/07-artifacts',
  '.nexus/07-artifacts/diffs',
  '.nexus/07-artifacts/traces',
  '.nexus/07-artifacts/screenshots',
  '.nexus/07-artifacts/videos',
  '.nexus/07-artifacts/logs',
  '.nexus/07-artifacts/patches',
  '.nexus/08-playwright',
  '.nexus/08-playwright/flow-specs',
  '.nexus/08-playwright/generated-tests',
  '.nexus/08-playwright/bug-repros',
  '.nexus/05-runtime/mailbox',
];

// Governance templates: dest path → template filename
const GOVERNANCE_TEMPLATES: Record<string, string> = {
  '.nexus/00-mission/PRD.md': 'PRD.md',
  '.nexus/00-mission/ACCEPTANCE_MASTER.md': 'ACCEPTANCE_MASTER.md',
  '.nexus/01-governance/STATE.md': 'STATE.md',
  '.nexus/01-governance/ROADMAP.md': 'ROADMAP.md',
  '.nexus/01-governance/HANDOFF.md': 'HANDOFF.md',
  '.nexus/01-governance/DECISION_LOG.md': 'DECISION_LOG.md',
  '.nexus/01-governance/SCARS.md': 'SCARS.md',
  '.nexus/01-governance/settings.json': 'settings.json',
  '.nexus/02-architecture/ARCHITECTURE.md': 'ARCHITECTURE.md',
  '.nexus/02-architecture/modules.json': 'modules.json',
  '.nexus/02-architecture/dependencies.json': 'dependencies.json',
  '.nexus/02-architecture/services.json': 'services.json',
  '.nexus/02-architecture/api_contracts.json': 'api_contracts.json',
  '.nexus/02-architecture/data_models.json': 'data_models.json',
  '.nexus/02-architecture/event_flows.json': 'event_flows.json',
  '.nexus/03-index/files.json': 'files.json',
  '.nexus/03-index/symbols.json': 'symbols.json',
  '.nexus/03-index/ownership.json': 'ownership.json',
  '.nexus/03-index/test_map.json': 'test_map.json',
  '.nexus/03-index/migration_map.json': 'migration_map.json',
  '.nexus/05-runtime/TASK_GRAPH.json': 'TASK_GRAPH.json',
};

export interface InitOptions {
  projectName?: string;
  description?: string;
  force?: boolean;
}

export async function initProject(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const nexusRoot = path.join(cwd, '.nexus');

  if (existsSync(nexusRoot) && !options.force) {
    console.log('\n⚠  .nexus/ already exists in this directory.');
    console.log('   Run with --force to reinitialize, or use /nexus:resume to continue.\n');
    return;
  }

  const projectName = options.projectName ?? path.basename(cwd);
  const description = options.description ?? '';

  console.log(`\nInitializing Nexus V6 in: ${cwd}`);
  console.log(`Project: ${projectName}\n`);

  // 1. Create all directories
  for (const dir of NEXUS_DIRS) {
    await mkdir(path.join(cwd, dir), { recursive: true });
  }

  // 2. Copy and populate templates
  const templatesExist = existsSync(TEMPLATES_DIR);

  for (const [dest, templateName] of Object.entries(GOVERNANCE_TEMPLATES)) {
    const destPath = path.join(cwd, dest);

    if (templatesExist) {
      const templatePath = path.join(TEMPLATES_DIR, templateName);
      if (existsSync(templatePath)) {
        let content = await readFile(templatePath, 'utf-8');
        // Replace placeholders
        content = content
          .replace(/\{\{project_name\}\}/g, projectName)
          .replace(/\{\{description\}\}/g, description)
          .replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
        await writeFile(destPath, content, 'utf-8');
        continue;
      }
    }

    // Fallback: write minimal stub
    const ext = path.extname(templateName);
    if (ext === '.json') {
      await writeFile(destPath, '{}', 'utf-8');
    } else if (ext === '.md') {
      await writeFile(destPath, `# ${path.basename(dest, '.md')}\n\n`, 'utf-8');
    }
  }

  // 3. Ensure settings.json contains required defaults + project name
  const settingsPath = path.join(cwd, '.nexus/01-governance/settings.json');
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, any>;

    parsed.project = parsed.project ?? {};
    parsed.project.name = projectName;
    if (description) parsed.project.description = description;
    parsed.project.version = parsed.project.version ?? '0.1.0';

    parsed.pipeline = parsed.pipeline ?? { auto_advance: true, parallelization: true, maxParallelWorkers: 5 };
    parsed.autonomy = parsed.autonomy ?? { default: 'medium', overrides: {} };
    parsed.tdd = parsed.tdd ?? { default: 'standard', overrides: {} };
    parsed.commands = parsed.commands ?? {
      test: 'npm test',
      lint: 'npm run lint',
      typecheck: 'npx tsc --noEmit',
      format_check: 'npx prettier --check .',
    };
    parsed.playwright = parsed.playwright ?? { enabled: false, mcpPath: '' };
    parsed.dashboard = parsed.dashboard ?? { port: 7890 };
    parsed.checkpoints = parsed.checkpoints ?? { beforeHighRisk: true, maxRetained: 10 };
    parsed.notifications = parsed.notifications ?? { onHighRisk: true, onCriticalRisk: true, onScar: true };
    parsed.required_skills = parsed.required_skills ?? {};

    await writeFile(settingsPath, JSON.stringify(parsed, null, 2), 'utf-8');
  } catch {
    const settings = {
      project: { name: projectName, description, version: '0.1.0' },
      pipeline: { auto_advance: true, parallelization: true, maxParallelWorkers: 5 },
      autonomy: { default: 'medium', overrides: {} },
      tdd: { default: 'standard', overrides: {} },
      commands: {
        test: 'npm test',
        lint: 'npm run lint',
        typecheck: 'npx tsc --noEmit',
        format_check: 'npx prettier --check .',
      },
      playwright: { enabled: false, mcpPath: '' },
      dashboard: { port: 7890 },
      checkpoints: { beforeHighRisk: true, maxRetained: 10 },
      notifications: { onHighRisk: true, onCriticalRisk: true, onScar: true },
      required_skills: {},
    };
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  // 4. Print success tree
  console.log('✓ Created .nexus/ workspace:\n');
  console.log('  .nexus/');
  console.log('  ├─ 00-mission/     PRD.md, ACCEPTANCE_MASTER.md');
  console.log('  ├─ 01-governance/  STATE.md, ROADMAP.md, DECISION_LOG.md, SCARS.md, settings.json');
  console.log('  ├─ 02-architecture/ ARCHITECTURE.md + 6 JSON files');
  console.log('  ├─ 03-index/       5 index JSON files');
  console.log('  ├─ 04-plans/       (phase plans created here)');
  console.log('  ├─ 05-runtime/     TASK_GRAPH.json, mailbox/, logs');
  console.log('  ├─ 06-checkpoints/ (rollback points stored here)');
  console.log('  ├─ 07-artifacts/   screenshots/, traces/, videos/, logs/, patches/');
  console.log('  └─ 08-playwright/  flow-specs/, generated-tests/, bug-repros/');
  console.log('');
  console.log('✓ Next steps:');
  console.log('  1. Run /nexus:plan in your AI runtime to create your first phase plan');
  console.log('  2. Or run: nexus map-codebase  (if this is an existing project)');
  console.log('');
}
