import { explorerAddressUrl, explorerTxUrl, qanTestnet } from '@qan-kit/chains';
import {
  DockerRunner,
  NotImplementedXlinkProvider,
  createExecaRunner,
  deployContract,
  loadConfig,
  silentUi,
  viemReceiptWaiter,
  type DeployOutcome,
  type XlinkProvider,
  type XlinkStatus,
} from '@qan-kit/core';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type { XlinkProvider, XlinkStatus };

// TODO: replace NotImplementedXlinkProvider when the public XLINK ABI settles.
// The old xlinkSet RPC is deprecated and is intentionally not called.
// https://docs.qanplatform.com/testnet/setup/qan-xlink/docker
export { NotImplementedXlinkProvider };

export function getPublicClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: qanTestnet,
    transport: http(rpcUrl ?? qanTestnet.rpcUrls.default.http[0]),
  });
}

export function getWalletClient(privateKey: Hex, rpcUrl?: string): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: qanTestnet,
    transport: http(rpcUrl ?? qanTestnet.rpcUrls.default.http[0]),
  });
}

export function explorerTx(hash: Hash): string {
  return explorerTxUrl(hash);
}

export function explorerAddress(address: Address): string {
  return explorerAddressUrl(address);
}

export async function deployFromArtifact(input: {
  cwd?: string;
  sourcePath: string;
  name?: string;
  privateKey: string;
  constructorArgs?: readonly string[];
}): Promise<DeployOutcome> {
  const cwd = input.cwd ?? process.cwd();
  const { config } = await loadConfig(cwd);
  const key = input.privateKey.replace(/^0x/i, '');
  return deployContract({
    cwd,
    sourcePath: input.sourcePath,
    name: input.name,
    constructorArgs: input.constructorArgs,
    config,
    privateKey: key,
    runner: new DockerRunner({
      exec: createExecaRunner([key]),
      requestedPlatform: config.docker.platform,
      wslInterop: config.docker.wslInterop,
      configuredSocket: config.docker.socketPath,
      ui: silentUi,
      secrets: [key],
    }),
    waitForReceipt: viemReceiptWaiter(config),
  });
}
