import Fastify from 'fastify';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { ProjectSettings } from '@nexus/core';
import { NEXUS_FILES } from '@nexus/core';
import { registerRoutes } from './routes.js';

const DEFAULT_PORT = 7890;

export async function startDashboard(cwd: string = process.cwd()): Promise<void> {
  const port = await getPort(cwd);

  const app = Fastify({ logger: false });
  registerRoutes(app, cwd);

  try {
    await app.listen({ port, host: '127.0.0.1' });
    console.log(`[Nexus Dashboard] Running at http://localhost:${port}`);
    console.log(`[Nexus Dashboard] Watching: ${cwd}/.nexus/`);
  } catch (err) {
    console.error('[Nexus Dashboard] Failed to start:', err);
    process.exit(1);
  }
}

async function getPort(cwd: string): Promise<number> {
  const settingsPath = path.join(cwd, NEXUS_FILES.SETTINGS);
  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw) as ProjectSettings;
      return settings.dashboard?.port ?? DEFAULT_PORT;
    } catch {}
  }
  const p = parseInt(process.env['NEXUS_DASHBOARD_PORT'] ?? '', 10);
  return Number.isFinite(p) && p > 0 ? p : DEFAULT_PORT;
}
