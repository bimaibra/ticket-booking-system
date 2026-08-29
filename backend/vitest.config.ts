import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/**/*.d.ts',
        'src/server.ts',
        'src/lib/prisma.ts',
        'src/lib/shutdown.ts',
      ],
      thresholds: {
        lines: 81,
        functions: 81,
        branches: 70,
        statements: 81,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
  },
});
