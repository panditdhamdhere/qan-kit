import { toDockerHostPath } from './paths.js';

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly?: boolean;
}

export interface DockerRunSpec {
  image: string;
  platform?: string;
  projectDir: string;
  containerWorkdir: string;
  dockerSocket?: string;
  mountDockerSocket: boolean;
  extraMounts?: readonly VolumeMount[];
  qvmctlArgs: readonly string[];
  host: {
    platform: NodeJS.Platform;
    wsl: boolean;
    wslInterop: 'linux' | 'windows';
  };
}

export function buildDockerRunArgs(spec: DockerRunSpec): string[] {
  const args = ['run', '--rm'];
  if (spec.platform && spec.platform.length > 0) {
    args.push('--platform', spec.platform);
  }

  if (spec.mountDockerSocket && spec.dockerSocket) {
    args.push('-v', `${spec.dockerSocket}:/var/run/docker.sock`);
  }

  const project = toDockerHostPath(spec.projectDir, spec.host);
  args.push('-v', `${project}:${spec.containerWorkdir}`);

  for (const mount of spec.extraMounts ?? []) {
    const host = toDockerHostPath(mount.hostPath, spec.host);
    const suffix = mount.readonly ? ':ro' : '';
    args.push('-v', `${host}:${mount.containerPath}${suffix}`);
  }

  args.push('-w', spec.containerWorkdir, spec.image, ...spec.qvmctlArgs);
  return args;
}
