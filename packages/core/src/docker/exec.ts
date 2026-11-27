import { execa } from 'execa';
import { redact } from '../redact.js';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ExecRunner {
  exec(file: string, args: readonly string[], options?: ExecOptions): Promise<ExecResult>;
}

export function createExecaRunner(secrets: readonly string[] = []): ExecRunner {
  return {
    async exec(file, args, options) {
      const subprocess = execa(file, [...args], {
        cwd: options?.cwd,
        env: options?.env,
        reject: false,
        input: options?.input,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdoutParts: string[] = [];
      const stderrParts: string[] = [];

      subprocess.stdout?.on('data', (chunk: Buffer | string) => {
        const text = redact(chunk.toString(), secrets);
        stdoutParts.push(text);
        options?.onStdout?.(text);
      });
      subprocess.stderr?.on('data', (chunk: Buffer | string) => {
        const text = redact(chunk.toString(), secrets);
        stderrParts.push(text);
        options?.onStderr?.(text);
      });

      const result = await subprocess;
      const stdout = stdoutParts.length > 0 ? stdoutParts.join('') : redact(result.stdout, secrets);
      const stderr = stderrParts.length > 0 ? stderrParts.join('') : redact(result.stderr, secrets);
      return {
        exitCode: result.exitCode ?? 1,
        stdout,
        stderr,
      };
    },
  };
}
