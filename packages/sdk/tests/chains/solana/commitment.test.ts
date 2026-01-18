/**
 * Solana Pedersen Commitment Tests
 *
 * Tests for ed25519-based Pedersen commitments on Solana.
 */

import { describe, it, expect } from 'vitest'
import {
  commitSolana,
  verifyOpeningSolana,
  commitSPLToken,
  verifySPLTokenCommitment,
  toSmallestUnits,
  fromSmallestUnits,
  addCommitmentsSolana,
  subtractCommitmentsSolana,
  addBlindingsSolana,
  subtractBlindingsSolana,
  getGeneratorsSolana,
  generateBlindingSolana,
  ED25519_ORDER,
  MAX_SPL_AMOUNT,
} from '../../../src/chains/solana/commitment'
import type { HexString } from '@sip-protocol/types'

describe('Solana Pedersen Commitments', () => {
  // ─── Basic Commitment ─────────────────────────────────────────────────────

  describe('commitSolana', () => {
    it('should create a commitment to a value', () => {
      const { commitment, blinding } = commitSolana(100n)

      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/) // 32 bytes ed25519 point
      expect(blinding).toMatch(/^0x[0-9a-f]{64}$/)   // 32 bytes blinding
    })

    it('should create different commitments for same value (random blinding)', () => {
      const c1 = commitSolana(100n)
      const c2 = commitSolana(100n)

      // Same value but different blindings = different commitments
      expect(c1.commitment).not.toBe(c2.commitment)
      expect(c1.blinding).not.toBe(c2.blinding)
    })

    it('should create deterministic commitment with provided blinding', () => {
      const blinding = new Uint8Array(32).fill(1) // Fixed blinding
      const c1 = commitSolana(100n, blinding)
      const c2 = commitSolana(100n, blinding)

      expect(c1.commitment).toBe(c2.commitment)
    })

    it('should create valid commitment for zero value', () => {
      const { commitment, blinding } = commitSolana(0n)

      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/)
      expect(verifyOpeningSolana(commitment, 0n, blinding)).toBe(true)
    })

    it('should throw for negative values', () => {
      expect(() => commitSolana(-1n)).toThrow()
    })

    it('should throw for value >= curve order', () => {
      expect(() => commitSolana(ED25519_ORDER)).toThrow()
      expect(() => commitSolana(ED25519_ORDER + 1n)).toThrow()
    })

    it('should throw for invalid blinding length', () => {
      const shortBlinding = new Uint8Array(16)
      expect(() => commitSolana(100n, shortBlinding)).toThrow()
    })
  })

  // ─── Verification ─────────────────────────────────────────────────────────

  describe('verifyOpeningSolana', () => {
    it('should verify correct opening', () => {
      const { commitment, blinding } = commitSolana(12345n)

      expect(verifyOpeningSolana(commitment, 12345n, blinding)).toBe(true)
    })

    it('should reject wrong value', () => {
      const { commitment, blinding } = commitSolana(100n)

      expect(verifyOpeningSolana(commitment, 99n, blinding)).toBe(false)
      expect(verifyOpeningSolana(commitment, 101n, blinding)).toBe(false)
    })

    it('should reject wrong blinding', () => {
      const { commitment } = commitSolana(100n)
      const wrongBlinding = '0x' + '00'.repeat(31) + '01' as HexString

      expect(verifyOpeningSolana(commitment, 100n, wrongBlinding)).toBe(false)
    })

    it('should verify zero value commitment', () => {
      const { commitment, blinding } = commitSolana(0n)

      expect(verifyOpeningSolana(commitment, 0n, blinding)).toBe(true)
      expect(verifyOpeningSolana(commitment, 1n, blinding)).toBe(false)
    })

    it('should verify large values', () => {
      const largeValue = 2n ** 63n - 1n // Max u64 / 2
      const { commitment, blinding } = commitSolana(largeValue)

      expect(verifyOpeningSolana(commitment, largeValue, blinding)).toBe(true)
    })
  })

  // ─── SPL Token Commitments ────────────────────────────────────────────────

  describe('commitSPLToken', () => {
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

    it('should create SPL token commitment', () => {
      const commitment = commitSPLToken(100_000_000n, USDC_MINT, 6)

      expect(commitment.commitment).toMatch(/^0x[0-9a-f]{64}$/)
      expect(commitment.blinding).toMatch(/^0x[0-9a-f]{64}$/)
      expect(commitment.mint).toBe(USDC_MINT)
      expect(commitment.decimals).toBe(6)
      expect(commitment.amountRaw).toBe(100_000_000n)
    })

    it('should verify SPL token commitment', () => {
      const commitment = commitSPLToken(100_000_000n, USDC_MINT, 6)

      expect(verifySPLTokenCommitment(commitment, 100_000_000n)).toBe(true)
      expect(verifySPLTokenCommitment(commitment, 100_000_001n)).toBe(false)
    })

    it('should handle max u64 amount', () => {
      const commitment = commitSPLToken(MAX_SPL_AMOUNT, USDC_MINT, 6)

      expect(commitment.amountRaw).toBe(MAX_SPL_AMOUNT)
      expect(verifySPLTokenCommitment(commitment, MAX_SPL_AMOUNT)).toBe(true)
    })

    it('should throw for amount > u64', () => {
      expect(() => commitSPLToken(MAX_SPL_AMOUNT + 1n, USDC_MINT, 6)).toThrow()
    })

    it('should throw for negative amount', () => {
      expect(() => commitSPLToken(-1n, USDC_MINT, 6)).toThrow()
    })

    it('should throw for invalid decimals', () => {
      expect(() => commitSPLToken(100n, USDC_MINT, -1)).toThrow()
      expect(() => commitSPLToken(100n, USDC_MINT, 19)).toThrow()
      expect(() => commitSPLToken(100n, USDC_MINT, 1.5)).toThrow()
    })
  })

  // ─── Unit Conversion ──────────────────────────────────────────────────────

  describe('toSmallestUnits', () => {
    it('should convert whole numbers', () => {
      expect(toSmallestUnits(100, 6)).toBe(100_000_000n)
      expect(toSmallestUnits(1, 9)).toBe(1_000_000_000n)
    })

    it('should convert fractional numbers', () => {
      expect(toSmallestUnits(100.5, 6)).toBe(100_500_000n)
      expect(toSmallestUnits(0.001, 9)).toBe(1_000_000n)
    })

    it('should handle string inputs', () => {
      expect(toSmallestUnits('100.5', 6)).toBe(100_500_000n)
      expect(toSmallestUnits('1', 9)).toBe(1_000_000_000n)
    })

    it('should truncate excess precision', () => {
      // 6 decimals, but input has more
      expect(toSmallestUnits('100.1234567', 6)).toBe(100_123_456n)
    })
  })

  describe('fromSmallestUnits', () => {
    it('should convert to human-readable', () => {
      expect(fromSmallestUnits(100_000_000n, 6)).toBe('100')
      expect(fromSmallestUnits(100_500_000n, 6)).toBe('100.5')
    })

    it('should handle small amounts', () => {
      expect(fromSmallestUnits(1n, 6)).toBe('0.000001')
      expect(fromSmallestUnits(1_000_000n, 9)).toBe('0.001')
    })

    it('should strip trailing zeros', () => {
      expect(fromSmallestUnits(100_000_000n, 6)).toBe('100')
      expect(fromSmallestUnits(100_100_000n, 6)).toBe('100.1')
    })
  })

  // ─── Homomorphic Addition ─────────────────────────────────────────────────

  describe('addCommitmentsSolana', () => {
    it('should add commitments homomorphically', () => {
      const c1 = commitSolana(100n)
      const c2 = commitSolana(50n)

      const sum = addCommitmentsSolana(c1.commitment, c2.commitment)
      const blindingSum = addBlindingsSolana(c1.blinding, c2.blinding)

      // The sum should verify for 150
      expect(verifyOpeningSolana(sum.commitment, 150n, blindingSum)).toBe(true)
    })

    it('should handle multiple additions', () => {
      const c1 = commitSolana(10n)
      const c2 = commitSolana(20n)
      const c3 = commitSolana(30n)

      const sum12 = addCommitmentsSolana(c1.commitment, c2.commitment)
      const blindSum12 = addBlindingsSolana(c1.blinding, c2.blinding)

      const sum123 = addCommitmentsSolana(sum12.commitment, c3.commitment)
      const blindSum123 = addBlindingsSolana(blindSum12, c3.blinding)

      expect(verifyOpeningSolana(sum123.commitment, 60n, blindSum123)).toBe(true)
    })

    it('should throw for invalid commitment', () => {
      expect(() => addCommitmentsSolana('invalid' as HexString, '0x' + '00'.repeat(32) as HexString)).toThrow()
    })
  })

  // ─── Homomorphic Subtraction ──────────────────────────────────────────────

  describe('subtractCommitmentsSolana', () => {
    it('should subtract commitments homomorphically', () => {
      const c1 = commitSolana(100n)
      const c2 = commitSolana(40n)

      const diff = subtractCommitmentsSolana(c1.commitment, c2.commitment)
      const blindingDiff = subtractBlindingsSolana(c1.blinding, c2.blinding)

      // The difference should verify for 60
      expect(verifyOpeningSolana(diff.commitment, 60n, blindingDiff)).toBe(true)
    })

    it('should handle subtraction to zero', () => {
      const blinding = new Uint8Array(32).fill(42)
      const c1 = commitSolana(100n, blinding)
      const c2 = commitSolana(100n, blinding)

      const diff = subtractCommitmentsSolana(c1.commitment, c2.commitment)

      // Result should be zero point
      expect(diff.commitment).toBe('0x' + '00'.repeat(32))
    })
  })

  // ─── Blinding Factor Operations ───────────────────────────────────────────

  describe('blinding operations', () => {
    it('should add blindings modulo curve order', () => {
      const b1 = generateBlindingSolana()
      const b2 = generateBlindingSolana()

      const sum = addBlindingsSolana(b1, b2)
      expect(sum).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should subtract blindings modulo curve order', () => {
      const b1 = generateBlindingSolana()
      const b2 = generateBlindingSolana()

      const diff = subtractBlindingsSolana(b1, b2)
      expect(diff).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should handle b1 - b1 = 0', () => {
      const b = generateBlindingSolana()
      const diff = subtractBlindingsSolana(b, b)

      expect(diff).toBe('0x' + '00'.repeat(32))
    })
  })

  // ─── Generators ───────────────────────────────────────────────────────────

  describe('getGeneratorsSolana', () => {
    it('should return valid generators', () => {
      const { G, H } = getGeneratorsSolana()

      expect(G).toMatch(/^0x[0-9a-f]{64}$/)
      expect(H).toMatch(/^0x[0-9a-f]{64}$/)
      expect(G).not.toBe(H) // G and H must be different
    })
  })

  describe('generateBlindingSolana', () => {
    it('should generate random 32-byte blinding', () => {
      const b1 = generateBlindingSolana()
      const b2 = generateBlindingSolana()

      expect(b1).toMatch(/^0x[0-9a-f]{64}$/)
      expect(b2).toMatch(/^0x[0-9a-f]{64}$/)
      expect(b1).not.toBe(b2) // Should be different
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle commitment arithmetic with zero', () => {
      const c1 = commitSolana(100n)
      const c0 = commitSolana(0n)

      const sum = addCommitmentsSolana(c1.commitment, c0.commitment)
      const blindSum = addBlindingsSolana(c1.blinding, c0.blinding)

      // 100 + 0 = 100
      expect(verifyOpeningSolana(sum.commitment, 100n, blindSum)).toBe(true)
    })

    it('should work with various SPL token amounts', () => {
      const amounts = [
        0n,
        1n,
        1000n,
        1_000_000n,
        1_000_000_000n,
        MAX_SPL_AMOUNT / 2n,
        MAX_SPL_AMOUNT,
      ]

      for (const amount of amounts) {
        const commitment = commitSolana(amount)
        expect(verifyOpeningSolana(commitment.commitment, amount, commitment.blinding)).toBe(true)
      }
    })

    it('should maintain hiding property', () => {
      // Different values with different blindings should produce different commitments
      const commitments = new Set<string>()

      for (let i = 0n; i < 100n; i++) {
        const { commitment } = commitSolana(i)
        commitments.add(commitment)
      }

      // All commitments should be unique
      expect(commitments.size).toBe(100)
    })
  })
})
