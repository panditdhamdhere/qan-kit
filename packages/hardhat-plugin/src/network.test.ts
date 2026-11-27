import { describe, expect, it } from 'vitest';
import { accountsFromEnv, qanHardhatNetwork } from './network.js';

describe('qan hardhat network', () => {
  it('points at testnet and prefixes the key', () => {
    const network = qanHardhatNetwork({ QAN_PRIVATE_KEY: 'ab'.repeat(32) });
    expect(network.chainId).toBe(1121);
    expect(network.url).toBe('https://rpc-testnet.qanplatform.com');
    expect(network.accounts).toEqual([`0x${'ab'.repeat(32)}`]);
  });

  it('leaves accounts empty when no key is set', () => {
    expect(accountsFromEnv({})).toEqual([]);
  });
});
