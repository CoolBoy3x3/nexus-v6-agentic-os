import type { FastifyInstance } from 'fastify';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ProjectSettings } from '@nexus/core';
import { StateStore, TaskGraphManager, ScarsStore, NEXUS_FILES, NEXUS_DIRS } from '@nexus/core';
import type { LogEntry } from './views/overview.js';
import { renderOverview } from './views/overview.js';
import { renderTaskGraph } from './views/task-graph.js';
import type { ArtifactEntry } from './views/artifacts.js';
import { renderArtifacts } from './views/artifacts.js';
import { renderScars } from './views/scars.js';
import { layout } from './layout.js';

export function registerRoutes(app: FastifyInstance, cwd: string): void {
  const stateStore  = new StateStore(cwd);
  const graphManager = new TaskGraphManager(cwd);
  const scarsStore  = new ScarsStore(cwd);

  // Helper to get project name for layout topbar
  async function getProjectName(): Promise<string> {
    const settings = await readSettings(cwd);
    return settings?.project?.name ?? path.basename(cwd);
  }

  // GET / — overview
  app.get('/', async (_req, reply) => {
    const [state, settings, log, projectName] = await Promise.all([
      stateStore.readState(),
      readSettings(cwd),
      readMissionLog(cwd),
      getProjectName(),
    ]);
    let graph = null;
    try { graph = await graphManager.load(); } catch {}
    reply.type('text/html').send(layout('Overview', renderOverview(state, graph, settings, log), projectName));
  });

  // GET /task-graph
  app.get('/task-graph', async (_req, reply) => {
    let graph = null;
    try { graph = await graphManager.load(); } catch {}
    const projectName = await getProjectName();
    reply.type('text/html').send(layout('Task Graph', renderTaskGraph(graph), projectName));
  });

  // GET /scars
  app.get('/scars', async (_req, reply) => {
    const scars = await scarsStore.readAll();
    const projectName = await getProjectName();
    reply.type('text/html').send(layout('Scars', renderScars(scars), projectName));
  });

  // GET /artifacts/:taskId
  app.get('/artifacts/:taskId', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const indexPath = path.join(cwd, NEXUS_DIRS.ARTIFACTS, taskId, 'index.json');
    let artifacts: ArtifactEntry[] = [];
    if (existsSync(indexPath)) {
      try {
        const raw = await readFile(indexPath, 'utf-8');
        const parsed = JSON.parse(raw) as { artifacts?: ArtifactEntry[] };
        artifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
      } catch {}
    }
    const projectName = await getProjectName();
    reply.type('text/html').send(layout(`Artifacts: ${taskId}`, renderArtifacts(taskId, artifacts), projectName));
  });

  // API — JSON
  app.get('/api/state', async (_req, reply) => {
    reply.send(await stateStore.readState());
  });

  app.get('/api/tasks', async (_req, reply) => {
    try { reply.send((await graphManager.load()).tasks); }
    catch { reply.send([]); }
  });

  app.get('/api/scars', async (_req, reply) => {
    reply.send(await scarsStore.readAll());
  });

  app.get('/api/log', async (_req, reply) => {
    reply.send(await readMissionLog(cwd));
  });

  app.get('/api/settings', async (_req, reply) => {
    reply.send(await readSettings(cwd) ?? {});
  });

  // SSE — live state updates every 3s
  app.get('/events', async (_req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = async () => {
      try {
        const state = await stateStore.readState();
        reply.raw.write(`data: ${JSON.stringify(state)}\n\n`);
      } catch {}
    };

    await send();
    const interval = setInterval(send, 3000);
    reply.raw.on('close', () => clearInterval(interval));
  });
}

async function readSettings(cwd: string): Promise<ProjectSettings | null> {
  const p = path.join(cwd, NEXUS_FILES.SETTINGS);
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, 'utf-8');
    return JSON.parse(raw) as ProjectSettings;
  } catch {
    return null;
  }
}

async function readMissionLog(cwd: string): Promise<LogEntry[]> {
  const p = path.join(cwd, '.nexus/05-runtime/mission-log.jsonl');
  if (!existsSync(p)) return [];
  try {
    const raw = await readFile(p, 'utf-8');
    return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as LogEntry);
  } catch {
    return [];
  }
}
