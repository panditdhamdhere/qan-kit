import { describe, expect, it } from 'vitest';
import { parseDeployOutput, requireDeployParse } from './parse-deploy.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';
const HASH = '0x2222222222222222222222222222222222222222222222222222222222222222';

describe('parseDeployOutput', () => {
  it('reads labelled address and tx lines and ignores PEM noise', () => {
    const stdout = `-----BEGIN QVM PEM-----\\nMII${ADDRESS}not-a-real-line\\n-----END QVM PEM-----\\n`;
    const stderr = `time="2026-11-27" level=info msg="deployed" contract address: ${ADDRESS}\\ntx hash: ${HASH}\\n`;
    expect(parseDeployOutput(stdout, stderr)).toEqual({ address: ADDRESS, txHash: HASH });
  });

  it('uses a config pattern when the label is unknown', () => {
    const parsed = parseDeployOutput('CONTRACT=0x1111111111111111111111111111111111111111', '', {
      addressPattern: 'CONTRACT=(0x[a-fA-F0-9]{40})',
    });
    expect(parsed.address).toBe(ADDRESS);
  });

  it('fails closed when nothing labelled shows up', () => {
    expect(() => requireDeployParse(parseDeployOutput('nope', ''), 'deployments/x.log')).toThrow(
      /address and tx hash/,
    );
  });
});
