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

// ─── Interface Versioning Tests ──────────────────────────────────────────────

import {
  CURRENT_BACKEND_VERSION,
  MIN_SUPPORTED_VERSION,
  validateBackendVersion,
  getBackendVersion,
  backendSupportsVersion,
  isV2Backend,
  warnIfDeprecatedVersion,
  UnsupportedVersionError,
  type PrivacyBackendVersion,
} from '../../src/privacy-backends/interface'

describe('Interface Versioning', () => {
  describe('constants', () => {
    it('should have CURRENT_BACKEND_VERSION set to 2', () => {
      expect(CURRENT_BACKEND_VERSION).toBe(2)
    })

    it('should have MIN_SUPPORTED_VERSION set to 1', () => {
      expect(MIN_SUPPORTED_VERSION).toBe(1)
    })
  })

  describe('validateBackendVersion', () => {
    it('should return valid for v2 backend', () => {
      const backend: PrivacyBackend = {
        version: 2,
        name: 'test',
        type: 'transaction',
        chains: ['solana'],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'test' }),
        estimateCost: async () => 0n,
      }

      const result = validateBackendVersion(backend)

      expect(result.valid).toBe(true)
      expect(result.version).toBe(2)
      expect(result.deprecated).toBe(false)
      expect(result.warning).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should mark v1 backend as deprecated', () => {
      const backend: PrivacyBackend = {
        version: 1,
        name: 'old-backend',
        type: 'transaction',
        chains: ['solana'],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'old-backend' }),
        estimateCost: async () => 0n,
      }

      const result = validateBackendVersion(backend)

      expect(result.valid).toBe(true)
      expect(result.version).toBe(1)
      expect(result.deprecated).toBe(true)
      expect(result.warning).toContain('uses version 1')
      expect(result.warning).toContain('upgrading to v2')
    })

    it('should treat undefined version as v1 with deprecation warning', () => {
      const backend: PrivacyBackend = {
        name: 'legacy-backend',
        type: 'transaction',
        chains: ['solana'],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'legacy-backend' }),
        estimateCost: async () => 0n,
      }

      const result = validateBackendVersion(backend)

      expect(result.valid).toBe(true)
      expect(result.version).toBe(1)
      expect(result.deprecated).toBe(true)
      expect(result.warning).toContain('does not specify a version field')
      expect(result.warning).toContain('v1 which is deprecated')
    })
  })

  describe('getBackendVersion', () => {
    it('should return version for v2 backend', () => {
      const backend: PrivacyBackend = {
        version: 2,
        name: 'test',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'test' }),
        estimateCost: async () => 0n,
      }

      expect(getBackendVersion(backend)).toBe(2)
    })

    it('should return 1 for backend without version field', () => {
      const backend: PrivacyBackend = {
        name: 'legacy',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'legacy' }),
        estimateCost: async () => 0n,
      }

      expect(getBackendVersion(backend)).toBe(1)
    })
  })

  describe('backendSupportsVersion', () => {
    const v2Backend: PrivacyBackend = {
      version: 2,
      name: 'v2',
      type: 'transaction',
      chains: [],
      getCapabilities: () => ({} as any),
      checkAvailability: async () => ({ available: true }),
      execute: async () => ({ success: true, backend: 'v2' }),
      estimateCost: async () => 0n,
    }

    const v1Backend: PrivacyBackend = {
      version: 1,
      name: 'v1',
      type: 'transaction',
      chains: [],
      getCapabilities: () => ({} as any),
      checkAvailability: async () => ({ available: true }),
      execute: async () => ({ success: true, backend: 'v1' }),
      estimateCost: async () => 0n,
    }

    it('should return true when backend meets minimum version', () => {
      expect(backendSupportsVersion(v2Backend, 1)).toBe(true)
      expect(backendSupportsVersion(v2Backend, 2)).toBe(true)
      expect(backendSupportsVersion(v1Backend, 1)).toBe(true)
    })

    it('should return false when backend is below minimum version', () => {
      expect(backendSupportsVersion(v1Backend, 2)).toBe(false)
    })
  })

  describe('isV2Backend', () => {
    it('should return true for v2 backend', () => {
      const backend: PrivacyBackend = {
        version: 2,
        name: 'test',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'test' }),
        estimateCost: async () => 0n,
      }

      expect(isV2Backend(backend)).toBe(true)
    })

    it('should return false for v1 backend', () => {
      const backend: PrivacyBackend = {
        version: 1,
        name: 'test',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'test' }),
        estimateCost: async () => 0n,
      }

      expect(isV2Backend(backend)).toBe(false)
    })

    it('should return false for backend without version field', () => {
      const backend: PrivacyBackend = {
        name: 'test',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'test' }),
        estimateCost: async () => 0n,
      }

      expect(isV2Backend(backend)).toBe(false)
    })
  })

  describe('warnIfDeprecatedVersion', () => {
    it('should call logger for deprecated backend', () => {
      const warnings: string[] = []
      const mockLogger = (msg: string) => warnings.push(msg)

      const backend: PrivacyBackend = {
        name: 'old-backend',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'old-backend' }),
        estimateCost: async () => 0n,
      }

      warnIfDeprecatedVersion(backend, mockLogger)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain('DEPRECATION WARNING')
      expect(warnings[0]).toContain('old-backend')
    })

    it('should not call logger for v2 backend', () => {
      const warnings: string[] = []
      const mockLogger = (msg: string) => warnings.push(msg)

      const backend: PrivacyBackend = {
        version: 2,
        name: 'modern-backend',
        type: 'transaction',
        chains: [],
        getCapabilities: () => ({} as any),
        checkAvailability: async () => ({ available: true }),
        execute: async () => ({ success: true, backend: 'modern-backend' }),
        estimateCost: async () => 0n,
      }

      warnIfDeprecatedVersion(backend, mockLogger)

      expect(warnings.length).toBe(0)
    })
  })

  describe('UnsupportedVersionError', () => {
    it('should create error with correct properties', () => {
      const error = new UnsupportedVersionError('old-backend', 1 as PrivacyBackendVersion, 2 as PrivacyBackendVersion)

      expect(error.name).toBe('UnsupportedVersionError')
      expect(error.backendName).toBe('old-backend')
      expect(error.backendVersion).toBe(1)
      expect(error.minSupported).toBe(2)
      expect(error.message).toContain('old-backend')
      expect(error.message).toContain('version 1')
      expect(error.message).toContain('minimum supported version is 2')
    })

    it('should be instanceof Error', () => {
      const error = new UnsupportedVersionError('test', 1 as PrivacyBackendVersion, 2 as PrivacyBackendVersion)

      expect(error instanceof Error).toBe(true)
      expect(error instanceof UnsupportedVersionError).toBe(true)
    })
  })
})

describe('SIPNativeBackend versioning', () => {
  it('should have version 2', () => {
    const backend = new SIPNativeBackend()

    expect(backend.version).toBe(2)
  })

  it('should pass v2 version check', () => {
    const backend = new SIPNativeBackend()

    expect(isV2Backend(backend)).toBe(true)
    expect(backendSupportsVersion(backend, 2)).toBe(true)
  })

  it('should not be deprecated', () => {
    const backend = new SIPNativeBackend()
    const result = validateBackendVersion(backend)

    expect(result.deprecated).toBe(false)
  })
})
