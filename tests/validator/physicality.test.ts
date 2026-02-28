import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises and child_process
const mockExistsSync = vi.fn();
const mockStatSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
}));

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

// Types matching nexus-validator physicality check
type PhysicalityStatus = 'PASS' | 'FAIL';

interface FileCheckResult {
  file: string;
  exists: boolean;
  size: number;
  status: PhysicalityStatus;
  reason?: string;
}

interface PhysicalityResult {
  overall: PhysicalityStatus;
  files: FileCheckResult[];
  undeclaredWrites: string[];
}

// Stub PhysicalityChecker for unit testing
class PhysicalityCheckerStub {
  constructor(
    private existsFn: (path: string) => boolean,
    private sizeFn: (path: string) => number,
    private gitDiffFn: () => string[]
  ) {}

  check(declaredFiles: string[]): PhysicalityResult {
    const fileResults: FileCheckResult[] = [];

    for (const file of declaredFiles) {
      const exists = this.existsFn(file);
      const size = exists ? this.sizeFn(file) : 0;

      let status: PhysicalityStatus = 'PASS';
      let reason: string | undefined;

      if (!exists) {
        status = 'FAIL';
        reason = 'File does not exist on disk';
      } else if (size === 0) {
        status = 'FAIL';
        reason = 'File exists but is empty (0 bytes)';
      }

      fileResults.push({ file, exists, size, status, reason });
    }

    const changedFiles = this.gitDiffFn();
    const declared = new Set(declaredFiles);
    const undeclaredWrites = changedFiles.filter(f => !declared.has(f));

    const overall: PhysicalityStatus = fileResults.every(r => r.status === 'PASS') && undeclaredWrites.length === 0
      ? 'PASS'
      : 'FAIL';

    return { overall, files: fileResults, undeclaredWrites };
  }
}

function makeChecker(
  fsMap: Record<string, number>, // path -> size in bytes (0 = missing)
  gitChanged: string[] = []
): PhysicalityCheckerStub {
  return new PhysicalityCheckerStub(
    (path) => fsMap[path] !== undefined,
    (path) => fsMap[path] ?? 0,
    () => gitChanged
  );
}

describe('PhysicalityChecker — existence checks', () => {
  it('should PASS when all declared files exist with non-zero size', () => {
    const checker = makeChecker({
      'src/auth/jwt.ts': 2048,
      'src/middleware/auth.ts': 1024,
    });
    const result = checker.check(['src/auth/jwt.ts', 'src/middleware/auth.ts']);
    expect(result.overall).toBe('PASS');
    expect(result.files.every(f => f.status === 'PASS')).toBe(true);
  });

  it('should FAIL when a declared file does not exist', () => {
    const checker = makeChecker({ 'src/auth/jwt.ts': 2048 });
    const result = checker.check(['src/auth/jwt.ts', 'src/middleware/auth.ts']);
    expect(result.overall).toBe('FAIL');
    const missingFile = result.files.find(f => f.file === 'src/middleware/auth.ts');
    expect(missingFile?.status).toBe('FAIL');
    expect(missingFile?.reason).toContain('does not exist');
  });

  it('should FAIL when a file exists but is empty (0 bytes)', () => {
    const checker = makeChecker({ 'src/stub.ts': 0 });
    const result = checker.check(['src/stub.ts']);
    expect(result.overall).toBe('FAIL');
    const emptyFile = result.files.find(f => f.file === 'src/stub.ts');
    expect(emptyFile?.status).toBe('FAIL');
    expect(emptyFile?.reason).toContain('empty');
  });

  it('should include size in each file result', () => {
    const checker = makeChecker({ 'src/hello.ts': 512 });
    const result = checker.check(['src/hello.ts']);
    expect(result.files[0].size).toBe(512);
  });
});

describe('PhysicalityChecker — undeclared writes detection', () => {
  it('should detect undeclared writes (files changed but not in files_to_touch)', () => {
    const checker = makeChecker(
      { 'src/auth/jwt.ts': 1024 },
      ['src/auth/jwt.ts', 'src/unrelated-file.ts']
    );
    const result = checker.check(['src/auth/jwt.ts']);
    expect(result.undeclaredWrites).toContain('src/unrelated-file.ts');
    expect(result.overall).toBe('FAIL');
  });

  it('should pass when all changed files are declared', () => {
    const checker = makeChecker(
      { 'src/auth/jwt.ts': 1024, 'src/auth/types.ts': 512 },
      ['src/auth/jwt.ts', 'src/auth/types.ts']
    );
    const result = checker.check(['src/auth/jwt.ts', 'src/auth/types.ts']);
    expect(result.undeclaredWrites).toHaveLength(0);
    expect(result.overall).toBe('PASS');
  });

  it('should pass when git reports no changed files', () => {
    const checker = makeChecker({ 'src/auth/jwt.ts': 1024 }, []);
    const result = checker.check(['src/auth/jwt.ts']);
    expect(result.undeclaredWrites).toHaveLength(0);
    expect(result.overall).toBe('PASS');
  });
});

describe('PhysicalityChecker — result structure', () => {
  it('should return a result with overall, files, and undeclaredWrites fields', () => {
    const checker = makeChecker({ 'src/hello.ts': 100 }, []);
    const result = checker.check(['src/hello.ts']);
    expect(result).toHaveProperty('overall');
    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('undeclaredWrites');
    expect(Array.isArray(result.files)).toBe(true);
    expect(Array.isArray(result.undeclaredWrites)).toBe(true);
  });

  it('should include a reason string for each failing file check', () => {
    const checker = makeChecker({}, []);
    const result = checker.check(['src/missing.ts']);
    const failedFile = result.files[0];
    expect(failedFile.status).toBe('FAIL');
    expect(typeof failedFile.reason).toBe('string');
    expect(failedFile.reason!.length).toBeGreaterThan(0);
  });
});
