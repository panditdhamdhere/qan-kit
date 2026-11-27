import { describe, expect, it } from 'vitest';
import { createProgram, isHelpExit } from './program.js';

describe('qan init help', () => {
  it('lists init', async () => {
    const program = createProgram();
    const error: unknown = await program
      .parseAsync(['node', 'qan', '--help'])
      .then(() => undefined)
      .catch((caught: unknown) => caught);
    expect(isHelpExit(error)).toBe(true);
  });
});
