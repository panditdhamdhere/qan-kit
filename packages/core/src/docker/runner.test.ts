import { describe, expect, it } from 'vitest';
import type { ExecResult, ExecRunner } from './exec.js';
import { DockerRunner } from './runner.js';
import { silentUi } from './ui.js';

function fakeExec(handler: (args: readonly string[]) => ExecResult | Promise<ExecResult>): {
  runner: ExecRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  return {
    calls,
    runner: {
      async exec(_file, args) {
        calls.push([...args]);
        return handler(args);
      },
    },
  };
}

describe('DockerRunner', () => {
  it('reports a dead daemon when the server version is empty', async () => {
    const { runner } = fakeExec(() => ({ exitCode: 1, stdout: '', stderr: 'Cannot connect' }));
    const docker = new DockerRunner({
      exec: runner,
      hostArch: 'arm64',
      requestedPlatform: 'linux/amd64',
      ui: silentUi,
      socketExists: () => false,
    });
    await expect(docker.check()).rejects.toMatchObject({ code: 'DOCKER_DAEMON' });
  });

  it('pulls with --platform linux/amd64 on arm64 and skips a second pull when the image is present', async () => {
    const { runner, calls } = fakeExec((args) => {
      if (args[0] === 'version') return { exitCode: 0, stdout: '27.4.0\n', stderr: '' };
      if (args[0] === 'info') return { exitCode: 0, stdout: 'aarch64\n', stderr: '' };
      if (args[0] === 'image') return { exitCode: 0, stdout: 'sha256:abc\n', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    const docker = new DockerRunner({
      exec: runner,
      hostArch: 'arm64',
      requestedPlatform: 'linux/amd64',
      ui: silentUi,
      socketExists: () => true,
      platform: 'darwin',
    });

    await docker.pull('qanplatform/qvmctl:latest', 'missing');
    expect(calls.some((call) => call[0] === 'pull')).toBe(false);

    await docker.pull('qanplatform/qvmctl:latest', 'always');
    const pull = calls.find((call) => call[0] === 'pull');
    expect(pull).toEqual(['pull', '--platform', 'linux/amd64', 'qanplatform/qvmctl:latest']);
  });

  it('refuses to run qvmctl on arm64 without emulation', async () => {
    const { runner } = fakeExec((args) => {
      if (args[0] === 'version') return { exitCode: 0, stdout: '27.4.0\n', stderr: '' };
      if (args[0] === 'info') return { exitCode: 0, stdout: 'aarch64\n', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    const docker = new DockerRunner({
      exec: runner,
      hostArch: 'arm64',
      ui: silentUi,
      socketExists: () => false,
    });
    await expect(
      docker.run({
        image: 'qanplatform/qvmctl:latest',
        projectDir: '/tmp/proj',
        containerWorkdir: '/ws',
        mountDockerSocket: true,
        qvmctlArgs: ['version'],
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_ARCH' });
  });

  it('maps a qvmctl fatal log to QVMCTL_FAILED', async () => {
    const { runner } = fakeExec((args) => {
      if (args[0] === 'version') return { exitCode: 0, stdout: '27.4.0\n', stderr: '' };
      if (args[0] === 'info') return { exitCode: 0, stdout: 'x86_64\n', stderr: '' };
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'level=fatal msg="expect at least one argument"\n',
      };
    });
    const docker = new DockerRunner({
      exec: runner,
      hostArch: 'x64',
      ui: silentUi,
      socketExists: () => false,
      platform: 'linux',
    });
    await expect(
      docker.run({
        image: 'qanplatform/qvmctl:latest',
        projectDir: '/work',
        containerWorkdir: '/ws',
        mountDockerSocket: false,
        qvmctlArgs: ['deploy'],
      }),
    ).rejects.toMatchObject({
      code: 'QVMCTL_FAILED',
      message: 'expect at least one argument',
    });
  });
});
