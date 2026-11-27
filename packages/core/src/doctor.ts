import { createPublicClient, formatEther, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { QanConfig } from './config/schema.js';
import { readPrivateKey } from './config/load.js';
import { DockerRunner } from './docker/runner.js';
import { chainFromConfig } from './evm/chain.js';
import { isQanError } from './errors.js';
import { NotImplementedXlinkProvider, type XlinkProvider } from './xlink.js';

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  ok: boolean;
}

export interface DoctorRpc {
  getChainId(): Promise<number>;
  getBalance(address: Address): Promise<bigint>;
}

export async function runDoctor(input: {
  config: QanConfig;
  env?: NodeJS.ProcessEnv;
  runner: DockerRunner;
  rpc?: DoctorRpc;
  xlink?: XlinkProvider;
}): Promise<DoctorReport> {
  const env = input.env ?? process.env;
  const checks: DoctorCheck[] = [];

  let dockerOk = false;
  try {
    const status = await input.runner.check();
    checks.push({
      name: 'docker',
      status: 'ok',
      detail: `daemon ${status.serverVersion}, arch ${status.dockerArch || 'unknown'}`,
    });
    dockerOk = true;
    if (status.decision.error) {
      checks.push({
        name: 'architecture',
        status: 'fail',
        detail: status.decision.error.message,
        fix: status.decision.error.hint,
      });
    } else if (status.decision.arm64) {
      checks.push({
        name: 'architecture',
        status: 'warn',
        detail: status.decision.warning ?? 'ARM64 with linux/amd64 emulation',
        fix: 'Keep docker.platform set to linux/amd64, or deploy from an x86_64 machine.',
      });
    } else {
      checks.push({ name: 'architecture', status: 'ok', detail: 'not arm64' });
    }
    if (!status.socketPath) {
      checks.push({
        name: 'docker socket',
        status: 'warn',
        detail: 'No Docker socket found to mount into qvmctl.',
        fix: 'QVM compiles pull toolchain images and need the socket. Set docker.socketPath if it lives somewhere else.',
      });
    } else {
      checks.push({ name: 'docker socket', status: 'ok', detail: status.socketPath });
    }
  } catch (error) {
    checks.push(fromError('docker', error, 'fail'));
  }

  if (dockerOk) {
    const present = await input.runner.imagePresent(input.config.images.qvmctl);
    checks.push(
      present
        ? { name: 'qvmctl image', status: 'ok', detail: input.config.images.qvmctl }
        : {
            name: 'qvmctl image',
            status: 'warn',
            detail: `${input.config.images.qvmctl} is not pulled yet`,
            fix: 'The next deploy pulls it. On Apple Silicon that pull needs --platform linux/amd64.',
          },
    );
  }

  const rpc = input.rpc ?? createDefaultRpc(input.config);
  let chainOk = false;
  try {
    const chainId = await rpc.getChainId();
    chainOk = true;
    if (chainId !== input.config.chainId) {
      checks.push({
        name: 'chain id',
        status: 'fail',
        detail: `RPC says ${chainId}, config says ${input.config.chainId}`,
        fix: 'Point rpcUrl at QAN testnet or fix chainId. Testnet is 1121.',
      });
    } else {
      checks.push({
        name: 'rpc',
        status: 'ok',
        detail: `${input.config.rpcUrl} (chain ${chainId})`,
      });
    }
  } catch (error) {
    checks.push(fromError('rpc', error, 'fail'));
  }

  if (chainOk) {
    try {
      const key = readPrivateKey(env);
      const address = privateKeyToAccount(`0x${key}`).address;
      const balance = await rpc.getBalance(address);
      const zero = balance === 0n;
      checks.push({
        name: 'balance',
        status: zero ? 'warn' : 'ok',
        detail: `${address} has ${formatEther(balance)} QANX`,
        fix: zero ? 'Grab testnet QANX from https://faucet.qanplatform.com' : undefined,
      });
      await checkXlink(checks, input.xlink ?? new NotImplementedXlinkProvider(), address);
    } catch (error) {
      if (isQanError(error) && error.code === 'PRIVATE_KEY_MISSING') {
        checks.push({
          name: 'balance',
          status: 'warn',
          detail: 'QAN_PRIVATE_KEY is not set',
          fix: error.hint,
        });
        checks.push({
          name: 'xlink',
          status: 'warn',
          detail: 'skipped until there is an account',
          fix: 'XLINK is evolving. This build does not call it.',
        });
      } else {
        checks.push(fromError('balance', error, 'warn'));
      }
    }
  }

  return { checks, ok: checks.every((check) => check.status !== 'fail') };
}

async function checkXlink(
  checks: DoctorCheck[],
  xlink: XlinkProvider,
  address: Address,
): Promise<void> {
  try {
    const status = await xlink.getStatus(address);
    checks.push({
      name: 'xlink',
      status: status.bound ? 'ok' : 'warn',
      detail: status.bound
        ? `bound${status.expiresAt ? `, expires ${status.expiresAt.toISOString()}` : ''}`
        : 'not bound',
    });
  } catch (error) {
    checks.push({
      name: 'xlink',
      status: 'warn',
      detail: 'status: evolving',
      fix: isQanError(error)
        ? error.hint
        : 'XLINK is not hardcoded. See the XLINK guide once the ABI is public.',
    });
  }
}

function createDefaultRpc(config: QanConfig): DoctorRpc {
  const client = createPublicClient({
    chain: chainFromConfig(config),
    transport: http(config.rpcUrl, { timeout: 8_000 }),
  });
  return {
    getChainId: () => client.getChainId(),
    getBalance: (address) => client.getBalance({ address }),
  };
}

function fromError(name: string, error: unknown, status: 'fail' | 'warn'): DoctorCheck {
  if (isQanError(error)) {
    return { name, status, detail: error.message, fix: error.hint };
  }
  return {
    name,
    status,
    detail: error instanceof Error ? error.message : 'failed',
    fix: 'Rerun `qan doctor --verbose` and keep the log.',
  };
}
