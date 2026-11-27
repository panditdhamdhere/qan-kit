import fs from 'node:fs/promises';
import path from 'node:path';
import { explorerTxUrl } from '@qan-kit/chains';
import { createPublicClient, http, type Abi } from 'viem';
import type { QanConfig } from '../config/schema.js';
import { type ContractLanguage, contractLanguages } from '../config/schema.js';
import { DockerRunner } from '../docker/runner.js';
import { ErrorCodes, QanError } from '../errors.js';
import { chainFromConfig } from '../evm/chain.js';
import { compileAbi } from '../evm/abi.js';
import { flattenSolidity } from '../flatten/flatten.js';
import { buildQvmctlDeployArgs, isSolidityLanguage } from '../qvmctl/args.js';
import { parseDeployOutput, requireDeployParse } from '../qvmctl/parse-deploy.js';
import { withPrivateKeyFile } from '../secrets.js';
import { toContainerPath } from './paths.js';
import { writeDeployLog, writeDeployment, type DeploymentRecord } from './record.js';

export interface Receipt {
  status: 'success' | 'reverted';
  contractAddress: `0x${string}` | null;
}

export interface DeployInput {
  cwd: string;
  sourcePath: string;
  name?: string;
  language?: ContractLanguage;
  constructorArgs?: readonly string[];
  config: QanConfig;
  privateKey: string;
  runner: DockerRunner;
  waitForReceipt: (hash: `0x${string}`) => Promise<Receipt>;
  now?: () => Date;
}

export interface DeployOutcome {
  record: DeploymentRecord;
  file: string;
  logFile: string;
  warnings: string[];
  explorer: string;
}

export async function deployContract(input: DeployInput): Promise<DeployOutcome> {
  const language = resolveLanguage(input);
  const warnings: string[] = [];
  let sourceFile = input.sourcePath;
  let abi: Abi = [];
  let inferred: string[] = [];

  if (isSolidityLanguage(language)) {
    const flat = await flattenSolidity(input.sourcePath, input.cwd);
    warnings.push(...flat.warnings);
    inferred = flat.contracts;
    const name = pickName(input.name, inferred, input.sourcePath);
    const flatRelative = path.join('.qan', `${name}.sol`);
    const flatAbsolute = path.join(input.cwd, flatRelative);
    await fs.mkdir(path.dirname(flatAbsolute), { recursive: true });
    await fs.writeFile(flatAbsolute, flat.source, 'utf8');
    sourceFile = flatRelative;
    abi = compileAbi(`${name}.sol`, flat.source, name);
    return finish({ ...input, language, sourceFile, abi, name, warnings });
  }

  const name = input.name ?? path.basename(input.sourcePath, path.extname(input.sourcePath));
  return finish({ ...input, language, sourceFile, abi, name, warnings });
}

