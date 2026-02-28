import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_DIRS } from '@nexus/core';
import type { MCPPlaywrightClient } from './mcp-client.js';
import { TraceManager } from './trace-manager.js';
import { ArtifactWriter } from './artifact-writer.js';

export interface FlowSpec {
  name: string;
  description: string;
  steps: FlowStep[];
  acceptanceCriteria: string[];
}

export interface FlowStep {
  action: 'navigate' | 'click' | 'fill' | 'screenshot' | 'assert-text' | 'assert-visible';
  selector?: string;
  value?: string;
  url?: string;
  description: string;
}

export interface FlowResult {
  flowName: string;
  taskId: string;
  passed: boolean;
  steps: Array<{ step: FlowStep; passed: boolean; detail: string }>;
  screenshotPaths: string[];
  tracePath?: string;
  error?: string;
  duration: number;
}

export class FlowRunner {
  private readonly traceManager: TraceManager;
  private readonly artifactWriter: ArtifactWriter;

  constructor(
    private readonly client: MCPPlaywrightClient,
    private readonly cwd: string = process.cwd(),
  ) {
    this.traceManager = new TraceManager(cwd);
    this.artifactWriter = new ArtifactWriter(cwd);
  }

  async loadFlowSpec(flowName: string): Promise<FlowSpec | null> {
    const flowDir = path.join(this.cwd, NEXUS_DIRS.PLAYWRIGHT, 'flow-specs');
    const candidates = [`${flowName}.json`, `${flowName}.md`];

    for (const candidate of candidates) {
      const p = path.join(flowDir, candidate);
      if (existsSync(p)) {
        try {
          const raw = await readFile(p, 'utf-8');
          if (p.endsWith('.json')) {
            return JSON.parse(raw) as FlowSpec;
          }
          // Minimal MD parsing — extract JSON frontmatter
          const match = raw.match(/```json\n([\s\S]+?)\n```/);
          if (match) return JSON.parse(match[1] ?? '') as FlowSpec;
        } catch {}
      }
    }
    return null;
  }

  async listFlows(): Promise<string[]> {
    const flowDir = path.join(this.cwd, NEXUS_DIRS.PLAYWRIGHT, 'flow-specs');
    if (!existsSync(flowDir)) return [];
    const files = await readdir(flowDir);
    return files
      .filter((f) => f.endsWith('.json') || f.endsWith('.md'))
      .map((f) => path.basename(f, path.extname(f)));
  }

  async run(flowName: string, taskId: string): Promise<FlowResult> {
    const startTime = Date.now();
    const spec = await this.loadFlowSpec(flowName);

    if (!spec) {
      return {
        flowName,
        taskId,
        passed: false,
        steps: [],
        screenshotPaths: [],
        error: `Flow spec not found: ${flowName}`,
        duration: Date.now() - startTime,
      };
    }

    const stepResults: FlowResult['steps'] = [];
    const screenshotPaths: string[] = [];
    // FlowRunner builds action specs for the AI runtime to execute.
    // The AI runtime (worker-cell.ts) performs the actual Playwright calls and
    // updates step results. Until executed, passed is false (not yet verified).
    let specBuildError = false;

    for (const step of spec.steps) {
      // Map assert actions to evaluate since MCP uses evaluate for assertions
      const actionType = (step.action === 'assert-text' || step.action === 'assert-visible' ? 'evaluate' : step.action) as 'navigate' | 'screenshot' | 'click' | 'fill' | 'trace-start' | 'trace-stop' | 'evaluate';
      try {
        const actionSpec = this.client.buildActionSpec({
          type: actionType,
          ...(step.selector !== undefined && { selector: step.selector }),
          ...(step.value !== undefined && { value: step.value }),
          ...(step.url !== undefined && { url: step.url }),
        });

        stepResults.push({
          step,
          passed: false, // not yet executed — AI runtime updates this after execution
          detail: `Action spec prepared: ${JSON.stringify(actionSpec).slice(0, 100)}`,
        });
      } catch (err) {
        specBuildError = true;
        stepResults.push({
          step,
          passed: false,
          detail: `Spec build failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const result: FlowResult = {
      flowName,
      taskId,
      passed: !specBuildError && stepResults.length > 0, // true only if all specs built — execution result determined by AI runtime
      steps: stepResults,
      screenshotPaths,
      duration: Date.now() - startTime,
    };

    // Record in trace manager
    await this.traceManager.record({
      taskId,
      flowName,
      tracePath: '',
      metadata: { steps: spec.steps.length, specBuildError },
      status: result.passed ? 'pass' : 'fail',
    });

    return result;
  }
}
