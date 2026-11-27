import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorCodes, QanError } from '../errors.js';
import { formatSolidityPragma, intersectPragmas } from './pragma.js';

export interface FlattenResult {
  source: string;
  contracts: string[];
  license: string;
  pragma: string;
  warnings: string[];
  files: string[];
}

interface FileUnit {
  relativePath: string;
  body: string;
  imports: string[];
  licenses: string[];
  pragmas: string[];
  contracts: string[];
}

export async function flattenSolidity(
  entryPath: string,
  cwd = process.cwd(),
): Promise<FlattenResult> {
  const entry = path.resolve(cwd, entryPath);
  const remappings = await readRemappings(cwd);
  const order: FileUnit[] = [];
  const seen = new Set<string>();

  async function visit(file: string, from: string): Promise<void> {
    let resolved: string;
    try {
      resolved = await fs.realpath(file);
    } catch (cause) {
      throw new QanError(
        ErrorCodes.FLATTEN_FAILED,
        `Could not read ${path.relative(cwd, file) || file}, imported from ${from}.`,
        'Check the import path, remappings.txt, and node_modules.',
        { cause },
      );
    }
    if (seen.has(resolved)) return;
    seen.add(resolved);

    const text = await fs.readFile(resolved, 'utf8');
    const unit = parseUnit(text, path.relative(cwd, resolved) || path.basename(resolved));
    for (const specifier of unit.imports) {
      const next = await resolveImport(specifier, resolved, cwd, remappings);
      await visit(next, unit.relativePath);
    }
    order.push(unit);
  }

  try {
    await fs.access(entry);
  } catch (cause) {
    throw new QanError(
      ErrorCodes.FLATTEN_FAILED,
      `No Solidity file at ${entryPath}.`,
      'Pass the path to a .sol file inside this project.',
      { cause },
    );
  }

  await visit(entry, entryPath);

  const licenses = unique(order.flatMap((unit) => unit.licenses));
  const pragmas = order.flatMap((unit) => unit.pragmas);
  const contracts = order.flatMap((unit) => unit.contracts);
  const warnings: string[] = [];

  if (licenses.length === 0) {
    warnings.push('No SPDX license identifier found. Added UNLICENSED.');
  } else if (licenses.length > 1) {
    warnings.push(`Multiple SPDX licenses (${licenses.join(', ')}). Combined with AND.`);
  }

  let pragma = '>=0.8.0 <0.9.0';
  if (pragmas.length === 0) {
    warnings.push('No pragma solidity found. Using >=0.8.0 <0.9.0.');
  } else {
    try {
      pragma = formatSolidityPragma(intersectPragmas(pragmas));
    } catch (cause) {
      throw new QanError(
        ErrorCodes.FLATTEN_FAILED,
        cause instanceof Error ? cause.message : 'Pragmas do not overlap.',
        'Make the imported files share one Solidity compiler range.',
        { cause },
      );
    }
  }

  if (contracts.length > 1) {
    warnings.push(
      `Found ${contracts.length} contracts (${contracts.join(', ')}). Pass --name to pick one.`,
    );
  }

  const license = licenses.length === 0 ? 'UNLICENSED' : licenses.join(' AND ');
  const parts = [
    `// SPDX-License-Identifier: ${license}`,
    `pragma solidity ${pragma};`,
    '',
    ...order.flatMap((unit) => [`// ${unit.relativePath}`, unit.body.trimEnd(), '']),
  ];

  return {
    source: `${parts.join('\n').trimEnd()}\n`,
    contracts,
    license,
    pragma,
    warnings,
    files: order.map((unit) => unit.relativePath),
  };
}

