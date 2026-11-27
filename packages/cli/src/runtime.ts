import {
  DockerRunner,
  ErrorCodes,
  QanError,
  assertNotMainnet,
  createConsoleUi,
  createExecaRunner,
  loadConfig,
  loadDotEnv,
  silentUi,
  type QanConfig,
} from '@qan-kit/core';
import type { Command } from 'commander';
import { readGlobals, type GlobalFlags } from './output.js';

export interface Runtime {
  flags: GlobalFlags;
  config: QanConfig;
  cwd: string;
}

export async function prepare(command: Command): Promise<Runtime> {
  const cwd = process.cwd();
  await loadDotEnv(cwd);
  const flags = readGlobals(command.optsWithGlobals());
  const loaded = await loadConfig(cwd);
  if (flags.network) {
    if (flags.network !== 'qan-testnet' && flags.network !== 'qan-mainnet') {
      throw new QanError(
        ErrorCodes.CONFIG_INVALID,
        `Unknown network "${flags.network}".`,
        'Use qan-testnet. qan-mainnet is not launched.',
      );
    }
    assertNotMainnet(flags.network);
  }
  return { flags, config: loaded.config, cwd };
}

export function makeRunner(runtime: Runtime, secrets: readonly string[] = []): DockerRunner {
  return new DockerRunner({
    exec: createExecaRunner(secrets),
    requestedPlatform: runtime.config.docker.platform,
    wslInterop: runtime.config.docker.wslInterop,
    configuredSocket: runtime.config.docker.socketPath,
    ui: runtime.flags.json ? silentUi : createConsoleUi(runtime.flags.verbose),
    verbose: runtime.flags.verbose,
    secrets,
  });
}

export async function guard(
  command: Command,
  run: (runtime: Runtime) => Promise<void>,
): Promise<void> {
  let json = false;
  try {
    const runtime = await prepare(command);
    json = runtime.flags.json;
    await run(runtime);
  } catch (error) {
    const { reportError } = await import('./output.js');
    process.exitCode = reportError(error, json);
  }
}
