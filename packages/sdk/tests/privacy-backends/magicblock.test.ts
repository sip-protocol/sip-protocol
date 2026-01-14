/**
 * MagicBlock Backend Tests
 *
 * Tests for the MagicBlock TEE-based privacy backend integration.
 * Note: Tests that require actual TEE API calls are skipped.
 * For integration tests, use a real MagicBlock devnet environment.
 */

import { describe, it, expect } from 'vitest'
import { MagicBlockBackend, createMagicBlockBackend, MAGICBLOCK_ENDPOINTS } from '../../src/privacy-backends/magicblock'
import type { TransferParams } from '../../src/privacy-backends/interface'

describe('MagicBlockBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new MagicBlockBackend()

      expect(backend.name).toBe('magicblock')
      expect(backend.type).toBe('both') // Supports transfer and compute
      expect(backend.chains).toContain('solana')
    })

    it('should only support Solana', () => {
      const backend = new MagicBlockBackend()

      expect(backend.chains).toEqual(['solana'])
    })

    it('should accept custom network configuration', () => {
      const backend = new MagicBlockBackend({
        network: 'mainnet-beta',
        region: 'us', // Only mainnet-us exists currently
      })

      expect(backend.name).toBe('magicblock')
    })

    it('should accept debug flag', () => {
      const backend = new MagicBlockBackend({
        debug: true,
      })

      expect(backend.name).toBe('magicblock')
    })

    // ─── Network Validation Tests ─────────────────────────────────────────────

    it('should throw on invalid network', () => {
      expect(() => {
        new MagicBlockBackend({
          // @ts-expect-error - Testing invalid network value
          network: 'invalid-network',
        })
      }).toThrow("Invalid MagicBlock network 'invalid-network'")
    })

    it('should include valid networks in error message', () => {
      expect(() => {
        new MagicBlockBackend({
          // @ts-expect-error - Testing invalid network value
          network: 'testnet',
        })
      }).toThrow('Valid networks: devnet, mainnet-beta')
    })

    it('should accept all valid networks', () => {
      const validNetworks = ['devnet', 'mainnet-beta'] as const
      for (const network of validNetworks) {
        const backend = new MagicBlockBackend({ network })
        expect(backend.name).toBe('magicblock')
      }
    })
  })

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const backend = new MagicBlockBackend()
      const caps = backend.getCapabilities()

      expect(caps.hiddenAmount).toBe(true)
      expect(caps.hiddenSender).toBe(true)
      expect(caps.hiddenRecipient).toBe(true)
      expect(caps.hiddenCompute).toBe(true) // TEE hides computation
      expect(caps.complianceSupport).toBe(true) // SIP adds viewing keys
      expect(caps.setupRequired).toBe(true) // Requires delegation
      expect(caps.latencyEstimate).toBe('fast')
      expect(caps.supportedTokens).toBe('spl')
    })

    it('should have minimum amount of 1', () => {
      const backend = new MagicBlockBackend()
      const caps = backend.getCapabilities()

      expect(caps.minAmount).toBe(1n)
    })

    it('should return a copy of capabilities', () => {
      const backend = new MagicBlockBackend()
      const caps1 = backend.getCapabilities()
      const caps2 = backend.getCapabilities()

      expect(caps1).not.toBe(caps2)
      expect(caps1).toEqual(caps2)
    })
  })

  describe('checkAvailability', () => {
    it('should not be available for unsupported chain', async () => {
      const backend = new MagicBlockBackend()
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

    it('should reject zero amount', async () => {
      const backend = new MagicBlockBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: 'some-mint-address',
        amount: 0n,
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('greater than 0')
    })

    it('should reject negative amount', async () => {
      const backend = new MagicBlockBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: 'some-mint-address',
        amount: -100n,
        decimals: 6,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('greater than 0')
    })

    it('should be available for compute operations', async () => {
      const backend = new MagicBlockBackend()
      const params = {
        operation: 'compute' as const,
        inputs: [],
        circuit: 'test',
      }

      const result = await backend.checkAvailability(params as any)

      expect(result.available).toBe(true)
      expect(result.estimatedTime).toBeDefined()
    })
  })

  describe('execute', () => {
    it('should fail without wallet', async () => {
      const backend = new MagicBlockBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender-address',
        recipient: 'recipient-address',
        mint: 'some-mint-address',
        amount: 1000n,
        decimals: 6,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Wallet keypair required')
      expect(result.backend).toBe('magicblock')
    })

    it('should fail for unsupported chain', async () => {
      const backend = new MagicBlockBackend()
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
      expect(result.backend).toBe('magicblock')
    })

    it('should fail for native SOL (no mint)', async () => {
      const backend = new MagicBlockBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender-address',
        recipient: 'recipient-address',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Native SOL transfers not yet supported')
    })
  })

  describe('estimateCost', () => {
    it('should return cost for transfer', async () => {
      const backend = new MagicBlockBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: 'some-mint-address',
        amount: 1000n,
        decimals: 6,
      }

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThan(0n)
    })

    it('should return cost for compute operations', async () => {
      const backend = new MagicBlockBackend()
      const params = {
        operation: 'compute',
        inputs: [],
      }

      const cost = await backend.estimateCost(params as any)

      expect(cost).toBe(10000n) // Base cost for compute
    })
  })

  describe('deriveEphemeralAta', () => {
    it('should derive ephemeral ATA address', () => {
      const backend = new MagicBlockBackend()

      const [address, bump] = backend.deriveEphemeralAta(
        'FWUhwfDNjb8KX5VJyVxZCpGqHYRjNPVB1o4pJJwrWZ8C',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      )

      expect(address).toBeDefined()
      expect(typeof address).toBe('string')
      expect(typeof bump).toBe('number')
      expect(bump).toBeGreaterThanOrEqual(0)
      expect(bump).toBeLessThanOrEqual(255)
    })
  })

  describe('setWallet', () => {
    it('should allow setting wallet after construction', () => {
      const backend = new MagicBlockBackend()

      // Should not throw
      expect(() => {
        // Can't easily create a Keypair in test without fs access
        // Just verify the method exists
        expect(typeof backend.setWallet).toBe('function')
      }).not.toThrow()
    })
  })

  describe('getConnections', () => {
    it('should return connection objects', () => {
      const backend = new MagicBlockBackend()

      const { connection, magicRouter } = backend.getConnections()

      expect(connection).toBeDefined()
      expect(magicRouter).toBeDefined()
    })
  })

  describe('PrivacyBackend interface compliance', () => {
    it('should implement all required properties', () => {
      const backend = new MagicBlockBackend()

      expect(typeof backend.name).toBe('string')
      expect(backend.name.length).toBeGreaterThan(0)
      expect(['transaction', 'compute', 'both']).toContain(backend.type)
      expect(Array.isArray(backend.chains)).toBe(true)
    })

    it('should implement all required methods', () => {
      const backend = new MagicBlockBackend()

      expect(typeof backend.checkAvailability).toBe('function')
      expect(typeof backend.getCapabilities).toBe('function')
      expect(typeof backend.execute).toBe('function')
      expect(typeof backend.estimateCost).toBe('function')
    })
  })
})

