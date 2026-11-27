import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@qan-kit/chains': path.join(root, 'packages/chains/src/index.ts'),
      '@qan-kit/core': path.join(root, 'packages/core/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
