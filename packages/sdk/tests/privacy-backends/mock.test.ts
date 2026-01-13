/**
 * Mock Backend Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MockBackend, createMockFactory } from '../../src/privacy-backends/mock'
import type { TransferParams } from '../../src/privacy-backends/interface'

const validParams: TransferParams = {
  chain: 'solana',
  sender: 'sender-address',
  recipient: 'recipient-address',
  mint: null,
  amount: 1000000n,
  decimals: 9,
}

describe('MockBackend', () => {
  let backend: MockBackend

  beforeEach(() => {
    backend = new MockBackend()
  })

  describe('constructor', () => {
    it('should create with default values', () => {
      expect(backend.name).toBe('mock')
      expect(backend.type).toBe('transaction')
      expect(backend.chains).toContain('solana')
      expect(backend.chains).toContain('ethereum')
    })

    it('should accept custom configuration', () => {
      const custom = new MockBackend({
        name: 'custom-mock',
        type: 'compute',
        chains: ['near'],
        latencyMs: 100,
      })

      expect(custom.name).toBe('custom-mock')
      expect(custom.type).toBe('compute')
      expect(custom.chains).toEqual(['near'])
    })
  })

  describe('checkAvailability', () => {
    it('should return available for supported chain', async () => {
      const result = await backend.checkAvailability(validParams)

      expect(result.available).toBe(true)
      expect(result.estimatedCost).toBeDefined()
    })

    it('should return unavailable for unsupported chain', async () => {
      const result = await backend.checkAvailability({
        ...validParams,
        chain: 'unknown-chain' as any,
      })

      expect(result.available).toBe(false)
      expect(result.reason).toContain('not supported')
    })

    it('should track availability calls', async () => {
      await backend.checkAvailability(validParams)
      await backend.checkAvailability(validParams)

      expect(backend.availabilityCalls).toHaveLength(2)
    })
  })

  describe('getCapabilities', () => {
    it('should return default capabilities', () => {
      const caps = backend.getCapabilities()

      expect(caps.hiddenAmount).toBe(true)
      expect(caps.hiddenSender).toBe(true)
      expect(caps.hiddenRecipient).toBe(true)
      expect(caps.complianceSupport).toBe(true)
    })

    it('should return custom capabilities', () => {
      const custom = new MockBackend({
        capabilities: {
          complianceSupport: false,
          latencyEstimate: 'slow',
        },
      })

      const caps = custom.getCapabilities()
      expect(caps.complianceSupport).toBe(false)
      expect(caps.latencyEstimate).toBe('slow')
    })
  })

  describe('execute', () => {
    it('should succeed by default', async () => {
      const result = await backend.execute(validParams)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.backend).toBe('mock')
    })

    it('should fail when configured', async () => {
      const failing = new MockBackend({
        shouldFail: true,
        failureMessage: 'Test failure',
      })

      const result = await failing.execute(validParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Test failure')
    })

    it('should track execute calls', async () => {
      await backend.execute(validParams)
      await backend.execute(validParams)

      expect(backend.executeCalls).toHaveLength(2)
      expect(backend.executeCalls[0]).toEqual(validParams)
    })

    it('should respect latency configuration', async () => {
      const slow = new MockBackend({ latencyMs: 50 })

      const start = Date.now()
      await slow.execute(validParams)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some variance
    })
  })

  describe('estimateCost', () => {
    it('should return default cost', async () => {
      const cost = await backend.estimateCost(validParams)
      expect(cost).toBe(5000n)
    })

    it('should return custom cost', async () => {
      const custom = new MockBackend({ estimatedCost: 10000n })
      const cost = await custom.estimateCost(validParams)
      expect(cost).toBe(10000n)
    })
  })

  describe('reset', () => {
    it('should clear call history', async () => {
      await backend.execute(validParams)
      await backend.checkAvailability(validParams)

      expect(backend.executeCalls).toHaveLength(1)
      expect(backend.availabilityCalls).toHaveLength(1)

      backend.reset()

      expect(backend.executeCalls).toHaveLength(0)
      expect(backend.availabilityCalls).toHaveLength(0)
    })
  })

  describe('setFailure', () => {
    it('should toggle failure state', async () => {
      const result1 = await backend.execute(validParams)
      expect(result1.success).toBe(true)

      backend.setFailure(true, 'Now failing')

      const result2 = await backend.execute(validParams)
      expect(result2.success).toBe(false)
      expect(result2.error).toBe('Now failing')

      backend.setFailure(false)

      const result3 = await backend.execute(validParams)
      expect(result3.success).toBe(true)
    })
  })

  describe('setAvailability', () => {
    it('should toggle availability', async () => {
      const result1 = await backend.checkAvailability(validParams)
      expect(result1.available).toBe(true)

      backend.setAvailability(false, 'Temporarily unavailable')

      const result2 = await backend.checkAvailability(validParams)
      expect(result2.available).toBe(false)
      expect(result2.reason).toBe('Temporarily unavailable')
    })
  })
})

describe('createMockFactory', () => {
  it('should create backends with default config', () => {
    const factory = createMockFactory({ latencyMs: 25 })

    const backend1 = factory('backend-1')
    const backend2 = factory('backend-2')

    expect(backend1.name).toBe('backend-1')
    expect(backend2.name).toBe('backend-2')
  })

  it('should allow overrides', () => {
    const factory = createMockFactory({ latencyMs: 25, shouldFail: false })

    const backend = factory('test', { shouldFail: true })

    // Execute should fail due to override
    backend.execute(validParams).then(result => {
      expect(result.success).toBe(false)
    })
  })
})