describe('createMagicBlockBackend', () => {
  it('should create backend with default config', () => {
    const backend = createMagicBlockBackend()

    expect(backend).toBeInstanceOf(MagicBlockBackend)
    expect(backend.name).toBe('magicblock')
  })

  it('should create backend with custom config', () => {
    const backend = createMagicBlockBackend({
      network: 'devnet',
      region: 'asia',
      debug: true,
    })

    expect(backend).toBeInstanceOf(MagicBlockBackend)
  })
})

describe('MAGICBLOCK_ENDPOINTS', () => {
  it('should have devnet-us endpoint', () => {
    expect(MAGICBLOCK_ENDPOINTS['devnet-us']).toBe('https://devnet-us.magicblock.app')
  })

  it('should have devnet-eu endpoint', () => {
    expect(MAGICBLOCK_ENDPOINTS['devnet-eu']).toBe('https://devnet-eu.magicblock.app')
  })

  it('should have devnet-asia endpoint', () => {
    expect(MAGICBLOCK_ENDPOINTS['devnet-asia']).toBe('https://devnet-as.magicblock.app')
  })

  it('should have mainnet-us endpoint', () => {
    expect(MAGICBLOCK_ENDPOINTS['mainnet-us']).toBe('https://mainnet-us.magicblock.app')
  })

  it('should have all required regions', () => {
    expect(Object.keys(MAGICBLOCK_ENDPOINTS)).toContain('devnet-us')
    expect(Object.keys(MAGICBLOCK_ENDPOINTS)).toContain('devnet-eu')
    expect(Object.keys(MAGICBLOCK_ENDPOINTS)).toContain('devnet-asia')
  })
})
