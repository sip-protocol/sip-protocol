/**
 * Pedersen Commitment Tests
 *
 * Comprehensive tests for Pedersen commitment primitives.
 */

import { describe, it, expect } from 'vitest'
import {
  commit,
  verifyOpening,
  commitZero,
  addCommitments,
  subtractCommitments,
  addBlindings,
  subtractBlindings,
  generateBlinding,
  getGenerators,
} from '../../src/commitment'
import { hexToBytes } from '@noble/hashes/utils'

describe('Pedersen Commitments', () => {
  describe('commit()', () => {
    it('should create a commitment to a value', () => {
      const { commitment, blinding } = commit(100n)

      expect(commitment).toBeDefined()
      expect(blinding).toBeDefined()
      expect(commitment.startsWith('0x')).toBe(true)
      expect(blinding.startsWith('0x')).toBe(true)
      // Compressed point is 33 bytes = 66 hex chars + '0x'
      expect(commitment.length).toBe(68)
      // Blinding is 32 bytes = 64 hex chars + '0x'
      expect(blinding.length).toBe(66)
    })

    it('should create different commitments with different blindings', () => {
      const c1 = commit(100n)
      const c2 = commit(100n)

      // Same value, different random blindings = different commitments
      expect(c1.commitment).not.toBe(c2.commitment)
      expect(c1.blinding).not.toBe(c2.blinding)
    })

    it('should create same commitment with same blinding', () => {
      const blinding = hexToBytes('0'.repeat(64))
      const c1 = commit(100n, blinding)
      const c2 = commit(100n, blinding)

      expect(c1.commitment).toBe(c2.commitment)
    })

    it('should handle zero value', () => {
      const { commitment, blinding } = commit(0n)

      expect(commitment).toBeDefined()
      expect(verifyOpening(commitment, 0n, blinding)).toBe(true)
    })

    it('should handle large values', () => {
      const largeValue = 2n ** 64n - 1n // Max u64
      const { commitment, blinding } = commit(largeValue)

      expect(verifyOpening(commitment, largeValue, blinding)).toBe(true)
    })

    it('should reject negative values', () => {
      expect(() => commit(-1n)).toThrow('must be non-negative')
    })

    it('should reject values >= curve order', () => {
      // secp256k1 curve order
      const curveOrder = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
      expect(() => commit(curveOrder)).toThrow('must be less than curve order')
    })

    it('should reject invalid blinding length', () => {
      const shortBlinding = new Uint8Array(16) // Should be 32
      expect(() => commit(100n, shortBlinding)).toThrow('must be 32 bytes')
    })
  })

  describe('verifyOpening()', () => {
    it('should verify valid opening', () => {
      const { commitment, blinding } = commit(100n)

      expect(verifyOpening(commitment, 100n, blinding)).toBe(true)
    })

    it('should reject wrong value', () => {
      const { commitment, blinding } = commit(100n)

      expect(verifyOpening(commitment, 99n, blinding)).toBe(false)
      expect(verifyOpening(commitment, 101n, blinding)).toBe(false)
    })

    it('should reject wrong blinding', () => {
      const { commitment } = commit(100n)
      const wrongBlinding = generateBlinding()

      expect(verifyOpening(commitment, 100n, wrongBlinding)).toBe(false)
    })

    it('should handle edge case: zero value', () => {
      const { commitment, blinding } = commit(0n)

      expect(verifyOpening(commitment, 0n, blinding)).toBe(true)
      expect(verifyOpening(commitment, 1n, blinding)).toBe(false)
    })

    it('should handle invalid commitment format', () => {
      const { blinding } = commit(100n)

      expect(verifyOpening('0xinvalid' as any, 100n, blinding)).toBe(false)
    })
  })

  describe('commitZero()', () => {
    it('should create commitment to zero', () => {
      const blinding = hexToBytes('0'.repeat(64))
      const { commitment, blinding: returnedBlinding } = commitZero(blinding)

      expect(verifyOpening(commitment, 0n, returnedBlinding)).toBe(true)
    })
  })

  describe('Homomorphic Operations', () => {
    describe('addCommitments()', () => {
      it('should add two commitments homomorphically', () => {
        const blinding1 = hexToBytes('01'.repeat(32))
        const blinding2 = hexToBytes('02'.repeat(32))

        const c1 = commit(100n, blinding1)
        const c2 = commit(50n, blinding2)

        // C1 + C2 should commit to 150 with blinding1 + blinding2
        const sum = addCommitments(c1.commitment, c2.commitment)
        const blindingSum = addBlindings(c1.blinding, c2.blinding)

        expect(verifyOpening(sum.commitment, 150n, blindingSum)).toBe(true)
      })

      it('should be associative', () => {
        const c1 = commit(10n)
        const c2 = commit(20n)
        const c3 = commit(30n)

        // (c1 + c2) + c3
        const sum12 = addCommitments(c1.commitment, c2.commitment)
        const sum123_a = addCommitments(sum12.commitment, c3.commitment)

        // c1 + (c2 + c3)
        const sum23 = addCommitments(c2.commitment, c3.commitment)
        const sum123_b = addCommitments(c1.commitment, sum23.commitment)

        expect(sum123_a.commitment).toBe(sum123_b.commitment)
      })

      it('should be commutative', () => {
        const c1 = commit(100n)
        const c2 = commit(200n)

        const sum1 = addCommitments(c1.commitment, c2.commitment)
        const sum2 = addCommitments(c2.commitment, c1.commitment)

        expect(sum1.commitment).toBe(sum2.commitment)
      })
    })

    describe('subtractCommitments()', () => {
      it('should subtract commitments homomorphically', () => {
        const blinding1 = hexToBytes('03'.repeat(32))
        const blinding2 = hexToBytes('01'.repeat(32))

        const c1 = commit(100n, blinding1)
        const c2 = commit(30n, blinding2)

        // C1 - C2 should commit to 70 with blinding1 - blinding2
        const diff = subtractCommitments(c1.commitment, c2.commitment)
        const blindingDiff = subtractBlindings(c1.blinding, c2.blinding)

        expect(verifyOpening(diff.commitment, 70n, blindingDiff)).toBe(true)
      })

      it('should satisfy C - C = 0 (point at infinity)', () => {
        const c = commit(100n)

        const diff = subtractCommitments(c.commitment, c.commitment)
        const blindingDiff = subtractBlindings(c.blinding, c.blinding)

        // C - C produces point at infinity, represented as '0x00'
        expect(diff.commitment).toBe('0x00')
        // Blinding diff should be all zeros
        expect(blindingDiff).toBe('0x' + '0'.repeat(64))
        // Verify the special case opens correctly
        expect(verifyOpening(diff.commitment, 0n, blindingDiff)).toBe(true)
      })
    })

    describe('addBlindings() / subtractBlindings()', () => {
      it('should add blindings correctly', () => {
        const b1 = generateBlinding()
        const b2 = generateBlinding()
        const sum = addBlindings(b1, b2)

        // Sum should be 66 chars (0x + 64 hex)
        expect(sum.startsWith('0x')).toBe(true)
        expect(sum.length).toBe(66)
      })

      it('should handle modular arithmetic (overflow)', () => {
        // Use very large blinding values
        const large1 = '0x' + 'ff'.repeat(32) // Max value
        const large2 = '0x' + '01'.repeat(32)

        const sum = addBlindings(large1 as any, large2 as any)
        // Should wrap around (mod curve order)
        expect(sum.startsWith('0x')).toBe(true)
      })

      it('should satisfy b - b = 0', () => {
        const b = generateBlinding()
        const diff = subtractBlindings(b, b)

        // Should be all zeros
        expect(diff).toBe('0x' + '0'.repeat(64))
      })
    })
  })

  describe('generateBlinding()', () => {
    it('should generate random 32-byte blinding', () => {
      const b = generateBlinding()

      expect(b.startsWith('0x')).toBe(true)
      expect(b.length).toBe(66) // 0x + 64 hex chars
    })

    it('should generate different values each time', () => {
      const b1 = generateBlinding()
      const b2 = generateBlinding()
      const b3 = generateBlinding()

      expect(b1).not.toBe(b2)
      expect(b2).not.toBe(b3)
      expect(b1).not.toBe(b3)
    })
  })

  describe('getGenerators()', () => {
    it('should return G and H points', () => {
      const { G, H } = getGenerators()

      expect(G.x).toBeDefined()
      expect(G.y).toBeDefined()
      expect(H.x).toBeDefined()
      expect(H.y).toBeDefined()

      // Check they are valid hex strings (64 chars for 32 bytes)
      expect(G.x.startsWith('0x')).toBe(true)
      expect(G.x.length).toBe(66)
    })

    it('should return consistent generators', () => {
      const gen1 = getGenerators()
      const gen2 = getGenerators()

      expect(gen1.G.x).toBe(gen2.G.x)
      expect(gen1.G.y).toBe(gen2.G.y)
      expect(gen1.H.x).toBe(gen2.H.x)
      expect(gen1.H.y).toBe(gen2.H.y)
    })

    it('should return different points for G and H', () => {
      const { G, H } = getGenerators()

      expect(G.x).not.toBe(H.x)
      // Note: y values could theoretically be same (unlikely)
    })
  })

  describe('Security Properties', () => {
    it('commitment should be hiding (same commitment for different values is infeasible)', () => {
      // This is a probabilistic test - if hiding property fails,
      // we could find the same commitment for different values
      const commitments = new Set<string>()

      for (let i = 0; i < 100; i++) {
        const { commitment } = commit(BigInt(i))
        expect(commitments.has(commitment)).toBe(false)
        commitments.add(commitment)
      }
    })

    it('commitment should be binding (cannot open to different value)', () => {
      const { commitment, blinding } = commit(100n)

      // Try to "open" to different values - should all fail
      for (let i = 0; i < 100; i++) {
        if (i !== 100) {
          expect(verifyOpening(commitment, BigInt(i), blinding)).toBe(false)
        }
      }

      // Only correct value should verify
      expect(verifyOpening(commitment, 100n, blinding)).toBe(true)
    })
  })
})
