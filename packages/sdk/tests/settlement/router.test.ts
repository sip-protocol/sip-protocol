/**
 * Tests for SmartRouter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SmartRouter, createSmartRouter } from '../../src/settlement/router'
import { SettlementRegistry } from '../../src/settlement/registry'
import type {
  SettlementBackend,
  QuoteParams,
  Quote,
  SwapParams,
  SwapResult,
  SwapStatusResponse,
  BackendCapabilities,
} from '../../src/settlement/interface'
import { SwapStatus } from '../../src/settlement/interface'
import { PrivacyLevel } from '@sip-protocol/types'
import { ValidationError, NetworkError } from '../../src/errors'

// Mock backend implementation
class MockBackend implements SettlementBackend {
  constructor(
    public readonly name: string,
    public readonly capabilities: BackendCapabilities,
    private mockQuote?: Partial<Quote>,
    private shouldFail: boolean = false
  ) {}

  async getQuote(params: QuoteParams): Promise<Quote> {
    if (this.shouldFail) {
      throw new Error('Backend unavailable')
    }

    return {
      quoteId: `quote-${this.name}-${Date.now()}`,
      amountIn: params.amount.toString(),
      amountOut: (params.amount * 95n / 100n).toString(), // 5% slippage
      minAmountOut: (params.amount * 90n / 100n).toString(),
      fees: {
        networkFee: '0.001',
        protocolFee: '0.05',
        totalFeeUSD: this.mockQuote?.fees?.totalFeeUSD || '10.00',
      },
      depositAddress: `deposit-${this.name}`,
      recipientAddress: `recipient-${this.name}`,
      expiresAt: Date.now() + 300000,
      estimatedTime: this.mockQuote?.estimatedTime || 60,
      ...this.mockQuote,
    }
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    return {
      swapId: `swap-${this.name}`,
      status: SwapStatus.PENDING_DEPOSIT,
      quoteId: params.quoteId,
      depositAddress: `deposit-${this.name}`,
    }
  }

  async getStatus(swapId: string): Promise<SwapStatusResponse> {
    return {
      swapId,
      status: SwapStatus.PENDING_DEPOSIT,
      quoteId: 'quote-123',
      depositAddress: 'deposit-addr',
      amountIn: '1000000',
      amountOut: '950000',
      updatedAt: Date.now(),
    }
  }
}

describe('SmartRouter', () => {
  let registry: SettlementRegistry
  let router: SmartRouter

  // Mock backends
  let fastBackend: MockBackend
  let cheapBackend: MockBackend
  let privateBackend: MockBackend
  let failingBackend: MockBackend

  beforeEach(() => {
    registry = new SettlementRegistry()

    // Fast backend (low execution time)
    fastBackend = new MockBackend(
      'fast-backend',
      {
        supportedSourceChains: ['ethereum', 'solana'],
        supportedDestinationChains: ['ethereum', 'solana'],
        supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
        supportsCancellation: true,
        supportsRefunds: true,
        averageExecutionTime: 30,
      },
      {
        estimatedTime: 30,
        fees: { networkFee: '0.002', protocolFee: '0.10', totalFeeUSD: '15.00' },
      }
    )

    // Cheap backend (low fees)
    cheapBackend = new MockBackend(
      'cheap-backend',
      {
        supportedSourceChains: ['ethereum', 'solana'],
        supportedDestinationChains: ['ethereum', 'solana'],
        supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
        supportsCancellation: false,
        supportsRefunds: true,
        averageExecutionTime: 120,
      },
      {
        estimatedTime: 120,
        fees: { networkFee: '0.001', protocolFee: '0.02', totalFeeUSD: '5.00' },
      }
    )

    // Private backend (shielded support)
    privateBackend = new MockBackend(
      'private-backend',
      {
        supportedSourceChains: ['ethereum', 'solana', 'zcash'],
        supportedDestinationChains: ['ethereum', 'solana', 'zcash'],
        supportedPrivacyLevels: [
          PrivacyLevel.TRANSPARENT,
          PrivacyLevel.SHIELDED,
          PrivacyLevel.COMPLIANT,
        ],
        supportsCancellation: true,
        supportsRefunds: true,
        averageExecutionTime: 60,
      },
      {
        estimatedTime: 60,
        fees: { networkFee: '0.001', protocolFee: '0.05', totalFeeUSD: '8.00' },
      }
    )

    // Failing backend
    failingBackend = new MockBackend(
      'failing-backend',
      {
        supportedSourceChains: ['ethereum'],
        supportedDestinationChains: ['solana'],
        supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
        supportsCancellation: false,
        supportsRefunds: false,
      },
      {},
      true // shouldFail
    )

    router = new SmartRouter(registry)
  })

  describe('constructor', () => {
    it('should create a SmartRouter instance', () => {
      expect(router).toBeInstanceOf(SmartRouter)
    })

    it('should create via factory function', () => {
      const factoryRouter = createSmartRouter(registry)
      expect(factoryRouter).toBeInstanceOf(SmartRouter)
    })
  })

  describe('findBestRoute', () => {
    it('should find routes from multiple backends', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      expect(routes).toHaveLength(2)
      expect(routes[0].backend).toBeDefined()
      expect(routes[0].quote).toBeDefined()
      expect(routes[0].backendInstance).toBeDefined()
      expect(routes[0].score).toBeGreaterThan(0)
    })

    it('should prefer low fees by default', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        preferLowFees: true,
      })

      // cheapBackend should rank higher (lower fees)
      expect(routes[0].backend).toBe('cheap-backend')
      expect(routes[0].quote.fees.totalFeeUSD).toBe('5.00')
    })

    it('should prefer speed when specified', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        preferSpeed: true,
        preferLowFees: false,
      })

      // fastBackend should rank higher (faster execution)
      expect(routes[0].backend).toBe('fast-backend')
      expect(routes[0].quote.estimatedTime).toBe(30)
    })

    it('should filter backends by supported route', async () => {
      registry.register(fastBackend)
      registry.register(new MockBackend(
        'btc-backend',
        {
          supportedSourceChains: ['bitcoin'],
          supportedDestinationChains: ['ethereum'],
          supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
          supportsCancellation: false,
          supportsRefunds: false,
        }
      ))

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      // Only fastBackend supports ETH -> SOL
      expect(routes).toHaveLength(1)
      expect(routes[0].backend).toBe('fast-backend')
    })

    it('should filter backends by privacy level', async () => {
      registry.register(fastBackend) // Only transparent
      registry.register(privateBackend) // Supports shielded

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Only privateBackend supports shielded
      expect(routes).toHaveLength(1)
      expect(routes[0].backend).toBe('private-backend')
    })

    it('should handle backend failures gracefully', async () => {
      registry.register(fastBackend)
      registry.register(failingBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      // Should only return successful route
      expect(routes).toHaveLength(1)
      expect(routes[0].backend).toBe('fast-backend')
    })

    it('should throw if no backends support route', async () => {
      registry.register(new MockBackend(
        'btc-only',
        {
          supportedSourceChains: ['bitcoin'],
          supportedDestinationChains: ['ethereum'],
          supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
          supportsCancellation: false,
          supportsRefunds: false,
        }
      ))

      await expect(
        router.findBestRoute({
          from: { chain: 'ethereum', token: 'USDC' },
          to: { chain: 'solana', token: 'SOL' },
          amount: 1000000n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should throw if all backends fail', async () => {
      registry.register(failingBackend)

      await expect(
        router.findBestRoute({
          from: { chain: 'ethereum', token: 'USDC' },
          to: { chain: 'solana', token: 'SOL' },
          amount: 1000000n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
        })
      ).rejects.toThrow(NetworkError)
    })

    it('should validate amount is positive', async () => {
      registry.register(fastBackend)

      await expect(
        router.findBestRoute({
          from: { chain: 'ethereum', token: 'USDC' },
          to: { chain: 'solana', token: 'SOL' },
          amount: 0n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should pass additional quote parameters', async () => {
      registry.register(fastBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 'sip:eth:0x123',
        senderAddress: '0xabc',
        slippageTolerance: 100,
        deadline: Date.now() + 600000,
      })

      expect(routes).toHaveLength(1)
      expect(routes[0].quote).toBeDefined()
    })

    it('should return sorted routes by score', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)
      registry.register(privateBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      expect(routes).toHaveLength(3)
      // Scores should be descending
      expect(routes[0].score).toBeGreaterThanOrEqual(routes[1].score)
      expect(routes[1].score).toBeGreaterThanOrEqual(routes[2].score)
    })
  })

  describe('compareQuotes', () => {
    it('should return empty comparison for empty routes', () => {
      const comparison = router.compareQuotes([])

      expect(comparison.routes).toHaveLength(0)
      expect(comparison.bestByCost).toBeNull()
      expect(comparison.bestBySpeed).toBeNull()
      expect(comparison.bestByPrivacy).toBeNull()
    })

    it('should identify best route by cost', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const comparison = router.compareQuotes(routes)

      expect(comparison.bestByCost).toBeDefined()
      expect(comparison.bestByCost?.backend).toBe('cheap-backend')
      expect(comparison.bestByCost?.quote.fees.totalFeeUSD).toBe('5.00')
    })

    it('should identify best route by speed', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const comparison = router.compareQuotes(routes)

      expect(comparison.bestBySpeed).toBeDefined()
      expect(comparison.bestBySpeed?.backend).toBe('fast-backend')
      expect(comparison.bestBySpeed?.quote.estimatedTime).toBe(30)
    })

    it('should identify best route by privacy', async () => {
      registry.register(fastBackend)
      registry.register(privateBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const comparison = router.compareQuotes(routes)

      expect(comparison.bestByPrivacy).toBeDefined()
      expect(comparison.bestByPrivacy?.backend).toBe('private-backend')
    })

    it('should include metadata', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const comparison = router.compareQuotes(routes)

      expect(comparison.metadata).toBeDefined()
      expect(comparison.metadata.totalQueried).toBe(2)
      expect(comparison.metadata.queriedAt).toBeGreaterThan(0)
    })

    it('should handle single route', async () => {
      registry.register(fastBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const comparison = router.compareQuotes(routes)

      expect(comparison.bestByCost).toBeDefined()
      expect(comparison.bestBySpeed).toBeDefined()
      expect(comparison.bestByPrivacy).toBeDefined()
      // All should be the same route
      expect(comparison.bestByCost?.backend).toBe('fast-backend')
      expect(comparison.bestBySpeed?.backend).toBe('fast-backend')
      expect(comparison.bestByPrivacy?.backend).toBe('fast-backend')
    })

    it('should return all routes in comparison', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)
      registry.register(privateBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const comparison = router.compareQuotes(routes)

      expect(comparison.routes).toHaveLength(3)
      expect(comparison.routes).toBe(routes) // Same array reference
    })
  })

  describe('score calculation', () => {
    it('should assign higher scores to cheaper routes', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        preferLowFees: true,
      })

      const cheapRoute = routes.find((r) => r.backend === 'cheap-backend')
      const fastRoute = routes.find((r) => r.backend === 'fast-backend')

      expect(cheapRoute).toBeDefined()
      expect(fastRoute).toBeDefined()
      expect(cheapRoute!.score).toBeGreaterThan(fastRoute!.score)
    })

    it('should assign higher scores to faster routes when preferSpeed', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        preferSpeed: true,
        preferLowFees: false,
      })

      const cheapRoute = routes.find((r) => r.backend === 'cheap-backend')
      const fastRoute = routes.find((r) => r.backend === 'fast-backend')

      expect(cheapRoute).toBeDefined()
      expect(fastRoute).toBeDefined()
      expect(fastRoute!.score).toBeGreaterThan(cheapRoute!.score)
    })

    it('should give privacy bonus to shielded backends', async () => {
      registry.register(fastBackend) // transparent only
      registry.register(privateBackend) // shielded support

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      const privateRoute = routes.find((r) => r.backend === 'private-backend')
      const transparentRoute = routes.find((r) => r.backend === 'fast-backend')

      expect(privateRoute).toBeDefined()
      expect(transparentRoute).toBeDefined()

      // Private backend should get privacy bonus in score
      // (even though both can handle transparent)
      const scoreDiff = privateRoute!.score - transparentRoute!.score
      expect(scoreDiff).toBeGreaterThan(0)
    })
  })

  describe('integration tests', () => {
    it('should handle complex multi-backend scenario', async () => {
      registry.register(fastBackend)
      registry.register(cheapBackend)
      registry.register(privateBackend)
      registry.register(failingBackend)

      const routes = await router.findBestRoute({
        from: { chain: 'ethereum', token: 'USDC' },
        to: { chain: 'solana', token: 'SOL' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        preferLowFees: true,
      })

      // Should get 3 successful routes (failingBackend excluded)
      expect(routes).toHaveLength(3)

      // Compare quotes
      const comparison = router.compareQuotes(routes)
      expect(comparison.bestByCost?.backend).toBe('cheap-backend')
      expect(comparison.bestBySpeed?.backend).toBe('fast-backend')
      expect(comparison.bestByPrivacy?.backend).toBe('private-backend')
    })

    it('should work with different chain combinations', async () => {
      registry.register(privateBackend) // Supports zcash

      const routes = await router.findBestRoute({
        from: { chain: 'zcash', token: 'ZEC' },
        to: { chain: 'ethereum', token: 'USDC' },
        amount: 1000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(routes).toHaveLength(1)
      expect(routes[0].backend).toBe('private-backend')
    })
  })
})
