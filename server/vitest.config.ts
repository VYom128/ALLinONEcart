import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Set before any test file (or setup file) imports src/config/env.ts.
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // the first run downloads the MongoDB binary
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/server.ts', 'src/worker.ts', 'src/seed/**'],
    },
  },
});
