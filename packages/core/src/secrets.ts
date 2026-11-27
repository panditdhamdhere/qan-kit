import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function withPrivateKeyFile<T>(
  hexKey: string,
  run: (hostPath: string) => Promise<T>,
): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qan-key-'));
  const file = path.join(dir, 'privkey');
  await fs.writeFile(file, hexKey, { mode: 0o600 });
  try {
    return await run(file);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
