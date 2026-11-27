import { z } from 'zod';
import { ErrorCodes, QanError } from '../errors.js';

export const contractLanguages = [
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
] as const;

export const contractLanguageSchema = z.enum(contractLanguages);

const contractSchema = z
  .object({
    path: z.string().min(1),
    language: contractLanguageSchema,
    name: z.string().min(1).optional(),
    slots: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const qanConfigSchema = z
  .object({
    network: z.enum(['qan-testnet', 'qan-mainnet']).default('qan-testnet'),
    rpcUrl: z.string().url().default('https://rpc-testnet.qanplatform.com'),
    chainId: z.number().int().positive().default(1121),
    images: z
      .object({
        qvmctl: z.string().min(1).default('qanplatform/qvmctl:latest'),
        registry: z.string().min(1).default('qanplatform'),
      })
      .strict()
      .default({}),
    docker: z
      .object({
        platform: z.string().min(1).optional(),
        socketPath: z.string().min(1).optional(),
        mountDockerSocket: z.boolean().default(true),
        containerWorkdir: z.string().min(1).default('/ws'),
        wslInterop: z.enum(['linux', 'windows']).default('linux'),
        pull: z.enum(['missing', 'always']).default('missing'),
      })
      .strict()
      .default({}),
    qvmctl: z
      .object({
        gasLimit: z.number().int().nonnegative().optional(),
        blockConfirm: z.number().int().nonnegative().optional(),
        pretestTimeout: z.number().int().positive().optional(),
        loglevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
      })
      .strict()
      .default({}),
    output: z
      .object({
        addressPattern: z.string().min(1).optional(),
        txHashPattern: z.string().min(1).optional(),
      })
      .strict()
      .default({}),
    contracts: z.record(z.string().min(1), contractSchema).default({}),
    slots: z.array(z.string().min(1)).default([]),
    precompilerImpl: z.number().int().positive().optional(),
  })
  .strict();

export type QanConfig = z.infer<typeof qanConfigSchema>;
export type ContractLanguage = z.infer<typeof contractLanguageSchema>;
export type ContractConfig = z.infer<typeof contractSchema>;

export function parseConfig(input: unknown): QanConfig {
  if (isRecord(input) && 'privateKey' in input) {
    throw new QanError(
      ErrorCodes.CONFIG_INVALID,
      'qan.config must not contain privateKey.',
      'Export QAN_PRIVATE_KEY in the environment. The file is the wrong place for it.',
    );
  }

  const parsed = qanConfigSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new QanError(
      ErrorCodes.CONFIG_INVALID,
      parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
      'Compare the file with `qan init`, or see docs/ASSUMPTIONS.md for fields we actually accept.',
    );
  }

  assertNotMainnet(parsed.data.network);
  return parsed.data;
}

export function assertNotMainnet(network: QanConfig['network']): void {
  if (network === 'qan-mainnet') {
    throw new QanError(
      ErrorCodes.MAINNET_UNAVAILABLE,
      'QAN mainnet has not launched.',
      'Use network "qan-testnet" (chain id 1121). The mainnet placeholder stays disabled on purpose.',
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
