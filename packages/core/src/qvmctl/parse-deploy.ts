import { ErrorCodes, QanError } from '../errors.js';

export interface DeployParse {
  address?: `0x${string}`;
  txHash?: `0x${string}`;
}

const ADDRESS = /0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g;
const HASH = /0x[a-fA-F0-9]{64}(?![a-fA-F0-9])/g;

export function parseDeployOutput(
  stdout: string,
  stderr: string,
  patterns?: { addressPattern?: string; txHashPattern?: string },
): DeployParse {
  const text = `${stdout}\n${stderr}`;

  if (patterns?.addressPattern || patterns?.txHashPattern) {
    return {
      address: patterns.addressPattern ? capture(text, patterns.addressPattern, 40) : undefined,
      txHash: patterns.txHashPattern ? capture(text, patterns.txHashPattern, 64) : undefined,
    };
  }

  const interesting = text
    .split('\n')
    .filter((line) => !line.includes('-----BEGIN') && !line.includes('-----END'))
    .filter((line) => /address|deploy|tx|hash|contract/i.test(line) || /level=/.test(line))
    .join('\n');

  const labelledAddress = labelled(interesting, ADDRESS, /address|deployed/i);
  const labelledHash = labelled(interesting, HASH, /tx|hash|transaction/i);

  return {
    address: labelledAddress,
    txHash: labelledHash,
  };
}

export function requireDeployParse(
  parsed: DeployParse,
  logPath: string,
): {
  address?: `0x${string}`;
  txHash: `0x${string}`;
} {
  if (!parsed.txHash && !parsed.address) {
    throw new QanError(
      ErrorCodes.PARSE_FAILED,
      'qvmctl finished, but the address and tx hash were not in the log.',
      `The raw log is ${logPath}. Set output.addressPattern and output.txHashPattern once you can see a successful deploy. See docs/ASSUMPTIONS.md.`,
    );
  }
  if (!parsed.txHash) {
    throw new QanError(
      ErrorCodes.PARSE_FAILED,
      'Found a contract address but no transaction hash.',
      `Check ${logPath} and set output.txHashPattern if qvmctl used a label we do not know yet.`,
    );
  }
  return { address: parsed.address, txHash: parsed.txHash };
}

function labelled(text: string, pattern: RegExp, label: RegExp): `0x${string}` | undefined {
  const hits: string[] = [];
  for (const line of text.split('\n')) {
    if (!label.test(line)) continue;
    for (const match of line.matchAll(pattern)) {
      if (match[0]) hits.push(match[0]);
    }
  }
  const unique = [...new Set(hits)];
  const only = unique.length === 1 ? unique[0] : undefined;
  return only ? (only as `0x${string}`) : undefined;
}

function capture(text: string, pattern: string, size: 40 | 64): `0x${string}` | undefined {
  let expression: RegExp;
  try {
    expression = new RegExp(pattern, 'i');
  } catch (cause) {
    throw new QanError(
      ErrorCodes.CONFIG_INVALID,
      `output pattern /${pattern}/ is not a valid regular expression.`,
      'Fix output.addressPattern or output.txHashPattern in qan.config.',
      { cause },
    );
  }
  const match = expression.exec(text);
  const value = match?.[1] ?? match?.[0];
  if (!value) return undefined;
  const hex = value.startsWith('0x') ? value : `0x${value}`;
  if (hex.length !== size + 2) return undefined;
  return hex as `0x${string}`;
}
