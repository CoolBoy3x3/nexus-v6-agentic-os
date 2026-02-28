import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { NEXUS_DIRS } from '@nexus/core';

export interface BugReproScript {
  id: string;
  bugDescription: string;
  reproSteps: string[];
  expectedBehavior: string;
  actualBehavior: string;
  generatedAt: string;
  scriptPath: string;
}

export class BugReproducer {
  constructor(private readonly cwd: string = process.cwd()) {}

  private reproDir(): string {
    return path.join(this.cwd, NEXUS_DIRS.PLAYWRIGHT, 'bug-repros');
  }

  async generate(
    bugDescription: string,
    reproSteps: string[],
    expectedBehavior: string,
    actualBehavior: string,
  ): Promise<BugReproScript> {
    const id = `bug-${Date.now()}`;
    const script = this.buildScript(bugDescription, reproSteps);
    const scriptPath = path.join(this.reproDir(), `${id}.json`);

    await mkdir(this.reproDir(), { recursive: true });

    const repro: BugReproScript = {
      id,
      bugDescription,
      reproSteps,
      expectedBehavior,
      actualBehavior,
      generatedAt: new Date().toISOString(),
      scriptPath,
    };

    await writeFile(scriptPath, JSON.stringify(repro, null, 2), 'utf-8');
    return repro;
  }

  private buildScript(description: string, steps: string[]): string {
    return JSON.stringify({
      name: `Bug repro: ${description.slice(0, 50)}`,
      description,
      steps: steps.map((s, i) => ({ stepNumber: i + 1, description: s })),
    }, null, 2);
  }
}
