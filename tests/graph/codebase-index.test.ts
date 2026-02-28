import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Lightweight stubs for CodebaseIndexer logic ──────────────────────────────
// We test the indexer's language detection, ignore-dir filtering, and test-map
// linking without hitting the real filesystem or glob.

/** Detect language from file extension — mirrors CodebaseIndexer private logic */
function detectLanguage(filePath: string): string {
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
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return LANGUAGE_MAP[ext] ?? 'unknown';
}

/** Should a file be ignored — mirrors CodebaseIndexer's IGNORE_DIRS check */
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.nexus', 'coverage', '.turbo'];
function shouldIgnore(filePath: string): boolean {
  return IGNORE_DIRS.some((dir) => filePath.split('/').includes(dir));
}

/** Check if a file looks like a test file */
function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__');
}

/** Build a stub test map: pair each source file with its test file if one exists */
function buildTestMap(
  files: string[],
): Record<string, { sourceFile: string; testFiles: string[] }> {
  const testMap: Record<string, { sourceFile: string; testFiles: string[] }> = {};
  const testFiles = files.filter(isTestFile);
  const sourceFiles = files.filter((f) => !isTestFile(f));

  for (const src of sourceFiles) {
    const baseName = src.replace(/\.[^.]+$/, ''); // strip extension
    const matchingTests = testFiles.filter((t) => t.includes(baseName.split('/').pop() ?? ''));
    testMap[src] = { sourceFile: src, testFiles: matchingTests };
  }
  return testMap;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CodebaseIndexer — language detection', () => {
  it('detects TypeScript files', () => {
    expect(detectLanguage('src/auth/login.ts')).toBe('typescript');
    expect(detectLanguage('src/components/Button.tsx')).toBe('typescript');
  });

  it('detects JavaScript files', () => {
    expect(detectLanguage('lib/utils.js')).toBe('javascript');
    expect(detectLanguage('lib/component.jsx')).toBe('javascript');
  });

  it('detects Python files', () => {
    expect(detectLanguage('scripts/deploy.py')).toBe('python');
  });

  it('detects Rust files', () => {
    expect(detectLanguage('src/main.rs')).toBe('rust');
  });

  it('detects Go files', () => {
    expect(detectLanguage('cmd/server.go')).toBe('go');
  });

  it('detects Markdown files', () => {
    expect(detectLanguage('docs/README.md')).toBe('markdown');
  });

  it('detects JSON files', () => {
    expect(detectLanguage('package.json')).toBe('json');
  });

  it('detects YAML files (both .yaml and .yml)', () => {
    expect(detectLanguage('config.yaml')).toBe('yaml');
    expect(detectLanguage('.github/ci.yml')).toBe('yaml');
  });

  it('detects shell scripts', () => {
    expect(detectLanguage('tools/build.sh')).toBe('shell');
  });

  it('returns unknown for unrecognized extensions', () => {
    expect(detectLanguage('binary.exe')).toBe('unknown');
    expect(detectLanguage('archive.tar')).toBe('unknown');
  });
});

describe('CodebaseIndexer — ignore directory filtering', () => {
  it('ignores files inside node_modules', () => {
    expect(shouldIgnore('node_modules/lodash/index.js')).toBe(true);
  });

  it('ignores files inside .git', () => {
    expect(shouldIgnore('.git/config')).toBe(true);
  });

  it('ignores files inside dist', () => {
    expect(shouldIgnore('dist/index.js')).toBe(true);
  });

  it('ignores files inside .nexus', () => {
    expect(shouldIgnore('.nexus/01-governance/STATE.md')).toBe(true);
  });

  it('ignores files inside coverage', () => {
    expect(shouldIgnore('coverage/lcov.info')).toBe(true);
  });

  it('ignores files inside .turbo', () => {
    expect(shouldIgnore('.turbo/cache.json')).toBe(true);
  });

  it('does NOT ignore regular source files', () => {
    expect(shouldIgnore('src/auth/login.ts')).toBe(false);
    expect(shouldIgnore('packages/nexus-core/src/types.ts')).toBe(false);
  });

  it('does NOT false-positive on partial directory name matches', () => {
    // "distribution" is not "dist"
    expect(shouldIgnore('distribution/assets/style.css')).toBe(false);
  });
});

describe('CodebaseIndexer — test file detection', () => {
  it('recognizes .test.ts files', () => {
    expect(isTestFile('src/auth/login.test.ts')).toBe(true);
  });

  it('recognizes .spec.ts files', () => {
    expect(isTestFile('src/auth/login.spec.ts')).toBe(true);
  });

  it('recognizes __tests__ directory files', () => {
    expect(isTestFile('src/__tests__/login.ts')).toBe(true);
  });

  it('does NOT mark regular source files as test files', () => {
    expect(isTestFile('src/auth/login.ts')).toBe(false);
    expect(isTestFile('src/utils/helpers.ts')).toBe(false);
  });
});

