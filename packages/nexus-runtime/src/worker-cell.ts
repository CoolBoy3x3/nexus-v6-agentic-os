import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type { TaskNode } from '@nexus/core';
import { ContextPacketBuilder, WORKER_TAGS, NEXUS_DIRS } from '@nexus/core';
import { WorktreeManager } from './worktree-manager.js';
import { MCPPlaywrightClient } from '@nexus/playwright';

export interface WorkerResult {
  taskId: string;
  status: 'completed' | 'failed' | 'blocked';
  output: string;
  filesModified: string[];
  blockerMessage?: string;
}

/** Which AI runtime CLI to use — read from env or auto-detected */
export type DispatchRuntime = 'claude' | 'codex' | 'gemini' | 'opencode';

/**
 * Build the prompt sent to the worker agent.
 * The prompt includes the full context packet inline so the agent
 * has everything it needs without loading the whole codebase.
 * playwrightSection is appended when the task requires browser validation.
 */
function buildWorkerPrompt(task: TaskNode, contextPacketJson: string, playwrightSection = ''): string {
  return `You are a Nexus V6 worker agent. Execute the following task exactly as specified.

## Task
ID: ${task.id}
Description: ${task.description}
Risk tier: ${task.riskTier}
TDD mode: ${task.tddMode}
Files to modify: ${task.filesModified.join(', ') || '(none specified — use your judgment)'}
${playwrightSection}
## Context Packet
${contextPacketJson}

## Instructions
1. Execute the task described above.
2. Only modify files listed in "Files to modify" (or files clearly required by the task).
3. Follow the TDD mode: ${task.tddMode === 'hard' ? 'write tests BEFORE implementation' : task.tddMode === 'skip' ? 'skip tests for this task' : 'write tests alongside implementation'}.
4. When done, emit EXACTLY one of these tags on its own line:

<<NEXUS_COMPLETE>>
{"filesModified": ["path/to/file1", "path/to/file2"], "summary": "one-line summary"}
<</NEXUS_COMPLETE>>

If you are blocked, emit:
<<NEXUS_BLOCKED>>
{"reason": "clear description of what is blocking you"}
<</NEXUS_BLOCKED>>

Do not emit any other structured tags. Begin execution now.`;
}

/**
 * Detect which runtime CLI is available.
 * Priority: NEXUS_RUNTIME env → claude → codex → opencode → gemini
 */
function detectRuntime(): DispatchRuntime {
  const env = process.env['NEXUS_RUNTIME'];
  if (env && ['claude', 'codex', 'gemini', 'opencode'].includes(env)) {
    return env as DispatchRuntime;
  }
  // Check which binaries exist on PATH
  const { execSync } = require('child_process') as typeof import('child_process');
  const candidates: DispatchRuntime[] = ['claude', 'codex', 'opencode', 'gemini'];
  for (const rt of candidates) {
    try {
      execSync(`${rt} --version`, { stdio: 'ignore', timeout: 2000 });
      return rt;
    } catch {}
  }
  return 'claude'; // fallback
}

/**
 * Build the CLI command + args for each runtime.
 *
 * Claude:    claude --print --output-format stream-json [--mcp-config <path>] --allowedTools ... -p "<prompt>"
 * Codex:     codex --full-auto -q "<prompt>"
 * Gemini:    gemini [--mcp-server "npx @playwright/mcp@latest"] -p "<prompt>"
 * OpenCode:  opencode run "<prompt>"  (MCP configured via opencode.json)
 *
 * extraArgs is used to inject runtime-specific extras like --mcp-config.
 */
function buildDispatchArgs(runtime: DispatchRuntime, prompt: string, extraArgs: string[] = []): { bin: string; args: string[] } {
  switch (runtime) {
    case 'claude':
      return {
        bin: 'claude',
        args: [
          '--print',
          '--output-format', 'stream-json',
          ...extraArgs,
          '--allowedTools', 'Bash,Read,Edit,Write,Glob,Grep,MultiEdit',
          '--permission-mode', 'acceptEdits',
          '-p', prompt,
        ],
      };
    case 'codex':
      return {
        bin: 'codex',
        args: ['--full-auto', '-q', prompt],
      };
    case 'gemini':
      return {
        bin: 'gemini',
        args: [...extraArgs, '-p', prompt],
      };
    case 'opencode':
      return {
        bin: 'opencode',
        args: ['run', prompt],
      };
  }
}

/**
 * Run the agent CLI and collect all stdout.
 * Streams output line-by-line to console so progress is visible.
 */
