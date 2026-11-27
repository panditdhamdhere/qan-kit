import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createProgram } from './program.js';

const reference = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/cli/reference.md'),
  'utf8',
);

describe('cli reference', () => {
  it('mentions every command', () => {
    const names = createProgram()
      .commands.map((command) => command.name())
      .filter((name) => name !== 'help');
    for (const name of names) {
      expect(reference).toContain(`## ${name}`);
    }
  });
});
