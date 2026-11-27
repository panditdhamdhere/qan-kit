import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  tsconfig: 'tsconfig.tsup.json',
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@qan-kit/chains', 'solc', 'viem', 'viem/accounts'],
});
