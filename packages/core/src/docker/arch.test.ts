import { describe, expect, it } from 'vitest';
import { decidePlatform } from './arch.js';

describe('decidePlatform', () => {
  it('leaves x86 alone', () => {
    expect(decidePlatform({ hostArch: 'x64' })).toEqual({ arm64: false });
  });

  it('errors on arm64 until linux/amd64 is requested', () => {
    const decision = decidePlatform({ hostArch: 'arm64', dockerArch: 'aarch64' });
    expect(decision.error?.code).toBe('UNSUPPORTED_ARCH');
    expect(decision.error?.hint).toMatch(/linux\/amd64/);
  });

  it('accepts emulation and says why', () => {
    const decision = decidePlatform({
      hostArch: 'arm64',
      requestedPlatform: 'linux/amd64',
    });
    expect(decision.error).toBeUndefined();
    expect(decision.platform).toBe('linux/amd64');
    expect(decision.warning).toMatch(/emulation/);
  });
});
