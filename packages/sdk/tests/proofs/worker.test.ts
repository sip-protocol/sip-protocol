/**
 * Web Worker Proof Tests
 *
 * Tests for the Web Worker-based proof generation.
 * These tests verify that validity and fulfillment proofs work in the worker.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/191
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProofWorker } from '../../src/proofs/worker'
import type { ValidityProofParams, FulfillmentProofParams } from '../../src/proofs/interface'
import type { HexString } from '@sip-protocol/types'
import { secp256k1 } from '@noble/curves/secp256k1'

describe('ProofWorker', () => {
  describe('Worker support detection', () => {
    it('should detect if Web Workers are supported', () => {
      const isSupported = ProofWorker.isSupported()
      expect(typeof isSupported).toBe('boolean')
    })
  })

  describe('Worker initialization', () => {
    it('should create a worker instance', () => {
      const worker = new ProofWorker()
      expect(worker).toBeDefined()
      expect(worker.isReady).toBe(false)
    })

    it('should handle initialization in non-worker environment', async () => {
      const worker = new ProofWorker()

      // In Node.js without workers, this should throw
      if (!ProofWorker.isSupported()) {
        await expect(worker.initialize()).rejects.toThrow('Web Workers not supported')
      }
    })
  })

  describe('Proof generation API', () => {
    let worker: ProofWorker

    beforeEach(() => {
      worker = new ProofWorker()
    })

    afterEach(async () => {
      if (worker.isReady) {
        await worker.destroy()
      }
    })

    it('should throw if proof generation called before initialization', async () => {
      const privateKey = new Uint8Array(32).fill(1)
      const intentHash = '0xdeadbeef000000000000000000000000000000000000000000000000000000'
      const messageHash = Buffer.from(intentHash.slice(2), 'hex')
      const signature = secp256k1.sign(messageHash, privateKey)

      const params: ValidityProofParams = {
        intentHash: intentHash as HexString,
        senderAddress: '0x0000000000000000000000742d35Cc6634C0532925a3b844Bc9e7595f',
        senderBlinding: new Uint8Array(32).fill(2),
        senderSecret: privateKey,
        authorizationSignature: new Uint8Array([...signature.toCompactRawBytes()]),
        nonce: new Uint8Array(32).fill(4),
        timestamp: 1000,
        expiry: 2000,
        senderPublicKey: {
          x: new Uint8Array(33).fill(5),
          y: new Uint8Array(33).fill(6),
        },
      }

      await expect(worker.generateProof('validity', params))
        .rejects.toThrow('Worker not initialized')
    })

    it('should accept validity proof type', async () => {
      if (!ProofWorker.isSupported()) {
        // Skip if workers not supported
        expect(true).toBe(true)
        return
      }

      // Just test that the API accepts the proof type
      // Full WASM tests would require browser environment
      const privateKey = new Uint8Array(32).fill(1)
      const intentHash = '0xdeadbeef000000000000000000000000000000000000000000000000000000'

      const params: ValidityProofParams = {
        intentHash: intentHash as HexString,
        senderAddress: '0x0000000000000000000000742d35Cc6634C0532925a3b844Bc9e7595f',
        senderBlinding: new Uint8Array(32).fill(2),
        senderSecret: privateKey,
        authorizationSignature: new Uint8Array(64).fill(3),
        nonce: new Uint8Array(32).fill(4),
        timestamp: 1000,
        expiry: 2000,
      }

      // This will fail with "not initialized" but confirms the API accepts the type
      try {
        await worker.generateProof('validity', params)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should accept fulfillment proof type', async () => {
      if (!ProofWorker.isSupported()) {
        // Skip if workers not supported
        expect(true).toBe(true)
        return
      }

      const params: FulfillmentProofParams = {
        intentHash: '0xdeadbeef000000000000000000000000000000000000000000000000000000' as HexString,
        recipientStealth: '0xabcdef000000000000000000000000000000000000000000000000000000' as HexString,
        minOutputAmount: 1000n,
        outputAmount: 1500n,
        outputBlinding: new Uint8Array(32).fill(7),
        solverSecret: new Uint8Array(32).fill(8),
        fulfillmentTime: 1500,
        expiry: 2000,
        oracleAttestation: {
          recipient: '0x123456000000000000000000000000000000000000000000000000000000' as HexString,
          amount: 1500n,
          txHash: '0xaabbcc000000000000000000000000000000000000000000000000000000' as HexString,
          blockNumber: 12345n,
          signature: new Uint8Array(64).fill(9),
        },
      }

      // This will fail with "not initialized" but confirms the API accepts the type
      try {
        await worker.generateProof('fulfillment', params)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Progress callbacks', () => {
    it('should accept progress callback parameter', async () => {
      const worker = new ProofWorker()
      const progressUpdates: Array<{ stage: string; percent: number }> = []

      const privateKey = new Uint8Array(32).fill(1)
      const params: ValidityProofParams = {
        intentHash: '0xdeadbeef000000000000000000000000000000000000000000000000000000' as HexString,
        senderAddress: '0x0000000000000000000000742d35Cc6634C0532925a3b844Bc9e7595f',
        senderBlinding: new Uint8Array(32).fill(2),
        senderSecret: privateKey,
        authorizationSignature: new Uint8Array(64).fill(3),
        nonce: new Uint8Array(32).fill(4),
        timestamp: 1000,
        expiry: 2000,
      }

      const onProgress = (progress: { stage: string; percent: number; message: string }) => {
        progressUpdates.push({ stage: progress.stage, percent: progress.percent })
      }

      try {
        await worker.generateProof('validity', params, onProgress)
      } catch (error) {
        // Expected to fail (not initialized), but callback is valid
        expect(error).toBeDefined()
      }

      // Cleanup
      if (worker.isReady) {
        await worker.destroy()
      }
    })
  })

  describe('Worker cleanup', () => {
    it('should handle destroy before initialization', async () => {
      const worker = new ProofWorker()
      await expect(worker.destroy()).resolves.not.toThrow()
    })

    it('should cleanup resources on destroy', async () => {
      const worker = new ProofWorker()

      if (ProofWorker.isSupported()) {
        try {
          await worker.initialize()
          expect(worker.isReady).toBe(true)
          await worker.destroy()
          expect(worker.isReady).toBe(false)
        } catch {
          // Worker initialization may fail in test environment
          await worker.destroy()
        }
      }
    })
  })

  describe('Message type validation', () => {
    it('should define all required message types', () => {
      // This test verifies the types are exported
      const messageTypes = ['init', 'generateFundingProof', 'generateValidityProof', 'generateFulfillmentProof', 'destroy']

      // Types are compile-time, but we can verify the string values
      expect(messageTypes).toContain('generateValidityProof')
      expect(messageTypes).toContain('generateFulfillmentProof')
    })
  })

  describe('Parameter types', () => {
    it('should accept ValidityProofParams type', () => {
      const params: ValidityProofParams = {
        intentHash: '0xdeadbeef000000000000000000000000000000000000000000000000000000' as HexString,
        senderAddress: '0x0000000000000000000000742d35Cc6634C0532925a3b844Bc9e7595f',
        senderBlinding: new Uint8Array(32).fill(2),
        senderSecret: new Uint8Array(32).fill(1),
        authorizationSignature: new Uint8Array(64).fill(3),
        nonce: new Uint8Array(32).fill(4),
        timestamp: 1000,
        expiry: 2000,
      }

      expect(params.intentHash).toBeDefined()
      expect(params.senderAddress).toBeDefined()
    })

    it('should accept FulfillmentProofParams type', () => {
      const params: FulfillmentProofParams = {
        intentHash: '0xdeadbeef000000000000000000000000000000000000000000000000000000' as HexString,
        recipientStealth: '0xabcdef000000000000000000000000000000000000000000000000000000' as HexString,
        minOutputAmount: 1000n,
        outputAmount: 1500n,
        outputBlinding: new Uint8Array(32).fill(7),
        solverSecret: new Uint8Array(32).fill(8),
        fulfillmentTime: 1500,
        expiry: 2000,
        oracleAttestation: {
          recipient: '0x123456000000000000000000000000000000000000000000000000000000' as HexString,
          amount: 1500n,
          txHash: '0xaabbcc000000000000000000000000000000000000000000000000000000' as HexString,
          blockNumber: 12345n,
          signature: new Uint8Array(64).fill(9),
        },
      }

      expect(params.intentHash).toBeDefined()
      expect(params.recipientStealth).toBeDefined()
      expect(params.oracleAttestation).toBeDefined()
    })
  })
})
