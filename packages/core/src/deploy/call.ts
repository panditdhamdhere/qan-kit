import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Hex,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { QanConfig } from '../config/schema.js';
import { DockerRunner } from '../docker/runner.js';
import { ErrorCodes, QanError } from '../errors.js';
import { chainFromConfig } from '../evm/chain.js';
import { buildQvmctlCallArgs, isSolidityLanguage } from '../qvmctl/args.js';
import { withPrivateKeyFile } from '../secrets.js';
import { languageFromPath, scanSlots } from '../slots/scan.js';
import { readDeployment } from './record.js';

export async function callContract(input: {
  cwd: string;
  name: string;
  method: string;
  args: readonly string[];
  config: QanConfig;
  privateKey?: string;
  runner?: DockerRunner;
  slots?: readonly string[];
}): Promise<{ result: unknown; warnings: string[] }> {
  const record = await readDeployment(input.cwd, input.config.network, input.name);
  if (isSolidityLanguage(record.language)) {
    const client = createPublicClient({
      chain: chainFromConfig(input.config),
      transport: http(input.config.rpcUrl, { timeout: 20_000 }),
    });
    try {
      const result: unknown = await client.readContract({
        address: record.address,
        abi: record.abi,
        functionName: input.method,
        args: input.args,
      } as Parameters<typeof client.readContract>[0]);
      return { result, warnings: [] };
    } catch (cause) {
      throw new QanError(
        ErrorCodes.RPC_UNREACHABLE,
        cause instanceof Error ? cause.message : 'eth_call failed.',
        'Check the RPC, the function name, and that the deployment ABI matches this contract.',
        { cause },
      );
    }
  }

  if (!input.privateKey || !input.runner) {
    throw new QanError(
      ErrorCodes.PRIVATE_KEY_MISSING,
      'QVM reads go through qvmctl query, which needs a key.',
      'Set QAN_PRIVATE_KEY. Solidity reads use eth_call and do not need one.',
    );
  }
  const scanned = await scanProjectFile(input.cwd, record.sourcePath, [
    ...(input.slots ?? []),
    ...input.config.slots,
  ]);
  const output = await runQvm(input.cwd, input.runner, input.config, input.privateKey, 'query', {
    address: record.address,
    method: input.method,
    methodArgs: input.args,
    slots: scanned.slots,
  });
  return { result: output, warnings: scanned.warnings };
}

export async function sendContract(input: {
  cwd: string;
  name: string;
  method: string;
  args: readonly string[];
  config: QanConfig;
  privateKey: string;
  runner?: DockerRunner;
  slots?: readonly string[];
  waitForReceipt?: (hash: `0x${string}`) => Promise<void>;
}): Promise<{ txHash?: `0x${string}`; output?: string; warnings: string[]; slots: string[] }> {
  const record = await readDeployment(input.cwd, input.config.network, input.name);
  if (isSolidityLanguage(record.language)) {
    const account = privateKeyToAccount(`0x${input.privateKey}`);
    const chain = chainFromConfig(input.config);
    const wallet = createWalletClient({
      account,
      chain,
      transport: http(input.config.rpcUrl, { timeout: 20_000 }),
    });
    const data = encodeCall(record.abi, input.method, input.args);
    try {
      const txHash = await wallet.sendTransaction({
        account,
        chain,
        to: record.address,
        data,
      });
      if (input.waitForReceipt) await input.waitForReceipt(txHash);
      return { txHash, warnings: [], slots: [] };
    } catch (cause) {
      throw new QanError(
        ErrorCodes.RPC_UNREACHABLE,
        cause instanceof Error ? cause.message : 'The send failed.',
        'Check the balance, the function arguments, and QAN_RPC_URL.',
        { cause },
      );
    }
  }

  if (!input.runner) {
    throw new QanError(
      ErrorCodes.DOCKER_MISSING,
      'QVM sends need Docker.',
      'Start Docker, then rerun `qan send`.',
    );
  }
  const scanned = await scanProjectFile(input.cwd, record.sourcePath, [
    ...(input.slots ?? []),
    ...(input.config.slots ?? []),
  ]);
  const output = await runQvm(input.cwd, input.runner, input.config, input.privateKey, 'tx', {
    address: record.address,
    method: input.method,
    methodArgs: input.args,
    slots: scanned.slots,
  });
  return { output, warnings: scanned.warnings, slots: scanned.slots };
}

function encodeCall(abi: Abi, method: string, args: readonly string[]): Hex {
  try {
    return encodeFunctionData({
      abi,
      functionName: method,
      args,
    } as Parameters<typeof encodeFunctionData>[0]);
  } catch (cause) {
    throw new QanError(
      ErrorCodes.CONTRACT_NOT_FOUND,
      cause instanceof Error ? cause.message : `Could not encode ${method}.`,
      'Check the function name against the ABI stored in deployments/.',
      { cause },
    );
  }
}

async function scanProjectFile(
  cwd: string,
  sourcePath: string,
  declared: readonly string[],
): Promise<{ slots: string[]; warnings: string[] }> {
  const language = languageFromPath(sourcePath);
  if (!language) return { slots: [...declared], warnings: [] };
  const source = await fs.readFile(path.resolve(cwd, sourcePath), 'utf8');
  const report = scanSlots(source, language, declared);
  const warnings = report.undeclaredReads.map(
    (slot) =>
      `${slot} is read and was not declared. It was added to -r. Undeclared reads come back empty.`,
  );
  if (report.dynamic.length > 0) {
    warnings.push(
      `Dynamic slot expression (${report.dynamic.join(', ')}). Add those names by hand if the call needs them.`,
    );
  }
  const slots = [...new Set([...declared, ...report.requiredReads])];
  return { slots, warnings };
}

async function runQvm(
  cwd: string,
  runner: DockerRunner,
  config: QanConfig,
  privateKey: string,
  kind: 'tx' | 'query',
  call: {
    address: `0x${string}`;
    method: string;
    methodArgs: readonly string[];
    slots: readonly string[];
  },
): Promise<string> {
  const args = buildQvmctlCallArgs({
    kind,
    address: call.address,
    method: call.method,
    methodArgs: call.methodArgs,
    slots: call.slots,
    privkeyContainerPath: '/run/secrets/privkey',
    rpcUrl: config.rpcUrl,
    loglevel: config.qvmctl.loglevel,
  });
  await runner.pull(config.images.qvmctl, config.docker.pull);
  const result = await withPrivateKeyFile(privateKey, (keyFile) =>
    runner.run({
      image: config.images.qvmctl,
      projectDir: cwd,
      containerWorkdir: config.docker.containerWorkdir,
      mountDockerSocket: config.docker.mountDockerSocket,
      extraMounts: [{ hostPath: keyFile, containerPath: '/run/secrets/privkey', readonly: true }],
      qvmctlArgs: args,
    }),
  );
  return `${result.stdout}${result.stderr}`.trim();
}