async function spawnAgent(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  onProgress: (line: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: process.platform === 'win32', // needed on Windows
    });

    let output = '';
    let timedOut = false;
    let sigkillTimer: ReturnType<typeof setTimeout> | null = null;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      // Track the SIGKILL timer so it can be cleared if the process exits in time
      sigkillTimer = setTimeout(() => {
        sigkillTimer = null;
        proc.kill('SIGKILL');
      }, 2000);
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      output += text;
      for (const line of text.split('\n')) {
        if (line.trim()) onProgress(line);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      for (const line of text.split('\n')) {
        if (line.trim()) onProgress(`[stderr] ${line}`);
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (sigkillTimer !== null) clearTimeout(sigkillTimer);
      if (timedOut) {
        reject(new Error(`Worker timed out after ${timeoutMs}ms`));
      } else if (code !== 0 && !output.includes(WORKER_TAGS.COMPLETE.open)) {
        reject(new Error(`Worker exited with code ${code}`));
      } else {
        resolve(output);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (sigkillTimer !== null) clearTimeout(sigkillTimer);
      reject(new Error(`Failed to spawn ${bin}: ${err.message}`));
    });
  });
}

/**
 * Parse the agent's output for NEXUS_COMPLETE / NEXUS_BLOCKED tags.
 * Falls back to heuristics if the runtime doesn't emit tags.
 */
