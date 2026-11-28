import { describe, expect, it } from 'vitest';
import { toJson } from './output.js';

describe('toJson', () => {
  it('prints a uint256 read as a decimal string', () => {
    expect(toJson({ result: 0n })).toBe('{\n  "result": "0"\n}');
  });
});
