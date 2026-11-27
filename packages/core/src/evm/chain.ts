import { qanTestnet } from '@qan-kit/chains';
import { defineChain, type Chain } from 'viem';
import type { QanConfig } from '../config/schema.js';

export function chainFromConfig(config: Pick<QanConfig, 'chainId' | 'rpcUrl'>): Chain {
  const published = qanTestnet.rpcUrls.default.http[0];
  if (config.chainId === qanTestnet.id && config.rpcUrl === published) return qanTestnet;
  return defineChain({
    id: config.chainId,
    name: 'QAN',
    nativeCurrency: qanTestnet.nativeCurrency,
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
}
