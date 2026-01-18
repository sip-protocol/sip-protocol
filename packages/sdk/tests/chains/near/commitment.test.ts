/**
 * NEAR Pedersen Commitment Tests
 *
 * Tests for M17-NEAR-03: NEAR commitment scheme for tokens
 */

import { describe, it, expect } from 'vitest'
import {
  commitNEAR,
  verifyOpeningNEAR,
  commitNEP141Token,
  verifyNEP141TokenCommitment,
  toYoctoNEAR,
  fromYoctoNEAR,
  addCommitmentsNEAR,
  subtractCommitmentsNEAR,
  addBlindingsNEAR,
  subtractBlindingsNEAR,
  getGeneratorsNEAR,
  generateBlindingNEAR,
  NEAR_ED25519_ORDER,
  MAX_NEAR_AMOUNT,
  NEAR_MAX_COMMITMENT_VALUE,
  ONE_NEAR,
} from '../../../src/chains/near'
import type { HexString } from '@sip-protocol/types'

describe('NEAR Pedersen Commitment (M17-NEAR-03)', () => {
  describe('commitNEAR', () => {
    it('should create a commitment to a value', () => {
      const value = 1000n
      const result = commitNEAR(value)

      expect(result.commitment).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.blinding).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should create different commitments for same value (randomized blinding)', () => {
      const value = 1000n
      const result1 = commitNEAR(value)
      const result2 = commitNEAR(value)

      expect(result1.commitment).not.toBe(result2.commitment)
      expect(result1.blinding).not.toBe(result2.blinding)
    })

    it('should create same commitment with same blinding', () => {
      const value = 1000n
      const blindingBytes = new Uint8Array(32)
      blindingBytes[0] = 1 // Non-zero blinding

      const result1 = commitNEAR(value, blindingBytes)
      const result2 = commitNEAR(value, blindingBytes)

      expect(result1.commitment).toBe(result2.commitment)
    })

    it('should handle zero value', () => {
      const result = commitNEAR(0n)

      expect(result.commitment).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.blinding).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should handle large values (1 NEAR in yoctoNEAR)', () => {
      const oneNEAR = ONE_NEAR
      const result = commitNEAR(oneNEAR)

      expect(result.commitment).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should throw for negative values', () => {
      expect(() => commitNEAR(-1n)).toThrow(/non-negative/)
    })

    it('should throw for values >= curve order', () => {
      expect(() => commitNEAR(NEAR_ED25519_ORDER)).toThrow(/curve order/)
    })

    it('should throw for non-bigint values', () => {
      // @ts-expect-error Testing runtime type check
      expect(() => commitNEAR(1000)).toThrow(/bigint/)
    })
  })

  describe('verifyOpeningNEAR', () => {
    it('should verify correct opening', () => {
      const value = 1000n
      const { commitment, blinding } = commitNEAR(value)

      const isValid = verifyOpeningNEAR(commitment, value, blinding)

      expect(isValid).toBe(true)
    })

    it('should reject wrong value', () => {
      const value = 1000n
      const { commitment, blinding } = commitNEAR(value)

      const isValid = verifyOpeningNEAR(commitment, 999n, blinding)

      expect(isValid).toBe(false)
    })

    it('should reject wrong blinding', () => {
      const value = 1000n
      const { commitment } = commitNEAR(value)
      const { blinding: wrongBlinding } = commitNEAR(value)

      const isValid = verifyOpeningNEAR(commitment, value, wrongBlinding)

      expect(isValid).toBe(false)
    })

    it('should verify zero value commitment', () => {
      const { commitment, blinding } = commitNEAR(0n)

      const isValid = verifyOpeningNEAR(commitment, 0n, blinding)

      expect(isValid).toBe(true)
    })

    it('should verify large value commitment', () => {
      const value = ONE_NEAR * 1000n // 1000 NEAR
      const { commitment, blinding } = commitNEAR(value)

      const isValid = verifyOpeningNEAR(commitment, value, blinding)

      expect(isValid).toBe(true)
    })
  })

  describe('NEP-141 Token Commitments', () => {
    describe('commitNEP141Token', () => {
      it('should create token commitment with metadata', () => {
        const amount = 100_000_000n // 100 USDC (6 decimals)
        const tokenContract = 'usdc.near'
        const decimals = 6

        const result = commitNEP141Token(amount, tokenContract, decimals)

        expect(result.commitment).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(result.blinding).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(result.tokenContract).toBe(tokenContract)
        expect(result.decimals).toBe(decimals)
        expect(result.amountRaw).toBe(amount)
      })

      it('should create native NEAR commitment', () => {
        const amount = ONE_NEAR // 1 NEAR
        const result = commitNEP141Token(amount, 'wrap.near', 24)

        expect(result.decimals).toBe(24)
        expect(result.amountRaw).toBe(amount)
      })

      it('should throw for negative amount', () => {
        expect(() => commitNEP141Token(-1n, 'token.near', 6)).toThrow()
      })

      it('should throw for amount exceeding curve order', () => {
        expect(() =>
          commitNEP141Token(NEAR_ED25519_ORDER, 'token.near', 6)
        ).toThrow(/u128|exceeds/)
      })

      it('should throw for invalid decimals', () => {
        expect(() => commitNEP141Token(100n, 'token.near', -1)).toThrow(/decimals/)
        expect(() => commitNEP141Token(100n, 'token.near', 25)).toThrow(/decimals/)
        expect(() => commitNEP141Token(100n, 'token.near', 6.5)).toThrow(
          /decimals/
        )
      })
    })

    describe('verifyNEP141TokenCommitment', () => {
      it('should verify correct token commitment', () => {
        const amount = 100_000_000n
        const commitment = commitNEP141Token(amount, 'usdc.near', 6)

        const isValid = verifyNEP141TokenCommitment(commitment, amount)

        expect(isValid).toBe(true)
      })

      it('should reject wrong amount', () => {
        const amount = 100_000_000n
        const commitment = commitNEP141Token(amount, 'usdc.near', 6)

        const isValid = verifyNEP141TokenCommitment(commitment, 99_000_000n)

        expect(isValid).toBe(false)
      })
    })
  })

  describe('Amount Conversion', () => {
    describe('toYoctoNEAR', () => {
      it('should convert whole numbers', () => {
        expect(toYoctoNEAR(1, 24)).toBe(ONE_NEAR)
        expect(toYoctoNEAR(100, 6)).toBe(100_000_000n)
      })

      it('should convert decimal amounts', () => {
        expect(toYoctoNEAR(0.5, 24)).toBe(ONE_NEAR / 2n)
        expect(toYoctoNEAR(100.5, 6)).toBe(100_500_000n)
      })

      it('should handle string input', () => {
        expect(toYoctoNEAR('1', 24)).toBe(ONE_NEAR)
        expect(toYoctoNEAR('100.5', 6)).toBe(100_500_000n)
      })

      it('should truncate excess decimals', () => {
        expect(toYoctoNEAR(1.123456789, 6)).toBe(1_123_456n)
      })
    })

    describe('fromYoctoNEAR', () => {
      it('should convert to whole numbers', () => {
        expect(fromYoctoNEAR(ONE_NEAR, 24)).toBe('1')
        expect(fromYoctoNEAR(100_000_000n, 6)).toBe('100')
      })

      it('should convert to decimals', () => {
        expect(fromYoctoNEAR(ONE_NEAR / 2n, 24)).toBe('0.5')
        expect(fromYoctoNEAR(100_500_000n, 6)).toBe('100.5')
      })

      it('should remove trailing zeros', () => {
        expect(fromYoctoNEAR(1_000_000n, 6)).toBe('1')
        expect(fromYoctoNEAR(1_500_000n, 6)).toBe('1.5')
      })

      it('should handle zero', () => {
        expect(fromYoctoNEAR(0n, 24)).toBe('0')
      })
    })

    it('should roundtrip correctly', () => {
      const original = 123.456789
      const decimals = 6
      const yocto = toYoctoNEAR(original, decimals)
      const back = fromYoctoNEAR(yocto, decimals)

      expect(back).toBe('123.456789')
    })
  })

  describe('Homomorphic Operations', () => {
    describe('addCommitmentsNEAR', () => {
      it('should add commitments homomorphically', () => {
        const v1 = 1000n
        const v2 = 2000n

        const c1 = commitNEAR(v1)
        const c2 = commitNEAR(v2)

        const sum = addCommitmentsNEAR(c1.commitment, c2.commitment)

        expect(sum.commitment).toMatch(/^0x[0-9a-f]{64}$/i)

        // Verify with combined blinding
        const combinedBlinding = addBlindingsNEAR(c1.blinding, c2.blinding)
        const isValid = verifyOpeningNEAR(
          sum.commitment,
          v1 + v2,
          combinedBlinding
        )
        expect(isValid).toBe(true)
      })

      it('should throw for invalid hex', () => {
        expect(() => addCommitmentsNEAR('invalid', '0x' + '00'.repeat(32))).toThrow(
          /valid hex/
        )
      })
    })

    describe('subtractCommitmentsNEAR', () => {
      it('should subtract commitments homomorphically', () => {
        const v1 = 3000n
        const v2 = 1000n

        const c1 = commitNEAR(v1)
        const c2 = commitNEAR(v2)

        const diff = subtractCommitmentsNEAR(c1.commitment, c2.commitment)

        expect(diff.commitment).toMatch(/^0x[0-9a-f]{64}$/i)

        // Verify with subtracted blinding
        const diffBlinding = subtractBlindingsNEAR(c1.blinding, c2.blinding)
        const isValid = verifyOpeningNEAR(diff.commitment, v1 - v2, diffBlinding)
        expect(isValid).toBe(true)
      })

      it('should handle equal commitments (zero result)', () => {
        const value = 1000n
        const { commitment, blinding } = commitNEAR(value)

        const diff = subtractCommitmentsNEAR(commitment, commitment)

        // Result should be a zero point
        expect(diff.commitment).toMatch(/^0x/)
      })
    })

    describe('addBlindingsNEAR', () => {
      it('should add blindings mod curve order', () => {
        const b1 = generateBlindingNEAR()
        const b2 = generateBlindingNEAR()

        const sum = addBlindingsNEAR(b1, b2)

        expect(sum).toMatch(/^0x[0-9a-f]{64}$/i)
      })

      it('should be commutative', () => {
        const b1 = generateBlindingNEAR()
        const b2 = generateBlindingNEAR()

        const sum1 = addBlindingsNEAR(b1, b2)
        const sum2 = addBlindingsNEAR(b2, b1)

        expect(sum1).toBe(sum2)
      })
    })

    describe('subtractBlindingsNEAR', () => {
      it('should subtract blindings mod curve order', () => {
        const b1 = generateBlindingNEAR()
        const b2 = generateBlindingNEAR()

        const diff = subtractBlindingsNEAR(b1, b2)

        expect(diff).toMatch(/^0x[0-9a-f]{64}$/i)
      })

      it('should give identity when subtracting same value', () => {
        const b = generateBlindingNEAR()
        const diff = subtractBlindingsNEAR(b, b)

        expect(diff).toBe('0x' + '00'.repeat(32))
      })
    })
  })

  describe('Utility Functions', () => {
    describe('getGeneratorsNEAR', () => {
      it('should return G and H generators', () => {
        const { G, H } = getGeneratorsNEAR()

        expect(G).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(H).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(G).not.toBe(H)
      })

      it('should return consistent generators', () => {
        const result1 = getGeneratorsNEAR()
        const result2 = getGeneratorsNEAR()

        expect(result1.G).toBe(result2.G)
        expect(result1.H).toBe(result2.H)
      })
    })

    describe('generateBlindingNEAR', () => {
      it('should generate valid blinding factor', () => {
        const blinding = generateBlindingNEAR()

        expect(blinding).toMatch(/^0x[0-9a-f]{64}$/i)
      })

      it('should generate unique blindings', () => {
        const b1 = generateBlindingNEAR()
        const b2 = generateBlindingNEAR()

        expect(b1).not.toBe(b2)
      })
    })
  })

  describe('Constants', () => {
    it('should have correct curve order', () => {
      expect(NEAR_ED25519_ORDER).toBe(
        2n ** 252n + 27742317777372353535851937790883648493n
      )
    })

    it('should have correct max NEAR amount (u128)', () => {
      expect(MAX_NEAR_AMOUNT).toBe(2n ** 128n - 1n)
    })

    it('should have max commitment value less than curve order', () => {
      expect(NEAR_MAX_COMMITMENT_VALUE).toBe(NEAR_ED25519_ORDER - 1n)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large valid values', () => {
      const largeValue = NEAR_MAX_COMMITMENT_VALUE - 1n
      const { commitment, blinding } = commitNEAR(largeValue)

      const isValid = verifyOpeningNEAR(commitment, largeValue, blinding)
      expect(isValid).toBe(true)
    })

    it('should handle commitment of 1', () => {
      const { commitment, blinding } = commitNEAR(1n)
      const isValid = verifyOpeningNEAR(commitment, 1n, blinding)
      expect(isValid).toBe(true)
    })

    it('should handle many sequential operations', () => {
      const values = [100n, 200n, 300n, 400n, 500n]
      const commitments = values.map((v) => commitNEAR(v))

      // Add all commitments
      let sumCommitment = commitments[0].commitment
      let sumBlinding = commitments[0].blinding

      for (let i = 1; i < commitments.length; i++) {
        const added = addCommitmentsNEAR(sumCommitment, commitments[i].commitment)
        sumCommitment = added.commitment
        sumBlinding = addBlindingsNEAR(sumBlinding, commitments[i].blinding)
      }

      // Verify sum
      const totalValue = values.reduce((a, b) => a + b, 0n)
      const isValid = verifyOpeningNEAR(sumCommitment, totalValue, sumBlinding)
      expect(isValid).toBe(true)
    })
  })
})
