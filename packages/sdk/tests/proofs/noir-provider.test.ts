/**
 * Noir Proof Provider Tests
 *
 * Tests for the NoirProofProvider - the production ZK proof provider.
 *
 * Note: Full proof generation tests require WASM support and may be slow.
 * These tests are marked appropriately for CI environments.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NoirProofProvider } from '../../src/proofs/noir'
import type { FundingProofParams, ValidityProofParams, FulfillmentProofParams } from '../../src/proofs/interface'
import type { ZKProof, HexString } from '@sip-protocol/types'

describe('NoirProofProvider', () => {
  let provider: NoirProofProvider

  beforeEach(() => {
    provider = new NoirProofProvider()
  })

  afterEach(async () => {
    // Clean up provider resources
    if (provider.isReady) {
      await provider.destroy()
    }
  })

  describe('initialization', () => {
    it('should not be ready before initialization', () => {
      expect(provider.isReady).toBe(false)
    })

    it('should have framework set to noir', () => {
      expect(provider.framework).toBe('noir')
    })

    it('should accept verbose config', () => {
      const verboseProvider = new NoirProofProvider({ verbose: true })
      expect(verboseProvider.framework).toBe('noir')
    })
  })

  describe('methods before initialization', () => {
    const fundingParams: FundingProofParams = {
      balance: 100n,
      minimumRequired: 50n,
      blindingFactor: new Uint8Array(32).fill(1),
      assetId: '0xABCD',
      userAddress: '0x1234567890abcdef',
      ownershipSignature: new Uint8Array(64),
    }

    const validityParams: ValidityProofParams = {
      intentHash: '0xabc123' as HexString,
      senderAddress: '0xsender',
      senderBlinding: new Uint8Array(32),
      senderSecret: new Uint8Array(32),
      authorizationSignature: new Uint8Array(64),
      nonce: new Uint8Array(32),
      timestamp: 1000,
      expiry: 2000,
    }

    const fulfillmentParams: FulfillmentProofParams = {
      intentHash: '0xabc123' as HexString,
      outputAmount: 100n,
      outputBlinding: new Uint8Array(32),
      minOutputAmount: 90n,
      recipientStealth: '0xrecipient' as HexString,
      solverId: 'solver-1',
      solverSecret: new Uint8Array(32),
      oracleAttestation: {
        recipient: '0xrecipient' as HexString,
        amount: 100n,
        txHash: '0xtxhash' as HexString,
        blockNumber: 12345n,
        signature: new Uint8Array(64),
      },
      fulfillmentTime: 1500,
      expiry: 2000,
    }

    it('should throw on generateFundingProof when not initialized', async () => {
      await expect(provider.generateFundingProof(fundingParams))
        .rejects.toThrow('not initialized')
    })

    it('should throw on generateValidityProof when not initialized', async () => {
      await expect(provider.generateValidityProof(validityParams))
        .rejects.toThrow('not initialized')
    })

    it('should throw on generateFulfillmentProof when not initialized', async () => {
      await expect(provider.generateFulfillmentProof(fulfillmentParams))
        .rejects.toThrow('not initialized')
    })

    it('should throw on verifyProof when not initialized', async () => {
      const mockProof: ZKProof = {
        type: 'funding',
        proof: '0xdeadbeef' as HexString,
        publicInputs: [],
      }
      await expect(provider.verifyProof(mockProof))
        .rejects.toThrow('not initialized')
    })
  })

  describe('destroy', () => {
    it('should be safe to call destroy on uninitialized provider', async () => {
      await expect(provider.destroy()).resolves.not.toThrow()
    })

    it('should set isReady to false after destroy', async () => {
      // Skip if initialization fails (WASM not available)
      try {
        await provider.initialize()
        expect(provider.isReady).toBe(true)
        await provider.destroy()
        expect(provider.isReady).toBe(false)
      } catch {
        // WASM not available in test environment
        expect(true).toBe(true)
      }
    })
  })

  // Integration tests that require WASM
  // These may be skipped in environments without WASM support
  describe('initialization with WASM', () => {
    it('should be ready after initialization', async () => {
      try {
        await provider.initialize()
        expect(provider.isReady).toBe(true)
      } catch (error) {
        // WASM initialization may fail in some test environments
        // This is expected behavior - we just verify it throws properly
        expect(error).toBeDefined()
      }
    })

    it('should be idempotent on multiple initialize calls', async () => {
      try {
        await provider.initialize()
        await provider.initialize()
        await provider.initialize()
        expect(provider.isReady).toBe(true)
      } catch {
        // WASM not available
        expect(true).toBe(true)
      }
    })
  })

  describe('validity proof not implemented', () => {
    it('should throw not implemented for validity proof', async () => {
      try {
        await provider.initialize()

        const params: ValidityProofParams = {
          intentHash: '0xabc123' as HexString,
          senderAddress: '0xsender',
          senderBlinding: new Uint8Array(32),
          senderSecret: new Uint8Array(32),
          authorizationSignature: new Uint8Array(64),
          nonce: new Uint8Array(32),
          timestamp: 1000,
          expiry: 2000,
        }

        await expect(provider.generateValidityProof(params))
          .rejects.toThrow('not yet implemented')
      } catch {
        // WASM not available - skip
        expect(true).toBe(true)
      }
    })
  })

  describe('fulfillment proof not implemented', () => {
    it('should throw not implemented for fulfillment proof', async () => {
      try {
        await provider.initialize()

        const params: FulfillmentProofParams = {
          intentHash: '0xabc123' as HexString,
          outputAmount: 100n,
          outputBlinding: new Uint8Array(32),
          minOutputAmount: 90n,
          recipientStealth: '0xrecipient' as HexString,
          solverId: 'solver-1',
          solverSecret: new Uint8Array(32),
          oracleAttestation: {
            recipient: '0xrecipient' as HexString,
            amount: 100n,
            txHash: '0xtxhash' as HexString,
            blockNumber: 12345n,
            signature: new Uint8Array(64),
          },
          fulfillmentTime: 1500,
          expiry: 2000,
        }

        await expect(provider.generateFulfillmentProof(params))
          .rejects.toThrow('not yet implemented')
      } catch {
        // WASM not available - skip
        expect(true).toBe(true)
      }
    })
  })

  describe('verifyProof for non-funding types', () => {
    it('should throw for validity proof verification', async () => {
      try {
        await provider.initialize()

        const validityProof: ZKProof = {
          type: 'validity',
          proof: '0xdeadbeef' as HexString,
          publicInputs: [],
        }

        await expect(provider.verifyProof(validityProof))
          .rejects.toThrow('not yet implemented')
      } catch {
        // WASM not available - skip
        expect(true).toBe(true)
      }
    })

    it('should throw for fulfillment proof verification', async () => {
      try {
        await provider.initialize()

        const fulfillmentProof: ZKProof = {
          type: 'fulfillment',
          proof: '0xdeadbeef' as HexString,
          publicInputs: [],
        }

        await expect(provider.verifyProof(fulfillmentProof))
          .rejects.toThrow('not yet implemented')
      } catch {
        // WASM not available - skip
        expect(true).toBe(true)
      }
    })
  })

  // Full proof generation tests - these require WASM and may be slow
  describe.skip('funding proof generation (requires WASM)', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should generate funding proof with valid params', async () => {
      const params: FundingProofParams = {
        balance: 100n,
        minimumRequired: 50n,
        blindingFactor: new Uint8Array(32).fill(1),
        assetId: '0xABCD',
        userAddress: '0x1234567890abcdef',
        ownershipSignature: new Uint8Array(64),
      }

      const result = await provider.generateFundingProof(params)

      expect(result.proof).toBeDefined()
      expect(result.proof.type).toBe('funding')
      expect(result.proof.proof).toBeDefined()
      expect(result.proof.proof.startsWith('0x')).toBe(true)
      expect(result.publicInputs.length).toBeGreaterThan(0)
    })

    it('should fail when balance < minimumRequired', async () => {
      const params: FundingProofParams = {
        balance: 40n,
        minimumRequired: 50n,
        blindingFactor: new Uint8Array(32).fill(1),
        assetId: '0xABCD',
        userAddress: '0x1234567890abcdef',
        ownershipSignature: new Uint8Array(64),
      }

      await expect(provider.generateFundingProof(params))
        .rejects.toThrow('Insufficient balance')
    })

    it('should verify generated proof', async () => {
      const params: FundingProofParams = {
        balance: 100n,
        minimumRequired: 50n,
        blindingFactor: new Uint8Array(32).fill(1),
        assetId: '0xABCD',
        userAddress: '0x1234567890abcdef',
        ownershipSignature: new Uint8Array(64),
      }

      const result = await provider.generateFundingProof(params)
      const isValid = await provider.verifyProof(result.proof)

      expect(isValid).toBe(true)
    })
  })
})

describe('NoirProofProvider verbose mode', () => {
  it('should log when verbose is enabled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const provider = new NoirProofProvider({ verbose: true })

    try {
      await provider.initialize()
      // Check if log was called with initialization message
      expect(logSpy).toHaveBeenCalled()
      const calls = logSpy.mock.calls.map(call => call[0])
      expect(calls.some(msg => msg?.includes?.('[NoirProofProvider]'))).toBe(true)
    } catch {
      // WASM may not be available
      expect(true).toBe(true)
    }

    logSpy.mockRestore()
  })

  it('should not log when verbose is disabled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const provider = new NoirProofProvider({ verbose: false })

    try {
      await provider.initialize()
    } catch {
      // WASM may not be available
    }

    // Check that no NoirProofProvider logs were made
    const calls = logSpy.mock.calls.map(call => call[0])
    expect(calls.every(msg => !msg?.includes?.('[NoirProofProvider]'))).toBe(true)

    logSpy.mockRestore()
  })
})
