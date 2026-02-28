#!/usr/bin/env tsx
/**
 * Build the codebase index — writes .nexus/03-index/files.json and test_map.json
 */
import { CodebaseIndexer } from '../packages/nexus-graph/src/codebase-index.js';

const cwd = process.cwd();
const indexer = new CodebaseIndexer(cwd);

console.log('[build-index] Scanning codebase...');
const index = await indexer.buildIndex(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.md']);
await indexer.save(index);
console.log(`[build-index] Indexed ${index.totalFiles} files`);
console.log(`[build-index] Test mappings: ${Object.keys(index.testMap).length}`);
console.log('[build-index] Done -> .nexus/03-index/');
