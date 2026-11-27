import { ErrorCodes, QanError } from '../errors.js';

export interface ArchDecision {
  arm64: boolean;
  platform?: string;
  error?: QanError;
  warning?: string;
}

export function decidePlatform(input: {
  hostArch: string;
  dockerArch?: string;
  requestedPlatform?: string;
}): ArchDecision {
  const reported = (input.dockerArch || input.hostArch).toLowerCase();
  const arm64 = reported === 'arm64' || reported === 'aarch64';
  const requested = input.requestedPlatform?.trim();

  if (!arm64) {
    return requested ? { arm64: false, platform: requested } : { arm64: false };
  }

  if (!requested || !/amd64|x86_64/.test(requested)) {
    const asked = requested ? ` (${requested})` : '';
    return {
      arm64: true,
      error: new QanError(
        ErrorCodes.UNSUPPORTED_ARCH,
        `This machine is ARM64${asked}. qanplatform/qvmctl publishes no arm64 image, and contract compilation does not support ARM64.`,
        'Pass --platform linux/amd64 (Docker will emulate amd64), or run the deploy on an x86_64 machine. `qan init` writes docker.platform: linux/amd64 for you.',
      ),
    };
  }

  return {
    arm64: true,
    platform: requested,
    warning:
      'ARM64 host. qvmctl is running under linux/amd64 emulation. Compilation is slower, and that is the supported path today.',
  };
}
