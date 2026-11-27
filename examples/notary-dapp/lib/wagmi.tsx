'use client';

import { qanTestnet } from '@qan-kit/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { numberToHex, type Address, type Chain } from 'viem';
import { createConfig, createConnector, http, WagmiProvider, type CreateConnectorFn } from 'wagmi';

interface EthereumProvider {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

function ethereumProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return eth;
}

// Local injected connector so the app does not import wagmi/connectors.
// That barrel pulls @base-org/account, which needs optional @x402 packages.
export function metaMaskInjected(): CreateConnectorFn {
  return createConnector((config) => ({
    id: 'injected',
    name: 'MetaMask',
    type: 'injected',
    async connect<withCapabilities extends boolean = false>(parameters?: {
      chainId?: number;
      isReconnecting?: boolean;
      withCapabilities?: boolean | withCapabilities;
    }) {
      const provider = ethereumProvider();
      if (!provider) throw new Error('MetaMask is not installed.');
      const raw = (await provider.request({ method: 'eth_requestAccounts' })) as readonly Address[];
      const chainId = Number(await provider.request({ method: 'eth_chainId' }));
      const accounts = parameters?.withCapabilities
        ? raw.map((address) => ({ address, capabilities: {} as Record<string, unknown> }))
        : raw;
      return { accounts, chainId } as {
        accounts: withCapabilities extends true
          ? readonly { address: Address; capabilities: Record<string, unknown> }[]
          : readonly Address[];
        chainId: number;
      };
    },
    async disconnect() {},
    async getAccounts() {
      const provider = ethereumProvider();
      if (!provider) return [];
      return (await provider.request({ method: 'eth_accounts' })) as Address[];
    },
    async getChainId() {
      const provider = ethereumProvider();
      if (!provider) throw new Error('MetaMask is not installed.');
      return Number(await provider.request({ method: 'eth_chainId' }));
    },
    async getProvider() {
      return ethereumProvider();
    },
    async isAuthorized() {
      const accounts = await this.getAccounts();
      return accounts.length > 0;
    },
    async switchChain({ chainId }) {
      const provider = ethereumProvider();
      if (!provider) throw new Error('MetaMask is not installed.');
      const chain = config.chains.find((item) => item.id === chainId);
      if (!chain) throw new Error(`Chain ${chainId} is not configured.`);
      const hexId = numberToHex(chainId);
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexId }],
        });
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
        if (code !== 4902) throw error;
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [chainParams(chain, hexId)],
        });
      }
      return chain;
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) config.emitter.emit('disconnect');
      else config.emitter.emit('change', { accounts: accounts as Address[] });
    },
    onChainChanged(chain) {
      config.emitter.emit('change', { chainId: Number(chain) });
    },
    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  }));
}

function chainParams(chain: Chain, hexId: string) {
  return {
    chainId: hexId,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls.default.http,
    blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
  };
}

export const wagmiConfig = createConfig({
  chains: [qanTestnet],
  connectors: [metaMaskInjected()],
  transports: {
    [qanTestnet.id]: http(qanTestnet.rpcUrls.default.http[0]),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
