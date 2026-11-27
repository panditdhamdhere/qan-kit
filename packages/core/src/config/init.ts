import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorCodes, QanError } from '../errors.js';
import { configSource, ENV_EXAMPLE, exampleContract, type InitTemplate } from './templates.js';

export interface InitOptions {
  cwd: string;
  template: InitTemplate;
  force?: boolean;
}

export interface InitResult {
  written: string[];
  skipped: string[];
}

const GITIGNORE_LINES = ['.env', 'deployments/', '.qan/'];

export async function initProject(options: InitOptions): Promise<InitResult> {
  const contract = exampleContract(options.template);
  const files: Array<{ relativePath: string; contents: string }> = [
    { relativePath: 'qan.config.ts', contents: configSource(options.template) },
    { relativePath: '.env.example', contents: ENV_EXAMPLE },
    { relativePath: contract.relativePath, contents: contract.source },
  ];

  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const target = path.join(options.cwd, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const existed = await fileExists(target);
    if (existed && !options.force) {
      skipped.push(file.relativePath);
      continue;
    }
    await fs.writeFile(target, file.contents, 'utf8');
    written.push(file.relativePath);
  }

  if (await ensureGitignore(options.cwd)) written.push('.gitignore');

  if (written.length === 0 && skipped.length > 0) {
    throw new QanError(
      ErrorCodes.FILE_EXISTS,
      `Nothing written. Already present: ${skipped.join(', ')}.`,
      'Pass --force to overwrite the config, env example, and sample contract.',
    );
  }

  return { written, skipped };
}

export function defineConfig<T>(config: T): T {
  return config;
}

async function ensureGitignore(cwd: string): Promise<boolean> {
  const target = path.join(cwd, '.gitignore');
  let current = '';
  try {
    current = await fs.readFile(target, 'utf8');
  } catch {
    current = '';
  }
  const missing = GITIGNORE_LINES.filter((line) => !current.split('\n').includes(line));
  if (missing.length === 0) return false;
  const prefix = current.length === 0 || current.endsWith('\n') ? current : `${current}\n`;
  const next = `${prefix}${missing.join('\n')}\n`;
  await fs.writeFile(target, next, 'utf8');
  return true;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
