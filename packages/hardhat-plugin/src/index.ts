import path from 'node:path';
import {
  DockerRunner,
  createConsoleUi,
  createExecaRunner,
  deployContract,
  loadConfig,
  readPrivateKey,
  viemReceiptWaiter,
} from '@qan-kit/core';
import { extendConfig, task } from 'hardhat/config';
import type { HardhatConfig, HttpNetworkConfig } from 'hardhat/types';
import { qanHardhatNetwork } from './network.js';

extendConfig((config: HardhatConfig, userConfig) => {
  const defaults = qanHardhatNetwork();
  const user = userConfig.networks?.qan;
  const existing = config.networks.qan;
  if (existing && 'url' in existing) {
    if (!user || !('url' in user) || !user.url) existing.url = defaults.url;
    if (existing.chainId === undefined) existing.chainId = defaults.chainId;
    const userAccounts = user && 'accounts' in user ? user.accounts : undefined;
    if (userAccounts === undefined && defaults.accounts.length > 0) {
      existing.accounts = defaults.accounts;
    }
    return;
  }
  const network: HttpNetworkConfig = {
    url: defaults.url,
    chainId: defaults.chainId,
    accounts: defaults.accounts.length > 0 ? defaults.accounts : 'remote',
    gas: 'auto',
    gasPrice: 'auto',
    gasMultiplier: 1,
    timeout: 20_000,
    httpHeaders: {},
  };
  config.networks.qan = network;
});

task('qan:deploy', 'Flatten a Hardhat contract and deploy it with qvmctl')
  .addParam('contract', 'Contract name, for example Counter')
  .addOptionalParam('args', 'Comma-separated constructor arguments')
  .setAction(async (args: { contract: string; args?: string }, hre) => {
    const artifact = await hre.artifacts.readArtifact(args.contract);
    const cwd = hre.config.paths.root;
    const sourcePath = path.isAbsolute(artifact.sourceName)
      ? artifact.sourceName
      : path.join(cwd, artifact.sourceName);
    const { config } = await loadConfig(cwd);
    const privateKey = readPrivateKey();
    const outcome = await deployContract({
      cwd,
      sourcePath,
      name: args.contract,
      language: 'solidity',
      constructorArgs: (args.args ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
      config,
      privateKey,
      runner: new DockerRunner({
        exec: createExecaRunner([privateKey]),
        requestedPlatform: config.docker.platform,
        wslInterop: config.docker.wslInterop,
        configuredSocket: config.docker.socketPath,
        ui: createConsoleUi(true),
        secrets: [privateKey],
        verbose: false,
      }),
      waitForReceipt: viemReceiptWaiter(config),
    });
    console.log(`${outcome.record.name} ${outcome.record.address}`);
    console.log(outcome.explorer);
    return outcome.record;
  });
