/**
 * Tests for Settlement Registry
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SettlementRegistry,
  SettlementRegistryError,
} from '../../src/settlement/registry'
import type {
  SettlementBackend,
  QuoteParams,
  Quote,
  SwapParams,
  SwapResult,
  SwapStatusResponse,
} from '../../src/settlement/interface'
import { PrivacyLevel, SwapStatus } from '@sip-protocol/types'

/**
 * Mock backend factory
 */
function createMockBackend(
  name: string,
  sourceChains: string[],
  destChains: string[],
  avgExecutionTime?: number
): SettlementBackend {
  return {
    name,
    capabilities: {
      supportedSourceChains: sourceChains,
      supportedDestinationChains: destChains,
      supportedPrivacyLevels: [
        PrivacyLevel.TRANSPARENT,
        PrivacyLevel.SHIELDED,
        PrivacyLevel.COMPLIANT,
      ],
      supportsCancellation: true,
      supportsRefunds: true,
      averageExecutionTime: avgExecutionTime,
    },
    async getQuote(_params: QuoteParams): Promise<Quote> {
      return {
        quoteId: 'test-quote',
        amountIn: '1000000',
        amountOut: '990000',
        minAmountOut: '980000',
        fees: {
          networkFee: '1000',
          protocolFee: '9000',
        },
        depositAddress: '0xdeposit',
        recipientAddress: '0xrecipient',
        expiresAt: Date.now() + 300000,
      }
    },
    async executeSwap(_params: SwapParams): Promise<SwapResult> {
      return {
        swapId: 'test-swap',
        status: SwapStatus.PENDING_DEPOSIT,
        quoteId: 'test-quote',
        depositAddress: '0xdeposit',
      }
    },
    async getStatus(_swapId: string): Promise<SwapStatusResponse> {
      return {
        swapId: 'test-swap',
        status: SwapStatus.SUCCESS,
        quoteId: 'test-quote',
        depositAddress: '0xdeposit',
        amountIn: '1000000',
        amountOut: '990000',
        updatedAt: Date.now(),
      }
    },
  }
}

