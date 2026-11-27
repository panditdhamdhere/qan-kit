import { describe, expect, it } from 'vitest';
import { isWsl, resolveDockerSocket, toDockerHostPath } from './paths.js';

describe('volume paths', () => {
  it('rewrites Windows drive paths for Docker Desktop', () => {
    expect(
      toDockerHostPath('C:\\Users\\me\\proj', {
        platform: 'win32',
        wsl: false,
        wslInterop: 'linux',
      }),
    ).toBe('/c/Users/me/proj');
  });

  it('keeps a WSL path unless interop is set to windows', () => {
    const linux = toDockerHostPath('/mnt/c/src/app', {
      platform: 'linux',
      wsl: true,
      wslInterop: 'linux',
    });
    expect(linux.endsWith('/mnt/c/src/app') || linux === '/mnt/c/src/app').toBe(true);

    expect(
      toDockerHostPath('/mnt/c/src/app', {
        platform: 'linux',
        wsl: true,
        wslInterop: 'windows',
      }),
    ).toBe('/c/src/app');
  });

  it('detects WSL from the distro env or /proc/version', () => {
    expect(isWsl({ WSL_DISTRO_NAME: 'Ubuntu' })).toBe(true);
    expect(isWsl({}, 'Linux version 5.15.0-microsoft-standard')).toBe(true);
    expect(isWsl({}, 'Darwin Kernel Version 24')).toBe(false);
  });
});

describe('resolveDockerSocket', () => {
  it('prefers DOCKER_HOST, then the first socket that exists', () => {
    expect(
      resolveDockerSocket({
        env: { DOCKER_HOST: 'unix:///Users/me/.docker/run/docker.sock' },
        platform: 'darwin',
        home: '/Users/me',
        exists: () => false,
      }),
    ).toBe('/Users/me/.docker/run/docker.sock');

    expect(
      resolveDockerSocket({
        env: {},
        platform: 'darwin',
        home: '/Users/me',
        exists: (candidate) => candidate.endsWith('.docker/run/docker.sock'),
      }),
    ).toBe('/Users/me/.docker/run/docker.sock');
  });
});
