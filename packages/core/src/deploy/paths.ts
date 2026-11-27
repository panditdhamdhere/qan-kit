import path from 'node:path';
import { ErrorCodes, QanError } from '../errors.js';

export function toContainerPath(cwd: string, file: string, workdir: string): string {
  const absolute = path.resolve(cwd, file);
  const relative = path.relative(cwd, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new QanError(
      ErrorCodes.FLATTEN_FAILED,
      `${file} is outside the project directory.`,
      'Move the contract into the project. Docker only sees the mounted folder.',
    );
  }
  const posix = relative.split(path.sep).join('/');
  return `${workdir.replace(/\/$/, '')}/${posix}`;
}
