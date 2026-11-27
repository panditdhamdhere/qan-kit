import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  tsconfig: 'tsconfig.tsup.json',
  format: ['cjs'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['hardhat', 'hardhat/config', '@qan-kit/chains', '@qan-kit/core'],
});
