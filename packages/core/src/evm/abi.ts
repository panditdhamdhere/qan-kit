import { createRequire } from 'node:module';
import type { Abi } from 'viem';
import { ErrorCodes, QanError } from '../errors.js';

interface SolcError {
  severity?: string;
  formattedMessage?: string;
  message?: string;
}

interface SolcOutput {
  errors?: SolcError[];
  contracts?: Record<string, Record<string, { abi?: Abi }>>;
}

const require = createRequire(import.meta.url);

export function compileAbi(fileName: string, source: string, contractName: string): Abi {
  const solc = require('solc') as { compile(input: string): string };
  const input = {
    language: 'Solidity',
    sources: { [fileName]: { content: source } },
    settings: {
      outputSelection: { '*': { '*': ['abi'] } },
    },
  };

  let output: SolcOutput;
  try {
    output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  } catch (cause) {
    throw new QanError(
      ErrorCodes.COMPILE_FAILED,
      'solc failed before it could return an ABI.',
      'The deploy still goes through qvmctl. This local compile is only for the ABI we save.',
      { cause },
    );
  }

  const errors = (output.errors ?? []).filter((error) => error.severity === 'error');
  if (errors.length > 0) {
    const first = errors[0];
    throw new QanError(
      ErrorCodes.COMPILE_FAILED,
      first?.formattedMessage ?? first?.message ?? 'solc reported an error.',
      'Fix the contract, then deploy again. qvmctl will compile the same flattened source.',
    );
  }

  const abi = output.contracts?.[fileName]?.[contractName]?.abi;
  if (!abi) {
    const found = Object.keys(output.contracts?.[fileName] ?? {});
    throw new QanError(
      ErrorCodes.COMPILE_FAILED,
      `solc did not return an ABI for ${contractName}.`,
      found.length > 0
        ? `Contracts in that file: ${found.join(', ')}.`
        : 'Check --name against the contract declaration.',
    );
  }
  return abi;
}
