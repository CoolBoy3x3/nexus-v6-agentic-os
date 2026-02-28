#!/usr/bin/env tsx
/**
 * Build the architecture graph — writes .nexus/02-architecture/modules.json and dependencies.json
 */
import { DependencyAnalyzer } from '../packages/nexus-graph/src/dependency-analyzer.js';
import { CodebaseIndexer } from '../packages/nexus-graph/src/codebase-index.js';

const cwd = process.cwd();
const indexer = new CodebaseIndexer(cwd);
const analyzer = new DependencyAnalyzer(cwd);

console.log('[build-architecture] Loading file index...');
const partial = await indexer.load();
const files = partial.files ? Object.keys(partial.files) : [];

if (files.length === 0) {
  console.log('[build-architecture] No files indexed. Run build-index first.');
  process.exit(1);
}

console.log(`[build-architecture] Analyzing ${files.length} files for dependencies...`);
const graph = await analyzer.buildGraph(files.filter(f => f.endsWith('.ts') || f.endsWith('.js')));

console.log(`[build-architecture] Found ${graph.edges.length} import edges`);
if (graph.cycles.length > 0) {
  console.warn(`[build-architecture] WARNING: ${graph.cycles.length} cycle(s) detected:`);
  graph.cycles.forEach(c => console.warn(' ', c.join(' -> ')));
}
console.log('[build-architecture] Done');
