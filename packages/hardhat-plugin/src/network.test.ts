import { QAN_TESTNET_ID, QAN_TESTNET_RPC_URL } from '@qan-kit/chains';
import { describe, expect, it } from 'vitest';
import { accountsFromEnv, qanHardhatNetwork } from './network.js';

describe('qan hardhat network', () => {
  it('points at testnet and prefixes the key', () => {
    const network = qanHardhatNetwork({ QAN_PRIVATE_KEY: 'ab'.repeat(32) });
    expect(network.chainId).toBe(QAN_TESTNET_ID);
    expect(network.url).toBe(QAN_TESTNET_RPC_URL);
    expect(network.accounts).toEqual([`0x${'ab'.repeat(32)}`]);
  });

  it('leaves accounts empty when no key is set', () => {
    expect(accountsFromEnv({})).toEqual([]);
  });
});
