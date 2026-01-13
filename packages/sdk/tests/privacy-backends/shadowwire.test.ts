/**
 * ShadowWire Backend Tests
 *
 * Tests for the ShadowWire privacy backend integration.
 * Note: Tests that require actual ShadowWire API calls are skipped.
 * For integration tests, use a real ShadowWire environment.
 */

import { describe, it, expect } from 'vitest'
import { ShadowWireBackend, createShadowWireBackend, SHADOWWIRE_TOKEN_MINTS } from '../../src/privacy-backends/shadowwire'
import type { TransferParams } from '../../src/privacy-backends/interface'

describe('ShadowWireBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new ShadowWireBackend()

      expect(backend.name).toBe('shadowwire')
      expect(backend.type).toBe('transaction')
      expect(backend.chains).toContain('solana')
    })

    it('should only support Solana', () => {
      const backend = new ShadowWireBackend()

      expect(backend.chains).toEqual(['solana'])
    })

    it('should accept custom configuration', () => {
      const backend = new ShadowWireBackend({
        debug: true,
        defaultTransferType: 'external',
        apiBaseUrl: 'https://custom.api.com',
      })

      expect(backend.name).toBe('shadowwire')
    })
  })

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const backend = new ShadowWireBackend()
      const caps = backend.getCapabilities()

      expect(caps.hiddenAmount).toBe(true)
      expect(caps.hiddenSender).toBe(true)
      expect(caps.hiddenRecipient).toBe(true)
      expect(caps.hiddenCompute).toBe(false)
      expect(caps.complianceSupport).toBe(true)
      expect(caps.setupRequired).toBe(false)
      expect(caps.latencyEstimate).toBe('medium')
      expect(caps.supportedTokens).toBe('spl')
    })

    it('should have minimum amount of 1', () => {
      const backend = new ShadowWireBackend()
      const caps = backend.getCapabilities()

      expect(caps.minAmount).toBe(1n)
    })

    it('should return a copy of capabilities', () => {
      const backend = new ShadowWireBackend()
      const caps1 = backend.getCapabilities()
      const caps2 = backend.getCapabilities()

      expect(caps1).not.toBe(caps2)
      expect(caps1).toEqual(caps2)
    })
  })

  describe('checkAvailability', () => {
    it('should be available for supported chain and SOL token', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender-address',
        recipient: 'recipient-address',
        mint: SHADOWWIRE_TOKEN_MINTS.SOL,
        amount: 1000000n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
      expect(result.estimatedCost).toBeDefined()
      expect(result.estimatedTime).toBeDefined()
    })

    it('should be available for USDC token', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.USDC,
        amount: 1000n,
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should be available for RADR token', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.RADR,
        amount: 1000n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should not be available for unsupported chain', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'ethereum',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 18,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('not supported')
    })

    it('should not be available for unsupported token', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: 'unsupported-token-mint-address',
        amount: 1000n,
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('not supported')
    })

    it('should reject zero amount', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.SOL,
        amount: 0n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('greater than 0')
    })

    it('should reject negative amount', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.SOL,
        amount: -100n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('greater than 0')
    })

    it('should treat null mint as SOL', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should be unavailable for compute operations', async () => {
      const backend = new ShadowWireBackend()
      const params = {
        operation: 'compute' as const,
        inputs: [],
        circuit: 'test',
      }

      const result = await backend.checkAvailability(params as any)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('transfer operations')
    })
  })

  describe('execute', () => {
    it('should fail without wallet', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.SOL,
        amount: 1000n,
        decimals: 9,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Wallet adapter required')
      expect(result.backend).toBe('shadowwire')
    })

    it('should fail for unsupported chain', async () => {
      const mockWallet = {
        signMessage: async () => new Uint8Array(64),
      }
      const backend = new ShadowWireBackend({ wallet: mockWallet })
      const params: TransferParams = {
        chain: 'ethereum',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 18,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.backend).toBe('shadowwire')
    })

    it('should fail for unsupported token', async () => {
      const mockWallet = {
        signMessage: async () => new Uint8Array(64),
      }
      const backend = new ShadowWireBackend({ wallet: mockWallet })
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: 'unsupported-token-address',
        amount: 1000n,
        decimals: 6,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('estimateCost', () => {
    it('should return cost for transfer', async () => {
      const backend = new ShadowWireBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.SOL,
        amount: 1000n,
        decimals: 9,
      }

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThan(0n)
    })

    it('should return 0 for non-transfer params', async () => {
      const backend = new ShadowWireBackend()
      const params = {
        operation: 'compute',
        inputs: [],
      }

      const cost = await backend.estimateCost(params as any)

      expect(cost).toBe(0n)
    })

    it('should return higher cost for internal transfers', async () => {
      const backend = new ShadowWireBackend({ defaultTransferType: 'internal' })
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: SHADOWWIRE_TOKEN_MINTS.SOL,
        amount: 1000n,
        decimals: 9,
      }

      const cost = await backend.estimateCost(params)

      // Internal transfers should have additional ZK proof verification cost
      expect(cost).toBeGreaterThan(5000n)
    })
  })

  describe('setWallet', () => {
    it('should allow setting wallet after construction', () => {
      const backend = new ShadowWireBackend()
      const mockWallet = {
        signMessage: async () => new Uint8Array(64),
      }

      // Should not throw
      expect(() => backend.setWallet(mockWallet)).not.toThrow()
    })
  })

  describe('getClient', () => {
    it('should return the underlying ShadowWire client', () => {
      const backend = new ShadowWireBackend()

      const client = backend.getClient()

      expect(client).toBeDefined()
    })
  })

  describe('PrivacyBackend interface compliance', () => {
    it('should implement all required properties', () => {
      const backend = new ShadowWireBackend()

      expect(typeof backend.name).toBe('string')
      expect(backend.name.length).toBeGreaterThan(0)
      expect(['transaction', 'compute', 'both']).toContain(backend.type)
      expect(Array.isArray(backend.chains)).toBe(true)
    })

    it('should implement all required methods', () => {
      const backend = new ShadowWireBackend()

      expect(typeof backend.checkAvailability).toBe('function')
      expect(typeof backend.getCapabilities).toBe('function')
      expect(typeof backend.execute).toBe('function')
      expect(typeof backend.estimateCost).toBe('function')
    })
  })
})

