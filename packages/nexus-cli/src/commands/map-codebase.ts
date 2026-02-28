import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { glob } from 'glob';

export async function mapCodebase(): Promise<void> {
  const cwd = process.cwd();
  const nexusRoot = path.join(cwd, '.nexus');

  if (!existsSync(nexusRoot)) {
    console.log('\n✗ No .nexus/ found. Run `nexus init` first.\n');
    process.exit(1);
  }

  console.log('\nScanning codebase...\n');

  // Quick file discovery
  const allFiles = await glob('**/*.{ts,tsx,js,jsx,py,go,java,rb,rs,cs}', {
    cwd,
    ignore: ['node_modules/**', '.nexus/**', 'dist/**', 'build/**', '.git/**'],
  });

  const extCounts: Record<string, number> = {};
  for (const f of allFiles) {
    const ext = path.extname(f) || 'other';
    extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  }

  console.log(`Found ${allFiles.length} source files:\n`);
  for (const [ext, count] of Object.entries(extCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
    console.log(`  ${ext.padEnd(8)} ${count} files`);
  }

  // Write stub index files
  await mkdir(path.join(cwd, '.nexus/03-index'), { recursive: true });
  await mkdir(path.join(cwd, '.nexus/02-architecture'), { recursive: true });

  const filesJson = { files: allFiles.map((f) => ({ path: f, module: '', owner: '' })), lastAnalyzed: new Date().toISOString() };
  await writeFile(path.join(cwd, '.nexus/03-index/files.json'), JSON.stringify(filesJson, null, 2), 'utf-8');

  const modulesJson = { modules: [], boundaries: [], lastAnalyzed: new Date().toISOString() };
  await writeFile(path.join(cwd, '.nexus/02-architecture/modules.json'), JSON.stringify(modulesJson, null, 2), 'utf-8');

  console.log('\n✓ Basic file index written to .nexus/03-index/files.json');
  console.log('\nFor full architecture analysis, use /nexus:map-codebase in your AI runtime.');
  console.log('The AI-powered analysis will infer module boundaries, ownership, and contracts.\n');
}
