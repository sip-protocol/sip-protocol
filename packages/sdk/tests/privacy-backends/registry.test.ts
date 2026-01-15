/**
 * Privacy Backend Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PrivacyBackendRegistry, defaultRegistry } from '../../src/privacy-backends/registry'
import { RateLimiter } from '../../src/privacy-backends/rate-limiter'
import type {
  PrivacyBackend,
  BackendCapabilities,
  TransferParams,
  AvailabilityResult,
  TransactionResult,
} from '../../src/privacy-backends/interface'

// Mock backend for testing
function createMockBackend(
  name: string,
  options: Partial<{
    chains: string[]
    type: 'transaction' | 'compute' | 'both'
    complianceSupport: boolean
    available: boolean
  }> = {}
): PrivacyBackend {
  const {
    chains = ['solana'],
    type = 'transaction',
    complianceSupport = true,
    available = true,
  } = options

  return {
    name,
    type,
    chains: chains as any,
    checkAvailability: vi.fn().mockResolvedValue({
      available,
      estimatedCost: 5000n,
      estimatedTime: 1000,
    } as AvailabilityResult),
    getCapabilities: vi.fn().mockReturnValue({
      hiddenAmount: true,
      hiddenSender: true,
      hiddenRecipient: true,
      hiddenCompute: false,
      complianceSupport,
      setupRequired: false,
      latencyEstimate: 'fast',
      supportedTokens: 'all',
    } as BackendCapabilities),
    execute: vi.fn().mockResolvedValue({
      success: true,
      signature: 'test-sig',
      backend: name,
    } as TransactionResult),
    estimateCost: vi.fn().mockResolvedValue(5000n),
  }
}

describe('PrivacyBackendRegistry', () => {
  let registry: PrivacyBackendRegistry

  beforeEach(() => {
    registry = new PrivacyBackendRegistry()
  })

  describe('register', () => {
    it('should register a backend', () => {
      const backend = createMockBackend('test-backend')
      registry.register(backend)

      expect(registry.has('test-backend')).toBe(true)
      expect(registry.get('test-backend')).toBe(backend)
    })

    it('should throw when registering duplicate without override', () => {
      const backend1 = createMockBackend('test-backend')
      const backend2 = createMockBackend('test-backend')

      registry.register(backend1)

      expect(() => registry.register(backend2)).toThrow(
        "Backend 'test-backend' is already registered"
      )
    })

    it('should allow override with option', () => {
      const backend1 = createMockBackend('test-backend')
      const backend2 = createMockBackend('test-backend')

      registry.register(backend1)
      registry.register(backend2, { override: true })

      expect(registry.get('test-backend')).toBe(backend2)
    })

    it('should respect custom priority', () => {
      const backend1 = createMockBackend('backend-1')
      const backend2 = createMockBackend('backend-2')

      registry.register(backend1, { priority: 10 })
      registry.register(backend2, { priority: 100 })

      const all = registry.getAll()
      expect(all[0].name).toBe('backend-2') // Higher priority first
      expect(all[1].name).toBe('backend-1')
    })

    it('should respect enabled option', () => {
      const backend = createMockBackend('disabled-backend')
      registry.register(backend, { enabled: false })

      expect(registry.has('disabled-backend')).toBe(true)
      expect(registry.get('disabled-backend')).toBeUndefined()
    })
  })

  describe('unregister', () => {
    it('should remove a registered backend', () => {
      const backend = createMockBackend('test-backend')
      registry.register(backend)

      expect(registry.unregister('test-backend')).toBe(true)
      expect(registry.has('test-backend')).toBe(false)
    })

    it('should return false for non-existent backend', () => {
      expect(registry.unregister('non-existent')).toBe(false)
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent backend', () => {
      expect(registry.get('non-existent')).toBeUndefined()
    })

    it('should return undefined for disabled backend', () => {
      const backend = createMockBackend('disabled')
      registry.register(backend, { enabled: false })

      expect(registry.get('disabled')).toBeUndefined()
    })
  })

  describe('getAll', () => {
    it('should return empty array when no backends', () => {
      expect(registry.getAll()).toEqual([])
    })

    it('should return all enabled backends sorted by priority', () => {
      registry.register(createMockBackend('low'), { priority: 10 })
      registry.register(createMockBackend('high'), { priority: 100 })
      registry.register(createMockBackend('medium'), { priority: 50 })
      registry.register(createMockBackend('disabled'), { enabled: false })

      const all = registry.getAll()
      expect(all).toHaveLength(3)
      expect(all[0].name).toBe('high')
      expect(all[1].name).toBe('medium')
      expect(all[2].name).toBe('low')
    })
  })

  describe('getAllEntries', () => {
    it('should include disabled backends', () => {
      registry.register(createMockBackend('enabled'))
      registry.register(createMockBackend('disabled'), { enabled: false })

      const entries = registry.getAllEntries()
      expect(entries).toHaveLength(2)
    })
  })

  describe('getByChain', () => {
    it('should filter backends by chain', () => {
      registry.register(createMockBackend('solana-backend', { chains: ['solana'] }))
      registry.register(createMockBackend('eth-backend', { chains: ['ethereum'] }))
      registry.register(createMockBackend('multi-backend', { chains: ['solana', 'ethereum'] }))

      const solanaBackends = registry.getByChain('solana')
      expect(solanaBackends).toHaveLength(2)
      expect(solanaBackends.map(b => b.name)).toContain('solana-backend')
      expect(solanaBackends.map(b => b.name)).toContain('multi-backend')
    })

    it('should return empty array for unsupported chain', () => {
      registry.register(createMockBackend('solana-only', { chains: ['solana'] }))

      expect(registry.getByChain('bitcoin')).toEqual([])
    })
  })

  describe('getByType', () => {
    it('should filter backends by type', () => {
      registry.register(createMockBackend('tx-backend', { type: 'transaction' }))
      registry.register(createMockBackend('compute-backend', { type: 'compute' }))
      registry.register(createMockBackend('both-backend', { type: 'both' }))

      const txBackends = registry.getByType('transaction')
      expect(txBackends).toHaveLength(2) // transaction + both
      expect(txBackends.map(b => b.name)).toContain('tx-backend')
      expect(txBackends.map(b => b.name)).toContain('both-backend')
    })
  })

  describe('getCompliant', () => {
    it('should return only compliance-supporting backends', () => {
      registry.register(createMockBackend('compliant', { complianceSupport: true }))
      registry.register(createMockBackend('non-compliant', { complianceSupport: false }))

      const compliant = registry.getCompliant()
      expect(compliant).toHaveLength(1)
      expect(compliant[0].name).toBe('compliant')
    })
  })

  describe('findAvailable', () => {
    it('should return available backends with availability info', async () => {
      registry.register(createMockBackend('available', { available: true }))
      registry.register(createMockBackend('unavailable', { available: false }))

      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const results = await registry.findAvailable(params)
      expect(results).toHaveLength(1)
      expect(results[0].backend.name).toBe('available')
      expect(results[0].availability.available).toBe(true)
    })
  })

  describe('enable/disable', () => {
    it('should enable a disabled backend', () => {
      const backend = createMockBackend('backend')
      registry.register(backend, { enabled: false })

      expect(registry.get('backend')).toBeUndefined()

      registry.enable('backend')
      expect(registry.get('backend')).toBe(backend)
    })

    it('should disable an enabled backend', () => {
      const backend = createMockBackend('backend')
      registry.register(backend)

      expect(registry.get('backend')).toBe(backend)

      registry.disable('backend')
      expect(registry.get('backend')).toBeUndefined()
    })

    it('should return false for non-existent backend', () => {
      expect(registry.enable('non-existent')).toBe(false)
      expect(registry.disable('non-existent')).toBe(false)
    })
  })

  describe('setPriority', () => {
    it('should update backend priority', () => {
      registry.register(createMockBackend('backend-1'), { priority: 10 })
      registry.register(createMockBackend('backend-2'), { priority: 100 })

      // backend-2 should be first
      expect(registry.getAll()[0].name).toBe('backend-2')

      // Change priority
      registry.setPriority('backend-1', 200)

      // Now backend-1 should be first
      expect(registry.getAll()[0].name).toBe('backend-1')
    })

    it('should return false for non-existent backend', () => {
      expect(registry.setPriority('non-existent', 100)).toBe(false)
    })
  })

  describe('count', () => {
    it('should return total count', () => {
      registry.register(createMockBackend('a'))
      registry.register(createMockBackend('b'))
      registry.register(createMockBackend('c'), { enabled: false })

      expect(registry.count()).toBe(3)
    })

    it('should return enabled count only', () => {
      registry.register(createMockBackend('a'))
      registry.register(createMockBackend('b'))
      registry.register(createMockBackend('c'), { enabled: false })

      expect(registry.count(true)).toBe(2)
    })
  })

  describe('clear', () => {
    it('should remove all backends', () => {
      registry.register(createMockBackend('a'))
      registry.register(createMockBackend('b'))

      registry.clear()

      expect(registry.count()).toBe(0)
      expect(registry.getAll()).toEqual([])
    })
  })

  describe('getNames', () => {
    it('should return all backend names', () => {
      registry.register(createMockBackend('a'))
      registry.register(createMockBackend('b'))
      registry.register(createMockBackend('c'), { enabled: false })

      const names = registry.getNames()
      expect(names).toContain('a')
      expect(names).toContain('b')
      expect(names).toContain('c')
    })

    it('should return only enabled backend names', () => {
      registry.register(createMockBackend('a'))
      registry.register(createMockBackend('b'), { enabled: false })

      const names = registry.getNames(true)
      expect(names).toContain('a')
      expect(names).not.toContain('b')
    })
  })
})

describe('rate limiting integration', () => {
  let registry: PrivacyBackendRegistry

  beforeEach(() => {
    registry = new PrivacyBackendRegistry({
      enableRateLimiting: true,
      rateLimiterConfig: {
        defaultConfig: { maxTokens: 3, refillRate: 1, refillIntervalMs: 1000 },
      },
    })
  })

  it('should have rate limiter when enabled', () => {
    expect(registry.getRateLimiter()).not.toBeNull()
  })

  it('should not have rate limiter by default', () => {
    const defaultReg = new PrivacyBackendRegistry()
    expect(defaultReg.getRateLimiter()).toBeNull()
  })

  it('should allow acquisition when tokens available', () => {
    registry.register(createMockBackend('backend'))

    expect(registry.tryAcquire('backend')).toBe(true)
    expect(registry.tryAcquire('backend')).toBe(true)
    expect(registry.tryAcquire('backend')).toBe(true)
  })

  it('should reject when tokens exhausted', () => {
    registry.register(createMockBackend('backend'))

    registry.tryAcquire('backend')
    registry.tryAcquire('backend')
    registry.tryAcquire('backend')

    expect(registry.tryAcquire('backend')).toBe(false)
  })

  it('should always allow when rate limiting disabled', () => {
    const regNoLimiting = new PrivacyBackendRegistry({ enableRateLimiting: false })
    regNoLimiting.register(createMockBackend('backend'))

    // Should always succeed when rate limiting is disabled
    for (let i = 0; i < 100; i++) {
      expect(regNoLimiting.tryAcquire('backend')).toBe(true)
    }
  })

  it('should check if backend is rate limited', () => {
    registry.register(createMockBackend('backend'))

    expect(registry.isRateLimited('backend')).toBe(false)

    // Exhaust tokens
    registry.tryAcquire('backend')
    registry.tryAcquire('backend')
    registry.tryAcquire('backend')

    expect(registry.isRateLimited('backend')).toBe(true)
  })

  it('should return stats for rate limited backend', () => {
    registry.register(createMockBackend('backend'))

    registry.tryAcquire('backend')
    registry.tryAcquire('backend')

    const stats = registry.getRateLimitStats('backend')
    expect(stats?.allowed).toBe(2)
  })

  it('should filter available backends by rate limit', () => {
    registry.register(createMockBackend('backend-a'))
    registry.register(createMockBackend('backend-b'))

    // Exhaust backend-a tokens
    registry.tryAcquire('backend-a')
    registry.tryAcquire('backend-a')
    registry.tryAcquire('backend-a')

    const available = registry.getAvailable()
    expect(available).toHaveLength(1)
    expect(available[0].name).toBe('backend-b')
  })

  it('should get ready backends (healthy AND not rate limited)', () => {
    registry.register(createMockBackend('backend-a'))
    registry.register(createMockBackend('backend-b'))

    // Exhaust backend-a tokens
    registry.tryAcquire('backend-a')
    registry.tryAcquire('backend-a')
    registry.tryAcquire('backend-a')

    // Open circuit for backend-b (simulate unhealthy)
    registry.openCircuit('backend-b')

    // Neither should be ready
    const ready = registry.getReady()
    expect(ready).toHaveLength(0)
  })

  it('should reset rate limit state', () => {
    registry.register(createMockBackend('backend'))

    // Exhaust tokens
    registry.tryAcquire('backend')
    registry.tryAcquire('backend')
    registry.tryAcquire('backend')
    expect(registry.isRateLimited('backend')).toBe(true)

    // Reset
    registry.resetRateLimit('backend')

    expect(registry.isRateLimited('backend')).toBe(false)
  })

  it('should allow setting external rate limiter', () => {
    const customLimiter = new RateLimiter({
      defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
    })

    const reg = new PrivacyBackendRegistry()
    reg.setRateLimiter(customLimiter)

    expect(reg.getRateLimiter()).toBe(customLimiter)

    // Should use custom limiter
    reg.register(createMockBackend('backend'))
    expect(reg.tryAcquire('backend')).toBe(true)
    expect(reg.tryAcquire('backend')).toBe(false)
  })
})

describe('defaultRegistry', () => {
  it('should be a PrivacyBackendRegistry instance', () => {
    expect(defaultRegistry).toBeInstanceOf(PrivacyBackendRegistry)
  })
})
