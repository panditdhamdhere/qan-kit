import { describe, expect, it } from 'vitest';
import { parseConfig } from './config/schema.js';
import type { ExecResult, ExecRunner } from './docker/exec.js';
import { DockerRunner } from './docker/runner.js';
import { silentUi } from './docker/ui.js';
import { runDoctor } from './doctor.js';
import { NotImplementedXlinkProvider } from './xlink.js';

function runnerFor(arch: string, image: boolean): DockerRunner {
  const exec: ExecRunner = {
    async exec(_file, args): Promise<ExecResult> {
      if (args[0] === 'version') return { exitCode: 0, stdout: '27.4.0\n', stderr: '' };
      if (args[0] === 'info') return { exitCode: 0, stdout: `${arch}\n`, stderr: '' };
      if (args[0] === 'image') {
        return image
          ? { exitCode: 0, stdout: 'sha256:abc\n', stderr: '' }
          : { exitCode: 1, stdout: '', stderr: 'missing' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  };
  return new DockerRunner({
    exec,
    hostArch: arch === 'aarch64' ? 'arm64' : 'x64',
    requestedPlatform: arch === 'aarch64' ? 'linux/amd64' : undefined,
    ui: silentUi,
    socketExists: () => true,
    platform: 'linux',
  });
}

describe('runDoctor', () => {
  it('reports arm64 emulation, a missing key, and the xlink placeholder', async () => {
    const report = await runDoctor({
      config: parseConfig({ docker: { platform: 'linux/amd64' } }),
      env: {},
      runner: runnerFor('aarch64', false),
      rpc: {
        async getChainId() {
          return 1121;
        },
        async getBalance() {
          return 0n;
        },
      },
      xlink: new NotImplementedXlinkProvider(),
    });

    const byName = Object.fromEntries(report.checks.map((check) => [check.name, check]));
    expect(byName.docker?.status).toBe('ok');
    expect(byName.architecture?.status).toBe('warn');
    expect(byName.architecture?.fix).toMatch(/linux\/amd64/);
    expect(byName['qvmctl image']?.status).toBe('warn');
    expect(byName.rpc?.status).toBe('ok');
    expect(byName.balance?.status).toBe('warn');
    expect(byName.xlink?.status).toBe('warn');
    expect(`${byName.xlink?.detail ?? ''} ${byName.xlink?.fix ?? ''}`).toMatch(/evolving/);
    expect(report.ok).toBe(true);
  });

  it('fails when the RPC chain id is not the configured one', async () => {
    const report = await runDoctor({
      config: parseConfig({}),
      env: { QAN_PRIVATE_KEY: `0x${'ab'.repeat(32)}` },
      runner: runnerFor('x86_64', true),
      rpc: {
        async getChainId() {
          return 1;
        },
        async getBalance() {
          return 1n;
        },
      },
    });
    expect(report.ok).toBe(false);
    expect(
      report.checks.some((check) => check.name === 'chain id' && check.status === 'fail'),
    ).toBe(true);
  });
});
