import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { useSIP } from '../../src/hooks/use-sip'
import { SIPProvider } from '../../src/providers/sip-provider'

// Mock the SDK module
vi.mock('@sip-protocol/sdk', () => {
  // Define MockSIP class inside the factory
  class MockSIP {
    private network: 'mainnet' | 'testnet'
    private mode: 'demo' | 'production'

    constructor(config: any) {
      if (!config || config.network === 'invalid' || config.network === 'bad-network') {
        throw new Error("network must be 'mainnet' or 'testnet'")
      }
      this.network = config.network
      this.mode = config.mode ?? 'demo'
    }

    getNetwork() {
      return this.network
    }

    getMode() {
      return this.mode
    }

    isConnected() {
      return false
    }

    createIntent = vi.fn()
    getQuotes = vi.fn()
    execute = vi.fn()
    intent = vi.fn()
    connect = vi.fn()
    disconnect = vi.fn()
    generateStealthKeys = vi.fn()
  }

  return {
    SIP: MockSIP,
  }
})

interface SIPConfig {
  network: 'mainnet' | 'testnet'
  mode?: 'demo' | 'production'
  rpcEndpoints?: Record<string, string>
}

describe('useSIP', () => {
  const mockConfig: SIPConfig = {
    network: 'testnet',
  }

  beforeEach(() => {
    // Clear console warnings/errors
    vi.clearAllMocks()
  })

  describe('with SIPProvider', () => {
    it('should return client from provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SIPProvider config={mockConfig}>{children}</SIPProvider>
      )

      const { result } = renderHook(() => useSIP(), { wrapper })

      expect(result.current.client).not.toBeNull()
      expect(result.current.isReady).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should return same client instance on re-render', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SIPProvider config={mockConfig}>{children}</SIPProvider>
      )

      const { result, rerender } = renderHook(() => useSIP(), { wrapper })

      const firstClient = result.current.client
      rerender()
      const secondClient = result.current.client

      expect(firstClient).toBe(secondClient)
      expect(firstClient).not.toBeNull()
    })

    it('should have isReady true when using provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SIPProvider config={mockConfig}>{children}</SIPProvider>
      )

      const { result } = renderHook(() => useSIP(), { wrapper })

      expect(result.current.isReady).toBe(true)
      expect(result.current.client).not.toBeNull()
    })

    it('should ignore initialize() when provider exists', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SIPProvider config={mockConfig}>{children}</SIPProvider>
      )

      const { result } = renderHook(() => useSIP(), { wrapper })

      await act(async () => {
        await result.current.initialize({ network: 'mainnet' })
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('initialize() called but SIPProvider')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should have client methods available', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SIPProvider config={mockConfig}>{children}</SIPProvider>
      )

      const { result } = renderHook(() => useSIP(), { wrapper })

      expect(result.current.client).not.toBeNull()
      expect(result.current.client?.createIntent).toBeTypeOf('function')
      expect(result.current.client?.getQuotes).toBeTypeOf('function')
      expect(result.current.client?.execute).toBeTypeOf('function')
    })
  })

  describe('without SIPProvider (standalone mode)', () => {
    it('should return null client initially', () => {
      const { result } = renderHook(() => useSIP())

      expect(result.current.client).toBeNull()
      expect(result.current.isReady).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should initialize client successfully', async () => {
      const { result } = renderHook(() => useSIP())

      expect(result.current.client).toBeNull()
      expect(result.current.isReady).toBe(false)

      await act(async () => {
        await result.current.initialize(mockConfig)
      })

      expect(result.current.client).not.toBeNull()
      expect(result.current.isReady).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should handle initialization errors', async () => {
      const { result } = renderHook(() => useSIP())

      const invalidConfig = { network: 'invalid' } as unknown as SIPConfig

      await act(async () => {
        try {
          await result.current.initialize(invalidConfig)
        } catch (err) {
          // Expected to throw
        }
      })

      expect(result.current.client).toBeNull()
      expect(result.current.isReady).toBe(false)
      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.message).toContain('network')
    })

    it('should prevent re-initialization', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useSIP())

      await act(async () => {
        await result.current.initialize(mockConfig)
      })

      expect(result.current.isReady).toBe(true)

      await act(async () => {
        await result.current.initialize({ network: 'mainnet' })
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already initialized')
      )

      // Should still be on testnet (original config)
      expect(result.current.client?.getNetwork()).toBe('testnet')

      consoleWarnSpy.mockRestore()
    })

    it('should maintain error state after failed initialization', async () => {
      const { result } = renderHook(() => useSIP())

      const invalidConfig = { network: 'bad-network' } as unknown as SIPConfig

      await act(async () => {
        try {
          await result.current.initialize(invalidConfig)
        } catch {
          // Expected
        }
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.isReady).toBe(false)
      expect(result.current.client).toBeNull()
    })

    it('should clear error on successful initialization after failure', async () => {
      const { result } = renderHook(() => useSIP())

      // First, fail
      const invalidConfig = { network: 'invalid' } as unknown as SIPConfig
      await act(async () => {
        try {
          await result.current.initialize(invalidConfig)
        } catch {
          // Expected
        }
      })

      expect(result.current.error).not.toBeNull()

      // Now succeed
      await act(async () => {
        await result.current.initialize(mockConfig)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isReady).toBe(true)
      expect(result.current.client).not.toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid initialize calls', async () => {
      const { result } = renderHook(() => useSIP())

      // Call initialize multiple times rapidly
      await act(async () => {
        const promises = [
          result.current.initialize(mockConfig),
          result.current.initialize(mockConfig),
          result.current.initialize(mockConfig),
        ]

        // First one should succeed, others should be ignored or handled gracefully
        await Promise.allSettled(promises)
      })

      expect(result.current.client).not.toBeNull()
      expect(result.current.isReady).toBe(true)
    })

    it('should return different instances for different hooks without provider', async () => {
      const { result: result1 } = renderHook(() => useSIP())
      const { result: result2 } = renderHook(() => useSIP())

      await act(async () => {
        await result1.current.initialize(mockConfig)
      })

      await act(async () => {
        await result2.current.initialize({ network: 'mainnet' })
      })

      expect(result1.current.client).not.toBeNull()
      expect(result2.current.client).not.toBeNull()
      expect(result1.current.client).not.toBe(result2.current.client)
      expect(result1.current.client?.getNetwork()).toBe('testnet')
      expect(result2.current.client?.getNetwork()).toBe('mainnet')
    })

    it('should handle config with all options', async () => {
      const { result } = renderHook(() => useSIP())

      const fullConfig: SIPConfig = {
        network: 'mainnet',
        mode: 'demo',
        rpcEndpoints: {
          ethereum: 'https://eth.example.com',
        },
      }

      await act(async () => {
        await result.current.initialize(fullConfig)
      })

      expect(result.current.client).not.toBeNull()
      expect(result.current.isReady).toBe(true)
      expect(result.current.client?.getNetwork()).toBe('mainnet')
      expect(result.current.client?.getMode()).toBe('demo')
    })
  })

  describe('client functionality', () => {
    it('should expose all SIP client methods', async () => {
      const { result } = renderHook(() => useSIP())

      await act(async () => {
        await result.current.initialize(mockConfig)
      })

      const client = result.current.client
      expect(client).not.toBeNull()

      // Check key methods exist
      expect(client?.createIntent).toBeTypeOf('function')
      expect(client?.getQuotes).toBeTypeOf('function')
      expect(client?.execute).toBeTypeOf('function')
      expect(client?.intent).toBeTypeOf('function')
      expect(client?.connect).toBeTypeOf('function')
      expect(client?.disconnect).toBeTypeOf('function')
      expect(client?.generateStealthKeys).toBeTypeOf('function')
      expect(client?.getNetwork).toBeTypeOf('function')
    })

    it('should allow calling client methods', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SIPProvider config={mockConfig}>{children}</SIPProvider>
      )

      const { result } = renderHook(() => useSIP(), { wrapper })

      expect(result.current.client?.getNetwork()).toBe('testnet')
      expect(result.current.client?.getMode()).toBe('demo')
      expect(result.current.client?.isConnected()).toBe(false)
    })
  })

  describe('TypeScript types', () => {
    it('should have correct return type shape', () => {
      const { result } = renderHook(() => useSIP())

      // Verify return type has all expected properties
      expect(result.current).toHaveProperty('client')
      expect(result.current).toHaveProperty('isReady')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('initialize')

      // Verify types
      expect(typeof result.current.isReady).toBe('boolean')
      expect(typeof result.current.initialize).toBe('function')
    })
  })
})