function parseOutput(output: string, runtime: DispatchRuntime): {
  status: 'completed' | 'blocked' | 'failed';
  message: string;
  filesModified: string[];
} {
  // First try our structured tags
  if (output.includes(WORKER_TAGS.COMPLETE.open)) {
    const match = output.match(
      new RegExp(`${escapeRegex(WORKER_TAGS.COMPLETE.open)}([\\s\\S]+?)${escapeRegex(WORKER_TAGS.COMPLETE.close)}`),
    );
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1].trim()) as { filesModified?: string[]; summary?: string };
        return {
          status: 'completed',
          message: parsed.summary ?? 'Task complete',
          filesModified: parsed.filesModified ?? [],
        };
      } catch (parseErr) {
        // NEXUS_COMPLETE tag found but JSON payload is malformed — treat as failed
        // so the orchestrator can surface the error rather than silently passing
        return {
          status: 'failed',
          message: `NEXUS_COMPLETE tag found but JSON payload could not be parsed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          filesModified: [],
        };
      }
    }
  }

  if (output.includes(WORKER_TAGS.BLOCKED.open)) {
    const match = output.match(
      new RegExp(`${escapeRegex(WORKER_TAGS.BLOCKED.open)}([\\s\\S]+?)${escapeRegex(WORKER_TAGS.BLOCKED.close)}`),
    );
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1].trim()) as { reason?: string };
        return { status: 'blocked', message: parsed.reason ?? 'Task blocked', filesModified: [] };
      } catch {
        return { status: 'blocked', message: match[1].trim().slice(0, 200), filesModified: [] };
      }
    }
  }

  // For Claude stream-json format, extract the structured result block which may contain our tags
  if (runtime === 'claude') {
    const parsed = parseClaudeStreamJson(output);
    if (parsed) return parsed;
  }

  // No recognized tags and no stream-json result: worker failed to follow protocol.
  // Return 'failed' rather than guessing — incorrect guesses cascade into bad state.
  return {
    status: 'failed',
    message: `Worker did not emit <<NEXUS_COMPLETE>> or <<NEXUS_BLOCKED>> tags. ` +
      `Check output at .nexus/05-runtime/output-*.txt for details. ` +
      `Tail: ${output.slice(-200)}`,
    filesModified: [],
  };
}

/** Parse Claude's stream-json output format */
function parseClaudeStreamJson(output: string): { status: 'completed' | 'blocked' | 'failed'; message: string; filesModified: string[] } | null {
  try {
    const lines = output.split('\n').filter((l) => l.trim().startsWith('{'));
    let finalResult: string | null = null;
    for (const line of lines) {
      const obj = JSON.parse(line) as { type?: string; result?: string; subtype?: string };
      if (obj.type === 'result') { finalResult = obj.result ?? null; break; }
    }
    if (finalResult) {
      return { status: 'completed', message: finalResult.slice(0, 200), filesModified: [] };
    }
  } catch {}
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── WorkerCell ────────────────────────────────────────────────────────────────

export class WorkerCell {
  private readonly contextBuilder: ContextPacketBuilder;
  private readonly worktreeManager: WorktreeManager;
  private readonly taskTimeoutMs: number;

  constructor(private readonly cwd: string = process.cwd()) {
    this.contextBuilder = new ContextPacketBuilder(cwd);
    this.worktreeManager = new WorktreeManager(cwd);
    // Default 30-minute timeout per task; override with NEXUS_WORKER_TIMEOUT_MS
    const rawTimeout = parseInt(process.env['NEXUS_WORKER_TIMEOUT_MS'] ?? '1800000', 10);
    this.taskTimeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 1800000;
  }

  async execute(task: TaskNode): Promise<WorkerResult> {
    // 1. Build narrow context packet
    const contextPacket = await this.contextBuilder.buildForTask(task);
    const packetPath = path.join(this.cwd, `.nexus/05-runtime/context-${task.id}.json`);
    await mkdir(path.dirname(packetPath), { recursive: true });
    await writeFile(packetPath, JSON.stringify(contextPacket, null, 2), 'utf-8');

    // 2. Detect runtime
    const runtime = detectRuntime();

    // 3. Playwright — if task needs browser validation, set up MCP for this runtime
    let playwrightSection = '';
    let mcpExtraArgs: string[] = [];
    const playwrightRequired = task.reviewTier === 'adversarial' || contextPacket.stateDigest?.includes('playwright_required');
    if (playwrightRequired) {
      const pwClient = new MCPPlaywrightClient(this.cwd);
      await pwClient.init(runtime);
      if (!pwClient.isConfigured()) {
        // Hard failure: task declared playwright_required but MCP is unavailable.
        // Do NOT proceed — verification would pass incorrectly without browser proof.
        throw new Error(
          `Task ${task.id} requires Playwright browser validation but @playwright/mcp is not configured. ` +
          `Run 'nexus doctor' to fix, or set playwright.mcpPath in .nexus/01-governance/settings.json.`
        );
      }
      mcpExtraArgs = await pwClient.getMCPArgs();
      const artifactDir = path.join(this.cwd, NEXUS_DIRS.ARTIFACTS, task.id).replace(/\\/g, '/');
      playwrightSection = pwClient.getPlaywrightInstructions(artifactDir);
      console.log(`[WorkerCell] Playwright enabled for task ${task.id} via ${runtime}`);
    }

    // 4. Build prompt
    const contextPacketJson = JSON.stringify(contextPacket, null, 2);
    const prompt = buildWorkerPrompt(task, contextPacketJson, playwrightSection);

    // 5. Write prompt to disk for auditability
    const promptPath = path.join(this.cwd, `.nexus/05-runtime/prompt-${task.id}.txt`);
    await writeFile(promptPath, prompt, 'utf-8');

    console.log(`[WorkerCell] Dispatching task ${task.id} via ${runtime} CLI...`);

    // 6. Dispatch
    const { bin, args } = buildDispatchArgs(runtime, prompt, mcpExtraArgs);
    let output: string;
    try {
      output = await spawnAgent(
        bin,
        args,
        this.cwd,
        this.taskTimeoutMs,
        (line) => console.log(`  [${task.id}] ${line.slice(0, 120)}`),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WorkerCell] Dispatch failed for ${task.id}: ${message}`);
      const failResult: WorkerResult = { taskId: task.id, status: 'failed', output: message, filesModified: [] };
      failResult.blockerMessage = message;
      return failResult;
    }

    // 7. Write raw output for audit
    const outputPath = path.join(this.cwd, `.nexus/05-runtime/output-${task.id}.txt`);
    await writeFile(outputPath, output, 'utf-8');

    // 8. Parse result
    const parsed = parseOutput(output, runtime);
    console.log(`[WorkerCell] Task ${task.id} → ${parsed.status}: ${parsed.message.slice(0, 80)}`);

    const result: WorkerResult = {
      taskId: task.id,
      status: parsed.status === 'completed' ? 'completed' : parsed.status === 'blocked' ? 'blocked' : 'failed',
      output,
      filesModified: parsed.filesModified.length > 0 ? parsed.filesModified : task.filesModified,
    };
    if (parsed.status !== 'completed') result.blockerMessage = parsed.message;
    return result;
  }

  /** Public helper — used by tests */
  parseWorkerOutput(output: string): {
    status: 'completed' | 'blocked' | 'running';
    message: string;
    filesModified?: string[];
  } {
    const result = parseOutput(output, 'claude');
    return {
      status: result.status === 'failed' ? 'running' : result.status,
      message: result.message,
      filesModified: result.filesModified,
    };
  }
}
