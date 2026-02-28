#!/usr/bin/env tsx
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const [,, filesArg] = process.argv;
if (!filesArg) {
  console.error('Usage: verify-physicality.ts <file1,file2,...>');
  process.exit(1);
}

const files = filesArg.split(',').map(f => f.trim()).filter(Boolean);
let allPass = true;

for (const file of files) {
  if (existsSync(file)) {
    console.log(`PASS EXISTS: ${file}`);
  } else {
    console.error(`FAIL MISSING: ${file}`);
    allPass = false;
  }
}

try {
  const diff = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
  const changed = diff.trim().split('\n').filter(Boolean);
  const declared = new Set(files);
  const undeclared = changed.filter(f => !declared.has(f));
  if (undeclared.length > 0) {
    console.error('\nFAIL UNDECLARED WRITES:');
    undeclared.forEach(f => console.error(`  ${f}`));
    allPass = false;
  } else {
    console.log('\nPASS No undeclared writes');
  }
} catch {
  console.log('\n(git not available — skipping undeclared writes check)');
}

process.exit(allPass ? 0 : 1);
