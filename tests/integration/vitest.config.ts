import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: [resolve(__dirname, './setup.ts')],
    testTimeout: 60000, // 60s for integration tests (longer than unit tests)
    hookTimeout: 30000, // 30s for setup/teardown hooks
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['tests/integration/**/*.ts'],
      exclude: [
        'tests/integration/setup.ts',
        'tests/integration/vitest.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@sip-protocol/sdk': resolve(__dirname, '../../packages/sdk/src'),
      '@sip-protocol/react': resolve(__dirname, '../../packages/react/src'),
      '@sip-protocol/cli': resolve(__dirname, '../../packages/cli/src'),
      '@sip-protocol/api': resolve(__dirname, '../../packages/api/src'),
      '@sip-protocol/types': resolve(__dirname, '../../packages/types/src'),
    },
  },
})