describe('createShadowWireBackend', () => {
  it('should create backend with default config', () => {
    const backend = createShadowWireBackend()

    expect(backend).toBeInstanceOf(ShadowWireBackend)
    expect(backend.name).toBe('shadowwire')
  })

  it('should create backend with custom config', () => {
    const backend = createShadowWireBackend({
      debug: true,
      defaultTransferType: 'external',
    })

    expect(backend).toBeInstanceOf(ShadowWireBackend)
  })
})

describe('SHADOWWIRE_TOKEN_MINTS', () => {
  it('should have SOL mint address', () => {
    expect(SHADOWWIRE_TOKEN_MINTS.SOL).toBe('So11111111111111111111111111111111111111112')
  })

  it('should have USDC mint address', () => {
    expect(SHADOWWIRE_TOKEN_MINTS.USDC).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('should have RADR mint address', () => {
    expect(SHADOWWIRE_TOKEN_MINTS.RADR).toBe('RADRi35VqLmMu4t7Gax1KVszxnQnbtqEwJQJVfzpump')
  })

  it('should have BONK mint address', () => {
    expect(SHADOWWIRE_TOKEN_MINTS.BONK).toBe('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
  })

  it('should have ORE mint address', () => {
    expect(SHADOWWIRE_TOKEN_MINTS.ORE).toBeDefined()
  })

  it('should have all supported token symbols', () => {
    const symbols = Object.keys(SHADOWWIRE_TOKEN_MINTS)
    expect(symbols).toContain('SOL')
    expect(symbols).toContain('USDC')
    expect(symbols).toContain('RADR')
    expect(symbols).toContain('BONK')
    expect(symbols).toContain('ORE')
  })
})
