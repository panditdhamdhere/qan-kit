import { Network } from 'ethers';
import { defineChain, type Chain } from 'viem';

export const QAN_TESTNET_ID = 1121;
export const QAN_TESTNET_RPC_URL = 'https://rpc-testnet.qanplatform.com';
export const QAN_TESTNET_EXPLORER_URL = 'https://testnet.qanscan.com';
export const QAN_FAUCET_URL = 'https://faucet.qanplatform.com';

export const QAN_MAINNET_MESSAGE = 'QAN mainnet has not launched. Stay on testnet (chain id 1121).';

/** Published testnet. Chain id checked against the docs, not against a live RPC. */
export const qanTestnet: Chain = defineChain({
  id: QAN_TESTNET_ID,
  name: 'QAN TestNet',
  nativeCurrency: {
    name: 'QANX',
    symbol: 'QANX',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [QAN_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: 'QANscan',
      url: QAN_TESTNET_EXPLORER_URL,
    },
  },
  testnet: true,
});

export function getQanTestnetEthersNetwork(): Network {
  return new Network('qan-testnet', QAN_TESTNET_ID);
}

/** Mainnet is intentionally unusable until QAN ships it. */
export function qanMainnet(): never {
  throw new Error(QAN_MAINNET_MESSAGE);
}

export function explorerTxUrl(hash: string, base: string = QAN_TESTNET_EXPLORER_URL): string {
  return `${stripSlash(base)}/tx/${hash}`;
}

export function explorerAddressUrl(
  address: string,
  base: string = QAN_TESTNET_EXPLORER_URL,
): string {
  return `${stripSlash(base)}/address/${address}`;
}

function stripSlash(value: string): string {
  return value.replace(/\/$/, '');
}