async function finish(
  input: DeployInput & {
    language: ContractLanguage;
    sourceFile: string;
    abi: Abi;
    name: string;
    warnings: string[];
  },
): Promise<DeployOutcome> {
  const built = buildQvmctlDeployArgs({
    language: input.language,
    contractName: input.name,
    privkeyContainerPath: '/run/secrets/privkey',
    rpcUrl: input.config.rpcUrl,
    sourceContainerPath: toContainerPath(
      input.cwd,
      input.sourceFile,
      input.config.docker.containerWorkdir,
    ),
    registry: input.config.images.registry,
    loglevel: input.config.qvmctl.loglevel,
    gasLimit: input.config.qvmctl.gasLimit,
    blockConfirm: input.config.qvmctl.blockConfirm,
    pretestTimeout: input.config.qvmctl.pretestTimeout,
    precompilerImpl: input.config.precompilerImpl,
    constructorArgs: input.constructorArgs ?? [],
  });

  await input.runner.pull(input.config.images.qvmctl, input.config.docker.pull);

  const result = await withPrivateKeyFile(input.privateKey, (keyFile) =>
    input.runner.run({
      image: input.config.images.qvmctl,
      projectDir: input.cwd,
      containerWorkdir: input.config.docker.containerWorkdir,
      mountDockerSocket: input.config.docker.mountDockerSocket,
      extraMounts: [{ hostPath: keyFile, containerPath: '/run/secrets/privkey', readonly: true }],
      qvmctlArgs: built.args,
    }),
  );

  const log = `${result.stdout}\n${result.stderr}`;
  const logFile = await writeDeployLog(input.cwd, input.config.network, input.name, log);
  const parsed = requireDeployParse(
    parseDeployOutput(result.stdout, result.stderr, {
      addressPattern: input.config.output.addressPattern,
      txHashPattern: input.config.output.txHashPattern,
    }),
    logFile,
  );

  const receipt = await input.waitForReceipt(parsed.txHash);
  if (receipt.status !== 'success') {
    throw new QanError(
      ErrorCodes.QVMCTL_FAILED,
      `Deploy transaction ${parsed.txHash} reverted.`,
      'Look at the log next to the deployment file, then rerun with --verbose.',
    );
  }

  const address = receipt.contractAddress ?? parsed.address;
  if (!address) {
    throw new QanError(
      ErrorCodes.PARSE_FAILED,
      `Transaction ${parsed.txHash} has no contract address.`,
      `The receipt did not include contractAddress. Raw log: ${logFile}.`,
    );
  }

  const record: DeploymentRecord = {
    name: input.name,
    address,
    txHash: parsed.txHash,
    abi: input.abi,
    args: [...(input.constructorArgs ?? [])],
    chainId: input.config.chainId,
    timestamp: (input.now ?? (() => new Date()))().toISOString(),
    language: input.language,
    sourcePath: input.sourcePath,
  };
  const file = await writeDeployment(input.cwd, input.config.network, record);
  return {
    record,
    file,
    logFile,
    warnings: [...input.warnings, ...built.warnings],
    explorer: explorerTxUrl(record.txHash),
  };
}

function resolveLanguage(input: DeployInput): ContractLanguage {
  if (input.language) return input.language;
  const match = Object.values(input.config.contracts).find(
    (contract) =>
      path.resolve(input.cwd, contract.path) === path.resolve(input.cwd, input.sourcePath),
  );
  if (match) return match.language;
  const ext = path.extname(input.sourcePath).toLowerCase();
  const fromExt: Record<string, ContractLanguage> = {
    '.sol': 'solidity',
    '.go': 'go',
    '.py': 'python',
    '.ts': 'typescript',
    '.js': 'javascript',
    '.c': 'c',
    '.cpp': 'cpp',
  };
  const found = fromExt[ext];
  if (!found) {
    throw new QanError(
      ErrorCodes.CONFIG_INVALID,
      `Cannot tell the language of ${input.sourcePath}.`,
      `Pass --language. Known values: ${contractLanguages.join(', ')}.`,
    );
  }
  return found;
}

export function viemReceiptWaiter(
  config: Pick<QanConfig, 'chainId' | 'rpcUrl'>,
): (hash: `0x${string}`) => Promise<Receipt> {
  const client = createPublicClient({
    chain: chainFromConfig(config),
    transport: http(config.rpcUrl, { timeout: 60_000 }),
  });
  return async (hash) => {
    try {
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
      return {
        status: receipt.status === 'success' ? 'success' : 'reverted',
        contractAddress: receipt.contractAddress ?? null,
      };
    } catch (cause) {
      throw new QanError(
        ErrorCodes.RPC_UNREACHABLE,
        cause instanceof Error ? cause.message : 'Timed out waiting for the deploy receipt.',
        'The tx may still land. Check the explorer, or set QAN_RPC_URL if the public RPC is slow.',
        { cause },
      );
    }
  };
}

function pickName(
  explicit: string | undefined,
  inferred: readonly string[],
  sourcePath: string,
): string {
  if (explicit) return explicit;
  if (inferred.length === 1 && inferred[0]) return inferred[0];
  throw new QanError(
    ErrorCodes.CONTRACT_NOT_FOUND,
    inferred.length === 0
      ? `No contract declaration in ${sourcePath}.`
      : `Several contracts in ${sourcePath}: ${inferred.join(', ')}.`,
    'Pass --name with the contract you want qvmctl to deploy.',
  );
}
