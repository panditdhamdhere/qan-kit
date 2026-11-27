export interface CommandOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Pull the last logrus fatal/error message out of qvmctl output. */
export function parseQvmctlFailure(output: CommandOutput): string {
  const text = `${output.stdout}\n${output.stderr}`;
  const messages = [...text.matchAll(/level=(?:fatal|error) msg="((?:\\.|[^"\\])*)"/g)];
  const last = messages.at(-1)?.[1];
  if (last) return last.replace(/\\"/g, '"');

  const plain = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const tail = plain.at(-1);
  if (tail) return tail;
  return `qvmctl exited ${output.exitCode}`;
}
