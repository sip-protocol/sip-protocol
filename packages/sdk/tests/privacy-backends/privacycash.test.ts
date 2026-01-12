/**
 * PrivacyCash Backend Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PrivacyCashBackend } from '../../src/privacy-backends/privacycash'
import {
  SOL_POOL_SIZES,
  USDC_POOL_SIZES,
  SPL_TOKEN_MINTS,
  findMatchingPoolSize,
  findNearestPoolSize,
  isValidPoolAmount,
  getAvailablePoolSizes,
  SOL_POOL_AMOUNTS,
  SPL_POOL_AMOUNTS,
} from '../../src/privacy-backends/privacycash-types'
import type { TransferParams } from '../../src/privacy-backends/interface'

describe('PrivacyCashBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new PrivacyCashBackend()

      expect(backend.name).toBe('privacycash')
      expect(backend.type).toBe('transaction')
      expect(backend.chains).toContain('solana')
    })

    it('should accept custom rpcUrl', () => {
      const backend = new PrivacyCashBackend({
        rpcUrl: 'https://custom.rpc.url',
      })

      expect(backend.name).toBe('privacycash')
    })

    it('should accept custom network', () => {
      const backend = new PrivacyCashBackend({
        network: 'devnet',
      })

      expect(backend.name).toBe('privacycash')
    })

    it('should accept custom relayerUrl', () => {
      const backend = new PrivacyCashBackend({
        relayerUrl: 'https://custom.relayer.url',
      })

      expect(backend.name).toBe('privacycash')
    })

    it('should accept custom minAnonymitySet', () => {
      const backend = new PrivacyCashBackend({
        minAnonymitySet: 10,
      })

      expect(backend.name).toBe('privacycash')
    })
  })

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const backend = new PrivacyCashBackend()
      const caps = backend.getCapabilities()

      expect(caps.hiddenAmount).toBe(false) // Pool sizes are fixed/known
      expect(caps.hiddenSender).toBe(true) // Pool mixing hides sender
      expect(caps.hiddenRecipient).toBe(true) // Withdrawal to fresh address
      expect(caps.hiddenCompute).toBe(false) // No compute privacy
      expect(caps.complianceSupport).toBe(false) // No viewing keys
      expect(caps.setupRequired).toBe(false)
      expect(caps.latencyEstimate).toBe('medium')
      expect(caps.supportedTokens).toBe('all')
    })

    it('should have min and max amounts set', () => {
      const backend = new PrivacyCashBackend()
      const caps = backend.getCapabilities()

      expect(caps.minAmount).toBe(SOL_POOL_SIZES.SMALL) // 0.1 SOL
      expect(caps.maxAmount).toBe(SOL_POOL_SIZES.WHALE) // 100 SOL
    })

    it('should have anonymity set', () => {
      const backend = new PrivacyCashBackend()
      const caps = backend.getCapabilities()

      expect(caps.anonymitySet).toBeGreaterThan(0)
    })
  })

  describe('checkAvailability', () => {
    let backend: PrivacyCashBackend

    beforeEach(() => {
      backend = new PrivacyCashBackend()
    })

    it('should be available for SOL with valid pool size', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM, // 1 SOL
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
      expect(result.estimatedCost).toBeDefined()
      expect(result.estimatedTime).toBeDefined()
    })

    it('should be available for 0.1 SOL pool', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.SMALL,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)
      expect(result.available).toBe(true)
    })

    it('should be available for 10 SOL pool', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.LARGE,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)
      expect(result.available).toBe(true)
    })

    it('should be available for 100 SOL pool', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.WHALE,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)
      expect(result.available).toBe(true)
    })

    it('should not be available for unsupported chain', async () => {
      const params: TransferParams = {
        chain: 'ethereum',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 18,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('only supports Solana')
    })

    it('should not be available for invalid pool size', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: BigInt(500_000_000), // 0.5 SOL - not a valid pool
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('must match a pool size')
    })

    it('should suggest nearest pool size when invalid', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: BigInt(1_500_000_000), // 1.5 SOL - not a valid pool
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('Nearest pool')
    })

    it('should reject negative amounts', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: BigInt(-1000),
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('negative')
    })

    it('should be available for USDC with valid pool size', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SPL_TOKEN_MINTS.USDC,
        amount: USDC_POOL_SIZES.MEDIUM, // 100 USDC
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should be available for USDT with valid pool size', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SPL_TOKEN_MINTS.USDT,
        amount: USDC_POOL_SIZES.MEDIUM, // Same pools as USDC
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should not be available for unsupported SPL token', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: 'UnknownTokenMintAddress123456789',
        amount: BigInt(100_000_000),
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('not supported')
    })

    it('should warn but not fail when viewing key is provided', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 9,
        viewingKey: {
          key: '0x1234' as any,
          path: 'm/0',
          hash: '0xabcd' as any,
        },
      }

      const result = await backend.checkAvailability(params)

      // Should still be available, just with a warning
      expect(result.available).toBe(true)
    })
  })

  describe('execute', () => {
    let backend: PrivacyCashBackend

    beforeEach(() => {
      backend = new PrivacyCashBackend()
    })

    it('should execute successfully for valid SOL params', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 9,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.backend).toBe('privacycash')
      expect(result.metadata).toBeDefined()
    })

    it('should include pool info in metadata', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 9,
      }

      const result = await backend.execute(params)

      expect(result.metadata?.poolSize).toBe(SOL_POOL_SIZES.MEDIUM.toString())
      expect(result.metadata?.isSOL).toBe(true)
      expect(result.metadata?.note).toBeDefined()
      expect(result.metadata?.anonymitySet).toBeGreaterThan(0)
    })

    it('should include token info for USDC', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SPL_TOKEN_MINTS.USDC,
        amount: USDC_POOL_SIZES.MEDIUM,
        decimals: 6,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(true)
      expect(result.metadata?.isSOL).toBe(false)
      expect(result.metadata?.token).toBe('USDC')
    })

    it('should fail for unsupported chain', async () => {
      const params: TransferParams = {
        chain: 'ethereum',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 18,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should fail for invalid pool size', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: BigInt(500_000_000),
        decimals: 9,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('estimateCost', () => {
    let backend: PrivacyCashBackend

    beforeEach(() => {
      backend = new PrivacyCashBackend()
    })

    it('should return estimated cost for SOL transfer', async () => {
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 9,
      }

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThan(BigInt(0))
    })

    it('should include relayer fee in cost', async () => {
      const smallParams: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.SMALL, // 0.1 SOL
        decimals: 9,
      }

      const largeParams: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.WHALE, // 100 SOL
        decimals: 9,
      }

      const smallCost = await backend.estimateCost(smallParams)
      const largeCost = await backend.estimateCost(largeParams)

      // Larger transfers should have higher relayer fees
      expect(largeCost).toBeGreaterThan(smallCost)
    })

    it('should have higher cost for SPL tokens', async () => {
      const solParams: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 9,
      }

      const usdcParams: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SPL_TOKEN_MINTS.USDC,
        amount: USDC_POOL_SIZES.MEDIUM,
        decimals: 6,
      }

      const solCost = await backend.estimateCost(solParams)
      const usdcCost = await backend.estimateCost(usdcParams)

      // SPL tokens have additional account rent
      expect(usdcCost).toBeGreaterThan(solCost)
    })
  })

  describe('pool cache', () => {
    it('should cache pool info', async () => {
      const backend = new PrivacyCashBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: SOL_POOL_SIZES.MEDIUM,
        decimals: 9,
      }

      // First call should fetch pool info
      await backend.checkAvailability(params)
      // Second call should use cache
      await backend.checkAvailability(params)

      // No way to directly verify caching, but we can verify it still works
      const result = await backend.checkAvailability(params)
      expect(result.available).toBe(true)
    })

    it('should allow clearing pool cache', () => {
      const backend = new PrivacyCashBackend()

      // This should not throw
      expect(() => backend.clearPoolCache()).not.toThrow()
    })
  })

  describe('PrivacyBackend interface compliance', () => {
    it('should implement all required properties', () => {
      const backend = new PrivacyCashBackend()

      expect(typeof backend.name).toBe('string')
      expect(backend.name.length).toBeGreaterThan(0)
      expect(['transaction', 'compute', 'both']).toContain(backend.type)
      expect(Array.isArray(backend.chains)).toBe(true)
    })

    it('should implement all required methods', () => {
      const backend = new PrivacyCashBackend()

      expect(typeof backend.checkAvailability).toBe('function')
      expect(typeof backend.getCapabilities).toBe('function')
      expect(typeof backend.execute).toBe('function')
      expect(typeof backend.estimateCost).toBe('function')
    })
  })
})

// ─── Helper Function Tests ───────────────────────────────────────────────────

describe('PrivacyCash Helper Functions', () => {
  describe('findMatchingPoolSize', () => {
    it('should find exact SOL pool matches', () => {
      expect(findMatchingPoolSize(SOL_POOL_SIZES.SMALL, true)).toBe(SOL_POOL_SIZES.SMALL)
      expect(findMatchingPoolSize(SOL_POOL_SIZES.MEDIUM, true)).toBe(SOL_POOL_SIZES.MEDIUM)
      expect(findMatchingPoolSize(SOL_POOL_SIZES.LARGE, true)).toBe(SOL_POOL_SIZES.LARGE)
      expect(findMatchingPoolSize(SOL_POOL_SIZES.WHALE, true)).toBe(SOL_POOL_SIZES.WHALE)
    })

    it('should find exact SPL pool matches', () => {
      expect(findMatchingPoolSize(USDC_POOL_SIZES.SMALL, false)).toBe(USDC_POOL_SIZES.SMALL)
      expect(findMatchingPoolSize(USDC_POOL_SIZES.MEDIUM, false)).toBe(USDC_POOL_SIZES.MEDIUM)
      expect(findMatchingPoolSize(USDC_POOL_SIZES.LARGE, false)).toBe(USDC_POOL_SIZES.LARGE)
      expect(findMatchingPoolSize(USDC_POOL_SIZES.WHALE, false)).toBe(USDC_POOL_SIZES.WHALE)
    })

    it('should return undefined for non-matching amounts', () => {
      expect(findMatchingPoolSize(BigInt(500_000_000), true)).toBeUndefined()
      expect(findMatchingPoolSize(BigInt(1), true)).toBeUndefined()
      expect(findMatchingPoolSize(BigInt(99_000_000), true)).toBeUndefined()
    })
  })

  describe('findNearestPoolSize', () => {
    it('should find nearest SOL pool', () => {
      // Closer to 0.1 SOL (0.05 SOL -> 0.1 SOL)
      expect(findNearestPoolSize(BigInt(50_000_000), true)).toBe(SOL_POOL_SIZES.SMALL)
      // 0.5 SOL is closer to 0.1 SOL (diff=0.4) than 1 SOL (diff=0.5)
      expect(findNearestPoolSize(BigInt(500_000_000), true)).toBe(SOL_POOL_SIZES.SMALL)
      // 0.6 SOL is closer to 1 SOL (diff=0.4) than 0.1 SOL (diff=0.5)
      expect(findNearestPoolSize(BigInt(600_000_000), true)).toBe(SOL_POOL_SIZES.MEDIUM)
      // 5 SOL is closer to 1 SOL (diff=4) than 10 SOL (diff=5)
      expect(findNearestPoolSize(BigInt(5_000_000_000), true)).toBe(SOL_POOL_SIZES.MEDIUM)
      // 6 SOL is closer to 10 SOL (diff=4) than 1 SOL (diff=5)
      expect(findNearestPoolSize(BigInt(6_000_000_000), true)).toBe(SOL_POOL_SIZES.LARGE)
      // 50 SOL is closer to 10 SOL (diff=40) than 100 SOL (diff=50)
      expect(findNearestPoolSize(BigInt(50_000_000_000), true)).toBe(SOL_POOL_SIZES.LARGE)
      // 60 SOL is closer to 100 SOL (diff=40) than 10 SOL (diff=50)
      expect(findNearestPoolSize(BigInt(60_000_000_000), true)).toBe(SOL_POOL_SIZES.WHALE)
    })

    it('should return exact match for valid pools', () => {
      expect(findNearestPoolSize(SOL_POOL_SIZES.MEDIUM, true)).toBe(SOL_POOL_SIZES.MEDIUM)
    })

    it('should handle edge cases', () => {
      // Very small amount
      expect(findNearestPoolSize(BigInt(1), true)).toBe(SOL_POOL_SIZES.SMALL)
      // Very large amount
      expect(findNearestPoolSize(BigInt(1_000_000_000_000), true)).toBe(SOL_POOL_SIZES.WHALE)
    })
  })

  describe('isValidPoolAmount', () => {
    it('should validate SOL pool amounts', () => {
      expect(isValidPoolAmount(SOL_POOL_SIZES.SMALL, true)).toBe(true)
      expect(isValidPoolAmount(SOL_POOL_SIZES.MEDIUM, true)).toBe(true)
      expect(isValidPoolAmount(SOL_POOL_SIZES.LARGE, true)).toBe(true)
      expect(isValidPoolAmount(SOL_POOL_SIZES.WHALE, true)).toBe(true)
    })

    it('should reject invalid SOL amounts', () => {
      expect(isValidPoolAmount(BigInt(500_000_000), true)).toBe(false)
      expect(isValidPoolAmount(BigInt(0), true)).toBe(false)
      expect(isValidPoolAmount(BigInt(1), true)).toBe(false)
    })

    it('should validate SPL pool amounts', () => {
      expect(isValidPoolAmount(USDC_POOL_SIZES.SMALL, false)).toBe(true)
      expect(isValidPoolAmount(USDC_POOL_SIZES.MEDIUM, false)).toBe(true)
      expect(isValidPoolAmount(USDC_POOL_SIZES.LARGE, false)).toBe(true)
      expect(isValidPoolAmount(USDC_POOL_SIZES.WHALE, false)).toBe(true)
    })
  })

  describe('getAvailablePoolSizes', () => {
    it('should return SOL pool sizes', () => {
      const pools = getAvailablePoolSizes(true)

      expect(pools).toHaveLength(4)
      expect(pools).toContain(SOL_POOL_SIZES.SMALL)
      expect(pools).toContain(SOL_POOL_SIZES.MEDIUM)
      expect(pools).toContain(SOL_POOL_SIZES.LARGE)
      expect(pools).toContain(SOL_POOL_SIZES.WHALE)
    })

    it('should return SPL pool sizes', () => {
      const pools = getAvailablePoolSizes(false)

      expect(pools).toHaveLength(4)
      expect(pools).toContain(USDC_POOL_SIZES.SMALL)
      expect(pools).toContain(USDC_POOL_SIZES.MEDIUM)
      expect(pools).toContain(USDC_POOL_SIZES.LARGE)
      expect(pools).toContain(USDC_POOL_SIZES.WHALE)
    })
  })
})

// ─── Pool Constants Tests ────────────────────────────────────────────────────

describe('PrivacyCash Constants', () => {
  describe('SOL_POOL_SIZES', () => {
    it('should have correct values', () => {
      expect(SOL_POOL_SIZES.SMALL).toBe(BigInt(100_000_000)) // 0.1 SOL
      expect(SOL_POOL_SIZES.MEDIUM).toBe(BigInt(1_000_000_000)) // 1 SOL
      expect(SOL_POOL_SIZES.LARGE).toBe(BigInt(10_000_000_000)) // 10 SOL
      expect(SOL_POOL_SIZES.WHALE).toBe(BigInt(100_000_000_000)) // 100 SOL
    })
  })

  describe('USDC_POOL_SIZES', () => {
    it('should have correct values', () => {
      expect(USDC_POOL_SIZES.SMALL).toBe(BigInt(10_000_000)) // 10 USDC
      expect(USDC_POOL_SIZES.MEDIUM).toBe(BigInt(100_000_000)) // 100 USDC
      expect(USDC_POOL_SIZES.LARGE).toBe(BigInt(1_000_000_000)) // 1,000 USDC
      expect(USDC_POOL_SIZES.WHALE).toBe(BigInt(10_000_000_000)) // 10,000 USDC
    })
  })

  describe('SPL_TOKEN_MINTS', () => {
    it('should have correct USDC mint', () => {
      expect(SPL_TOKEN_MINTS.USDC).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    })

    it('should have correct USDT mint', () => {
      expect(SPL_TOKEN_MINTS.USDT).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
    })
  })

  describe('SOL_POOL_AMOUNTS array', () => {
    it('should be sorted ascending', () => {
      for (let i = 1; i < SOL_POOL_AMOUNTS.length; i++) {
        expect(SOL_POOL_AMOUNTS[i]).toBeGreaterThan(SOL_POOL_AMOUNTS[i - 1])
      }
    })

    it('should contain all pool sizes', () => {
      expect(SOL_POOL_AMOUNTS).toContain(SOL_POOL_SIZES.SMALL)
      expect(SOL_POOL_AMOUNTS).toContain(SOL_POOL_SIZES.MEDIUM)
      expect(SOL_POOL_AMOUNTS).toContain(SOL_POOL_SIZES.LARGE)
      expect(SOL_POOL_AMOUNTS).toContain(SOL_POOL_SIZES.WHALE)
    })
  })

  describe('SPL_POOL_AMOUNTS array', () => {
    it('should be sorted ascending', () => {
      for (let i = 1; i < SPL_POOL_AMOUNTS.length; i++) {
        expect(SPL_POOL_AMOUNTS[i]).toBeGreaterThan(SPL_POOL_AMOUNTS[i - 1])
      }
    })

    it('should contain all pool sizes', () => {
      expect(SPL_POOL_AMOUNTS).toContain(USDC_POOL_SIZES.SMALL)
      expect(SPL_POOL_AMOUNTS).toContain(USDC_POOL_SIZES.MEDIUM)
      expect(SPL_POOL_AMOUNTS).toContain(USDC_POOL_SIZES.LARGE)
      expect(SPL_POOL_AMOUNTS).toContain(USDC_POOL_SIZES.WHALE)
    })
  })
})

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('PrivacyCash Integration', () => {
  describe('registry integration', () => {
    it('should be registerable in PrivacyBackendRegistry', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new PrivacyCashBackend()

      registry.register(backend)

      expect(registry.get('privacycash')).toBe(backend)
    })

    it('should be findable by chain', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new PrivacyCashBackend()

      registry.register(backend)

      const solanaBackends = registry.getByChain('solana')
      expect(solanaBackends).toContain(backend)
    })

    it('should be findable by type', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new PrivacyCashBackend()

      registry.register(backend)

      const transactionBackends = registry.getByType('transaction')
      expect(transactionBackends).toContain(backend)
    })

    it('should not appear in compliant backends', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new PrivacyCashBackend()

      registry.register(backend)

      const compliantBackends = registry.getCompliant()
      expect(compliantBackends).not.toContain(backend)
    })
  })

  describe('comparison with SIPNative', () => {
    it('should have different capabilities than SIPNative', async () => {
      const { SIPNativeBackend } = await import('../../src/privacy-backends/sip-native')

      const privacyCash = new PrivacyCashBackend()
      const sipNative = new SIPNativeBackend()

      const pcCaps = privacyCash.getCapabilities()
      const snCaps = sipNative.getCapabilities()

      // PrivacyCash doesn't hide amounts (fixed pools)
      expect(pcCaps.hiddenAmount).toBe(false)
      expect(snCaps.hiddenAmount).toBe(true)

      // PrivacyCash doesn't support compliance (no viewing keys)
      expect(pcCaps.complianceSupport).toBe(false)
      expect(snCaps.complianceSupport).toBe(true)

      // PrivacyCash has anonymity set
      expect(pcCaps.anonymitySet).toBeDefined()
      expect(pcCaps.anonymitySet).toBeGreaterThan(0)

      // PrivacyCash is medium latency (pool mixing)
      expect(pcCaps.latencyEstimate).toBe('medium')
      expect(snCaps.latencyEstimate).toBe('fast')
    })
  })
})