describe('CodebaseIndexer — test map building', () => {
  it('links source files to matching test files', () => {
    const files = [
      'src/auth/login.ts',
      'src/auth/login.test.ts',
      'src/utils/helpers.ts',
    ];
    const testMap = buildTestMap(files);
    expect(testMap['src/auth/login.ts'].testFiles).toContain('src/auth/login.test.ts');
  });

  it('returns empty testFiles array when no matching test exists', () => {
    const files = ['src/utils/helpers.ts'];
    const testMap = buildTestMap(files);
    expect(testMap['src/utils/helpers.ts'].testFiles).toHaveLength(0);
  });

  it('does NOT create test map entries for test files themselves', () => {
    const files = ['src/auth/login.ts', 'src/auth/login.test.ts'];
    const testMap = buildTestMap(files);
    expect(testMap['src/auth/login.test.ts']).toBeUndefined();
  });

  it('handles multiple test files per source file', () => {
    const files = [
      'src/auth/login.ts',
      'src/auth/login.test.ts',
      'src/auth/login.spec.ts',
    ];
    const testMap = buildTestMap(files);
    const testFiles = testMap['src/auth/login.ts'].testFiles;
    expect(testFiles).toHaveLength(2);
    expect(testFiles).toContain('src/auth/login.test.ts');
    expect(testFiles).toContain('src/auth/login.spec.ts');
  });

  it('handles an empty file list gracefully', () => {
    const testMap = buildTestMap([]);
    expect(Object.keys(testMap)).toHaveLength(0);
  });
});

// ─── ArchitectureGraphManager stubs ──────────────────────────────────────────

type LayerType = 'presentation' | 'application' | 'domain' | 'infrastructure' | 'unknown';

interface StubModuleEntry {
  name: string;
  path: string;
  layer: LayerType;
  criticalPath: boolean;
}

/** Detect layer from path — mirrors architecture-graph heuristics */
function detectLayer(modulePath: string): LayerType {
  if (/component|view|page|ui|dashboard/.test(modulePath)) return 'presentation';
  if (/service|use-case|handler|command/.test(modulePath)) return 'application';
  if (/domain|model|entity|aggregate/.test(modulePath)) return 'domain';
  if (/repository|database|db|infra|adapter|storage/.test(modulePath)) return 'infrastructure';
  return 'unknown';
}

/** Detect boundary violation: presentation should not import directly from infrastructure */
function hasBoundaryViolation(from: LayerType, to: LayerType): boolean {
  const forbidden: Partial<Record<LayerType, LayerType[]>> = {
    presentation: ['infrastructure'],
    domain: ['infrastructure', 'presentation', 'application'],
  };
  return (forbidden[from] ?? []).includes(to);
}

describe('ArchitectureGraphManager — layer detection', () => {
  it('classifies UI paths as presentation', () => {
    expect(detectLayer('src/components/Button')).toBe('presentation');
    expect(detectLayer('src/views/Dashboard')).toBe('presentation');
    expect(detectLayer('src/pages/Login')).toBe('presentation');
  });

  it('classifies service paths as application', () => {
    expect(detectLayer('src/services/AuthService')).toBe('application');
    expect(detectLayer('src/handlers/LoginHandler')).toBe('application');
  });

  it('classifies domain paths correctly', () => {
    expect(detectLayer('src/domain/User')).toBe('domain');
    expect(detectLayer('src/model/Order')).toBe('domain');
  });

  it('classifies database/infra paths as infrastructure', () => {
    expect(detectLayer('src/repository/UserRepo')).toBe('infrastructure');
    expect(detectLayer('src/database/migrations')).toBe('infrastructure');
    expect(detectLayer('src/adapters/redis')).toBe('infrastructure');
  });

  it('returns unknown for unclassified paths', () => {
    expect(detectLayer('src/utils/format')).toBe('unknown');
    expect(detectLayer('lib/helpers')).toBe('unknown');
  });
});

describe('ArchitectureGraphManager — boundary violation detection', () => {
  it('flags presentation→infrastructure as a boundary violation', () => {
    expect(hasBoundaryViolation('presentation', 'infrastructure')).toBe(true);
  });

  it('flags domain→infrastructure as a boundary violation', () => {
    expect(hasBoundaryViolation('domain', 'infrastructure')).toBe(true);
  });

  it('flags domain→presentation as a boundary violation', () => {
    expect(hasBoundaryViolation('domain', 'presentation')).toBe(true);
  });

  it('allows presentation→application (normal dependency direction)', () => {
    expect(hasBoundaryViolation('presentation', 'application')).toBe(false);
  });

  it('allows application→domain (normal dependency direction)', () => {
    expect(hasBoundaryViolation('application', 'domain')).toBe(false);
  });

  it('allows application→infrastructure (data access)', () => {
    expect(hasBoundaryViolation('application', 'infrastructure')).toBe(false);
  });

  it('allows domain→domain (same-layer imports OK)', () => {
    expect(hasBoundaryViolation('domain', 'domain')).toBe(false);
  });
});
