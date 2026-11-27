import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './load.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('loadConfig', () => {
  it('reads qan.config.json and applies env overrides', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-cfg-'));
    dirs.push(cwd);
    await fs.writeFile(
      path.join(cwd, 'qan.config.json'),
      JSON.stringify({
        contracts: {
          Counter: { path: 'contracts/Counter.sol', language: 'solidity', name: 'Counter' },
        },
      }),
      'utf8',
    );

    const loaded = await loadConfig(cwd, { QAN_RPC_URL: 'http://127.0.0.1:8545' });
    expect(loaded.configPath).toBe(path.join(cwd, 'qan.config.json'));
    expect(loaded.config.rpcUrl).toBe('http://127.0.0.1:8545');
    expect(loaded.config.contracts.Counter?.name).toBe('Counter');
    expect(loaded.config.chainId).toBe(1121);
  });

  it('loads a typescript config through jiti', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-cfg-ts-'));
    dirs.push(cwd);
    await fs.writeFile(
      path.join(cwd, 'qan.config.ts'),
      `export default { chainId: 1121, slots: ['COUNTER'] }\n`,
      'utf8',
    );
    const loaded = await loadConfig(cwd, {});
    expect(loaded.config.slots).toEqual(['COUNTER']);
  });
});
