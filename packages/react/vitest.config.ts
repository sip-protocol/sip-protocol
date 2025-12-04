import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/index.ts',
        'src/hooks/index.ts',
      ],
    },
    deps: {
      // Mock ledger packages that are optional in the SDK
      inline: [/@ledgerhq/],
    },
    alias: {
      // Mock all hardware wallet packages (Ledger, Trezor)
      '@ledgerhq/hw-app-eth': new URL('./tests/__mocks__/hardware-wallet.ts', import.meta.url).pathname,
      '@ledgerhq/hw-app-solana': new URL('./tests/__mocks__/hardware-wallet.ts', import.meta.url).pathname,
      '@ledgerhq/hw-transport-webusb': new URL('./tests/__mocks__/hardware-wallet.ts', import.meta.url).pathname,
      '@trezor/connect-web': new URL('./tests/__mocks__/hardware-wallet.ts', import.meta.url).pathname,
    },
  },
})
