#!/usr/bin/env tsx
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface APIContract {
  id: string;
  version: string;
  endpoint: string;
  method: string;
}

const [,, prevPath] = process.argv;
const currentPath = '.nexus/02-architecture/api_contracts.json';

async function main() {
  if (!existsSync(currentPath)) {
    console.log('No api_contracts.json found. Nothing to diff.');
    process.exit(0);
  }

  const current: Record<string, APIContract> = JSON.parse(await readFile(currentPath, 'utf-8'));

  if (!prevPath || !existsSync(prevPath)) {
    console.log(`Current contracts: ${Object.keys(current).length}`);
    console.log('No previous contracts provided — no diff possible.');
    process.exit(0);
  }

  const previous: Record<string, APIContract> = JSON.parse(await readFile(prevPath, 'utf-8'));
  const allIds = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const breaking: string[] = [];
  const nonBreaking: string[] = [];

  for (const id of allIds) {
    const prev = previous[id];
    const curr = current[id];
    if (prev && !curr) { breaking.push(`REMOVED: ${id}`); continue; }
    if (!prev && curr) { nonBreaking.push(`ADDED: ${id} (${curr.method} ${curr.endpoint})`); continue; }
    if (prev && curr) {
      if (prev.method !== curr.method) breaking.push(`METHOD CHANGE: ${id} ${prev.method} -> ${curr.method}`);
      if (prev.endpoint !== curr.endpoint) breaking.push(`ENDPOINT CHANGE: ${id} ${prev.endpoint} -> ${curr.endpoint}`);
      if (prev.version !== curr.version) nonBreaking.push(`VERSION: ${id} ${prev.version} -> ${curr.version}`);
    }
  }

  if (breaking.length > 0) {
    console.error('\nBREAKING CHANGES DETECTED:');
    breaking.forEach(b => console.error('  [BREAK]', b));
  }
  if (nonBreaking.length > 0) {
    console.log('\nNon-breaking changes:');
    nonBreaking.forEach(n => console.log('  [OK]', n));
  }
  if (breaking.length === 0 && nonBreaking.length === 0) {
    console.log('No contract changes detected.');
  }

  process.exit(breaking.length > 0 ? 1 : 0);
}

main().catch(console.error);
