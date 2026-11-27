import type { ContractLanguage } from '../config/schema.js';
import { ErrorCodes, QanError } from '../errors.js';

export interface DeployArgInput {
  language: ContractLanguage;
  contractName?: string;
  privkeyContainerPath: string;
  rpcUrl: string;
  sourceContainerPath: string;
  registry?: string;
  loglevel: string;
  gasLimit?: number;
  blockConfirm?: number;
  pretestTimeout?: number;
  precompilerImpl?: number;
  constructorArgs: readonly string[];
}

export function buildQvmctlDeployArgs(input: DeployArgInput): {
  args: string[];
  warnings: string[];
} {
  const language = deployLanguage(input.language);
  const warnings: string[] = [];
  const args = [
    'deploy',
    '-language',
    language,
    '-privkey',
    input.privkeyContainerPath,
    '-rpc',
    input.rpcUrl,
    '-loglevel',
    input.loglevel,
  ];

  if (language === 'solidity') {
    if (!input.contractName) {
      throw new QanError(
        ErrorCodes.CONTRACT_NOT_FOUND,
        'Solidity deploy needs a contract name.',
        'Pass --name, or leave a single contract in the file so qan-kit can infer it.',
      );
    }
    args.push('-solidity.name', input.contractName);
  } else if (input.registry) {
    args.push('-registry', input.registry);
  }

  if (input.gasLimit !== undefined) args.push('-gasLimit', String(input.gasLimit));
  if (input.blockConfirm !== undefined) args.push('-blockConfirm', String(input.blockConfirm));
  if (language !== 'solidity' && input.pretestTimeout !== undefined) {
    args.push('-pretest.timeout', String(input.pretestTimeout));
  }
  if (input.precompilerImpl !== undefined) {
    args.push('-precompilerImpl', String(input.precompilerImpl));
    warnings.push(
      'Passing -precompilerImpl. qvmctl marks this flag deprecated and already defaults to 3.',
    );
  }

  args.push(input.sourceContainerPath);

  if (input.constructorArgs.length > 0) {
    args.push(...input.constructorArgs);
    warnings.push(
      'qvmctl v0.1.0 says deploy args after the source path are unused. They were forwarded, but the constructor may not see them.',
    );
  }

  return { args, warnings };
}

export function buildQvmctlCallArgs(input: {
  kind: 'tx' | 'query';
  address: string;
  method: string;
  methodArgs: readonly string[];
  slots: readonly string[];
  privkeyContainerPath: string;
  rpcUrl: string;
  loglevel: string;
}): string[] {
  const args = [
    input.kind,
    '-language',
    'qvm',
    '-privkey',
    input.privkeyContainerPath,
    '-rpc',
    input.rpcUrl,
  ];
  if (input.slots.length > 0) {
    args.push('-r', input.slots.join(','));
  }
  args.push('-loglevel', input.loglevel, input.address, input.method, ...input.methodArgs);
  return args;
}

export function deployLanguage(language: ContractLanguage): string {
  if (language === 'sol') return 'solidity';
  if (language === 'golang') return 'go';
  if (language === 'py') return 'python';
  return language;
}

export function isSolidityLanguage(language: ContractLanguage | string): boolean {
  return language === 'solidity' || language === 'sol';
}
