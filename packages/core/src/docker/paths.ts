import path from 'node:path';

export function isWsl(env: NodeJS.ProcessEnv, procVersion = ''): boolean {
  if (env.WSL_DISTRO_NAME) return true;
  return procVersion.toLowerCase().includes('microsoft');
}

/**
 * Docker Desktop wants forward-slash paths. Windows `C:\proj` becomes `/c/proj`.
 * WSL keeps the Linux path unless `wslInterop` is `windows`, in which case
 * `/mnt/c/proj` becomes `/c/proj`.
 */
export function toDockerHostPath(
  hostPath: string,
  options: {
    platform: NodeJS.Platform;
    wsl: boolean;
    wslInterop: 'linux' | 'windows';
  },
): string {
  const absolute =
    options.platform === 'win32' ? path.win32.resolve(hostPath) : path.resolve(hostPath);
  const slashed = absolute.replace(/\\/g, '/');

  if (options.platform === 'win32') {
    return slashed.replace(/^([A-Za-z]):/, (_match, drive: string) => `/${drive.toLowerCase()}`);
  }

  if (options.wsl && options.wslInterop === 'windows') {
    const mount = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(slashed);
    if (mount?.[1]) {
      const rest = mount[2] ?? '';
      return `/${mount[1].toLowerCase()}/${rest}`;
    }
  }

  return slashed;
}

export function resolveDockerSocket(input: {
  configured?: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  home: string;
  exists: (candidate: string) => boolean;
}): string | undefined {
  if (input.configured && input.configured.length > 0) return input.configured;

  const dockerHost = input.env.DOCKER_HOST;
  if (dockerHost?.startsWith('unix://')) {
    return dockerHost.slice('unix://'.length);
  }

  const candidates = ['/var/run/docker.sock'];
  if (input.platform === 'darwin') {
    candidates.push(path.join(input.home, '.docker', 'run', 'docker.sock'));
  }

  return candidates.find((candidate) => input.exists(candidate));
}
