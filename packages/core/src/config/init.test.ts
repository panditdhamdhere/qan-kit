import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initProject } from './init.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('initProject', () => {
  it('scaffolds solidity, go, and python without writing a key', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-init-'));
    dirs.push(cwd);

    const solidity = await initProject({ cwd, template: 'solidity' });
    expect(solidity.written).toEqual(
      expect.arrayContaining(['qan.config.ts', '.env.example', 'contracts/Counter.sol']),
    );
    const config = await fs.readFile(path.join(cwd, 'qan.config.ts'), 'utf8');
    expect(config).toContain("platform: 'linux/amd64'");
    expect(config).not.toMatch(/privateKey/);
    const env = await fs.readFile(path.join(cwd, '.env.example'), 'utf8');
    expect(env).toContain('QAN_PRIVATE_KEY=');
    const ignore = await fs.readFile(path.join(cwd, '.gitignore'), 'utf8');
    expect(ignore).toContain('.env');

    await expect(initProject({ cwd, template: 'solidity' })).rejects.toMatchObject({
      code: 'FILE_EXISTS',
    });

    const goDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-init-go-'));
    dirs.push(goDir);
    await initProject({ cwd: goDir, template: 'go' });
    const go = await fs.readFile(path.join(goDir, 'contracts/main.go'), 'utf8');
    expect(go).toContain('DB_COUNTER');
    expect(go).toContain('DBW=COUNTER=');

    const pyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-init-py-'));
    dirs.push(pyDir);
    await initProject({ cwd: pyDir, template: 'python' });
    const py = await fs.readFile(path.join(pyDir, 'contracts/main.py'), 'utf8');
    expect(py).toContain('os.getenv("DB_COUNTER")');
  });
});
