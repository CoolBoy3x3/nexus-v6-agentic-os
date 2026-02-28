#!/usr/bin/env tsx
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const changedFiles = process.argv.slice(2);

async function main() {
  if (changedFiles.length === 0) {
    console.log('Usage: selective-test-runner.ts <file1> [file2] ...');
    process.exit(1);
  }

  const testMapPath = '.nexus/03-index/test_map.json';
  if (!existsSync(testMapPath)) {
    console.log('No test_map.json found. Run nexus build-index first.');
    process.exit(0);
  }

  const testMap = JSON.parse(await readFile(testMapPath, 'utf-8'));
  const testFiles = new Set<string>();

  for (const file of changedFiles) {
    const entry = testMap[file];
    if (entry?.testFiles) {
      entry.testFiles.forEach((f: string) => testFiles.add(f));
    }
  }

  if (testFiles.size === 0) {
    console.log('No test files mapped to changed files.');
    process.exit(0);
  }

  console.log(`Running ${testFiles.size} test file(s):`, Array.from(testFiles));

  try {
    execSync(`pnpm vitest run ${Array.from(testFiles).join(' ')}`, { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

main().catch(console.error);
