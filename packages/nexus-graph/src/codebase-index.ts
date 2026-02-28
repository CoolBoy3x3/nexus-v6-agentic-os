import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { NEXUS_FILES, NEXUS_DIRS } from '@nexus/core';

export interface FileEntry {
  path: string;
  size: number;
  lastModified: string;
  language: string;
  module?: string;
  exports: string[];
  imports: string[];
}

export interface TestMapEntry {
  sourceFile: string;
  testFiles: string[];
  coverage?: number;
}

export interface CodebaseIndex {
  version: string;
  generatedAt: string;
  files: Record<string, FileEntry>;
  testMap: Record<string, TestMapEntry>;
  totalFiles: number;
  languages: Record<string, number>;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'shell',
};

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.nexus', 'coverage', '.turbo'];

export class CodebaseIndexer {
  constructor(private readonly cwd: string = process.cwd()) {}

  private filesPath(): string {
    return path.join(this.cwd, NEXUS_FILES.FILE_MAP);
  }

  private testMapPath(): string {
    return path.join(this.cwd, NEXUS_FILES.TEST_MAP);
  }

  async buildIndex(patterns: string[] = ['**/*']): Promise<CodebaseIndex> {
    const ignorePattern = IGNORE_DIRS.map((d) => `**/${d}/**`);
    const files = await glob(patterns, {
      cwd: this.cwd,
      nodir: true,
      ignore: ignorePattern,
      absolute: false,
    });

    const fileEntries: Record<string, FileEntry> = {};
    const languages: Record<string, number> = {};
    const testMap: Record<string, TestMapEntry> = {};

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      const lang = LANGUAGE_MAP[ext] ?? 'unknown';
      languages[lang] = (languages[lang] ?? 0) + 1;

      const absPath = path.join(this.cwd, filePath);
      let size = 0;
      let lastModified = new Date().toISOString();
      try {
        const stats = await stat(absPath);
        size = stats.size;
        lastModified = stats.mtime.toISOString();
      } catch {}

      fileEntries[filePath] = {
        path: filePath,
        size,
        lastModified,
        language: lang,
        exports: [],
        imports: [],
      };
    }

    // Build test map: match test files to source files
    for (const filePath of files) {
      const isTest =
        filePath.includes('.test.') ||
        filePath.includes('.spec.') ||
        filePath.includes('__tests__/');

      if (isTest) {
        const sourceName = filePath
          .replace(/\.test\.(ts|tsx|js|jsx)$/, '.$1')
          .replace(/\.spec\.(ts|tsx|js|jsx)$/, '.$1')
          .replace(/__tests__\//, '');

        const guessedSource = files.find(
          (f) =>
            !f.includes('.test.') &&
            !f.includes('.spec.') &&
            path.basename(f, path.extname(f)) === path.basename(sourceName, path.extname(sourceName)),
        );

        if (guessedSource) {
          if (!testMap[guessedSource]) {
            testMap[guessedSource] = { sourceFile: guessedSource, testFiles: [] };
          }
          testMap[guessedSource].testFiles.push(filePath);
        }
      }
    }

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      files: fileEntries,
      testMap,
      totalFiles: files.length,
      languages,
    };
  }

  async save(index: CodebaseIndex): Promise<void> {
    await mkdir(path.dirname(this.filesPath()), { recursive: true });
    await writeFile(this.filesPath(), JSON.stringify(index.files, null, 2), 'utf-8');
    await writeFile(this.testMapPath(), JSON.stringify(index.testMap, null, 2), 'utf-8');
  }

  async load(): Promise<Partial<CodebaseIndex>> {
    const result: Partial<CodebaseIndex> = {};
    if (existsSync(this.filesPath())) {
      const raw = await readFile(this.filesPath(), 'utf-8');
      result.files = JSON.parse(raw);
    }
    if (existsSync(this.testMapPath())) {
      const raw = await readFile(this.testMapPath(), 'utf-8');
      result.testMap = JSON.parse(raw);
    }
    return result;
  }

  getTestsForFiles(testMap: Record<string, TestMapEntry>, changedFiles: string[]): string[] {
    const tests = new Set<string>();
    for (const changed of changedFiles) {
      const entry = testMap[changed];
      if (entry) entry.testFiles.forEach((t) => tests.add(t));
    }
    return Array.from(tests);
  }
}