export function parseUnit(source: string, relativePath: string): FileUnit {
  const imports: string[] = [];
  const licenses: string[] = [];
  const pragmas: string[] = [];
  const removals: Array<{ start: number; end: number }> = [];
  const length = source.length;
  let index = 0;

  while (index < length) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '/') {
      const end = eol(source, index);
      const comment = source.slice(index, end);
      const license = readSpdx(comment);
      if (license) {
        licenses.push(license);
        removals.push({ start: index, end });
      }
      index = end;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = Math.max(source.indexOf('*/', index + 2), index + 2) + 2;
      const comment = source.slice(index, Math.min(end, length));
      const license = readSpdx(comment);
      if (license) {
        licenses.push(license);
        removals.push({ start: index, end: Math.min(end, length) });
      }
      index = Math.min(end, length);
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(source, index);
      continue;
    }
    if (startsWithWord(source, index, 'import')) {
      const end = statementEnd(source, index);
      const statement = source.slice(index, end);
      const specifier = readImportSpecifier(statement);
      if (!specifier) {
        throw new QanError(
          ErrorCodes.FLATTEN_FAILED,
          `Could not read an import in ${relativePath}.`,
          'Use a string import path. The flattener does not understand this statement.',
        );
      }
      imports.push(specifier);
      removals.push({ start: index, end });
      index = end;
      continue;
    }
    if (startsWithWord(source, index, 'pragma')) {
      const end = statementEnd(source, index);
      const statement = source.slice(index, end);
      const solidity = /^pragma\s+solidity\s+([^;]+);/.exec(statement);
      if (solidity?.[1]) {
        pragmas.push(solidity[1].trim());
        removals.push({ start: index, end });
      }
      index = end;
      continue;
    }
    index += 1;
  }

  let body = source;
  for (const removal of removals.sort((a, b) => b.start - a.start)) {
    body = body.slice(0, removal.start) + body.slice(removal.end);
  }

  return {
    relativePath,
    body: body.replace(/\n{3,}/g, '\n\n'),
    imports,
    licenses: unique(licenses),
    pragmas,
    contracts: findContracts(source),
  };
}

export async function resolveImport(
  specifier: string,
  fromFile: string,
  cwd: string,
  remappings: readonly Remapping[],
): Promise<string> {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.resolve(path.dirname(fromFile), specifier);
  }

  const mapped = applyRemapping(specifier, remappings, path.dirname(fromFile));
  if (mapped) return mapped;

  let dir = path.dirname(fromFile);
  const root = path.resolve(cwd);
  while (true) {
    const candidate = path.join(dir, 'node_modules', specifier);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      if (dir === root || dir === path.dirname(dir)) break;
      dir = path.dirname(dir);
    }
  }

  throw new QanError(
    ErrorCodes.FLATTEN_FAILED,
    `Could not resolve import "${specifier}".`,
    'Add a remappings.txt entry or install the package. qvmctl still wants one flattened file.',
  );
}

export interface Remapping {
  prefix: string;
  target: string;
}

export async function readRemappings(cwd: string): Promise<Remapping[]> {
  const file = path.join(cwd, 'remappings.txt');
  try {
    const text = await fs.readFile(file, 'utf8');
    return parseRemappings(text, cwd);
  } catch {
    return [];
  }
}

export function parseRemappings(text: string, cwd: string): Remapping[] {
  const rows: Remapping[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const prefix = trimmed.slice(0, eq);
    const target = trimmed.slice(eq + 1);
    rows.push({
      prefix,
      target: path.isAbsolute(target) ? target : path.resolve(cwd, target),
    });
  }
  return rows.sort((a, b) => b.prefix.length - a.prefix.length);
}

function applyRemapping(
  specifier: string,
  remappings: readonly Remapping[],
  fromDir: string,
): string | undefined {
  for (const remapping of remappings) {
    if (specifier.startsWith(remapping.prefix)) {
      const rest = specifier.slice(remapping.prefix.length);
      return path.resolve(fromDir, remapping.target, rest);
    }
  }
  return undefined;
}

function findContracts(source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  return [...stripped.matchAll(/\b(?:abstract\s+)?contract\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name));
}

function readSpdx(comment: string): string | undefined {
  const match = /SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+)/.exec(comment);
  return match?.[1];
}

function readImportSpecifier(statement: string): string | undefined {
  const match = /["']([^"']+)["']/.exec(statement);
  return match?.[1];
}

function startsWithWord(source: string, index: number, word: string): boolean {
  if (!source.startsWith(word, index)) return false;
  const prev = source[index - 1];
  if (prev && /[A-Za-z0-9_]/.test(prev)) return false;
  const next = source[index + word.length];
  return !next || !/[A-Za-z0-9_]/.test(next);
}

function statementEnd(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'") {
      index = skipString(source, index);
      continue;
    }
    if (char === ';') return index + 1;
    index += 1;
  }
  return source.length;
}

function skipString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function eol(source: string, start: number): number {
  const newline = source.indexOf('\n', start);
  return newline === -1 ? source.length : newline + 1;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
