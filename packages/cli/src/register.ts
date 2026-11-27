import fs from 'node:fs/promises';
import path from 'node:path';
import { explorerTxUrl } from '@qan-kit/chains';
import {
  ErrorCodes,
  QanError,
  callContract,
  deployContract,
  flattenSolidity,
  initProject,
  languageFromPath,
  readPrivateKey,
  runDoctor,
  scanSlots,
  sendContract,
  viemReceiptWaiter,
  type ContractLanguage,
  type InitTemplate,
} from '@qan-kit/core';
import { Command } from 'commander';
import pc from 'picocolors';
import { printJson } from './output.js';
import { guard, makeRunner, type Runtime } from './runtime.js';

const TEMPLATES: readonly InitTemplate[] = ['solidity', 'go', 'python'];

export function registerCommands(program: Command): void {
  program
    .command('init')
    .description('Write qan.config.ts, .env.example, and a sample contract')
    .option('--template <template>', 'solidity, go, or python', 'solidity')
    .option('--force', 'overwrite existing scaffold files')
    .action((opts: { template?: string; force?: boolean }, command: Command) =>
      guard(command, async (runtime) => {
        const template = parseTemplate(opts.template ?? 'solidity');
        const result = await initProject({
          cwd: runtime.cwd,
          template,
          force: opts.force ?? false,
        });
        if (runtime.flags.json) {
          printJson(result);
          return;
        }
        process.stdout.write(`Wrote ${result.written.join(', ') || 'nothing new'}\n`);
        if (result.skipped.length > 0) {
          process.stdout.write(`Left alone: ${result.skipped.join(', ')}\n`);
        }
        process.stdout.write('Copy .env.example to .env and set QAN_PRIVATE_KEY.\n');
      }),
    );

  program
    .command('doctor')
    .description('Check Docker, arch, RPC, balance, and XLINK')
    .action((_opts: unknown, command: Command) =>
      guard(command, async (runtime) => {
        const report = await runDoctor({
          config: runtime.config,
          runner: makeRunner(runtime),
        });
        if (runtime.flags.json) {
          printJson(report);
        } else {
          for (const check of report.checks) {
            const mark =
              check.status === 'ok'
                ? pc.green('ok')
                : check.status === 'warn'
                  ? pc.yellow('warn')
                  : pc.red('fail');
            process.stdout.write(`${mark}  ${check.name}  ${check.detail}\n`);
            if (check.fix) process.stdout.write(`    ${pc.dim(check.fix)}\n`);
          }
        }
        if (!report.ok) process.exitCode = 1;
      }),
    );

  program
    .command('flatten')
    .description('Flatten a Solidity file into one compilation unit')
    .argument('<file>', 'solidity source')
    .option('-o, --out <file>', 'write the flattened source here instead of stdout')
    .action((file: string, opts: { out?: string }, command: Command) =>
      guard(command, async (runtime) => {
        const flat = await flattenSolidity(file, runtime.cwd);
        if (opts.out) {
          await fs.mkdir(path.dirname(path.resolve(runtime.cwd, opts.out)), { recursive: true });
          await fs.writeFile(path.resolve(runtime.cwd, opts.out), flat.source, 'utf8');
        }
        if (runtime.flags.json) {
          printJson({ ...flat, source: opts.out ? undefined : flat.source, out: opts.out });
          return;
        }
        if (!opts.out) process.stdout.write(flat.source);
        else process.stdout.write(`Wrote ${opts.out}\n`);
        for (const warning of flat.warnings) process.stderr.write(`${pc.yellow(warning)}\n`);
      }),
    );

  program
    .command('slots')
    .description('Scan a QVM contract for storage slots')
    .argument('<file>', 'go, python, or typescript source')
    .option('--declare <slots>', 'comma-separated slots you already pass to -r')
    .action((file: string, opts: { declare?: string }, command: Command) =>
      guard(command, async (runtime) => {
        const language = languageFromPath(file);
        if (!language) {
          throw new QanError(
            ErrorCodes.CONFIG_INVALID,
            `Cannot scan ${file}.`,
            'Use a .go, .py, or .ts file. Solidity does not use QVM slots.',
          );
        }
        const source = await fs.readFile(path.resolve(runtime.cwd, file), 'utf8');
        const declared = [...splitList(opts.declare), ...runtime.config.slots];
        const report = scanSlots(source, language, declared);
        if (runtime.flags.json) {
          printJson(report);
          return;
        }
        process.stdout.write(
          report.readFlag.length > 0 ? `-r ${report.readFlag}\n` : '-r (none)\n',
        );
        if (report.writes.length > 0) process.stdout.write(`writes ${report.writes.join(',')}\n`);
        for (const slot of report.undeclaredReads) {
          process.stderr.write(
            `${pc.yellow(`${slot} is read and not in the declared list. qvmctl will return empty for it.`)}\n`,
          );
        }
        for (const dynamic of report.dynamic) {
          process.stderr.write(`${pc.yellow(`dynamic slot: ${dynamic}`)}\n`);
        }
      }),
    );

  program
    .command('deploy')
    .description('Flatten if needed and deploy with qvmctl')
    .argument('<file>', 'contract source')
    .option('--name <name>', 'contract name (required when a Solidity file has several)')
    .option('--args <args>', 'comma-separated constructor args (qvmctl currently ignores these)')
    .option('--language <language>', 'solidity, go, python, typescript, ...')
    .action(
      (file: string, opts: { name?: string; args?: string; language?: string }, command: Command) =>
        guard(command, async (runtime) => {
          const privateKey = readPrivateKey();
          const outcome = await deployContract({
            cwd: runtime.cwd,
            sourcePath: file,
            name: opts.name,
            language: parseLanguage(opts.language),
            constructorArgs: splitList(opts.args),
            config: runtime.config,
            privateKey,
            runner: makeRunner(runtime, [privateKey]),
            waitForReceipt: viemReceiptWaiter(runtime.config),
          });
          const payload = {
            name: outcome.record.name,
            address: outcome.record.address,
            txHash: outcome.record.txHash,
            explorer: outcome.explorer,
            file: path.relative(runtime.cwd, outcome.file),
            warnings: outcome.warnings,
          };
          if (runtime.flags.json) {
            printJson(payload);
            return;
          }
          process.stdout.write(
            `${payload.name}\n${payload.address}\n${payload.explorer}\n${payload.file}\n`,
          );
          for (const warning of outcome.warnings) process.stderr.write(`${pc.yellow(warning)}\n`);
        }),
    );

  program
    .command('call')
    .description('Read a deployed contract')
    .argument('<name>', 'deployment name')
    .argument('<method>', 'function or QVM method')
    .argument('[args...]', 'method arguments')
    .option('--slots <slots>', 'extra QVM read slots')
    .action(
      (name: string, method: string, args: string[], opts: { slots?: string }, command: Command) =>
        guard(command, (runtime) => invoke(runtime, 'call', name, method, args, opts.slots)),
    );

  program
    .command('send')
    .description('Send a transaction. QVM sends pick up scanned slots.')
    .argument('<name>', 'deployment name')
    .argument('<method>', 'function or QVM method')
    .argument('[args...]', 'method arguments')
    .option('--slots <slots>', 'extra QVM read slots')
    .action(
      (name: string, method: string, args: string[], opts: { slots?: string }, command: Command) =>
        guard(command, (runtime) => invoke(runtime, 'send', name, method, args, opts.slots)),
    );
}

