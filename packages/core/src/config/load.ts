import fs from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import { ErrorCodes, QanError } from '../errors.js';
import { assertNotMainnet, parseConfig, type QanConfig } from './schema.js';

const FILE_NAMES = ['qan.config.ts', 'qan.config.mts', 'qan.config.js', 'qan.config.json'] as const;

export interface LoadedConfig {
  config: QanConfig;
  configPath?: string;
}

export async function loadConfig(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<LoadedConfig> {
  const found = await findConfigFile(cwd);
  let raw: unknown = {};
  if (found) {
    raw = found.endsWith('.json') ? await readJson(found) : await importModule(found);
  }
  const config = applyEnvOverrides(parseConfig(raw), env);
  return found ? { config, configPath: found } : { config };
}

export function applyEnvOverrides(config: QanConfig, env: NodeJS.ProcessEnv): QanConfig {
  const network = readNetwork(env.QAN_NETWORK) ?? config.network;
  assertNotMainnet(network);

  const chainId = readChainId(env.QAN_CHAIN_ID) ?? config.chainId;
  return {
    ...config,
    network,
    chainId,
    rpcUrl: env.QAN_RPC_URL?.trim() || config.rpcUrl,
    images: {
      ...config.images,
      qvmctl: env.QAN_QVMCTL_IMAGE?.trim() || config.images.qvmctl,
    },
    docker: {
      ...config.docker,
      platform: env.QAN_DOCKER_PLATFORM?.trim() || config.docker.platform,
    },
  };
}

export function readPrivateKey(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.QAN_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new QanError(
      ErrorCodes.PRIVATE_KEY_MISSING,
      'QAN_PRIVATE_KEY is not set.',
      'Add it to your shell or a gitignored .env file. `qan init` writes .env.example. Never put the key in qan.config.',
    );
  }
  const hex = raw.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new QanError(
      ErrorCodes.PRIVATE_KEY_INVALID,
      'QAN_PRIVATE_KEY is not a 32-byte hex private key.',
      'Use a secp256k1 key, hex encoded, with or without a 0x prefix.',
    );
  }
  return hex;
}

async function findConfigFile(cwd: string): Promise<string | undefined> {
  for (const name of FILE_NAMES) {
    const candidate = path.join(cwd, name);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try the next name
    }
  }
  return undefined;
}

async function readJson(file: string): Promise<unknown> {
  const text = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new QanError(
      ErrorCodes.CONFIG_INVALID,
      `Could not parse ${path.basename(file)} as JSON.`,
      'Fix the JSON, or switch to qan.config.ts.',
      { cause },
    );
  }
}

async function importModule(file: string): Promise<unknown> {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loaded: unknown = await jiti.import(file);
  if (isRecord(loaded) && 'default' in loaded) return loaded.default;
  return loaded;
}

function readNetwork(value: string | undefined): QanConfig['network'] | undefined {
  if (!value || value.trim() === '') return undefined;
  if (value === 'qan-testnet' || value === 'qan-mainnet') return value;
  throw new QanError(
    ErrorCodes.CONFIG_INVALID,
    `QAN_NETWORK=${value} is not a known network.`,
    'Use qan-testnet. qan-mainnet is rejected until mainnet exists.',
  );
}

function readChainId(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new QanError(
      ErrorCodes.CONFIG_INVALID,
      `QAN_CHAIN_ID=${value} is not a positive integer.`,
      'Testnet is 1121. Unset the variable to use the config file.',
    );
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
