export const ErrorCodes = {
  DOCKER_MISSING: 'DOCKER_MISSING',
  DOCKER_DAEMON: 'DOCKER_DAEMON',
  UNSUPPORTED_ARCH: 'UNSUPPORTED_ARCH',
  IMAGE_PULL_FAILED: 'IMAGE_PULL_FAILED',
  QVMCTL_FAILED: 'QVMCTL_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  PRIVATE_KEY_MISSING: 'PRIVATE_KEY_MISSING',
  PRIVATE_KEY_INVALID: 'PRIVATE_KEY_INVALID',
  MAINNET_UNAVAILABLE: 'MAINNET_UNAVAILABLE',
  FILE_EXISTS: 'FILE_EXISTS',
  PARSE_FAILED: 'PARSE_FAILED',
  FLATTEN_FAILED: 'FLATTEN_FAILED',
  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
  RPC_UNREACHABLE: 'RPC_UNREACHABLE',
  CHAIN_MISMATCH: 'CHAIN_MISMATCH',
  XLINK_NOT_IMPLEMENTED: 'XLINK_NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class QanError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;

  constructor(code: ErrorCode, message: string, hint: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'QanError';
    this.code = code;
    this.hint = hint;
  }
}

export function isQanError(value: unknown): value is QanError {
  return value instanceof QanError;
}
