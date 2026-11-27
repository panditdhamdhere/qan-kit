import { ErrorCodes, QanError, initProject, type InitTemplate } from '@qan-kit/core';
import { Command, CommanderError } from 'commander';
import { printJson, readGlobals, reportError } from './output.js';

const TEMPLATES: readonly InitTemplate[] = ['solidity', 'go', 'python'];

export function createProgram(): Command {
  const program = new Command();
  program
    .name('qan')
    .description('Deploy to QAN testnet')
    .option('--json', 'machine-readable output')
    .option('--verbose', 'print docker commands with secrets redacted')
    .option('--network <network>', 'qan-testnet, or qan-mainnet (disabled)');

  program
    .command('init')
    .description('Write qan.config.ts, .env.example, and a sample contract')
    .option('--template <template>', 'solidity, go, or python', 'solidity')
    .option('--force', 'overwrite existing scaffold files')
    .action(async (opts: { template?: string; force?: boolean }, command: Command) => {
      const flags = readGlobals(command.optsWithGlobals());
      try {
        const template = parseTemplate(opts.template ?? 'solidity');
        const result = await initProject({
          cwd: process.cwd(),
          template,
          force: opts.force ?? false,
        });
        if (flags.json) {
          printJson(result);
          return;
        }
        process.stdout.write(`Wrote ${result.written.join(', ') || 'nothing new'}\n`);
        if (result.skipped.length > 0) {
          process.stdout.write(`Left alone: ${result.skipped.join(', ')}\n`);
        }
        process.stdout.write('Copy .env.example to .env and set QAN_PRIVATE_KEY.\n');
      } catch (error) {
        process.exitCode = reportError(error, flags.json);
      }
    });

  program.exitOverride();
  return program;
}

export function isHelpExit(error: unknown): boolean {
  return error instanceof CommanderError && error.exitCode === 0;
}

function parseTemplate(value: string): InitTemplate {
  if (TEMPLATES.includes(value as InitTemplate)) return value as InitTemplate;
  throw new QanError(
    ErrorCodes.CONFIG_INVALID,
    `Unknown template "${value}".`,
    'Use solidity, go, or python.',
  );
}
