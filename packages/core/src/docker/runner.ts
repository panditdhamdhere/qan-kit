import fs from 'node:fs';
import os from 'node:os';
import { ErrorCodes, QanError } from '../errors.js';
import { redact } from '../redact.js';
import { decidePlatform, type ArchDecision } from './arch.js';
import { buildDockerRunArgs, type DockerRunSpec } from './args.js';
import { type ExecResult, type ExecRunner } from './exec.js';
import { parseQvmctlFailure } from './logs.js';
import { isWsl, resolveDockerSocket } from './paths.js';
import { silentUi, type DockerUi } from './ui.js';

export interface DockerCheck {
  serverVersion: string;
  dockerArch: string;
  decision: ArchDecision;
  socketPath?: string;
}

export interface DockerRunnerOptions {
  exec: ExecRunner;
  hostArch?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  requestedPlatform?: string;
  wslInterop?: 'linux' | 'windows';
  procVersion?: string;
  home?: string;
  socketExists?: (candidate: string) => boolean;
  configuredSocket?: string;
  ui?: DockerUi;
  secrets?: readonly string[];
  verbose?: boolean;
}

export class DockerRunner {
  private readonly exec: ExecRunner;
  private readonly hostArch: string;
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;
  private readonly requestedPlatform?: string;
  private readonly wslInterop: 'linux' | 'windows';
  private readonly procVersion: string;
  private readonly home: string;
  private readonly socketExists: (candidate: string) => boolean;
  private readonly configuredSocket?: string;
  private readonly ui: DockerUi;
  private readonly secrets: readonly string[];
  private readonly verbose: boolean;

  constructor(options: DockerRunnerOptions) {
    this.exec = options.exec;
    this.hostArch = options.hostArch ?? process.arch;
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.requestedPlatform = options.requestedPlatform;
    this.wslInterop = options.wslInterop ?? 'linux';
    this.procVersion = options.procVersion ?? '';
    this.home = options.home ?? os.homedir();
    this.socketExists = options.socketExists ?? ((candidate) => fs.existsSync(candidate));
    this.configuredSocket = options.configuredSocket;
    this.ui = options.ui ?? silentUi;
    this.secrets = options.secrets ?? [];
    this.verbose = options.verbose ?? false;
  }

  async check(): Promise<DockerCheck> {
    let version: ExecResult;
    try {
      version = await this.exec.exec('docker', ['version', '--format', '{{.Server.Version}}']);
    } catch (cause) {
      throw dockerSpawnError(cause);
    }

    if (version.exitCode !== 0 || version.stdout.trim() === '') {
      throw new QanError(
        ErrorCodes.DOCKER_DAEMON,
        'Docker is installed, but the daemon is not responding.',
        'Start Docker Desktop or the docker service, then rerun `qan doctor`.',
      );
    }

    const info = await this.exec.exec('docker', ['info', '--format', '{{.Architecture}}']);
    const dockerArch = info.exitCode === 0 ? info.stdout.trim() : this.hostArch;
    const decision = decidePlatform({
      hostArch: this.hostArch,
      dockerArch,
      requestedPlatform: this.requestedPlatform,
    });

    if (decision.warning) this.ui.warn(decision.warning);

    const socketPath = resolveDockerSocket({
      configured: this.configuredSocket,
      env: this.env,
      platform: this.platform,
      home: this.home,
      exists: this.socketExists,
    });

    return {
      serverVersion: version.stdout.trim(),
      dockerArch,
      decision,
      socketPath,
    };
  }

  async pull(image: string, mode: 'missing' | 'always' = 'missing'): Promise<void> {
    const status = await this.check();
    if (status.decision.error) throw status.decision.error;

    if (mode === 'missing') {
      const inspect = await this.exec.exec('docker', [
        'image',
        'inspect',
        image,
        '--format',
        '{{.Id}}',
      ]);
      if (inspect.exitCode === 0 && inspect.stdout.trim().length > 0) return;
    }

    const args = ['pull'];
    if (status.decision.platform) args.push('--platform', status.decision.platform);
    args.push(image);

    const spinner = this.ui.spin(`Pulling ${image}`);
    const result = await this.exec.exec('docker', args, {
      onStdout: (chunk) => spinner.text(chunk),
      onStderr: (chunk) => spinner.text(chunk),
    });
    if (result.exitCode !== 0) {
      spinner.fail(`Could not pull ${image}`);
      throw new QanError(
        ErrorCodes.IMAGE_PULL_FAILED,
        parseQvmctlFailure(result),
        'Check the image tag (images.qvmctl) and that this machine can reach Docker Hub.',
      );
    }
    spinner.succeed(`Pulled ${image}`);
  }

  async run(
    spec: Omit<DockerRunSpec, 'platform' | 'host' | 'dockerSocket'> & {
      dockerSocket?: string;
    },
  ): Promise<ExecResult> {
    const status = await this.check();
    if (status.decision.error) throw status.decision.error;

    const args = buildDockerRunArgs({
      ...spec,
      platform: status.decision.platform,
      dockerSocket: spec.dockerSocket ?? status.socketPath,
      host: {
        platform: this.platform,
        wsl: isWsl(this.env, this.procVersion),
        wslInterop: this.wslInterop,
      },
    });

    const rendered = redact(['docker', ...args].join(' '), this.secrets);
    if (this.verbose) this.ui.info(rendered);

    const result = await this.exec.exec('docker', args, {
      onStdout: (chunk) => {
        if (this.verbose) this.ui.info(chunk.trimEnd());
      },
      onStderr: (chunk) => {
        if (this.verbose) this.ui.info(chunk.trimEnd());
      },
    });

    if (result.exitCode !== 0) {
      throw new QanError(
        ErrorCodes.QVMCTL_FAILED,
        parseQvmctlFailure(result),
        'Rerun with --verbose for the redacted log. `qan doctor` checks Docker, the image arch, and the RPC.',
      );
    }
    return result;
  }
}

function dockerSpawnError(cause: unknown): QanError {
  const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
  if (code === 'ENOENT') {
    return new QanError(
      ErrorCodes.DOCKER_MISSING,
      'Docker is not installed, or it is not on PATH.',
      'Install Docker Desktop (or the Docker engine) and rerun `qan doctor`.',
      { cause },
    );
  }
  return new QanError(
    ErrorCodes.DOCKER_DAEMON,
    'Could not talk to Docker.',
    'Start Docker and confirm `docker version` prints a server version.',
    { cause },
  );
}
