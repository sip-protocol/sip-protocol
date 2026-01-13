/**
 * SmartRouter Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SmartRouter } from '../../src/privacy-backends/router'
import { PrivacyBackendRegistry } from '../../src/privacy-backends/registry'
import { AllBackendsFailedError } from '../../src/privacy-backends/interface'
import type {
  PrivacyBackend,
  BackendCapabilities,
  TransferParams,
  AvailabilityResult,
  TransactionResult,
} from '../../src/privacy-backends/interface'

// Mock backend factory
function createMockBackend(
  name: string,
  options: Partial<{
    chains: string[]
    type: 'transaction' | 'compute' | 'both'
    complianceSupport: boolean
    available: boolean
    latencyEstimate: 'fast' | 'medium' | 'slow'
    setupRequired: boolean
    anonymitySet: number
    estimatedCost: bigint
    estimatedTime: number
  }> = {}
): PrivacyBackend {
  const {
    chains = ['solana'],
    type = 'transaction',
    complianceSupport = true,
    available = true,
    latencyEstimate = 'fast',
    setupRequired = false,
    anonymitySet,
    estimatedCost = 5000n,
    estimatedTime = 1000,
  } = options

  return {
    name,
    type,
    chains: chains as any,
    checkAvailability: vi.fn().mockResolvedValue({
      available,
      estimatedCost,
      estimatedTime,
    } as AvailabilityResult),
    getCapabilities: vi.fn().mockReturnValue({
      hiddenAmount: true,
      hiddenSender: true,
      hiddenRecipient: true,
      hiddenCompute: type === 'compute' || type === 'both',
      complianceSupport,
      anonymitySet,
      setupRequired,
      latencyEstimate,
      supportedTokens: 'all',
    } as BackendCapabilities),
    execute: vi.fn().mockResolvedValue({
      success: true,
      signature: `sig-${name}`,
      backend: name,
    } as TransactionResult),
    estimateCost: vi.fn().mockResolvedValue(estimatedCost),
  }
}

const defaultParams: TransferParams = {
  chain: 'solana',
  sender: 'sender-address',
  recipient: 'recipient-address',
  mint: null,
  amount: 1000000n,
  decimals: 9,
}

describe('SmartRouter', () => {
  let registry: PrivacyBackendRegistry
  let router: SmartRouter

  beforeEach(() => {
    registry = new PrivacyBackendRegistry()
    router = new SmartRouter(registry)
  })

  describe('selectBackend', () => {
    it('should throw when no backends available', async () => {
      await expect(router.selectBackend(defaultParams)).rejects.toThrow(
        "No backends available for chain 'solana'"
      )
    })

    it('should throw when no backends meet requirements', async () => {
      registry.register(createMockBackend('unavailable', { available: false }))

      await expect(router.selectBackend(defaultParams)).rejects.toThrow(
        'No backends meet the requirements'
      )
    })

    it('should select the only available backend', async () => {
      registry.register(createMockBackend('only-backend'))

      const result = await router.selectBackend(defaultParams)

      expect(result.backend.name).toBe('only-backend')
      expect(result.score).toBeGreaterThan(0)
    })

    it('should select backend with highest score', async () => {
      registry.register(createMockBackend('low-score', { complianceSupport: false }))
      registry.register(createMockBackend('high-score', { complianceSupport: true }))

      const result = await router.selectBackend(defaultParams, {
        prioritize: 'compliance',
      })

      expect(result.backend.name).toBe('high-score')
    })

    it('should respect excludeBackends config', async () => {
      registry.register(createMockBackend('backend-a'))
      registry.register(createMockBackend('backend-b'))

      const result = await router.selectBackend(defaultParams, {
        excludeBackends: ['backend-a'],
      })

      expect(result.backend.name).toBe('backend-b')
    })

    it('should respect requireViewingKeys config', async () => {
      registry.register(createMockBackend('no-compliance', { complianceSupport: false }))
      registry.register(createMockBackend('with-compliance', { complianceSupport: true }))

      const result = await router.selectBackend(defaultParams, {
        requireViewingKeys: true,
      })

      expect(result.backend.name).toBe('with-compliance')
    })

    it('should respect minAnonymitySet config', async () => {
      registry.register(createMockBackend('small-set', { anonymitySet: 50 }))
      registry.register(createMockBackend('large-set', { anonymitySet: 200 }))

      const result = await router.selectBackend(defaultParams, {
        minAnonymitySet: 100,
      })

      expect(result.backend.name).toBe('large-set')
    })

    it('should respect allowComputePrivacy config', async () => {
      registry.register(createMockBackend('compute', { type: 'compute' }))
      registry.register(createMockBackend('transaction', { type: 'transaction' }))

      const result = await router.selectBackend(defaultParams, {
        allowComputePrivacy: false,
      })

      expect(result.backend.name).toBe('transaction')
    })

    it('should respect maxCost config', async () => {
      registry.register(createMockBackend('expensive', { estimatedCost: 100000n }))
      registry.register(createMockBackend('cheap', { estimatedCost: 1000n }))

      const result = await router.selectBackend(defaultParams, {
        maxCost: 50000n,
      })

      expect(result.backend.name).toBe('cheap')
    })

    it('should respect maxLatency config', async () => {
      registry.register(createMockBackend('slow', { estimatedTime: 10000 }))
      registry.register(createMockBackend('fast', { estimatedTime: 500 }))

      const result = await router.selectBackend(defaultParams, {
        maxLatency: 2000,
      })

      expect(result.backend.name).toBe('fast')
    })

    it('should prefer specified backend if within 10 points', async () => {
      registry.register(createMockBackend('optimal'))
      registry.register(createMockBackend('preferred'))

      const result = await router.selectBackend(defaultParams, {
        preferredBackend: 'preferred',
      })

      expect(result.backend.name).toBe('preferred')
      expect(result.reason).toContain('Preferred backend')
    })

    it('should include alternatives in result', async () => {
      registry.register(createMockBackend('backend-1'))
      registry.register(createMockBackend('backend-2'))
      registry.register(createMockBackend('backend-3'))

      const result = await router.selectBackend(defaultParams)

      expect(result.alternatives).toHaveLength(2)
    })
  })

  describe('execute', () => {
    it('should execute on selected backend', async () => {
      const mockBackend = createMockBackend('test-backend')
      registry.register(mockBackend)

      const result = await router.execute(defaultParams)

      expect(result.success).toBe(true)
      expect(result.backend).toBe('test-backend')
      expect(mockBackend.execute).toHaveBeenCalledWith(defaultParams)
    })

    it('should pass config to selectBackend', async () => {
      registry.register(createMockBackend('no-compliance', { complianceSupport: false }))
      registry.register(createMockBackend('with-compliance', { complianceSupport: true }))

      const result = await router.execute(defaultParams, {
        requireViewingKeys: true,
      })

      expect(result.backend).toBe('with-compliance')
    })
  })

  describe('getAvailableBackends', () => {
    it('should return available backends with availability info', async () => {
      registry.register(createMockBackend('available-1'))
      registry.register(createMockBackend('available-2'))
      registry.register(createMockBackend('unavailable', { available: false }))

      const results = await router.getAvailableBackends(defaultParams)

      expect(results).toHaveLength(2)
      expect(results.every(r => r.availability.available)).toBe(true)
    })
  })

  describe('priority scoring', () => {
    describe('privacy priority', () => {
      it('should score higher for more privacy features', async () => {
        registry.register(createMockBackend('full-privacy', {
          complianceSupport: true,
        }))

        const result = await router.selectBackend(defaultParams, {
          prioritize: 'privacy',
        })

        expect(result.score).toBeGreaterThan(50)
        expect(result.reason).toContain('hidden')
      })
    })

    describe('speed priority', () => {
      it('should prefer fast backends', async () => {
        registry.register(createMockBackend('slow', { latencyEstimate: 'slow' }))
        registry.register(createMockBackend('fast', { latencyEstimate: 'fast' }))

        const result = await router.selectBackend(defaultParams, {
          prioritize: 'speed',
        })

        expect(result.backend.name).toBe('fast')
      })

      it('should penalize backends requiring setup', async () => {
        registry.register(createMockBackend('no-setup', { setupRequired: false }))
        registry.register(createMockBackend('needs-setup', { setupRequired: true }))

        const result = await router.selectBackend(defaultParams, {
          prioritize: 'speed',
        })

        expect(result.backend.name).toBe('no-setup')
      })
    })

    describe('cost priority', () => {
      it('should prefer cheaper backends', async () => {
        registry.register(createMockBackend('expensive', { estimatedCost: 100000n }))
        registry.register(createMockBackend('cheap', { estimatedCost: 100n }))

        const result = await router.selectBackend(defaultParams, {
          prioritize: 'cost',
        })

        expect(result.backend.name).toBe('cheap')
      })
    })

    describe('compliance priority', () => {
      it('should strongly prefer compliance-supporting backends', async () => {
        registry.register(createMockBackend('no-compliance', { complianceSupport: false }))
        registry.register(createMockBackend('with-compliance', { complianceSupport: true }))

        const result = await router.selectBackend(defaultParams, {
          prioritize: 'compliance',
        })

        expect(result.backend.name).toBe('with-compliance')
        expect(result.reason).toContain('viewing key')
      })
    })
  })

  // ─── Health-Aware Selection Tests ─────────────────────────────────────────────

  describe('health-aware selection', () => {
    it('should skip unhealthy backends by default', async () => {
      registry.register(createMockBackend('healthy'))
      registry.register(createMockBackend('unhealthy'))

      // Open circuit for unhealthy backend
      registry.openCircuit('unhealthy')

      const result = await router.selectBackend(defaultParams)

      expect(result.backend.name).toBe('healthy')
      expect(result.alternatives).toHaveLength(0)
    })

    it('should include unhealthy backends when includeUnhealthy is true', async () => {
      registry.register(createMockBackend('healthy'))
      registry.register(createMockBackend('unhealthy'))

      registry.openCircuit('unhealthy')

      const result = await router.selectBackend(defaultParams, {
        includeUnhealthy: true,
      })

      // Should have both backends available
      expect(result.alternatives.length + 1).toBe(2)
    })

    it('should throw when all backends are unhealthy', async () => {
      registry.register(createMockBackend('backend-1'))
      registry.register(createMockBackend('backend-2'))

      registry.openCircuit('backend-1')
      registry.openCircuit('backend-2')

      await expect(router.selectBackend(defaultParams)).rejects.toThrow(
        'No backends meet the requirements'
      )
    })
  })

  // ─── Fallback Tests ───────────────────────────────────────────────────────────

  describe('fallback behavior', () => {
    it('should try alternative when primary fails', async () => {
      const failingBackend = createMockBackend('failing')
      vi.mocked(failingBackend.execute).mockResolvedValue({
        success: false,
        error: 'Primary failed',
        backend: 'failing',
      })

      const workingBackend = createMockBackend('working')

      registry.register(failingBackend)
      registry.register(workingBackend)

      const result = await router.execute(defaultParams, {
        enableFallback: true,
      })

      expect(result.success).toBe(true)
      expect(result.backend).toBe('working')
      expect(result.metadata?.fallbackFrom).toBe('failing')
    })

    it('should not try fallback when enableFallback is false', async () => {
      const failingBackend = createMockBackend('failing')
      vi.mocked(failingBackend.execute).mockResolvedValue({
        success: false,
        error: 'Primary failed',
        backend: 'failing',
      })

      registry.register(failingBackend)
      registry.register(createMockBackend('working'))

      const result = await router.execute(defaultParams, {
        enableFallback: false,
      })

      expect(result.success).toBe(false)
      expect(result.backend).toBe('failing')
    })

    it('should throw AllBackendsFailedError when all backends fail', async () => {
      const failing1 = createMockBackend('failing-1')
      const failing2 = createMockBackend('failing-2')

      vi.mocked(failing1.execute).mockResolvedValue({
        success: false,
        error: 'Error 1',
        backend: 'failing-1',
      })
      vi.mocked(failing2.execute).mockResolvedValue({
        success: false,
        error: 'Error 2',
        backend: 'failing-2',
      })

      registry.register(failing1)
      registry.register(failing2)

      await expect(router.execute(defaultParams)).rejects.toThrow(AllBackendsFailedError)

      try {
        await router.execute(defaultParams)
      } catch (error) {
        expect(error).toBeInstanceOf(AllBackendsFailedError)
        const allFailed = error as AllBackendsFailedError
        expect(allFailed.attemptedBackends).toContain('failing-1')
        expect(allFailed.attemptedBackends).toContain('failing-2')
        expect(allFailed.errors.get('failing-1')).toBe('Error 1')
        expect(allFailed.errors.get('failing-2')).toBe('Error 2')
      }
    })

    it('should respect maxFallbackAttempts', async () => {
      const backends = ['b1', 'b2', 'b3', 'b4', 'b5'].map(name => {
        const backend = createMockBackend(name)
        vi.mocked(backend.execute).mockResolvedValue({
          success: false,
          error: `${name} failed`,
          backend: name,
        })
        return backend
      })

      for (const backend of backends) {
        registry.register(backend)
      }

      try {
        await router.execute(defaultParams, {
          maxFallbackAttempts: 2,
        })
      } catch (error) {
        expect(error).toBeInstanceOf(AllBackendsFailedError)
        const allFailed = error as AllBackendsFailedError
        // Primary + 2 fallback attempts = 3 total
        expect(allFailed.attemptedBackends).toHaveLength(3)
      }
    })

    it('should skip unhealthy backends during fallback', async () => {
      const failing = createMockBackend('failing')
      const unhealthy = createMockBackend('unhealthy')
      const working = createMockBackend('working')

      vi.mocked(failing.execute).mockResolvedValue({
        success: false,
        error: 'Failed',
        backend: 'failing',
      })

      registry.register(failing)
      registry.register(unhealthy)
      registry.register(working)

      // Open circuit for unhealthy
      registry.openCircuit('unhealthy')

      const result = await router.execute(defaultParams)

      expect(result.success).toBe(true)
      expect(result.backend).toBe('working')
      // unhealthy should not have been attempted
      expect(result.metadata?.attemptedBackends).not.toContain('unhealthy')
    })

    it('should not count skipped unhealthy backends against maxFallbackAttempts', async () => {
      // Create 5 backends: 1 primary (fails) + 2 unhealthy + 2 healthy (1 fails, 1 works)
      const primary = createMockBackend('primary')
      const unhealthy1 = createMockBackend('unhealthy1')
      const unhealthy2 = createMockBackend('unhealthy2')
      const failingHealthy = createMockBackend('failing-healthy')
      const workingHealthy = createMockBackend('working-healthy')

      vi.mocked(primary.execute).mockResolvedValue({
        success: false,
        error: 'Primary failed',
        backend: 'primary',
      })
      vi.mocked(failingHealthy.execute).mockResolvedValue({
        success: false,
        error: 'Also failed',
        backend: 'failing-healthy',
      })

      // Register with priorities to control order
      registry.register(primary, { priority: 100 })
      registry.register(unhealthy1, { priority: 90 })
      registry.register(unhealthy2, { priority: 80 })
      registry.register(failingHealthy, { priority: 70 })
      registry.register(workingHealthy, { priority: 60 })

      // Open circuits for unhealthy backends
      registry.openCircuit('unhealthy1')
      registry.openCircuit('unhealthy2')

      // With maxFallbackAttempts=2, we should:
      // 1. Try primary (fails)
      // 2. Skip unhealthy1 (doesn't count)
      // 3. Skip unhealthy2 (doesn't count)
      // 4. Try failing-healthy (fails, counts as attempt 1)
      // 5. Try working-healthy (succeeds, counts as attempt 2)
      const result = await router.execute(defaultParams, {
        maxFallbackAttempts: 2,
      })

      expect(result.success).toBe(true)
      expect(result.backend).toBe('working-healthy')
      expect(result.metadata?.attemptedBackends).toEqual([
        'primary',
        'failing-healthy',
        'working-healthy',
      ])
    })
  })

  // ─── Health Recording Tests ───────────────────────────────────────────────────

  describe('health recording', () => {
    it('should record success on successful execution', async () => {
      const backend = createMockBackend('test')
      registry.register(backend)

      await router.execute(defaultParams)

      const metrics = registry.getMetrics('test')
      expect(metrics).toBeDefined()
      expect(metrics!.successfulRequests).toBe(1)
      expect(metrics!.failedRequests).toBe(0)
    })

    it('should record failure on failed execution', async () => {
      const backend = createMockBackend('test')
      vi.mocked(backend.execute).mockResolvedValue({
        success: false,
        error: 'Test error',
        backend: 'test',
      })
      registry.register(backend)

      await router.execute(defaultParams, { enableFallback: false })

      const metrics = registry.getMetrics('test')
      expect(metrics).toBeDefined()
      expect(metrics!.failedRequests).toBe(1)
    })

    it('should record failure on exception', async () => {
      const backend = createMockBackend('test')
      vi.mocked(backend.execute).mockRejectedValue(new Error('Connection error'))
      registry.register(backend)

      await router.execute(defaultParams, { enableFallback: false })

      const health = registry.getHealthState('test')
      expect(health).toBeDefined()
      expect(health!.consecutiveFailures).toBe(1)
      expect(health!.lastFailureReason).toBe('Connection error')
    })

    it('should open circuit after multiple failures', async () => {
      const backend = createMockBackend('test')
      vi.mocked(backend.execute).mockResolvedValue({
        success: false,
        error: 'Keeps failing',
        backend: 'test',
      })
      registry.register(backend)

      // Execute 3 times (default threshold)
      for (let i = 0; i < 3; i++) {
        await router.execute(defaultParams, { enableFallback: false })
      }

      expect(registry.isHealthy('test')).toBe(false)
      const health = registry.getHealthState('test')
      expect(health!.circuitState).toBe('open')
    })
  })
})
