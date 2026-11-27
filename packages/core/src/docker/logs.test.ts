import { describe, expect, it } from 'vitest';
import { parseQvmctlFailure } from './logs.js';

describe('parseQvmctlFailure', () => {
  it('reads the last logrus fatal line', () => {
    const message = parseQvmctlFailure({
      exitCode: 1,
      stdout: '',
      stderr: 'time="2026-11-27 10:41:20" level=fatal msg="expect at least one argument"\n',
    });
    expect(message).toBe('expect at least one argument');
  });

  it('unescapes quotes inside the logrus message', () => {
    const message = parseQvmctlFailure({
      exitCode: 1,
      stdout: '',
      stderr:
        'time="2026-11-27 10:41:46" level=error msg="create deployer failed" error="Post \\"https://rpc-testnet.qanplatform.com\\": context deadline exceeded"\n',
    });
    expect(message).toBe(
      'create deployer failed: Post "https://rpc-testnet.qanplatform.com": context deadline exceeded',
    );
  });

  it('keeps the gas error qvmctl puts in the error field', () => {
    const message = parseQvmctlFailure({
      exitCode: 1,
      stdout: '',
      stderr:
        'level=error msg="deploy contract failed" error="failed to estimate gas needed: insufficient funds for transfer"\n',
    });
    expect(message).toBe(
      'deploy contract failed: failed to estimate gas needed: insufficient funds for transfer',
    );
  });
});
