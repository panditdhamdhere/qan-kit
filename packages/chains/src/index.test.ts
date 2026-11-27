import { createPublicClient, http } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  QAN_FAUCET_URL,
  QAN_MAINNET_MESSAGE,
  explorerAddressUrl,
  explorerTxUrl,
  getQanTestnetEthersNetwork,
  qanMainnet,
  qanTestnet,
} from './index.js';

describe('qanTestnet', () => {
  it('matches the published testnet values', () => {
    expect(qanTestnet.id).toBe(1121);
    expect(qanTestnet.nativeCurrency).toEqual({
      name: 'QANX',
      symbol: 'QANX',
      decimals: 18,
    });
    expect(qanTestnet.rpcUrls.default.http[0]).toBe('https://rpc-testnet.qanplatform.com');
    expect(qanTestnet.blockExplorers?.default.url).toBe('https://testnet.qanscan.com');
    expect(qanTestnet.testnet).toBe(true);
    expect(QAN_FAUCET_URL).toBe('https://faucet.qanplatform.com');
  });

  it('builds an ethers network with the same chain id', () => {
    const network = getQanTestnetEthersNetwork();
    expect(network.chainId).toBe(1121n);
    expect(network.name).toBe('qan-testnet');
  });

  it('links explorer pages the way QANscan serves them', () => {
    expect(explorerTxUrl('0xabc')).toBe('https://testnet.qanscan.com/tx/0xabc');
    expect(explorerAddressUrl('0xdef')).toBe('https://testnet.qanscan.com/address/0xdef');
  });

  it('refuses to invent a mainnet chain', () => {
    expect(qanMainnet).toThrow(QAN_MAINNET_MESSAGE);
  });

  it.skipIf(!process.env.QAN_LIVE)('eth_chainId is 1121', async () => {
    const client = createPublicClient({
      chain: qanTestnet,
      transport: http(qanTestnet.rpcUrls.default.http[0]),
    });
    expect(await client.getChainId()).toBe(1121);
  });
});
