import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // All test files share one Postgres database.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
