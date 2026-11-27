import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { flattenSolidity } from './flatten.js';
import { formatSolidityPragma, intersectPragmas } from './pragma.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('flattenSolidity', () => {
  it('inlines imports once, keeps one license and the tightest pragma', async () => {
    const flat = await flattenSolidity(path.join(fixtures, 'Entry.sol'), fixtures);
    expect(flat.source).not.toMatch(/\bimport\b/);
    expect(flat.files.filter((file) => file.endsWith('Lib.sol'))).toHaveLength(1);
    expect(flat.source).toContain('contract Lib');
    expect(flat.source).toContain('contract Thing');
    expect(flat.source).toContain('contract Entry');
    expect(flat.license).toBe('MIT AND GPL-3.0-only');
    expect(flat.pragma).toBe('^0.8.20');
    expect(flat.source.startsWith('// SPDX-License-Identifier: MIT AND GPL-3.0-only\n')).toBe(true);
    expect(flat.warnings.some((warning) => warning.includes('SPDX'))).toBe(true);
    expect(flat.contracts).toEqual(['Lib', 'Thing', 'Entry']);
  });

  it('warns when one file declares several contracts', async () => {
    const flat = await flattenSolidity(path.join(fixtures, 'Multi.sol'), fixtures);
    expect(flat.contracts).toEqual(['Alpha', 'Beta']);
    expect(flat.warnings.some((warning) => warning.includes('Alpha'))).toBe(true);
    expect(flat.pragma).toBe('^0.8.24');
  });
});

describe('pragma intersection', () => {
  it('picks the highest compatible caret', () => {
    const range = intersectPragmas(['^0.8.0', '^0.8.20', '>=0.8.20 <0.9.0']);
    expect(formatSolidityPragma(range)).toBe('^0.8.20');
  });

  it('refuses ranges that do not overlap', () => {
    expect(() => intersectPragmas(['^0.7.0', '^0.8.0'])).toThrow(/overlap/);
  });
});
