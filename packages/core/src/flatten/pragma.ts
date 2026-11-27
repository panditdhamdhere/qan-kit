export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export interface SolRange {
  min: Version;
  minInclusive: boolean;
  max?: Version;
  maxInclusive?: boolean;
}

export function parseSolidityPragma(expression: string): SolRange {
  const tokens = expression
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  let range: SolRange | undefined;

  for (const token of tokens) {
    const next = parsePragmaToken(token);
    range = range ? intersect(range, next) : next;
  }

  if (!range) {
    throw new Error(`Could not parse pragma "${expression}"`);
  }
  return range;
}

export function intersectPragmas(expressions: readonly string[]): SolRange {
  let current: SolRange | undefined;
  for (const expression of expressions) {
    const next = parseSolidityPragma(expression);
    current = current ? intersect(current, next) : next;
  }
  if (!current) throw new Error('No pragma to intersect');
  return current;
}

export function formatSolidityPragma(range: SolRange): string {
  if (
    range.max &&
    range.minInclusive &&
    !range.maxInclusive &&
    range.min.major === 0 &&
    range.max.major === range.min.major &&
    range.max.minor === range.min.minor + 1 &&
    range.max.patch === 0
  ) {
    return `^${formatVersion(range.min)}`;
  }

  if (range.max && range.minInclusive && range.maxInclusive && sameVersion(range.min, range.max)) {
    return formatVersion(range.min);
  }

  const parts = [`${range.minInclusive ? '>=' : '>'}${formatVersion(range.min)}`];
  if (range.max) {
    parts.push(`${range.maxInclusive ? '<=' : '<'}${formatVersion(range.max)}`);
  }
  return parts.join(' ');
}

function parsePragmaToken(token: string): SolRange {
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(token);
  if (caret?.[1] && caret[2] && caret[3]) {
    const version = versionOf(caret[1], caret[2], caret[3]);
    return {
      min: version,
      minInclusive: true,
      max: { major: version.major, minor: version.minor + 1, patch: 0 },
      maxInclusive: false,
    };
  }

  const exact = /^(\d+)\.(\d+)\.(\d+)$/.exec(token);
  if (exact?.[1] && exact[2] && exact[3]) {
    const version = versionOf(exact[1], exact[2], exact[3]);
    return { min: version, minInclusive: true, max: version, maxInclusive: true };
  }

  const bound = /^(>=|<=|>|<)(\d+)\.(\d+)\.(\d+)$/.exec(token);
  if (bound?.[1] && bound[2] && bound[3] && bound[4]) {
    const version = versionOf(bound[2], bound[3], bound[4]);
    if (bound[1] === '>=' || bound[1] === '>') {
      return { min: version, minInclusive: bound[1] === '>=', maxInclusive: false };
    }
    return {
      min: { major: 0, minor: 0, patch: 0 },
      minInclusive: true,
      max: version,
      maxInclusive: bound[1] === '<=',
    };
  }

  throw new Error(`Unsupported pragma token "${token}"`);
}

function intersect(left: SolRange, right: SolRange): SolRange {
  const minCmp = compare(left.min, right.min);
  const min = minCmp > 0 ? left.min : minCmp < 0 ? right.min : left.min;
  let minInclusive = true;
  if (minCmp > 0) minInclusive = left.minInclusive;
  else if (minCmp < 0) minInclusive = right.minInclusive;
  else minInclusive = left.minInclusive && right.minInclusive;

  const max = lowerMax(left, right);
  if (max && compare(min, max.version) > 0) {
    throw new Error('Solidity pragmas do not overlap');
  }
  if (max && compare(min, max.version) === 0 && (!minInclusive || !max.inclusive)) {
    throw new Error('Solidity pragmas do not overlap');
  }

  return max
    ? { min, minInclusive, max: max.version, maxInclusive: max.inclusive }
    : { min, minInclusive, maxInclusive: false };
}

function lowerMax(
  left: SolRange,
  right: SolRange,
): { version: Version; inclusive: boolean } | undefined {
  if (!left.max)
    return right.max ? { version: right.max, inclusive: right.maxInclusive ?? false } : undefined;
  if (!right.max) return { version: left.max, inclusive: left.maxInclusive ?? false };
  const cmp = compare(left.max, right.max);
  if (cmp < 0) return { version: left.max, inclusive: left.maxInclusive ?? false };
  if (cmp > 0) return { version: right.max, inclusive: right.maxInclusive ?? false };
  return {
    version: left.max,
    inclusive: (left.maxInclusive ?? false) && (right.maxInclusive ?? false),
  };
}

function versionOf(major: string, minor: string, patch: string): Version {
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

function compare(left: Version, right: Version): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function sameVersion(left: Version, right: Version): boolean {
  return compare(left, right) === 0;
}

function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}