describe('SettlementRegistry', () => {
  let registry: SettlementRegistry

  beforeEach(() => {
    registry = new SettlementRegistry()
  })

  describe('register', () => {
    it('should register a backend', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])

      registry.register(backend)
      expect(registry.has('test-backend')).toBe(true)
      expect(registry.size()).toBe(1)
    })

    it('should throw error when registering duplicate backend', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])

      registry.register(backend)

      expect(() => registry.register(backend)).toThrow(SettlementRegistryError)
      expect(() => registry.register(backend)).toThrow(
        "Backend 'test-backend' is already registered"
      )
    })

    it('should allow registering multiple different backends', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['solana'], ['ethereum'])
      const backend3 = createMockBackend('backend-3', ['near'], ['zcash'])

      registry.register(backend1)
      registry.register(backend2)
      registry.register(backend3)

      expect(registry.size()).toBe(3)
    })
  })

  describe('get', () => {
    it('should retrieve a registered backend', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])

      registry.register(backend)
      const retrieved = registry.get('test-backend')

      expect(retrieved).toBe(backend)
      expect(retrieved.name).toBe('test-backend')
    })

    it('should throw error for unknown backend', () => {
      expect(() => registry.get('unknown')).toThrow(SettlementRegistryError)
      expect(() => registry.get('unknown')).toThrow(
        "Backend 'unknown' not found"
      )
    })
  })

  describe('list', () => {
    it('should return empty array when no backends registered', () => {
      expect(registry.list()).toEqual([])
    })

    it('should list all registered backend names', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['solana'], ['ethereum'])
      const backend3 = createMockBackend('backend-3', ['near'], ['zcash'])

      registry.register(backend1)
      registry.register(backend2)
      registry.register(backend3)

      const names = registry.list()
      expect(names).toHaveLength(3)
      expect(names).toContain('backend-1')
      expect(names).toContain('backend-2')
      expect(names).toContain('backend-3')
    })

    it('should return array in insertion order', () => {
      const backend1 = createMockBackend('zcash', ['ethereum'], ['zcash'])
      const backend2 = createMockBackend('near-intents', ['ethereum'], ['solana'])
      const backend3 = createMockBackend('thorchain', ['bitcoin'], ['ethereum'])

      registry.register(backend1)
      registry.register(backend2)
      registry.register(backend3)

      expect(registry.list()).toEqual(['zcash', 'near-intents', 'thorchain'])
    })
  })

  describe('has', () => {
    it('should return false for unregistered backend', () => {
      expect(registry.has('unknown')).toBe(false)
    })

    it('should return true for registered backend', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])
      registry.register(backend)

      expect(registry.has('test-backend')).toBe(true)
    })
  })

  describe('unregister', () => {
    it('should remove a registered backend', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])
      registry.register(backend)

      expect(registry.has('test-backend')).toBe(true)
      const removed = registry.unregister('test-backend')

      expect(removed).toBe(true)
      expect(registry.has('test-backend')).toBe(false)
      expect(registry.size()).toBe(0)
    })

    it('should return false for unregistered backend', () => {
      const removed = registry.unregister('unknown')
      expect(removed).toBe(false)
    })

    it('should not affect other backends', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['solana'], ['ethereum'])

      registry.register(backend1)
      registry.register(backend2)

      registry.unregister('backend-1')

      expect(registry.has('backend-1')).toBe(false)
      expect(registry.has('backend-2')).toBe(true)
      expect(registry.size()).toBe(1)
    })
  })

  describe('clear', () => {
    it('should remove all backends', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['solana'], ['ethereum'])
      const backend3 = createMockBackend('backend-3', ['near'], ['zcash'])

      registry.register(backend1)
      registry.register(backend2)
      registry.register(backend3)

      expect(registry.size()).toBe(3)

      registry.clear()

      expect(registry.size()).toBe(0)
      expect(registry.list()).toEqual([])
    })

    it('should work on empty registry', () => {
      expect(() => registry.clear()).not.toThrow()
      expect(registry.size()).toBe(0)
    })
  })

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0)
    })

    it('should return correct count', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['solana'], ['ethereum'])

      registry.register(backend1)
      expect(registry.size()).toBe(1)

      registry.register(backend2)
      expect(registry.size()).toBe(2)

      registry.unregister('backend-1')
      expect(registry.size()).toBe(1)
    })
  })

  describe('getBestForRoute', () => {
    it('should return backend that supports the route', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])
      registry.register(backend)

      const best = registry.getBestForRoute('ethereum', 'solana')
      expect(best.name).toBe('test-backend')
    })

    it('should throw error when no backend supports route', () => {
      const backend = createMockBackend('test-backend', ['ethereum'], ['solana'])
      registry.register(backend)

      expect(() => registry.getBestForRoute('bitcoin', 'zcash')).toThrow(
        SettlementRegistryError
      )
      expect(() => registry.getBestForRoute('bitcoin', 'zcash')).toThrow(
        "No backend supports route from 'bitcoin' to 'zcash'"
      )
    })

    it('should select fastest backend when multiple support route', () => {
      const slow = createMockBackend('slow', ['ethereum'], ['solana'], 300)
      const fast = createMockBackend('fast', ['ethereum'], ['solana'], 60)
      const medium = createMockBackend('medium', ['ethereum'], ['solana'], 120)

      registry.register(slow)
      registry.register(fast)
      registry.register(medium)

      const best = registry.getBestForRoute('ethereum', 'solana')
      expect(best.name).toBe('fast')
    })

    it('should handle backends without execution time', () => {
      const withTime = createMockBackend('with-time', ['ethereum'], ['solana'], 120)
      const noTime = createMockBackend('no-time', ['ethereum'], ['solana'])

      registry.register(noTime)
      registry.register(withTime)

      const best = registry.getBestForRoute('ethereum', 'solana')
      expect(best.name).toBe('with-time')
    })

    it('should return first registered when all backends have no time', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['ethereum'], ['solana'])

      registry.register(backend1)
      registry.register(backend2)

      const best = registry.getBestForRoute('ethereum', 'solana')
      expect(best.name).toBe('backend-1')
    })

    it('should handle backends with overlapping chain support', () => {
      const backend1 = createMockBackend(
        'multi-1',
        ['ethereum', 'solana', 'near'],
        ['bitcoin', 'zcash']
      )
      const backend2 = createMockBackend(
        'multi-2',
        ['ethereum', 'polygon'],
        ['bitcoin', 'litecoin']
      )

      registry.register(backend1)
      registry.register(backend2)

      // Both support ethereum -> bitcoin
      const best = registry.getBestForRoute('ethereum', 'bitcoin')
      expect(['multi-1', 'multi-2']).toContain(best.name)

      // Only backend1 supports near -> zcash
      const best2 = registry.getBestForRoute('near', 'zcash')
      expect(best2.name).toBe('multi-1')

      // Only backend2 supports polygon -> litecoin
      const best3 = registry.getBestForRoute('polygon', 'litecoin')
      expect(best3.name).toBe('multi-2')
    })
  })

  describe('getSupportedRoutes', () => {
    it('should return empty array when no backends registered', () => {
      expect(registry.getSupportedRoutes()).toEqual([])
    })

    it('should return all routes from single backend', () => {
      const backend = createMockBackend('test', ['ethereum', 'solana'], ['near', 'zcash'])
      registry.register(backend)

      const routes = registry.getSupportedRoutes()
      expect(routes).toHaveLength(4) // 2 sources * 2 destinations

      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'near',
        backend: 'test',
      })
      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'zcash',
        backend: 'test',
      })
      expect(routes).toContainEqual({
        fromChain: 'solana',
        toChain: 'near',
        backend: 'test',
      })
      expect(routes).toContainEqual({
        fromChain: 'solana',
        toChain: 'zcash',
        backend: 'test',
      })
    })

    it('should return routes from multiple backends', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'])
      const backend2 = createMockBackend('backend-2', ['solana'], ['ethereum'])
      const backend3 = createMockBackend('backend-3', ['near'], ['zcash'])

      registry.register(backend1)
      registry.register(backend2)
      registry.register(backend3)

      const routes = registry.getSupportedRoutes()
      expect(routes).toHaveLength(3)

      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'solana',
        backend: 'backend-1',
      })
      expect(routes).toContainEqual({
        fromChain: 'solana',
        toChain: 'ethereum',
        backend: 'backend-2',
      })
      expect(routes).toContainEqual({
        fromChain: 'near',
        toChain: 'zcash',
        backend: 'backend-3',
      })
    })

    it('should handle backends with many chains', () => {
      const backend = createMockBackend(
        'multi-chain',
        ['ethereum', 'solana', 'near'],
        ['bitcoin', 'zcash']
      )
      registry.register(backend)

      const routes = registry.getSupportedRoutes()
      expect(routes).toHaveLength(6) // 3 sources * 2 destinations

      // Check a few samples
      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'bitcoin',
        backend: 'multi-chain',
      })
      expect(routes).toContainEqual({
        fromChain: 'near',
        toChain: 'zcash',
        backend: 'multi-chain',
      })
    })

    it('should include overlapping routes from different backends', () => {
      const backend1 = createMockBackend('backend-1', ['ethereum'], ['solana'], 60)
      const backend2 = createMockBackend('backend-2', ['ethereum'], ['solana'], 120)

      registry.register(backend1)
      registry.register(backend2)

      const routes = registry.getSupportedRoutes()
      expect(routes).toHaveLength(2)

      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'solana',
        backend: 'backend-1',
      })
      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'solana',
        backend: 'backend-2',
      })
    })

    it('should handle backend with same chain in source and destination', () => {
      const backend = createMockBackend('self-swap', ['ethereum'], ['ethereum'])
      registry.register(backend)

      const routes = registry.getSupportedRoutes()
      expect(routes).toHaveLength(1)
      expect(routes[0]).toEqual({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        backend: 'self-swap',
      })
    })
  })

  describe('integration scenarios', () => {
    it('should support full lifecycle: register, use, unregister', () => {
      const backend = createMockBackend('test', ['ethereum'], ['solana'])

      // Register
      registry.register(backend)
      expect(registry.has('test')).toBe(true)

      // Use
      const retrieved = registry.get('test')
      expect(retrieved.name).toBe('test')

      const best = registry.getBestForRoute('ethereum', 'solana')
      expect(best.name).toBe('test')

      // Unregister
      registry.unregister('test')
      expect(registry.has('test')).toBe(false)
      expect(() => registry.get('test')).toThrow()
    })

    it('should support realistic multi-backend scenario', () => {
      // Register common backends
      const nearIntents = createMockBackend(
        'near-intents',
        ['ethereum', 'solana', 'near', 'polygon'],
        ['ethereum', 'solana', 'near', 'polygon'],
        120
      )
      const zcash = createMockBackend(
        'zcash',
        ['ethereum', 'bitcoin'],
        ['zcash'],
        180
      )
      const thorchain = createMockBackend(
        'thorchain',
        ['ethereum', 'bitcoin'],
        ['ethereum', 'bitcoin'],
        90
      )

      registry.register(nearIntents)
      registry.register(zcash)
      registry.register(thorchain)

      // Check registry state
      expect(registry.size()).toBe(3)
      expect(registry.list()).toEqual(['near-intents', 'zcash', 'thorchain'])

      // Test route selection
      const ethToSol = registry.getBestForRoute('ethereum', 'solana')
      expect(ethToSol.name).toBe('near-intents') // Only one supports this

      const ethToEth = registry.getBestForRoute('ethereum', 'ethereum')
      expect(ethToEth.name).toBe('thorchain') // Fastest for this route

      const ethToZcash = registry.getBestForRoute('ethereum', 'zcash')
      expect(ethToZcash.name).toBe('zcash') // Only one supports this

      // Check all routes
      const routes = registry.getSupportedRoutes()
      expect(routes.length).toBeGreaterThan(0)

      // Verify specific routes exist
      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'solana',
        backend: 'near-intents',
      })
      expect(routes).toContainEqual({
        fromChain: 'ethereum',
        toChain: 'zcash',
        backend: 'zcash',
      })
      expect(routes).toContainEqual({
        fromChain: 'bitcoin',
        toChain: 'ethereum',
        backend: 'thorchain',
      })
    })
  })
})
