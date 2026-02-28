import { Command } from 'commander';
import chalk from 'chalk';
import { installCommand } from './commands/install.js';
import { doctorCommand } from './commands/doctor.js';
import { initProject as initProjectCommand } from './commands/init-project.js';
import { mapCodebase as mapCodebaseCommand } from './commands/map-codebase.js';
import { buildIndex as buildIndexCommand } from './commands/build-index.js';
import { buildArchitecture as buildArchitectureCommand } from './commands/build-architecture.js';
import { runRecover as runRecoverCommand } from './commands/run-recover.js';
import { openDashboard as openDashboardCommand } from './commands/open-dashboard.js';

const BANNER = `
${chalk.cyan('  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗')}
${chalk.cyan('  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝')}
${chalk.cyan('  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗')}
${chalk.cyan('  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║')}
${chalk.cyan('  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║')}
${chalk.cyan('  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝')}

${chalk.bold('  NEXUS V6')} ${chalk.dim('— AI-native project intelligence system')}
  ${chalk.dim('Context engineering, mission tracking, multi-runtime install')}
`;

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('nexus')
    .description('Nexus V6 CLI — install, init, run, manage')
    .version('0.1.0')
    .hook('preAction', () => {
      // Print banner unless --no-banner or JSON output flags
      const args = process.argv.slice(2);
      const suppressBanner =
        args.includes('--no-banner') ||
        args.includes('--json') ||
        args.includes('-h') ||
        args.includes('--help') ||
        args.includes('-V') ||
        args.includes('--version');
      if (!suppressBanner) {
        console.log(BANNER);
      }
    });

  // nexus install
  program
    .command('install')
    .description('Install Nexus into AI runtimes (Claude, Codex, Gemini, OpenCode)')
    .option('--claude', 'Install for Claude Code')
    .option('--codex', 'Install for Codex / OpenAI')
    .option('--gemini', 'Install for Gemini CLI')
    .option('--opencode', 'Install for OpenCode')
    .option('--all', 'Install for all detected runtimes')
    .option('-g, --global', 'Install globally (user config dir)')
    .option('-l, --local', 'Install locally (current project)')
    .option('-c, --config-dir <path>', 'Custom config directory (overrides defaults)')
    .option('-u, --uninstall', 'Uninstall Nexus from selected runtimes')
    .action(installCommand);

  // nexus doctor
  program
    .command('doctor')
    .description('Check environment and dependencies')
    .action(doctorCommand);

  // nexus init
  program
    .command('init')
    .description('Initialize .nexus/ in the current project')
    .option('--name <name>', 'Project name (defaults to directory name)')
    .option('--description <desc>', 'One-line project description')
    .option('--force', 'Reinitialize even if .nexus/ already exists')
    .action(initProjectCommand);

  // nexus map-codebase
  program
    .command('map-codebase')
    .description('Analyze and index an existing codebase into .nexus/')
    .option('--dir <path>', 'Directory to analyze (default: cwd)')
    .action(mapCodebaseCommand);

  // nexus build-index
  program
    .command('build-index')
    .description('Rebuild .nexus/03-index/ from the current codebase')
    .action(buildIndexCommand);

  // nexus build-architecture
  program
    .command('build-architecture')
    .description('Rebuild .nexus/02-architecture/ from the current codebase')
    .action(buildArchitectureCommand);

  // nexus recover
  program
    .command('recover')
    .description('Roll back to a .nexus/ checkpoint')
    .option('--checkpoint <name>', 'Checkpoint to restore (skip selection prompt)')
    .action(runRecoverCommand);

  // nexus dashboard
  program
    .command('dashboard')
    .description('Start the Nexus live dashboard for this project')
    .option('--port <number>', 'Port to listen on (default: 7890)', (v) => parseInt(v, 10))
    .option('--no-open', 'Do not open browser automatically')
    .action((opts) => openDashboardCommand({ port: opts.port, open: opts.open !== false }));

  await program.parseAsync(process.argv);
}
