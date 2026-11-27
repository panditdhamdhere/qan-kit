import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDockerRunArgs } from './args.js';

const host = { platform: 'darwin' as const, wsl: false, wslInterop: 'linux' as const };

describe('buildDockerRunArgs', () => {
  it('mounts the project and the docker socket, and pins amd64', () => {
    const project = path.resolve('/tmp/qan-proj');
    const args = buildDockerRunArgs({
      image: 'qanplatform/qvmctl:latest',
      platform: 'linux/amd64',
      projectDir: project,
      containerWorkdir: '/ws',
      dockerSocket: '/var/run/docker.sock',
      mountDockerSocket: true,
      extraMounts: [
        {
          hostPath: path.resolve('/tmp/qan-key'),
          containerPath: '/run/secrets/key',
          readonly: true,
        },
      ],
      qvmctlArgs: [
        'deploy',
        '-language',
        'solidity',
        '-solidity.name',
        'Counter',
        '/ws/contracts/Counter.sol',
      ],
      host,
    });

    expect(args).toEqual([
      'run',
      '--rm',
      '--platform',
      'linux/amd64',
      '-v',
      '/var/run/docker.sock:/var/run/docker.sock',
      '-v',
      `${project}:/ws`,
      '-v',
      `${path.resolve('/tmp/qan-key')}:/run/secrets/key:ro`,
      '-w',
      '/ws',
      'qanplatform/qvmctl:latest',
      'deploy',
      '-language',
      'solidity',
      '-solidity.name',
      'Counter',
      '/ws/contracts/Counter.sol',
    ]);
  });

  it('skips the socket mount when asked', () => {
    const args = buildDockerRunArgs({
      image: 'qanplatform/qvmctl:latest',
      projectDir: '/work',
      containerWorkdir: '/ws',
      mountDockerSocket: false,
      qvmctlArgs: ['version'],
      host,
    });
    expect(args).not.toContain('/var/run/docker.sock:/var/run/docker.sock');
    expect(args.slice(-2)).toEqual(['qanplatform/qvmctl:latest', 'version']);
  });
});
