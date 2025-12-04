/**
 * Performance Benchmarks
 *
 * Measures the performance of cryptographic operations.
 * Note: These are informational benchmarks - timing varies by environment.
 * The tests log performance metrics without strict assertions.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { commit, verifyOpening, addCommitments } from '../../src/commitment'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
import { MockProofProvider } from '../../src/proofs/mock'
import type { ChainId, HexString } from '@sip-protocol/types'

// Utility to measure execution time
function measureTime<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now()
  const result = fn()
  const timeMs = performance.now() - start
  return { result, timeMs }
}

async function measureTimeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const start = performance.now()
  const result = await fn()
  const timeMs = performance.now() - start
  return { result, timeMs }
}

describe('Performance Benchmarks', () => {
  describe('Pedersen Commitments', () => {
    it('commit() performance (first run includes H generation)', () => {
      const { result, timeMs } = measureTime(() => commit(1000n))
      console.log(`  commit(): ${timeMs.toFixed(3)}ms`)
      // First run is slower due to H point generation (NUMS)
      // Just verify it completes and produces valid output
      expect(result.commitment).toBeDefined()
      expect(result.blinding).toBeDefined()
    })

    it('verifyOpening() performance', () => {
      const { commitment, blinding } = commit(1000n)
      const { result, timeMs } = measureTime(() => verifyOpening(commitment, 1000n, blinding))
      console.log(`  verifyOpening(): ${timeMs.toFixed(3)}ms`)
      expect(result).toBe(true)
    })

    it('addCommitments() performance', () => {
      const c1 = commit(100n)
      const c2 = commit(200n)
      const { result, timeMs } = measureTime(() => addCommitments(c1.commitment, c2.commitment))
      console.log(`  addCommitments(): ${timeMs.toFixed(3)}ms`)
      expect(result.commitment).toBeDefined()
    })

    it('batch commit performance (100 commits)', () => {
      const start = performance.now()
      const commitments = []
      for (let i = 0; i < 100; i++) {
        commitments.push(commit(BigInt(i * 1000)))
      }
      const timeMs = performance.now() - start
      console.log(`  100 commits: ${timeMs.toFixed(3)}ms (avg ${(timeMs / 100).toFixed(3)}ms)`)
      expect(commitments.length).toBe(100)
    })
  })

  describe('Stealth Addresses', () => {
    it('generateStealthMetaAddress() performance', () => {
      const { result, timeMs } = measureTime(() => generateStealthMetaAddress('ethereum' as ChainId))
      console.log(`  generateStealthMetaAddress(): ${timeMs.toFixed(3)}ms`)
      expect(result.metaAddress).toBeDefined()
    })

    it('generateStealthAddress() performance', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum' as ChainId)
      const { result, timeMs } = measureTime(() => generateStealthAddress(metaAddress))
      console.log(`  generateStealthAddress(): ${timeMs.toFixed(3)}ms`)
      expect(result.stealthAddress).toBeDefined()
    })

    it('checkStealthAddress() performance', () => {
      const recipient = generateStealthMetaAddress('ethereum' as ChainId)
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      const { result, timeMs } = measureTime(() =>
        checkStealthAddress(
          stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )
      )
      console.log(`  checkStealthAddress(): ${timeMs.toFixed(3)}ms`)
      expect(result).toBe(true)
    })

    it('deriveStealthPrivateKey() performance', () => {
      const recipient = generateStealthMetaAddress('ethereum' as ChainId)
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      const { result, timeMs } = measureTime(() =>
        deriveStealthPrivateKey(
          stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )
      )
      console.log(`  deriveStealthPrivateKey(): ${timeMs.toFixed(3)}ms`)
      expect(result.privateKey).toBeDefined()
    })

    it('full stealth flow performance', () => {
      const start = performance.now()

      const recipient = generateStealthMetaAddress('ethereum' as ChainId)
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
      const isOurs = checkStealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      const timeMs = performance.now() - start
      console.log(`  Full stealth flow: ${timeMs.toFixed(3)}ms`)
      expect(isOurs).toBe(true)
      expect(recovery.privateKey).toBeDefined()
    })
  })

  describe('Mock Proof Provider', () => {
    let provider: MockProofProvider

    beforeAll(async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      provider = new MockProofProvider()
      await provider.initialize()
    })

    it('generateFundingProof() performance', async () => {
      const { result, timeMs } = await measureTimeAsync(() =>
        provider.generateFundingProof({
          balance: 1000n,
          minimumRequired: 500n,
          assetId: 'NEAR',
          blinding: '0x123' as HexString,
        })
      )
      console.log(`  generateFundingProof(): ${timeMs.toFixed(3)}ms`)
      expect(result.proof).toBeDefined()
    })

    it('generateValidityProof() performance', async () => {
      const { result, timeMs } = await measureTimeAsync(() =>
        provider.generateValidityProof({
          intentHash: '0xabc' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblind' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: 1000n,
          expiry: 2000n,
        })
      )
      console.log(`  generateValidityProof(): ${timeMs.toFixed(3)}ms`)
      expect(result.proof).toBeDefined()
    })

    it('generateFulfillmentProof() performance', async () => {
      const { result, timeMs } = await measureTimeAsync(() =>
        provider.generateFulfillmentProof({
          intentHash: '0xabc' as HexString,
          outputAmount: 1000n,
          minOutputAmount: 900n,
          recipientStealth: '0xstealth' as HexString,
          outputBlinding: '0xblind' as HexString,
          fulfillmentTime: 1500n,
          expiry: 2000n,
        })
      )
      console.log(`  generateFulfillmentProof(): ${timeMs.toFixed(3)}ms`)
      expect(result.proof).toBeDefined()
    })
  })

  describe('Batch Operations', () => {
    it('scan 100 stealth addresses performance', () => {
      const recipient = generateStealthMetaAddress('ethereum' as ChainId)

      const addresses = Array.from({ length: 100 }, () =>
        generateStealthAddress(recipient.metaAddress).stealthAddress
      )

      const start = performance.now()
      let matches = 0
      for (const addr of addresses) {
        if (
          checkStealthAddress(
            addr,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )
        ) {
          matches++
        }
      }
      const timeMs = performance.now() - start

      console.log(`  Scanned 100 addresses: ${timeMs.toFixed(3)}ms (avg ${(timeMs / 100).toFixed(3)}ms)`)
      expect(matches).toBe(100)
    })
  })
})
