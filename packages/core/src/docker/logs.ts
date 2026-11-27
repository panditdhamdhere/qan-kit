export interface CommandOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Pull the last logrus fatal/error message out of qvmctl output. */
export function parseQvmctlFailure(output: CommandOutput): string {
  const text = `${output.stdout}\n${output.stderr}`;
  const lines = text.split('\n').filter((line) => /level=(?:fatal|error)/.test(line));
  const line = lines.at(-1);
  if (line) {
    const msg = readLogrusField(line, 'msg');
    const detail = readLogrusField(line, 'error');
    if (msg && detail && !msg.includes(detail)) return `${msg}: ${detail}`;
    if (msg) return msg;
  }

  const plain = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const tail = plain.at(-1);
  if (tail) return tail;
  return `qvmctl exited ${output.exitCode}`;
}

function readLogrusField(line: string, field: string): string | undefined {
  const match = line.match(new RegExp(`${field}="((?:\\\\.|[^"\\\\])*)"`));
  return match?.[1]?.replace(/\\"/g, '"');
}
