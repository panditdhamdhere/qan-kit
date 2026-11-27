import { describe, expect, it } from 'vitest';
import { redact, redactEnv } from './redact.js';

describe('redact', () => {
  it('strips the key and its 0x form', () => {
    const key = `0x${'ab'.repeat(32)}`;
    const text = `signing with ${key} and ${'ab'.repeat(32)}`;
    expect(redact(text, [key])).toBe('signing with [redacted] and [redacted]');
  });

  it('hides env values that look like secrets', () => {
    const env = redactEnv({
      QAN_PRIVATE_KEY: 'secret-value',
      PATH: '/usr/bin',
      QAN_RPC_URL: 'https://rpc-testnet.qanplatform.com',
    });
    expect(env.QAN_PRIVATE_KEY).toBe('[redacted]');
    expect(env.PATH).toBe('/usr/bin');
    expect(env.QAN_RPC_URL).toBe('https://rpc-testnet.qanplatform.com');
  });
});
