/**
 * SIP Native Backend Tests
 */

import { describe, it, expect } from 'vitest'
import { SIPNativeBackend } from '../../src/privacy-backends/sip-native'
import type { TransferParams } from '../../src/privacy-backends/interface'

describe('SIPNativeBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new SIPNativeBackend()

      expect(backend.name).toBe('sip-native')
      expect(backend.type).toBe('transaction')
      expect(backend.chains).toContain('solana')
      expect(backend.chains).toContain('ethereum')
    })

    it('should accept custom chains', () => {
      const backend = new SIPNativeBackend({
        chains: ['solana', 'near'],
      })

      expect(backend.chains).toEqual(['solana', 'near'])
    })

    it('should accept custom config options', () => {
      const backend = new SIPNativeBackend({
        requireViewingKey: true,
        minAmount: 1000n,
        maxAmount: 1000000n,
      })

      const caps = backend.getCapabilities()
      expect(caps.minAmount).toBe(1000n)
      expect(caps.maxAmount).toBe(1000000n)
    })
  })

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const backend = new SIPNativeBackend()
      const caps = backend.getCapabilities()

      expect(caps.hiddenAmount).toBe(true)
      expect(caps.hiddenSender).toBe(true)
      expect(caps.hiddenRecipient).toBe(true)
      expect(caps.hiddenCompute).toBe(false)
      expect(caps.complianceSupport).toBe(true)
      expect(caps.setupRequired).toBe(false)
      expect(caps.latencyEstimate).toBe('fast')
      expect(caps.supportedTokens).toBe('all')
    })

    it('should include custom min/max amounts', () => {
      const backend = new SIPNativeBackend({
        minAmount: 100n,
        maxAmount: 10000n,
      })

      const caps = backend.getCapabilities()
      expect(caps.minAmount).toBe(100n)
      expect(caps.maxAmount).toBe(10000n)
    })
  })

  describe('checkAvailability', () => {
    it('should be available for supported chain', async () => {
      const backend = new SIPNativeBackend()
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
      expect(result.estimatedCost).toBeDefined()
      expect(result.estimatedTime).toBeDefined()
    })

    it('should not be available for unsupported chain', async () => {
      const backend = new SIPNativeBackend({ chains: ['solana'] })
      const params: TransferParams = {
        chain: 'bitcoin',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 8,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('not supported')
    })

    it('should require viewing key when configured', async () => {
      const backend = new SIPNativeBackend({ requireViewingKey: true })
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('Viewing key required')
    })

    it('should be available with viewing key when required', async () => {
      const backend = new SIPNativeBackend({ requireViewingKey: true })
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
        viewingKey: {
          key: '0x1234' as any,
          path: 'm/0',
          hash: '0xabcd' as any,
        },
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should reject amount below minimum', async () => {
      const backend = new SIPNativeBackend({ minAmount: 1000n })
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 500n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('below minimum')
    })

    it('should reject amount above maximum', async () => {
      const backend = new SIPNativeBackend({ maxAmount: 10000n })
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 50000n,
        decimals: 9,
      }

      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('above maximum')
    })
  })

  describe('execute', () => {
    it('should execute successfully for valid params', async () => {
      const backend = new SIPNativeBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.backend).toBe('sip-native')
      expect(result.metadata).toBeDefined()
    })

    it('should fail for unavailable params', async () => {
      const backend = new SIPNativeBackend({ chains: ['solana'] })
      const params: TransferParams = {
        chain: 'bitcoin',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 8,
      }

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should include viewing key status in metadata', async () => {
      const backend = new SIPNativeBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
        viewingKey: {
          key: '0x1234' as any,
          path: 'm/0',
          hash: '0xabcd' as any,
        },
      }

      const result = await backend.execute(params)

      expect(result.metadata?.hasViewingKey).toBe(true)
    })
  })

  describe('estimateCost', () => {
    it('should return estimated cost for Solana', async () => {
      const backend = new SIPNativeBackend()
      const params: TransferParams = {
        chain: 'solana',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const cost = await backend.estimateCost(params)

      expect(cost).toBe(5000n) // Solana cost
    })

    it('should return estimated cost for Ethereum', async () => {
      const backend = new SIPNativeBackend()
      const params: TransferParams = {
        chain: 'ethereum',
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 18,
      }

      const cost = await backend.estimateCost(params)

      expect(cost).toBe(50000000000000n) // Ethereum cost
    })

    it('should return 0 for unknown chain', async () => {
      const backend = new SIPNativeBackend({ chains: ['unknown' as any] })
      const params: TransferParams = {
        chain: 'unknown' as any,
        sender: 'sender',
        recipient: 'recipient',
        mint: null,
        amount: 1000n,
        decimals: 9,
      }

      const cost = await backend.estimateCost(params)

      expect(cost).toBe(0n)
    })
  })

  describe('PrivacyBackend interface compliance', () => {
    it('should implement all required properties', () => {
      const backend = new SIPNativeBackend()

      expect(typeof backend.name).toBe('string')
      expect(backend.name.length).toBeGreaterThan(0)
      expect(['transaction', 'compute', 'both']).toContain(backend.type)
      expect(Array.isArray(backend.chains)).toBe(true)
    })

    it('should implement all required methods', () => {
      const backend = new SIPNativeBackend()

      expect(typeof backend.checkAvailability).toBe('function')
      expect(typeof backend.getCapabilities).toBe('function')
      expect(typeof backend.execute).toBe('function')
      expect(typeof backend.estimateCost).toBe('function')
    })
  })
})
