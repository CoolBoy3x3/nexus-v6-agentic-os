import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../lib/logger.js';
import { detectInstalledRuntimes, type Runtime } from '../lib/runtime-detect.js';
import { ClaudeInstaller } from '../lib/installers/claude.js';
import { CodexInstaller } from '../lib/installers/codex.js';
import { GeminiInstaller } from '../lib/installers/gemini.js';
import { OpenCodeInstaller } from '../lib/installers/opencode.js';

interface InstallOptions {
  claude?: boolean;
  codex?: boolean;
  gemini?: boolean;
  opencode?: boolean;
  all?: boolean;
  global?: boolean;
  local?: boolean;
  configDir?: string;
  uninstall?: boolean;
}

function runtimeInstructions(runtime: Runtime, isGlobal: boolean): string {
  const scope = isGlobal ? 'globally' : 'in this project';
  switch (runtime) {
    case 'claude':
      return `Run ${chalk.cyan('/nexus:init')} in Claude Code to get started`;
    case 'codex':
      return `Mention ${chalk.cyan('$nexus-init')} in your Codex prompt to get started`;
    case 'gemini':
      return `Run ${chalk.cyan('@nexus-init')} in Gemini CLI to get started`;
    case 'opencode':
      return `Run ${chalk.cyan('/nexus-init')} in OpenCode to get started`;
  }
}

async function askRuntimes(): Promise<Runtime[]> {
  const detected = detectInstalledRuntimes();
  const choices = [
    { name: `Claude Code${detected.includes('claude') ? chalk.dim(' (detected)') : ''}`, value: 'claude' },
    { name: `Codex / OpenAI${detected.includes('codex') ? chalk.dim(' (detected)') : ''}`, value: 'codex' },
    { name: `Gemini CLI${detected.includes('gemini') ? chalk.dim(' (detected)') : ''}`, value: 'gemini' },
    { name: `OpenCode${detected.includes('opencode') ? chalk.dim(' (detected)') : ''}`, value: 'opencode' },
  ];

  const answer = await inquirer.prompt<{ runtimes: Runtime[] }>([
    {
      type: 'checkbox' as const,
      name: 'runtimes' as const,
      message: 'Which AI runtimes do you want to install Nexus into?',
      choices,
    },
  ]);

  if (!answer.runtimes || answer.runtimes.length === 0) {
    logger.error('No runtimes selected. Select at least one runtime.');
    process.exit(1);
  }

  return answer.runtimes;
}

async function askScope(): Promise<'global' | 'local'> {
  const answer = await inquirer.prompt<{ scope: 'global' | 'local' }>([
    {
      type: 'list',
      name: 'scope',
      message: 'Install globally (user config) or locally (this project only)?',
      choices: [
        { name: 'Global — available in all projects', value: 'global' },
        { name: 'Local — this project only', value: 'local' },
      ],
      default: 'global',
    },
  ]);
  return answer.scope;
}

function createInstaller(
  runtime: Runtime,
  isGlobal: boolean,
  configDir?: string
): { install(): Promise<void>; uninstall(): Promise<void> } {
  switch (runtime) {
    case 'claude':
      return new ClaudeInstaller(isGlobal, configDir);
    case 'codex':
      return new CodexInstaller(isGlobal, configDir);
    case 'gemini':
      return new GeminiInstaller(isGlobal, configDir);
    case 'opencode':
      return new OpenCodeInstaller(isGlobal, configDir);
  }
}

export async function installCommand(opts: InstallOptions): Promise<void> {
  // Determine which runtimes to target
  let runtimes: Runtime[] = [];
  if (opts.all) {
    runtimes = ['claude', 'codex', 'gemini', 'opencode'];
  } else {
    if (opts.claude) runtimes.push('claude');
    if (opts.codex) runtimes.push('codex');
    if (opts.gemini) runtimes.push('gemini');
    if (opts.opencode) runtimes.push('opencode');
  }

  // If no runtimes specified via flags, prompt interactively
  if (runtimes.length === 0) {
    runtimes = await askRuntimes();
  }

  // Determine scope
  let isGlobal: boolean;
  if (opts.global) {
    isGlobal = true;
  } else if (opts.local) {
    isGlobal = false;
  } else {
    const scope = await askScope();
    isGlobal = scope === 'global';
  }

  const scopeLabel = isGlobal ? 'global' : 'local';
  const action = opts.uninstall ? 'Uninstalling' : 'Installing';

  logger.header(`${action} Nexus V6 (${scopeLabel})`);

  const errors: Array<{ runtime: Runtime; error: unknown }> = [];

  for (const runtime of runtimes) {
    const installer = createInstaller(runtime, isGlobal, opts.configDir);
    try {
      if (opts.uninstall) {
        await installer.uninstall();
      } else {
        await installer.install();
        logger.dim(runtimeInstructions(runtime, isGlobal));
      }
    } catch (err) {
      errors.push({ runtime, error: err });
    }
  }

  if (errors.length > 0) {
    logger.blank();
    logger.error('Some installations failed:');
    for (const { runtime, error } of errors) {
      logger.error(
        `  ${chalk.bold(runtime)}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    process.exit(1);
  }

  if (!opts.uninstall) {
    logger.blank();
    logger.done(
      `Nexus V6 installed into: ${runtimes.map(r => chalk.cyan(r)).join(', ')}`
    );
    logger.dim('Use your AI runtime\'s slash command / skill to get started.');
  }
}
