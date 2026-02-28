import chalk from 'chalk';
import ora, { type Ora } from 'ora';

// Log levels: silent=0, error=1, warn=2, info=3, verbose=4
const LOG_LEVELS: Record<string, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
};

function getLogLevel(): number {
  const envLevel = process.env['NEXUS_LOG_LEVEL']?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel]!;
  }
  return LOG_LEVELS['info']!; // default: info
}

function shouldLog(level: number): boolean {
  return level <= getLogLevel();
}

export const logger = {
  /** General informational message */
  info(message: string): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log(chalk.blue('  i ') + message);
    }
  },

  /** Warning message */
  warn(message: string): void {
    if (shouldLog(LOG_LEVELS['warn']!)) {
      console.log(chalk.yellow('  ! ') + chalk.yellow(message));
    }
  },

  /** Error message */
  error(message: string): void {
    if (shouldLog(LOG_LEVELS['error']!)) {
      console.error(chalk.red('  x ') + chalk.red(message));
    }
  },

  /** Success message */
  success(message: string): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log(chalk.green('  v ') + chalk.green(message));
    }
  },

  /** Dimmed / secondary information */
  dim(message: string): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log(chalk.dim('    ' + message));
    }
  },

  /** Bold section header */
  header(message: string): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log('\n' + chalk.bold.cyan(message));
      console.log(chalk.dim('─'.repeat(Math.min(message.length, 60))));
    }
  },

  /** Numbered / bulleted step */
  step(message: string): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log(chalk.cyan('  > ') + message);
    }
  },

  /** Final "done" message */
  done(message: string): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log('\n' + chalk.bold.green('  Done! ') + message + '\n');
    }
  },

  /** Print a blank line */
  blank(): void {
    if (shouldLog(LOG_LEVELS['info']!)) {
      console.log('');
    }
  },
};

/**
 * Create and start an ora spinner.
 * Returns the spinner instance so callers can `.succeed()` / `.fail()` it.
 */
export function spinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  }).start();
}
