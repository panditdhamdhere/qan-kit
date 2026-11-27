const SECRET_ENV = /key|secret|token|password|mnemonic|priv/i;

/** Replace known secret strings. Short values are left alone so we don't chew normal words. */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    const trimmed = secret.trim();
    if (trimmed.length < 8) continue;
    out = out.split(trimmed).join('[redacted]');
    const bare = trimmed.replace(/^0x/i, '');
    if (bare.length >= 8 && bare !== trimmed) {
      out = out.split(bare).join('[redacted]');
    }
  }
  return out;
}

export function redactEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    out[key] = SECRET_ENV.test(key) ? '[redacted]' : value;
  }
  return out;
}
