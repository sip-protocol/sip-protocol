/**
 * CLI Integration Tests
 *
 * Tests that verify command execution with SDK integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as sdk from '@sip-protocol/sdk'

// Mock process.exit to prevent test termination
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`Process.exit(${code})`)
})

// Suppress console output during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SDK Integration', () => {
  describe('Stealth Address Generation', () => {
    it('should generate secp256k1 meta-address for ethereum', () => {
      const result = sdk.generateStealthMetaAddress('ethereum')

      expect(result).toBeDefined()
      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('ethereum')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]+$/i)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]+$/i)
      expect(result.spendingPrivateKey).toMatch(/^0x[0-9a-f]+$/i)
      expect(result.viewingPrivateKey).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should generate ed25519 meta-address for solana', () => {
      const result = sdk.generateEd25519StealthMetaAddress('solana')

      expect(result).toBeDefined()
      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('solana')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]+$/i)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should generate ed25519 meta-address for near', () => {
      const result = sdk.generateEd25519StealthMetaAddress('near')

      expect(result).toBeDefined()
      expect(result.metaAddress.chain).toBe('near')
    })

    it('should encode meta-address to SIP format', () => {
      const result = sdk.generateStealthMetaAddress('ethereum')
      const encoded = sdk.encodeStealthMetaAddress(result.metaAddress)

      expect(encoded).toMatch(/^sip:ethereum:0x[0-9a-f]+:0x[0-9a-f]+$/i)
    })
  })

  describe('Commitment Operations', () => {
    it('should create commitment for amount', () => {
      const amount = 1000n
      const result = sdk.commit(amount)

      expect(result).toBeDefined()
      expect(result.commitment).toMatch(/^0x[0-9a-f]+$/i)
      expect(result.blinding).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should verify commitment opening', () => {
      const amount = 1000n
      const result = sdk.commit(amount)

      const isValid = sdk.verifyOpening(result.commitment, amount, result.blinding)
      expect(isValid).toBe(true)
    })

    it('should reject wrong amount', () => {
      const amount = 1000n
      const wrongAmount = 999n
      const result = sdk.commit(amount)

      const isValid = sdk.verifyOpening(result.commitment, wrongAmount, result.blinding)
      expect(isValid).toBe(false)
    })

    it('should create unique commitments for same amount', () => {
      const amount = 1000n
      const result1 = sdk.commit(amount)
      const result2 = sdk.commit(amount)

      expect(result1.commitment).not.toBe(result2.commitment)
      expect(result1.blinding).not.toBe(result2.blinding)
    })
  })

  describe('Chain Detection', () => {
    it('should detect ed25519 chains', () => {
      expect(sdk.isEd25519Chain('solana')).toBe(true)
      expect(sdk.isEd25519Chain('near')).toBe(true)
      expect(sdk.isEd25519Chain('aptos')).toBe(true)
      expect(sdk.isEd25519Chain('sui')).toBe(true)
    })

    it('should detect secp256k1 chains', () => {
      expect(sdk.isEd25519Chain('ethereum')).toBe(false)
      expect(sdk.isEd25519Chain('polygon')).toBe(false)
      expect(sdk.isEd25519Chain('arbitrum')).toBe(false)
    })
  })
})
