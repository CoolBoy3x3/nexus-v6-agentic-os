#!/usr/bin/env tsx
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const registryPath = '.nexus/02-architecture/migration_map.json';

async function main() {
  if (!existsSync(registryPath)) {
    console.log('No migration_map.json found.');
    process.exit(0);
  }
  const migrations = JSON.parse(await readFile(registryPath, 'utf-8'));
  const applied = migrations.filter((m: any) => m.status === 'applied');
  const pending = migrations.filter((m: any) => m.status === 'pending');

  console.log(`Migrations — Applied: ${applied.length}, Pending: ${pending.length}`);

  if (pending.length > 0) {
    console.log('\nPending migrations:');
    pending.forEach((m: any) => console.log(` - ${m.id}: ${m.description}`));
    console.log('\nRun migrations before proceeding with schema-dependent tasks.');
  }
  process.exit(0);
}
main().catch(console.error);
