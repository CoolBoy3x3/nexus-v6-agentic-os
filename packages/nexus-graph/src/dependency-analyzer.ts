import { readFile } from 'fs/promises';
import path from 'path';

export interface ImportEdge {
  from: string;
  to: string;
  type: 'static' | 'dynamic' | 'type-only' | 'require';
  line: number;
}

export interface DependencyGraph {
  nodes: string[]; // file paths
  edges: ImportEdge[];
  cycles: string[][];
}

const IMPORT_PATTERNS = [
  // ES static import: import ... from '...'
  /^import\s+(?:type\s+)?(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/m,
  // Dynamic import: import('...')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Require: require('...')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Export from: export ... from '...'
  /^export\s+(?:type\s+)?(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/m,
];

export class DependencyAnalyzer {
  constructor(private readonly cwd: string = process.cwd()) {}

  async analyzeFile(filePath: string): Promise<ImportEdge[]> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(this.cwd, filePath);
    let content: string;
    try {
      content = await readFile(absPath, 'utf-8');
    } catch {
      return [];
    }

    const edges: ImportEdge[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Static imports
      const staticMatch = line.match(/^import\s+(type\s+)?(?:.+\s+from\s+)?['"]([^'"]+)['"]/);
      if (staticMatch) {
        const importType = staticMatch[1] ? 'type-only' : 'static';
        const target = staticMatch[2] ?? '';
        if (target) {
          edges.push({ from: filePath, to: target, type: importType, line: i + 1 });
        }
      }

      // Export from
      const exportMatch = line.match(/^export\s+(type\s+)?(?:.+\s+from\s+)?['"]([^'"]+)['"]/);
      if (exportMatch) {
        const target = exportMatch[2] ?? '';
        if (target) {
          edges.push({ from: filePath, to: target, type: 'static', line: i + 1 });
        }
      }

      // Dynamic imports
      const dynMatches = line.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const m of dynMatches) {
        const target = m[1] ?? '';
        if (target) {
          edges.push({ from: filePath, to: target, type: 'dynamic', line: i + 1 });
        }
      }

      // Require
      const reqMatches = line.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const m of reqMatches) {
        const target = m[1] ?? '';
        if (target) {
          edges.push({ from: filePath, to: target, type: 'require', line: i + 1 });
        }
      }
    }

    return edges;
  }

  async buildGraph(files: string[]): Promise<DependencyGraph> {
    const allEdges: ImportEdge[] = [];
    for (const file of files) {
      const edges = await this.analyzeFile(file);
      allEdges.push(...edges);
    }

    const cycles = this.detectCycles(files, allEdges);

    return {
      nodes: files,
      edges: allEdges,
      cycles,
    };
  }

  private detectCycles(nodes: string[], edges: ImportEdge[]): string[][] {
    // Build adjacency: only local imports (not packages)
    const adj: Record<string, string[]> = {};
    for (const n of nodes) adj[n] = [];

    for (const edge of edges) {
      if (!edge.to.startsWith('.')) continue; // skip package imports
      const resolved = path.resolve(path.dirname(edge.from), edge.to);
      const relResolved = path.relative(this.cwd, resolved);
      if (adj[edge.from]) {
        adj[edge.from]!.push(relResolved);
      }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (node: string, stack: string[]): void => {
      visited.add(node);
      inStack.add(node);
      stack.push(node);

      for (const neighbor of adj[node] ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, stack);
        } else if (inStack.has(neighbor)) {
          const cycleStart = stack.indexOf(neighbor);
          cycles.push(stack.slice(cycleStart));
        }
      }

      stack.pop();
      inStack.delete(node);
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }
}
