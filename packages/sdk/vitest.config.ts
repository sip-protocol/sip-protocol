import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',           // Re-exports only
        'src/proofs/index.ts',    // Re-exports only
        'src/proofs/noir.ts',     // Intentionally unimplemented (see #14, #15, #16)
      ],
    },
    testTimeout: 30000, // 30s for crypto operations
  },
})
