import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function runRecover(): Promise<void> {
  const cwd = process.cwd();
  const checkpointsDir = path.join(cwd, '.nexus/06-checkpoints');

  if (!existsSync(checkpointsDir)) {
    console.log('\n✗ No checkpoints directory found. Run `nexus init` first.\n');
    process.exit(1);
  }

  const files = await readdir(checkpointsDir).catch(() => [] as string[]);
  const checkpoints = files.filter((f) => f.endsWith('.json'));

  if (checkpoints.length === 0) {
    console.log('\n✗ No checkpoints found in .nexus/06-checkpoints/');
    console.log('  Checkpoints are created automatically before high-risk tasks.');
    console.log('  Use /nexus:recover in your AI runtime for guided recovery.\n');
    return;
  }

  console.log(`\nAvailable checkpoints (${checkpoints.length}):\n`);

  for (const file of checkpoints.sort().reverse()) {
    const raw = await readFile(path.join(checkpointsDir, file), 'utf-8').catch(() => '{}');
    const cp = JSON.parse(raw) as { id?: string; timestamp?: string; description?: string; taskId?: string };
    console.log(`  ${cp.id ?? file}`);
    console.log(`    Task: ${cp.taskId ?? '?'}`);
    console.log(`    Time: ${cp.timestamp ?? '?'}`);
    console.log(`    Desc: ${cp.description ?? '?'}`);
    console.log('');
  }

  console.log('To roll back, use /nexus:recover in your AI runtime for interactive recovery.');
  console.log('This ensures scars are recorded and re-planning happens correctly.\n');
}
