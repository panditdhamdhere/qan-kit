import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../config/schema.js';
import type { ExecResult, ExecRunner } from '../docker/exec.js';
import { DockerRunner } from '../docker/runner.js';
import { silentUi } from '../docker/ui.js';
import { deployContract } from './deploy.js';

const ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('deployContract', () => {
  it('flattens, asks qvmctl for the contract name, and writes the deployment', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-deploy-'));
    dirs.push(cwd);
    await fs.mkdir(path.join(cwd, 'contracts'));
    await fs.writeFile(
      path.join(cwd, 'contracts', 'Counter.sol'),
      `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract Counter { uint256 public count; function inc() external { count += 1; } }
`,
      'utf8',
    );

    const calls: string[][] = [];
    const exec: ExecRunner = {
      async exec(_file, args): Promise<ExecResult> {
        calls.push([...args]);
        if (args[0] === 'version') return { exitCode: 0, stdout: '27.4.0\n', stderr: '' };
        if (args[0] === 'info') return { exitCode: 0, stdout: 'x86_64\n', stderr: '' };
        if (args[0] === 'image') return { exitCode: 0, stdout: 'sha256:abc\n', stderr: '' };
        if (args[0] === 'run') {
          return {
            exitCode: 0,
            stdout: '',
            stderr: `contract address: ${ADDRESS}\ntx hash: ${HASH}\n`,
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const outcome = await deployContract({
      cwd,
      sourcePath: 'contracts/Counter.sol',
      config: parseConfig({ docker: { platform: 'linux/amd64' } }),
      privateKey: '11'.repeat(32),
      runner: new DockerRunner({
        exec,
        hostArch: 'x64',
        requestedPlatform: 'linux/amd64',
        ui: silentUi,
        socketExists: () => false,
        platform: 'linux',
        secrets: ['11'.repeat(32)],
      }),
      waitForReceipt: async () => ({ status: 'success', contractAddress: ADDRESS }),
      now: () => new Date('2026-11-27T00:00:00.000Z'),
    });

    const run = calls.find((call) => call[0] === 'run');
    expect(run).toBeDefined();
    expect(run).toContain('--platform');
    expect(run).toContain('linux/amd64');
    expect(run).toContain('-solidity.name');
    expect(run).toContain('Counter');
    expect(run).toContain('-language');
    expect(run).not.toContain('11'.repeat(32));
    expect(outcome.record.address).toBe(ADDRESS);
    expect(outcome.record.txHash).toBe(HASH);
    expect(outcome.record.abi.some((item) => item.type === 'function' && item.name === 'inc')).toBe(
      true,
    );
    const saved = JSON.parse(await fs.readFile(outcome.file, 'utf8')) as { address: string };
    expect(saved.address).toBe(ADDRESS);
  });
});