async function invoke(
  runtime: Runtime,
  kind: 'call' | 'send',
  name: string,
  method: string,
  args: string[],
  slots: string | undefined,
): Promise<void> {
  const privateKey = kind === 'send' ? readPrivateKey() : tryKey();
  const runner = makeRunner(runtime, privateKey ? [privateKey] : []);
  if (kind === 'call') {
    const result = await callContract({
      cwd: runtime.cwd,
      name,
      method,
      args,
      config: runtime.config,
      privateKey,
      runner,
      slots: splitList(slots),
    });
    emit(runtime, { result: result.result, warnings: result.warnings });
    return;
  }
  if (!privateKey) {
    throw new QanError(
      ErrorCodes.PRIVATE_KEY_MISSING,
      'QAN_PRIVATE_KEY is not set.',
      'Add it to .env.',
    );
  }
  const sent = await sendContract({
    cwd: runtime.cwd,
    name,
    method,
    args,
    config: runtime.config,
    privateKey,
    runner,
    slots: splitList(slots),
    waitForReceipt: async (hash) => {
      await viemReceiptWaiter(runtime.config)(hash);
    },
  });
  emit(runtime, {
    txHash: sent.txHash,
    explorer: sent.txHash ? explorerTxUrl(sent.txHash) : undefined,
    output: sent.output,
    slots: sent.slots,
    warnings: sent.warnings,
  });
}

function emit(runtime: Runtime, value: unknown): void {
  if (runtime.flags.json) {
    printJson(value);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseTemplate(value: string): InitTemplate {
  if (TEMPLATES.includes(value as InitTemplate)) return value as InitTemplate;
  throw new QanError(
    ErrorCodes.CONFIG_INVALID,
    `Unknown template "${value}".`,
    'Use solidity, go, or python.',
  );
}

function parseLanguage(value: string | undefined): ContractLanguage | undefined {
  if (!value) return undefined;
  const known: readonly ContractLanguage[] = [
    'solidity',
    'sol',
    'go',
    'golang',
    'python',
    'py',
    'typescript',
    'ts',
    'javascript',
    'js',
    'c',
    'cpp',
    'cxx',
  ];
  const match = known.find((item) => item === value);
  if (match) return match;
  throw new QanError(
    ErrorCodes.CONFIG_INVALID,
    `Unknown language "${value}".`,
    `Use one of: ${known.join(', ')}.`,
  );
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function tryKey(): string | undefined {
  try {
    return readPrivateKey();
  } catch (error) {
    if (error instanceof QanError && error.code === 'PRIVATE_KEY_MISSING') return undefined;
    throw error;
  }
}
