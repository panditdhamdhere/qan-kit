import { Command, CommanderError } from 'commander';
import { registerCommands } from './register.js';

export function createProgram(): Command {
  const program = new Command();
  program
    .name('qan')
    .description('Deploy to QAN testnet')
    .option('--json', 'machine-readable output')
    .option('--verbose', 'print docker commands with secrets redacted')
    .option('--network <network>', 'qan-testnet, or qan-mainnet (disabled)');

  registerCommands(program);
  program.exitOverride();
  return program;
}

export function isHelpExit(error: unknown): boolean {
  return error instanceof CommanderError && error.exitCode === 0;
}
