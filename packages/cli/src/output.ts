import { isQanError } from '@qan-kit/core';
import pc from 'picocolors';

export interface GlobalFlags {
  json: boolean;
  verbose: boolean;
  network?: string;
}

export function readGlobals(opts: {
  json?: boolean;
  verbose?: boolean;
  network?: string;
}): GlobalFlags {
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    network: opts.network,
  };
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function reportError(error: unknown, json: boolean): number {
  if (isQanError(error)) {
    const payload = { error: { code: error.code, message: error.message, hint: error.hint } };
    if (json) {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    } else {
      process.stderr.write(`${pc.red(error.code)}\n${error.message}\n${pc.dim(error.hint)}\n`);
    }
    return 1;
  }

  const message = error instanceof Error ? error.message : 'Unknown failure';
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ error: { code: 'UNEXPECTED', message, hint: 'Rerun with --verbose and keep the log.' } })}\n`,
    );
  } else {
    process.stderr.write(`${pc.red('UNEXPECTED')}\n${message}\n`);
  }
  return 1;
}
