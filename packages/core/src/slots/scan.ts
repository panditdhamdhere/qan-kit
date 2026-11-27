export type SlotLanguage = 'go' | 'python' | 'ts';

export interface SlotReport {
  language: SlotLanguage;
  reads: string[];
  writes: string[];
  deletes: string[];
  dynamic: string[];
  /** Reads that qvmctl will not inject unless they are passed to -r. */
  requiredReads: string[];
  undeclaredReads: string[];
  readFlag: string;
}

/** Injected by the runtime in the official samples. Not part of the -r list. */
const RUNTIME_SLOTS = new Set(['QVM_INITIALIZED']);

const READ_PATTERNS = [
  /os\.Getenv\(\s*"DB_([A-Z][A-Z0-9_]*)"\s*\)/g,
  /os\.LookupEnv\(\s*"DB_([A-Z][A-Z0-9_]*)"\s*\)/g,
  /os\.getenv\(\s*["']DB_([A-Z][A-Z0-9_]*)["']/g,
  /os\.environ(?:\.get)?\(\s*["']DB_([A-Z][A-Z0-9_]*)["']/g,
  /os\.environ\[\s*["']DB_([A-Z][A-Z0-9_]*)["']\s*\]/g,
  /process\.env\.DB_([A-Z][A-Z0-9_]*)/g,
  /process\.env\[\s*["']DB_([A-Z][A-Z0-9_]*)["']\s*\]/g,
];

const DYNAMIC_PATTERNS = [
  /DB_[A-Za-z0-9_]*%[sd]/g,
  /["']DB_[A-Za-z0-9_]*["']\s*\+/g,
  /DBW=[A-Za-z0-9_]*%/g,
];

export function scanSlots(
  source: string,
  language: SlotLanguage,
  declared: readonly string[] = [],
): SlotReport {
  const reads = matchAll(source, READ_PATTERNS);
  const writes = matchAll(source, [/DBW=([A-Z][A-Z0-9_]*)=/g]);
  const deletes = matchAll(source, [/DBP=([A-Z][A-Z0-9_,]+)/g]).flatMap((value) =>
    value.split(',').filter((slot) => slot.length > 0),
  );
  const dynamic = unique(
    DYNAMIC_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[0])),
  );

  const requiredReads = reads.filter((slot) => !RUNTIME_SLOTS.has(slot));
  const declaredSet = new Set(declared);
  const undeclaredReads = requiredReads.filter((slot) => !declaredSet.has(slot));

  return {
    language,
    reads: unique(reads),
    writes: unique(writes),
    deletes: unique(deletes),
    dynamic,
    requiredReads,
    undeclaredReads,
    readFlag: requiredReads.join(','),
  };
}

export function languageFromPath(file: string): SlotLanguage | undefined {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (ext === '.go') return 'go';
  if (ext === '.py') return 'python';
  if (ext === '.ts' || ext === '.js') return 'ts';
  return undefined;
}

function matchAll(source: string, patterns: readonly RegExp[]): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const slot = match[1];
      if (slot) found.push(slot);
    }
  }
  return unique(found);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
