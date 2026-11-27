import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  tsconfig: 'tsconfig.tsup.json',
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
  external: ['@qan-kit/chains', '@qan-kit/core'],
});
