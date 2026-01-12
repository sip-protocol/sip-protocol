/**
 * SmartRouter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SmartRouter } from '../../src/privacy-backends/router'
import { PrivacyBackendRegistry } from '../../src/privacy-backends/registry'
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
})
