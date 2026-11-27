import { QAN_TESTNET_ID, QAN_TESTNET_RPC_URL } from '@qan-kit/chains';

export interface QanHardhatNetwork {
  url: string;
  chainId: number;
  accounts: string[];
}

export function accountsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.QAN_PRIVATE_KEY?.trim();
  if (!raw) return [];
  return [raw.startsWith('0x') || raw.startsWith('0X') ? raw : `0x${raw}`];
}

export function qanHardhatNetwork(env: NodeJS.ProcessEnv = process.env): QanHardhatNetwork {
  return {
    url: env.QAN_RPC_URL?.trim() || QAN_TESTNET_RPC_URL,
    chainId: QAN_TESTNET_ID,
    accounts: accountsFromEnv(env),
  };
}
