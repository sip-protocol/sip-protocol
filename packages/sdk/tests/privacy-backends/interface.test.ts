/**
 * Privacy Backend Interface Contract Tests
 *
 * These tests verify that all implementations correctly implement
 * the PrivacyBackend interface contract.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SIPNativeBackend } from '../../src/privacy-backends/sip-native'
import type {
  PrivacyBackend,
  BackendCapabilities,
  TransferParams,
  AvailabilityResult,
  TransactionResult,
} from '../../src/privacy-backends/interface'

// All backend implementations to test
const backendFactories: Array<{
  name: string
  create: () => PrivacyBackend
}> = [
  {
    name: 'SIPNativeBackend',
    create: () => new SIPNativeBackend(),
  },
  // Add more backends here as they are implemented:
  // { name: 'PrivacyCashBackend', create: () => new PrivacyCashBackend() },
  // { name: 'ArciumBackend', create: () => new ArciumBackend() },
  // { name: 'IncoBackend', create: () => new IncoBackend() },
]

const validParams: TransferParams = {
  chain: 'solana',
  sender: 'sender-address',
  recipient: 'recipient-address',
  mint: null,
  amount: 1000000n,
  decimals: 9,
}

describe('PrivacyBackend Interface Contract', () => {
  backendFactories.forEach(({ name, create }) => {
    describe(name, () => {
      let backend: PrivacyBackend

      beforeEach(() => {
        backend = create()
      })

      describe('required properties', () => {
        it('should have a non-empty name', () => {
          expect(typeof backend.name).toBe('string')
          expect(backend.name.length).toBeGreaterThan(0)
        })

        it('should have a valid type', () => {
          expect(['transaction', 'compute', 'both']).toContain(backend.type)
        })

        it('should have a non-empty chains array', () => {
          expect(Array.isArray(backend.chains)).toBe(true)
          expect(backend.chains.length).toBeGreaterThan(0)
        })
      })

      describe('checkAvailability', () => {
        it('should return an AvailabilityResult', async () => {
          const result = await backend.checkAvailability(validParams)

          expect(typeof result).toBe('object')
          expect(typeof result.available).toBe('boolean')
        })

        it('should include reason when not available', async () => {
          const unsupportedParams: TransferParams = {
            ...validParams,
            chain: 'unsupported-chain' as any,
          }

          const result = await backend.checkAvailability(unsupportedParams)

          if (!result.available) {
            expect(typeof result.reason).toBe('string')
            expect(result.reason!.length).toBeGreaterThan(0)
          }
        })

        it('should include cost estimate when available', async () => {
          const result = await backend.checkAvailability(validParams)

          if (result.available) {
            expect(result.estimatedCost).toBeDefined()
            expect(typeof result.estimatedCost).toBe('bigint')
          }
        })

        it('should include time estimate when available', async () => {
          const result = await backend.checkAvailability(validParams)

          if (result.available) {
            expect(result.estimatedTime).toBeDefined()
            expect(typeof result.estimatedTime).toBe('number')
          }
        })
      })

      describe('getCapabilities', () => {
        it('should return a BackendCapabilities object', () => {
          const caps = backend.getCapabilities()

          expect(typeof caps).toBe('object')
        })

        it('should have all required boolean fields', () => {
          const caps = backend.getCapabilities()

          expect(typeof caps.hiddenAmount).toBe('boolean')
          expect(typeof caps.hiddenSender).toBe('boolean')
          expect(typeof caps.hiddenRecipient).toBe('boolean')
          expect(typeof caps.hiddenCompute).toBe('boolean')
          expect(typeof caps.complianceSupport).toBe('boolean')
          expect(typeof caps.setupRequired).toBe('boolean')
        })

        it('should have valid latencyEstimate', () => {
          const caps = backend.getCapabilities()

          expect(['fast', 'medium', 'slow']).toContain(caps.latencyEstimate)
        })

        it('should have valid supportedTokens', () => {
          const caps = backend.getCapabilities()

          expect(['native', 'spl', 'all']).toContain(caps.supportedTokens)
        })

        it('should have optional anonymitySet as number or undefined', () => {
          const caps = backend.getCapabilities()

          if (caps.anonymitySet !== undefined) {
            expect(typeof caps.anonymitySet).toBe('number')
            expect(caps.anonymitySet).toBeGreaterThan(0)
          }
        })

        it('should be deterministic (same result on multiple calls)', () => {
          const caps1 = backend.getCapabilities()
          const caps2 = backend.getCapabilities()

          expect(caps1.hiddenAmount).toBe(caps2.hiddenAmount)
          expect(caps1.complianceSupport).toBe(caps2.complianceSupport)
          expect(caps1.latencyEstimate).toBe(caps2.latencyEstimate)
        })
      })

      describe('execute', () => {
        it('should return a TransactionResult', async () => {
          const result = await backend.execute(validParams)

          expect(typeof result).toBe('object')
          expect(typeof result.success).toBe('boolean')
          expect(result.backend).toBe(backend.name)
        })

        it('should include signature on success', async () => {
          const result = await backend.execute(validParams)

          if (result.success) {
            expect(result.signature).toBeDefined()
            expect(typeof result.signature).toBe('string')
          }
        })

        it('should include error on failure', async () => {
          const invalidParams: TransferParams = {
            ...validParams,
            chain: 'unsupported-chain' as any,
          }

          const result = await backend.execute(invalidParams)

          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(typeof result.error).toBe('string')
          }
        })
      })

      describe('estimateCost', () => {
        it('should return a bigint', async () => {
          const cost = await backend.estimateCost(validParams)

          expect(typeof cost).toBe('bigint')
        })

        it('should return non-negative cost', async () => {
          const cost = await backend.estimateCost(validParams)

          expect(cost >= 0n).toBe(true)
        })

        it('should be consistent with checkAvailability estimate', async () => {
          const availability = await backend.checkAvailability(validParams)
          const cost = await backend.estimateCost(validParams)

          if (availability.available && availability.estimatedCost !== undefined) {
            // Should be the same or very close
            expect(cost).toBe(availability.estimatedCost)
          }
        })
      })
    })
  })
})

describe('BackendCapabilities type', () => {
  it('should allow all required fields', () => {
    const caps: BackendCapabilities = {
      hiddenAmount: true,
      hiddenSender: true,
      hiddenRecipient: true,
      hiddenCompute: false,
      complianceSupport: true,
      setupRequired: false,
      latencyEstimate: 'fast',
      supportedTokens: 'all',
    }

    expect(caps.hiddenAmount).toBe(true)
    expect(caps.complianceSupport).toBe(true)
  })

  it('should allow optional fields', () => {
    const caps: BackendCapabilities = {
      hiddenAmount: true,
      hiddenSender: true,
      hiddenRecipient: true,
      hiddenCompute: false,
      complianceSupport: true,
      setupRequired: false,
      latencyEstimate: 'fast',
      supportedTokens: 'all',
      anonymitySet: 100,
      minAmount: 1000n,
      maxAmount: 1000000n,
    }

    expect(caps.anonymitySet).toBe(100)
    expect(caps.minAmount).toBe(1000n)
    expect(caps.maxAmount).toBe(1000000n)
  })
})

describe('TransferParams type', () => {
  it('should require all mandatory fields', () => {
    const params: TransferParams = {
      chain: 'solana',
      sender: 'sender',
      recipient: 'recipient',
      mint: null,
      amount: 1000n,
      decimals: 9,
    }

    expect(params.chain).toBe('solana')
    expect(params.amount).toBe(1000n)
  })

  it('should allow optional fields', () => {
    const params: TransferParams = {
      chain: 'solana',
      sender: 'sender',
      recipient: 'recipient',
      mint: 'token-mint',
      amount: 1000n,
      decimals: 6,
      viewingKey: {
        key: '0x1234' as any,
        path: 'm/0',
        hash: '0xabcd' as any,
      },
      options: {
        customOption: 'value',
      },
    }

    expect(params.viewingKey).toBeDefined()
    expect(params.options).toBeDefined()
  })
})

describe('AvailabilityResult type', () => {
  it('should work for available result', () => {
    const result: AvailabilityResult = {
      available: true,
      estimatedCost: 5000n,
      estimatedTime: 1000,
    }

    expect(result.available).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('should work for unavailable result', () => {
    const result: AvailabilityResult = {
      available: false,
      reason: 'Chain not supported',
    }

    expect(result.available).toBe(false)
    expect(result.reason).toBe('Chain not supported')
  })
})

describe('TransactionResult type', () => {
  it('should work for successful result', () => {
    const result: TransactionResult = {
      success: true,
      signature: 'tx-signature',
      backend: 'sip-native',
      metadata: {
        timestamp: Date.now(),
      },
    }

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should work for failed result', () => {
    const result: TransactionResult = {
      success: false,
      error: 'Transfer failed',
      backend: 'sip-native',
    }

    expect(result.success).toBe(false)
    expect(result.signature).toBeUndefined()
  })
})

// ─── Timeout Utilities Tests ──────────────────────────────────────────────────

import {
  withTimeout,
  ComputationTimeoutError,
  deepFreeze,
} from '../../src/privacy-backends/interface'

describe('withTimeout', () => {
  it('should resolve when promise completes before timeout', async () => {
    const result = await withTimeout(
      Promise.resolve('success'),
      1000,
      () => { throw new Error('timeout') }
    )

    expect(result).toBe('success')
  })

  it('should throw timeout error when promise exceeds timeout', async () => {
    const slowPromise = new Promise<string>(resolve => {
      setTimeout(() => resolve('too late'), 100)
    })

    await expect(
      withTimeout(
        slowPromise,
        10, // Very short timeout
        () => { throw new Error('Computation timed out') }
      )
    ).rejects.toThrow('Computation timed out')
  })

  it('should cleanup timeout when promise resolves', async () => {
    // This test ensures we don't leak timers
    const result = await withTimeout(
      Promise.resolve(42),
      5000,
      () => { throw new Error('should not happen') }
    )

    expect(result).toBe(42)
  })

  it('should pass through rejection from original promise', async () => {
    const failingPromise = Promise.reject(new Error('original error'))

    await expect(
      withTimeout(
        failingPromise,
        1000,
        () => { throw new Error('timeout error') }
      )
    ).rejects.toThrow('original error')
  })
})

describe('ComputationTimeoutError', () => {
  it('should create error with correct properties', () => {
    const error = new ComputationTimeoutError('comp-123', 5000, 'arcium')

    expect(error.name).toBe('ComputationTimeoutError')
    expect(error.computationId).toBe('comp-123')
    expect(error.timeoutMs).toBe(5000)
    expect(error.backendName).toBe('arcium')
    expect(error.message).toContain('comp-123')
    expect(error.message).toContain('5000ms')
    expect(error.message).toContain('arcium')
  })

  it('should be instanceof Error', () => {
    const error = new ComputationTimeoutError('comp-456', 10000, 'inco')

    expect(error instanceof Error).toBe(true)
    expect(error instanceof ComputationTimeoutError).toBe(true)
  })
})

// ─── Deep Freeze Utility Tests ────────────────────────────────────────────────

describe('deepFreeze', () => {
  it('should freeze top-level object', () => {
    const obj = { name: 'test', value: 42 }
    const frozen = deepFreeze(obj)

    expect(Object.isFrozen(frozen)).toBe(true)
  })

  it('should freeze nested objects', () => {
    const obj = {
      config: {
        network: 'devnet',
        options: {
          timeout: 5000,
        },
      },
    }
    const frozen = deepFreeze(obj)

    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isFrozen(frozen.config)).toBe(true)
    expect(Object.isFrozen(frozen.config.options)).toBe(true)
  })

  it('should freeze arrays', () => {
    const obj = {
      items: [1, 2, 3],
      nested: [{ id: 1 }, { id: 2 }],
    }
    const frozen = deepFreeze(obj)

    expect(Object.isFrozen(frozen.items)).toBe(true)
    expect(Object.isFrozen(frozen.nested)).toBe(true)
    expect(Object.isFrozen(frozen.nested[0])).toBe(true)
  })

  it('should handle null values', () => {
    const obj = { value: null, name: 'test' }
    const frozen = deepFreeze(obj)

    expect(Object.isFrozen(frozen)).toBe(true)
    expect(frozen.value).toBe(null)
  })

  it('should handle empty objects', () => {
    const obj = {}
    const frozen = deepFreeze(obj)

    expect(Object.isFrozen(frozen)).toBe(true)
  })

  it('should return same object reference', () => {
    const obj = { test: true }
    const frozen = deepFreeze(obj)

    expect(frozen).toBe(obj)
  })

  it('should prevent modification in strict mode', () => {
    const obj = { network: 'devnet', options: { timeout: 5000 } }
    const frozen = deepFreeze(obj)

    // In strict mode, this would throw
    // In non-strict mode, modifications are silently ignored
    expect(() => {
      // @ts-expect-error - testing frozen object
      frozen.network = 'mainnet'
    }).toThrow()

    expect(() => {
      // @ts-expect-error - testing frozen object
      frozen.options.timeout = 10000
    }).toThrow()
  })
})

// ─── LRU Cache Tests ─────────────────────────────────────────────────────────

import { LRUCache } from '../../src/privacy-backends/interface'

describe('LRUCache', () => {
  describe('basic operations', () => {
    it('should set and get values', () => {
      const cache = new LRUCache<string>()

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
    })

    it('should return undefined for missing keys', () => {
      const cache = new LRUCache<string>()

      expect(cache.get('missing')).toBeUndefined()
    })

    it('should delete values', () => {
      const cache = new LRUCache<string>()

      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
    })

    it('should report correct size', () => {
      const cache = new LRUCache<string>()

      expect(cache.size).toBe(0)
      cache.set('key1', 'value1')
      expect(cache.size).toBe(1)
      cache.set('key2', 'value2')
      expect(cache.size).toBe(2)
    })

    it('should clear all values', () => {
      const cache = new LRUCache<string>()

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('key1')).toBeUndefined()
    })

    it('should check if key exists', () => {
      const cache = new LRUCache<string>()

      cache.set('key1', 'value1')

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('missing')).toBe(false)
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entry when maxSize exceeded', () => {
      const cache = new LRUCache<string>({ maxSize: 3 })

      cache.set('a', '1')
      cache.set('b', '2')
      cache.set('c', '3')
      cache.set('d', '4') // Should evict 'a'

      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe('2')
      expect(cache.get('c')).toBe('3')
      expect(cache.get('d')).toBe('4')
      expect(cache.size).toBe(3)
    })

    it('should move accessed entries to end (most recent)', () => {
      const cache = new LRUCache<string>({ maxSize: 3 })

      cache.set('a', '1')
      cache.set('b', '2')
      cache.set('c', '3')

      // Access 'a' to make it most recently used
      cache.get('a')

      cache.set('d', '4') // Should evict 'b' (now oldest)

      expect(cache.get('a')).toBe('1')
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe('3')
      expect(cache.get('d')).toBe('4')
    })

    it('should update existing key without eviction', () => {
      const cache = new LRUCache<string>({ maxSize: 2 })

      cache.set('a', '1')
      cache.set('b', '2')
      cache.set('a', 'updated') // Update, not insert

      expect(cache.get('a')).toBe('updated')
      expect(cache.get('b')).toBe('2')
      expect(cache.size).toBe(2)
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const cache = new LRUCache<string>({ ttlMs: 50 })

      cache.set('key', 'value')
      expect(cache.get('key')).toBe('value')

      await new Promise((resolve) => setTimeout(resolve, 60))

      expect(cache.get('key')).toBeUndefined()
    })

    it('should not expire entries before TTL', async () => {
      const cache = new LRUCache<string>({ ttlMs: 100 })

      cache.set('key', 'value')
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(cache.get('key')).toBe('value')
    })
  })

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string>()

      cache.set('key', 'value')
      cache.get('key') // hit
      cache.get('key') // hit
      cache.get('missing') // miss

      const stats = cache.stats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.667, 2)
    })

    it('should track evictions', () => {
      const cache = new LRUCache<string>({ maxSize: 2 })

      cache.set('a', '1')
      cache.set('b', '2')
      cache.set('c', '3') // evict 'a'
      cache.set('d', '4') // evict 'b'

      const stats = cache.stats()
      expect(stats.evictions).toBe(2)
    })

    it('should reset statistics', () => {
      const cache = new LRUCache<string>()

      cache.set('key', 'value')
      cache.get('key')
      cache.get('missing')

      cache.resetStats()
      const stats = cache.stats()

      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.evictions).toBe(0)
      expect(stats.size).toBe(1) // size is not reset
    })

    it('should handle zero access hit rate', () => {
      const cache = new LRUCache<string>()
      const stats = cache.stats()

      expect(stats.hitRate).toBe(0)
    })
  })

  describe('default configuration', () => {
    it('should use default maxSize of 100', () => {
      const cache = new LRUCache<number>()

      for (let i = 0; i < 150; i++) {
        cache.set(`key${i}`, i)
      }

      expect(cache.size).toBe(100)
      // First 50 should be evicted
      expect(cache.get('key0')).toBeUndefined()
      expect(cache.get('key49')).toBeUndefined()
      expect(cache.get('key50')).toBe(50)
    })
  })
})
