/**
 * Mock Proof Provider Tests
 *
 * Tests for the MockProofProvider used in development/testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MockProofProvider } from '../../src/proofs/mock'
import type { ZKProof, HexString } from '@sip-protocol/types'

describe('MockProofProvider', () => {
  let provider: MockProofProvider

  beforeEach(() => {
    provider = new MockProofProvider()
  })

  describe('initialization', () => {
    it('should not be ready before initialization', () => {
      expect(provider.isReady).toBe(false)
    })

    it('should be ready after initialization', async () => {
      // Suppress console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await provider.initialize()

      expect(provider.isReady).toBe(true)
      warnSpy.mockRestore()
    })

    it('should have framework set to mock', () => {
      expect(provider.framework).toBe('mock')
    })

    it('should log warning on initialization', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await provider.initialize()

      expect(warnSpy).toHaveBeenCalled()
      const warnMessage = warnSpy.mock.calls[0][0]
      expect(warnMessage).toContain('MOCK PROOF PROVIDER')
      expect(warnMessage).toContain('NOT FOR PRODUCTION USE')

      warnSpy.mockRestore()
    })

    it('should only show warning once', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await provider.initialize()
      await provider.initialize()
      await provider.initialize()

      expect(warnSpy).toHaveBeenCalledTimes(1)
      warnSpy.mockRestore()
    })

    it('should not log warning when silent option is true', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const silentProvider = new MockProofProvider({ silent: true })

      await silentProvider.initialize()

      expect(warnSpy).not.toHaveBeenCalled()
      expect(silentProvider.isReady).toBe(true)
      warnSpy.mockRestore()
    })

    it('should still log warning when silent option is false', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const explicitProvider = new MockProofProvider({ silent: false })

      await explicitProvider.initialize()

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('generateFundingProof()', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await provider.initialize()
    })

    it('should generate funding proof with valid params', async () => {
      const result = await provider.generateFundingProof({
        balance: 100n,
        minimumRequired: 50n,
        assetId: 'usdc',
        blinding: '0x123' as HexString,
      })

      expect(result.proof).toBeDefined()
      expect(result.proof.type).toBe('funding')
      expect(result.proof.proof).toBeDefined()
      expect(result.publicInputs).toBeDefined()
      expect(result.publicInputs.length).toBeGreaterThan(0)
    })

    it('should fail if balance < minimumRequired', async () => {
      await expect(
        provider.generateFundingProof({
          balance: 40n,
          minimumRequired: 50n,
          assetId: 'usdc',
          blinding: '0x123' as HexString,
        })
      ).rejects.toThrow('Balance is less than minimum required')
    })

    it('should generate proof with MOCK prefix', async () => {
      const result = await provider.generateFundingProof({
        balance: 100n,
        minimumRequired: 50n,
        assetId: 'usdc',
        blinding: '0x123' as HexString,
      })

      // MOCK prefix is 0x4d4f434b
      expect(result.proof.proof.startsWith('0x4d4f434b')).toBe(true)
    })

    it('should throw if not initialized', async () => {
      const uninitProvider = new MockProofProvider()

      await expect(
        uninitProvider.generateFundingProof({
          balance: 100n,
          minimumRequired: 50n,
          assetId: 'usdc',
          blinding: '0x123' as HexString,
        })
      ).rejects.toThrow('not initialized')
    })
  })

  describe('generateValidityProof()', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await provider.initialize()
    })

    it('should generate validity proof with valid params', async () => {
      const result = await provider.generateValidityProof({
        intentHash: '0xabc123' as HexString,
        senderAddress: '0xsender' as HexString,
        senderBlinding: '0xblinding' as HexString,
        signature: new Uint8Array(64),
        nonce: 1n,
        timestamp: 1000n,
        expiry: 2000n,
      })

      expect(result.proof).toBeDefined()
      expect(result.proof.type).toBe('validity')
      expect(result.publicInputs).toContain('0xabc123')
    })

    it('should fail if timestamp >= expiry (expired)', async () => {
      await expect(
        provider.generateValidityProof({
          intentHash: '0xabc123' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblinding' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: 2000n,
          expiry: 2000n, // Same as timestamp = expired
        })
      ).rejects.toThrow('Intent has already expired')
    })

    it('should fail if timestamp > expiry', async () => {
      await expect(
        provider.generateValidityProof({
          intentHash: '0xabc123' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblinding' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: 3000n,
          expiry: 2000n,
        })
      ).rejects.toThrow('Intent has already expired')
    })
  })

  describe('generateFulfillmentProof()', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await provider.initialize()
    })

    it('should generate fulfillment proof with valid params', async () => {
      const result = await provider.generateFulfillmentProof({
        intentHash: '0xabc123' as HexString,
        outputAmount: 100n,
        minOutputAmount: 90n,
        recipientStealth: '0xrecipient' as HexString,
        outputBlinding: '0xblinding' as HexString,
        fulfillmentTime: 1500n,
        expiry: 2000n,
      })

      expect(result.proof).toBeDefined()
      expect(result.proof.type).toBe('fulfillment')
    })

    it('should fail if outputAmount < minOutputAmount', async () => {
      await expect(
        provider.generateFulfillmentProof({
          intentHash: '0xabc123' as HexString,
          outputAmount: 80n,
          minOutputAmount: 90n,
          recipientStealth: '0xrecipient' as HexString,
          outputBlinding: '0xblinding' as HexString,
          fulfillmentTime: 1500n,
          expiry: 2000n,
        })
      ).rejects.toThrow('Output amount is less than minimum required')
    })

    it('should fail if fulfillmentTime > expiry', async () => {
      await expect(
        provider.generateFulfillmentProof({
          intentHash: '0xabc123' as HexString,
          outputAmount: 100n,
          minOutputAmount: 90n,
          recipientStealth: '0xrecipient' as HexString,
          outputBlinding: '0xblinding' as HexString,
          fulfillmentTime: 2500n,
          expiry: 2000n,
        })
      ).rejects.toThrow('Fulfillment time is after expiry')
    })
  })

  describe('verifyProof()', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await provider.initialize()
    })

    it('should verify mock proofs', async () => {
      const result = await provider.generateFundingProof({
        balance: 100n,
        minimumRequired: 50n,
        assetId: 'usdc',
        blinding: '0x123' as HexString,
      })

      const isValid = await provider.verifyProof(result.proof)
      expect(isValid).toBe(true)
    })

    it('should reject non-mock proofs', async () => {
      const fakeProof: ZKProof = {
        type: 'funding',
        proof: '0xdeadbeef' as HexString, // Not a mock proof
        publicInputs: [],
      }

      const isValid = await provider.verifyProof(fakeProof)
      expect(isValid).toBe(false)
    })
  })

  describe('isMockProof()', () => {
    it('should identify mock proofs', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await provider.initialize()

      const result = await provider.generateFundingProof({
        balance: 100n,
        minimumRequired: 50n,
        assetId: 'usdc',
        blinding: '0x123' as HexString,
      })

      expect(MockProofProvider.isMockProof(result.proof)).toBe(true)
    })

    it('should reject non-mock proofs', () => {
      const fakeProof: ZKProof = {
        type: 'funding',
        proof: '0xdeadbeef' as HexString,
        publicInputs: [],
      }

      expect(MockProofProvider.isMockProof(fakeProof)).toBe(false)
    })
  })

  describe('proof generation consistency', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await provider.initialize()
    })

    it('should generate unique proofs for same params (due to random)', async () => {
      const params = {
        balance: 100n,
        minimumRequired: 50n,
        assetId: 'usdc',
        blinding: '0x123' as HexString,
      }

      const proof1 = await provider.generateFundingProof(params)
      const proof2 = await provider.generateFundingProof(params)

      // Proofs should be different due to random bytes
      expect(proof1.proof.proof).not.toBe(proof2.proof.proof)
    })

    it('should all be verifiable mock proofs', async () => {
      const proofs = await Promise.all([
        provider.generateFundingProof({
          balance: 100n,
          minimumRequired: 50n,
          assetId: 'usdc',
          blinding: '0x123' as HexString,
        }),
        provider.generateValidityProof({
          intentHash: '0xabc' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblinding' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: 1000n,
          expiry: 2000n,
        }),
        provider.generateFulfillmentProof({
          intentHash: '0xabc' as HexString,
          outputAmount: 100n,
          minOutputAmount: 90n,
          recipientStealth: '0xrcp' as HexString,
          outputBlinding: '0xblind' as HexString,
          fulfillmentTime: 1500n,
          expiry: 2000n,
        }),
      ])

      for (const result of proofs) {
        const isValid = await provider.verifyProof(result.proof)
        expect(isValid).toBe(true)
        expect(MockProofProvider.isMockProof(result.proof)).toBe(true)
      }
    })
  })
})
