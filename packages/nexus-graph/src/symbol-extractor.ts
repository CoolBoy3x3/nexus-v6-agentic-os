import { readFile } from 'fs/promises';
import path from 'path';

export interface SymbolEntry {
  name: string;
  kind: 'class' | 'function' | 'const' | 'type' | 'interface' | 'enum' | 'route' | 'unknown';
  exported: boolean;
  file: string;
  line: number;
}

export interface SymbolIndex {
  version: string;
  generatedAt: string;
  symbols: SymbolEntry[];
  byFile: Record<string, SymbolEntry[]>;
}

export class SymbolExtractor {
  constructor(private readonly cwd: string = process.cwd()) {}

  async extractFromFile(filePath: string): Promise<SymbolEntry[]> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(this.cwd, filePath);
    let content: string;
    try {
      content = await readFile(absPath, 'utf-8');
    } catch {
      return [];
    }

    const symbols: SymbolEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;

      // Exported class
      const classMatch = line.match(/^(export\s+(?:default\s+)?)(abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[3] ?? '', kind: 'class', exported: true, file: filePath, line: lineNum });
        continue;
      }

      // Exported function
      const fnMatch = line.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1] ?? '', kind: 'function', exported: true, file: filePath, line: lineNum });
        continue;
      }

      // Exported const (arrow function or value)
      const constMatch = line.match(/^export\s+const\s+(\w+)/);
      if (constMatch) {
        symbols.push({ name: constMatch[1] ?? '', kind: 'const', exported: true, file: filePath, line: lineNum });
        continue;
      }

      // Exported type
      const typeMatch = line.match(/^export\s+type\s+(\w+)/);
      if (typeMatch) {
        symbols.push({ name: typeMatch[1] ?? '', kind: 'type', exported: true, file: filePath, line: lineNum });
        continue;
      }

      // Exported interface
      const ifaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (ifaceMatch) {
        symbols.push({ name: ifaceMatch[1] ?? '', kind: 'interface', exported: true, file: filePath, line: lineNum });
        continue;
      }

      // Exported enum
      const enumMatch = line.match(/^export\s+(?:const\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({ name: enumMatch[1] ?? '', kind: 'enum', exported: true, file: filePath, line: lineNum });
        continue;
      }

      // Route patterns (Express/Fastify style)
      const routeMatch = line.match(/(?:app|router|fastify)\.(get|post|put|delete|patch|options)\s*\(\s*['"]([^'"]+)['"]/);
      if (routeMatch) {
        symbols.push({
          name: `${(routeMatch[1] ?? '').toUpperCase()} ${routeMatch[2] ?? ''}`,
          kind: 'route',
          exported: false,
          file: filePath,
          line: lineNum,
        });
        continue;
      }
    }

    return symbols;
  }

  async buildIndex(files: string[]): Promise<SymbolIndex> {
    const allSymbols: SymbolEntry[] = [];
    const byFile: Record<string, SymbolEntry[]> = {};

    for (const file of files) {
      const symbols = await this.extractFromFile(file);
      allSymbols.push(...symbols);
      byFile[file] = symbols;
    }

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      symbols: allSymbols,
      byFile,
    };
  }
}
