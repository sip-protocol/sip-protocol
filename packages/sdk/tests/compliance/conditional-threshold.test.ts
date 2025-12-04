/**
 * Tests for Conditional Amount Threshold Disclosure
 */

import { describe, it, expect } from 'vitest'
import {
  createAmountThreshold,
  proveExceedsThreshold,
  verifyThresholdProof,
  shouldDisclose,
  type ThresholdDisclosure,
  type RangeProof,
} from '../../src/compliance/conditional-threshold'
import { commit } from '../../src/commitment'

describe('Conditional Amount Threshold Disclosure', () => {
  describe('createAmountThreshold', () => {
    it('should create a valid threshold disclosure', () => {
      const { commitment } = commit(10000_000000n)

      const threshold = createAmountThreshold({
        viewingKey: 'auditor-viewing-key',
        threshold: 10000_000000n,
        commitment,
      })

      expect(threshold).toBeDefined()
      expect(threshold.viewingKey).toBe('auditor-viewing-key')
      expect(threshold.threshold).toBe(10000_000000n)
      expect(threshold.commitment).toBe(commitment)
      expect(threshold.thresholdId).toMatch(/^thr_/)
      expect(threshold.createdAt).toBeGreaterThan(0)
    })

    it('should generate unique threshold IDs', () => {
      const { commitment } = commit(10000_000000n)

      const threshold1 = createAmountThreshold({
        viewingKey: 'key1',
        threshold: 10000_000000n,
        commitment,
      })

      const threshold2 = createAmountThreshold({
        viewingKey: 'key2',
        threshold: 10000_000000n,
        commitment,
      })

      expect(threshold1.thresholdId).not.toBe(threshold2.thresholdId)
    })

    it('should reject invalid viewing key', () => {
      expect(() => {
        createAmountThreshold({
          viewingKey: '',
          threshold: 10000_000000n,
          commitment: '0xabc',
        })
      }).toThrow('viewing key is required')
    })

    it('should reject invalid threshold', () => {
      expect(() => {
        createAmountThreshold({
          viewingKey: 'key',
          threshold: -100n,
          commitment: '0xabc',
        })
      }).toThrow('threshold must be non-negative')
    })

    it('should reject non-bigint threshold', () => {
      expect(() => {
        createAmountThreshold({
          viewingKey: 'key',
          threshold: 100 as unknown as bigint,
          commitment: '0xabc',
        })
      }).toThrow('threshold must be a bigint')
    })

    it('should reject invalid commitment', () => {
      expect(() => {
        createAmountThreshold({
          viewingKey: 'key',
          threshold: 10000_000000n,
          commitment: '',
        })
      }).toThrow('commitment is required')
    })
  })

  describe('proveExceedsThreshold', () => {
    it('should create proof for amount exceeding threshold', () => {
      const amount = 15000_000000n // $15,000
      const threshold = 10000_000000n // $10,000

      const proof = proveExceedsThreshold(amount, threshold)

      expect(proof).toBeDefined()
      expect(proof.threshold).toBe(threshold)
      expect(proof.differenceCommitment).toMatch(/^0x/)
      expect(proof.differenceBlinding).toMatch(/^0x/)
      expect(proof.bitCommitments).toHaveLength(64)
      expect(proof.metadata.numBits).toBe(64)
      expect(proof.metadata.proofId).toMatch(/^prf_/)
      expect(proof.metadata.timestamp).toBeGreaterThan(0)
    })

    it('should create proof for amount exactly equal to threshold', () => {
      const amount = 10000_000000n
      const threshold = 10000_000000n

      const proof = proveExceedsThreshold(amount, threshold)

      expect(proof).toBeDefined()
      expect(proof.threshold).toBe(threshold)
    })

    it('should reject amount below threshold', () => {
      expect(() => {
        proveExceedsThreshold(5000_000000n, 10000_000000n)
      }).toThrow('amount must be >= threshold')
    })

    it('should reject negative amount', () => {
      expect(() => {
        proveExceedsThreshold(-100n, 10000_000000n)
      }).toThrow('amount must be non-negative')
    })

    it('should reject negative threshold', () => {
      expect(() => {
        proveExceedsThreshold(10000_000000n, -100n)
      }).toThrow('threshold must be non-negative')
    })

    it('should reject non-bigint amount', () => {
      expect(() => {
        proveExceedsThreshold(100 as unknown as bigint, 10000_000000n)
      }).toThrow('amount must be a bigint')
    })

    it('should reject non-bigint threshold', () => {
      expect(() => {
        proveExceedsThreshold(10000_000000n, 100 as unknown as bigint)
      }).toThrow('threshold must be a bigint')
    })

    it('should create 64 bit commitments', () => {
      const proof = proveExceedsThreshold(15000_000000n, 10000_000000n)

      expect(proof.bitCommitments).toHaveLength(64)
      proof.bitCommitments.forEach(commitment => {
        expect(commitment).toMatch(/^0x/)
        expect(commitment.length).toBeGreaterThan(2)
      })
    })

    it('should handle small differences', () => {
      const amount = 10000_000001n
      const threshold = 10000_000000n

      const proof = proveExceedsThreshold(amount, threshold)
      expect(proof).toBeDefined()
    })

    it('should handle large differences', () => {
      const amount = 1000000_000000n // $1,000,000
      const threshold = 10000_000000n // $10,000

      const proof = proveExceedsThreshold(amount, threshold)
      expect(proof).toBeDefined()
    })
  })

  describe('verifyThresholdProof', () => {
    it('should verify valid proof', () => {
      const amount = 15000_000000n
      const threshold = 10000_000000n
      const { commitment } = commit(amount)

      const thresholdConfig = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold,
        commitment,
      })

      const proof = proveExceedsThreshold(amount, threshold)
      const isValid = verifyThresholdProof(proof, thresholdConfig)

      expect(isValid).toBe(true)
    })

    it('should reject proof with mismatched threshold', () => {
      const amount = 15000_000000n
      const threshold = 10000_000000n
      const { commitment } = commit(amount)

      const thresholdConfig = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 5000_000000n, // Different threshold
        commitment,
      })

      const proof = proveExceedsThreshold(amount, threshold)
      const isValid = verifyThresholdProof(proof, thresholdConfig)

      expect(isValid).toBe(false)
    })

    it('should reject proof with invalid difference commitment', () => {
      const { commitment } = commit(15000_000000n)

      const thresholdConfig = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const proof = proveExceedsThreshold(15000_000000n, 10000_000000n)
      proof.differenceCommitment = '0xinvalid'

      const isValid = verifyThresholdProof(proof, thresholdConfig)
      expect(isValid).toBe(false)
    })

    it('should reject proof with missing blinding', () => {
      const { commitment } = commit(15000_000000n)

      const thresholdConfig = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const proof = proveExceedsThreshold(15000_000000n, 10000_000000n)
      proof.differenceBlinding = '' as unknown as `0x${string}`

      const isValid = verifyThresholdProof(proof, thresholdConfig)
      expect(isValid).toBe(false)
    })

    it('should reject proof with wrong number of bit commitments', () => {
      const { commitment } = commit(15000_000000n)

      const thresholdConfig = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const proof = proveExceedsThreshold(15000_000000n, 10000_000000n)
      proof.bitCommitments = proof.bitCommitments.slice(0, 32) // Only 32 bits

      const isValid = verifyThresholdProof(proof, thresholdConfig)
      expect(isValid).toBe(false)
    })

    it('should reject proof with invalid bit commitment', () => {
      const { commitment } = commit(15000_000000n)

      const thresholdConfig = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const proof = proveExceedsThreshold(15000_000000n, 10000_000000n)
      proof.bitCommitments[0] = '0xinvalid'

      const isValid = verifyThresholdProof(proof, thresholdConfig)
      expect(isValid).toBe(false)
    })
  })

  describe('shouldDisclose', () => {
    it('should return true when amount exceeds threshold', () => {
      const { commitment } = commit(15000_000000n)

      const threshold = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const result = shouldDisclose(15000_000000n, threshold)
      expect(result).toBe(true)
    })

    it('should return true when amount equals threshold', () => {
      const { commitment } = commit(10000_000000n)

      const threshold = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const result = shouldDisclose(10000_000000n, threshold)
      expect(result).toBe(true)
    })

    it('should return false when amount is below threshold', () => {
      const { commitment } = commit(5000_000000n)

      const threshold = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const result = shouldDisclose(5000_000000n, threshold)
      expect(result).toBe(false)
    })

    it('should handle small amounts', () => {
      const { commitment } = commit(1n)

      const threshold = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const result = shouldDisclose(1n, threshold)
      expect(result).toBe(false)
    })

    it('should handle large amounts', () => {
      const { commitment } = commit(1000000_000000n)

      const threshold = createAmountThreshold({
        viewingKey: 'auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      const result = shouldDisclose(1000000_000000n, threshold)
      expect(result).toBe(true)
    })
  })

  describe('E2E: Regulatory Compliance Use Case', () => {
    it('should handle $10,000 threshold for regulatory reporting', () => {
      // Use case: Report transactions over $10,000
      const REGULATORY_THRESHOLD = 10000_000000n // $10,000 USDC

      // Transaction 1: $5,000 (below threshold)
      const amount1 = 5000_000000n
      const { commitment: commitment1 } = commit(amount1)

      const threshold1 = createAmountThreshold({
        viewingKey: 'regulatory-auditor-key',
        threshold: REGULATORY_THRESHOLD,
        commitment: commitment1,
      })

      expect(shouldDisclose(amount1, threshold1)).toBe(false)

      // Transaction 2: $15,000 (above threshold, requires disclosure)
      const amount2 = 15000_000000n
      const { commitment: commitment2 } = commit(amount2)

      const threshold2 = createAmountThreshold({
        viewingKey: 'regulatory-auditor-key',
        threshold: REGULATORY_THRESHOLD,
        commitment: commitment2,
      })

      expect(shouldDisclose(amount2, threshold2)).toBe(true)

      // Create proof that amount exceeds threshold (without revealing exact amount)
      const proof = proveExceedsThreshold(amount2, REGULATORY_THRESHOLD)
      const isValid = verifyThresholdProof(proof, threshold2)

      expect(isValid).toBe(true)
    })

    it('should preserve privacy for under-threshold transactions', () => {
      const REGULATORY_THRESHOLD = 10000_000000n

      // $9,999.99 (just below threshold)
      const amount = 9999_990000n
      const { commitment } = commit(amount)

      const threshold = createAmountThreshold({
        viewingKey: 'regulatory-auditor-key',
        threshold: REGULATORY_THRESHOLD,
        commitment,
      })

      // Should not require disclosure
      expect(shouldDisclose(amount, threshold)).toBe(false)

      // Cannot create proof for amount below threshold
      expect(() => {
        proveExceedsThreshold(amount, REGULATORY_THRESHOLD)
      }).toThrow('amount must be >= threshold')
    })

    it('should handle multiple thresholds for different jurisdictions', () => {
      const amount = 12000_000000n // $12,000
      const { commitment } = commit(amount)

      // US threshold: $10,000
      const usThreshold = createAmountThreshold({
        viewingKey: 'us-auditor-key',
        threshold: 10000_000000n,
        commitment,
      })

      // EU threshold: €15,000 (assume 1:1 for simplicity)
      const euThreshold = createAmountThreshold({
        viewingKey: 'eu-auditor-key',
        threshold: 15000_000000n,
        commitment,
      })

      expect(shouldDisclose(amount, usThreshold)).toBe(true)
      expect(shouldDisclose(amount, euThreshold)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero amount', () => {
      const { commitment } = commit(0n)

      const threshold = createAmountThreshold({
        viewingKey: 'key',
        threshold: 10000_000000n,
        commitment,
      })

      expect(shouldDisclose(0n, threshold)).toBe(false)
    })

    it('should handle zero threshold', () => {
      const { commitment } = commit(100n)

      const threshold = createAmountThreshold({
        viewingKey: 'key',
        threshold: 0n,
        commitment,
      })

      expect(shouldDisclose(100n, threshold)).toBe(true)
      expect(shouldDisclose(0n, threshold)).toBe(true)
    })

    it('should handle maximum safe values', () => {
      const maxSafe = 2n ** 53n - 1n // Maximum safe integer in JavaScript
      const { commitment } = commit(maxSafe)

      const threshold = createAmountThreshold({
        viewingKey: 'key',
        threshold: maxSafe - 1n,
        commitment,
      })

      expect(shouldDisclose(maxSafe, threshold)).toBe(true)

      const proof = proveExceedsThreshold(maxSafe, maxSafe - 1n)
      expect(verifyThresholdProof(proof, threshold)).toBe(true)
    })
  })
})
