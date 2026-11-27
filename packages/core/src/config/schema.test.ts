import { describe, expect, it } from 'vitest';
import { applyEnvOverrides, readPrivateKey } from './load.js';
import { parseConfig } from './schema.js';

describe('parseConfig', () => {
  it('fills testnet defaults', () => {
    const config = parseConfig({});
    expect(config.network).toBe('qan-testnet');
    expect(config.chainId).toBe(1121);
    expect(config.rpcUrl).toBe('https://rpc-testnet.qanplatform.com');
    expect(config.images.qvmctl).toBe('qanplatform/qvmctl:latest');
    expect(config.docker.mountDockerSocket).toBe(true);
    expect(config.docker.containerWorkdir).toBe('/ws');
  });

  it('rejects a private key in the file', () => {
    expect(() => parseConfig({ privateKey: '0xabc' })).toThrow(/must not contain privateKey/);
  });

  it('rejects mainnet', () => {
    expect(() => parseConfig({ network: 'qan-mainnet' })).toThrow(/has not launched/);
  });

  it('rejects unknown keys', () => {
    expect(() => parseConfig({ faucet: 'https://example.com' })).toThrow(
      /CONFIG_INVALID|unrecognized/i,
    );
  });
});

describe('env overrides', () => {
  it('lets the environment replace rpc and chain id, not the key file', () => {
    const config = applyEnvOverrides(parseConfig({}), {
      QAN_RPC_URL: 'https://rpc.example.test',
      QAN_CHAIN_ID: '1121',
      QAN_DOCKER_PLATFORM: 'linux/amd64',
    });
    expect(config.rpcUrl).toBe('https://rpc.example.test');
    expect(config.docker.platform).toBe('linux/amd64');
  });

  it('refuses a mainnet override', () => {
    expect(() => applyEnvOverrides(parseConfig({}), { QAN_NETWORK: 'qan-mainnet' })).toThrow(
      /has not launched/,
    );
  });

  it('reads a 32-byte key and ignores the 0x prefix', () => {
    const hex = 'ab'.repeat(32);
    expect(readPrivateKey({ QAN_PRIVATE_KEY: `0x${hex}` })).toBe(hex);
    expect(() => readPrivateKey({})).toThrow(/QAN_PRIVATE_KEY is not set/);
    expect(() => readPrivateKey({ QAN_PRIVATE_KEY: 'nope' })).toThrow(/not a 32-byte/);
  });
});
