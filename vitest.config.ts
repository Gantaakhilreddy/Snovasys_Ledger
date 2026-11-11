import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // Run test files sequentially to prevent database state collision
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
