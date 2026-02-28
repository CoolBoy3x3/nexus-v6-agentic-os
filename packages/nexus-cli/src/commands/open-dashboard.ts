import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function openDashboard(options: { port?: number; open?: boolean } = {}): Promise<void> {
  const cwd = process.cwd();
  const settingsPath = path.join(cwd, '.nexus/01-governance/settings.json');

  let port = options.port ?? 7890;
  if (!options.port && existsSync(settingsPath)) {
    const raw = await readFile(settingsPath, 'utf-8').catch(() => '{}');
    const settings = JSON.parse(raw) as { dashboard?: { port?: number } };
    port = settings.dashboard?.port ?? 7890;
  }

  // Find the dashboard server script relative to this CLI package
  const dashboardScript = path.resolve(__dirname, '../../../../packages/nexus-dashboard/dist/server.js');
  const hasScript = existsSync(dashboardScript);

  if (!hasScript) {
    console.log(`\n⚠  Nexus Dashboard server not found at:\n   ${dashboardScript}`);
    console.log('   Run: pnpm build  to build the dashboard package first.\n');
    return;
  }

  console.log(`\nNexus Dashboard — starting on http://localhost:${port}`);
  console.log(`Watching: ${cwd}/.nexus/\n`);

  // Spawn the dashboard process
  // Pass cwd via env var to avoid path injection in the -e argument string
  const child = spawn(
    process.execPath,
    ['-e', `import('file://${dashboardScript.replace(/\\/g, '/')}').then(m => m.startDashboard(process.env.NEXUS_CWD))`],
    {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, NEXUS_DASHBOARD_PORT: String(port), NEXUS_CWD: cwd },
    }
  );

  child.on('error', (err) => {
    console.error('Failed to start dashboard:', err.message);
  });

  // Open browser if requested
  if (options.open !== false) {
    setTimeout(() => {
      const url = `http://localhost:${port}`;
      const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(cmd, [url], { shell: true, detached: true, stdio: 'ignore' }).unref();
      console.log(`Opened browser: ${url}`);
    }, 1500);
  }

  // Keep alive
  await new Promise<void>((resolve) => {
    child.on('close', () => resolve());
    process.on('SIGINT', () => { child.kill(); resolve(); });
  });
}
