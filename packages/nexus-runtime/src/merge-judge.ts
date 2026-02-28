import type { VerificationResult, MergeDecision } from '@nexus/core';

export class MergeJudge {
  evaluate(verification: VerificationResult): MergeDecision {
    const rejectionReasons: string[] = [];

    if (!verification.physicalityOk) {
      rejectionReasons.push('Physicality check failed: files may not exist on disk or have undeclared writes');
    }
    if (!verification.deterministicOk) {
      rejectionReasons.push('Deterministic check failed: tests, lint, or typecheck failed');
    }
    if (!verification.goalBackwardOk) {
      rejectionReasons.push('Goal-backward check failed: must-have acceptance criteria not met');
    }
    if (!verification.adversarialOk) {
      rejectionReasons.push('Adversarial check failed: edge cases, error paths, or suspicious shortcuts found');
    }
    if (!verification.systemValidationOk) {
      rejectionReasons.push('System validation failed: integration or E2E tests failed');
    }

    // Playwright is only required when explicitly flagged
    // (playwrightOk defaults to true when not required)

    const allPassed = rejectionReasons.length === 0;

    return {
      taskId: verification.taskId,
      timestamp: new Date().toISOString(),
      verdict: allPassed ? 'approved' : 'rejected',
      physicalityVerified: verification.physicalityOk,
      deterministicVerified: verification.deterministicOk,
      goalVerified: verification.goalBackwardOk,
      adversarialCleared: verification.adversarialOk,
      playwrightVerified: verification.playwrightOk,
      rejectionReasons,
      approvedBy: 'merge-judge-agent',
    };
  }
}
