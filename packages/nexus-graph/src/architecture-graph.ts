import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_FILES, NEXUS_DIRS } from '@nexus/core';

export interface ModuleEntry {
  name: string;
  path: string;
  files: string[];
  exports: string[];
  imports: string[];
  layer: 'presentation' | 'application' | 'domain' | 'infrastructure' | 'unknown';
  criticalPath: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'dynamic-import' | 'type-only';
  files: string[];
}

export interface ArchitectureGraph {
  version: string;
  generatedAt: string;
  modules: Record<string, ModuleEntry>;
  dependencies: DependencyEdge[];
  boundaryViolations: BoundaryViolation[];
}

export interface BoundaryViolation {
  from: string;
  to: string;
  reason: string;
  severity: 'warning' | 'error';
}

export class ArchitectureGraphManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  private modulesPath(): string {
    return path.join(this.cwd, NEXUS_FILES.MODULES);
  }

  private dependenciesPath(): string {
    return path.join(this.cwd, NEXUS_FILES.DEPENDENCIES);
  }

  async load(): Promise<ArchitectureGraph> {
    const modulesPath = this.modulesPath();
    const depPath = this.dependenciesPath();

    let modules: Record<string, ModuleEntry> = {};
    let dependencies: DependencyEdge[] = [];

    if (existsSync(modulesPath)) {
      const raw = await readFile(modulesPath, 'utf-8');
      modules = JSON.parse(raw);
    }
    if (existsSync(depPath)) {
      const raw = await readFile(depPath, 'utf-8');
      dependencies = JSON.parse(raw);
    }

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      modules,
      dependencies,
      boundaryViolations: [],
    };
  }

  async save(graph: ArchitectureGraph): Promise<void> {
    await mkdir(path.dirname(this.modulesPath()), { recursive: true });
    await writeFile(this.modulesPath(), JSON.stringify(graph.modules, null, 2), 'utf-8');
    await writeFile(this.dependenciesPath(), JSON.stringify(graph.dependencies, null, 2), 'utf-8');
  }

  getModuleSlice(graph: ArchitectureGraph, filePaths: string[]): Record<string, ModuleEntry> {
    const slice: Record<string, ModuleEntry> = {};
    for (const [name, mod] of Object.entries(graph.modules)) {
      // Use exact match or path-segment boundary match to avoid false positives
      // (e.g. "src/utils.ts" must not match "src/utils-new.ts")
      const relevant = mod.files.some((f) => filePaths.some((fp) => fp === f || fp.startsWith(f + '/') || f.startsWith(fp + '/')));
      if (relevant) slice[name] = mod;
    }
    return slice;
  }

  detectBoundaryViolations(graph: ArchitectureGraph): BoundaryViolation[] {
    const violations: BoundaryViolation[] = [];
    const layerOrder: ModuleEntry['layer'][] = [
      'presentation',
      'application',
      'domain',
      'infrastructure',
      'unknown',
    ];

    for (const edge of graph.dependencies) {
      const fromMod = graph.modules[edge.from];
      const toMod = graph.modules[edge.to];
      if (!fromMod || !toMod) continue;

      const fromIdx = layerOrder.indexOf(fromMod.layer);
      const toIdx = layerOrder.indexOf(toMod.layer);

      // Domain should not depend on presentation or application
      if (fromMod.layer === 'domain' && (toMod.layer === 'presentation' || toMod.layer === 'application')) {
        violations.push({
          from: edge.from,
          to: edge.to,
          reason: `Domain layer (${edge.from}) should not depend on ${toMod.layer} layer (${edge.to})`,
          severity: 'error',
        });
      }
    }

    return violations;
  }

  addOrUpdateModule(graph: ArchitectureGraph, entry: ModuleEntry): void {
    graph.modules[entry.name] = entry;
  }

  removeModule(graph: ArchitectureGraph, name: string): void {
    delete graph.modules[name];
    graph.dependencies = graph.dependencies.filter(
      (d) => d.from !== name && d.to !== name,
    );
  }
}
