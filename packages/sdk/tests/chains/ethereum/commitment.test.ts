/**
 * Ethereum Pedersen Commitment Tests
 */

import { describe, it, expect } from 'vitest'
import {
  commitETH,
  verifyOpeningETH,
  commitERC20Token,
  verifyERC20TokenCommitment,
  addCommitmentsETH,
  subtractCommitmentsETH,
  addBlindingsETH,
  subtractBlindingsETH,
  getGeneratorsETH,
  generateBlindingETH,
  toWei,
  fromWei,
  createZeroCommitmentETH,
  isZeroCommitmentETH,
  SECP256K1_ORDER,
  MAX_COMMITMENT_VALUE,
} from '../../../src/chains/ethereum'

describe('Ethereum Pedersen Commitments', () => {
  describe('commitETH', () => {
    it('should create a commitment for ETH amount', () => {
      const amount = 10n ** 18n // 1 ETH in wei
      const commitment = commitETH(amount)

      expect(commitment.commitment).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(commitment.blinding).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should create unique commitments for same amount', () => {
      const amount = 10n ** 18n
      const c1 = commitETH(amount)
      const c2 = commitETH(amount)

      // Same amount should produce different commitments (different blindings)
      expect(c1.commitment).not.toBe(c2.commitment)
      expect(c1.blinding).not.toBe(c2.blinding)
    })

    it('should accept zero amount', () => {
      const commitment = commitETH(0n)
      expect(commitment.commitment).toMatch(/^0x[0-9a-f]{66}$/i)
    })

    it('should throw for negative amount', () => {
      expect(() => commitETH(-1n)).toThrow()
    })
  })

  describe('verifyOpeningETH', () => {
    it('should verify a valid commitment opening', () => {
      const amount = 1000n
      const commitment = commitETH(amount)

      const isValid = verifyOpeningETH(commitment.commitment, amount, commitment.blinding)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect amount', () => {
      const amount = 1000n
      const commitment = commitETH(amount)

      const isValid = verifyOpeningETH(commitment.commitment, 999n, commitment.blinding)
      expect(isValid).toBe(false)
    })

    it('should reject incorrect blinding', () => {
      const amount = 1000n
      const commitment = commitETH(amount)
      const wrongBlinding = generateBlindingETH()

      const isValid = verifyOpeningETH(commitment.commitment, amount, wrongBlinding)
      expect(isValid).toBe(false)
    })
  })

  describe('commitERC20Token', () => {
    it('should create a token commitment', () => {
      const amount = 100_000_000n // 100 USDC (6 decimals)
      const tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      const decimals = 6

      const commitment = commitERC20Token(amount, tokenContract, decimals)

      expect(commitment.commitment).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(commitment.tokenContract).toBe(tokenContract)
      expect(commitment.decimals).toBe(6)
      expect(commitment.amountRaw).toBe(amount)
    })
  })

  describe('verifyERC20TokenCommitment', () => {
    it('should verify a valid token commitment', () => {
      const amount = 50_000_000n // 50 USDC
      const tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

      const commitment = commitERC20Token(amount, tokenContract, 6)
      const isValid = verifyERC20TokenCommitment(commitment, amount)

      expect(isValid).toBe(true)
    })
  })

  describe('homomorphic operations', () => {
    it('should add commitments correctly', () => {
      const amount1 = 100n
      const amount2 = 50n
      const c1 = commitETH(amount1)
      const c2 = commitETH(amount2)

      const sumCommitment = addCommitmentsETH(c1.commitment, c2.commitment)
      const sumBlinding = addBlindingsETH(c1.blinding, c2.blinding)

      // Verify the sum commitment opens to amount1 + amount2
      const isValid = verifyOpeningETH(sumCommitment.commitment, amount1 + amount2, sumBlinding)
      expect(isValid).toBe(true)
    })

    it('should subtract commitments correctly', () => {
      const amount1 = 100n
      const amount2 = 30n
      const c1 = commitETH(amount1)
      const c2 = commitETH(amount2)

      const diffCommitment = subtractCommitmentsETH(c1.commitment, c2.commitment)
      const diffBlinding = subtractBlindingsETH(c1.blinding, c2.blinding)

      // Verify the difference commitment opens to amount1 - amount2
      const isValid = verifyOpeningETH(diffCommitment.commitment, amount1 - amount2, diffBlinding)
      expect(isValid).toBe(true)
    })

    it('should handle blinding subtraction with underflow', () => {
      const c1 = commitETH(50n)
      const c2 = commitETH(100n)

      // This should not throw - modular arithmetic handles underflow
      const diffBlinding = subtractBlindingsETH(c1.blinding, c2.blinding)
      expect(diffBlinding).toMatch(/^0x[0-9a-f]{64}$/i)
    })
  })

  describe('utility functions', () => {
    describe('getGeneratorsETH', () => {
      it('should return G and H generators', () => {
        const { G, H } = getGeneratorsETH()

        expect(G).toMatch(/^0x[0-9a-f]{66}$/i)
        expect(H).toMatch(/^0x[0-9a-f]{66}$/i)
        expect(G).not.toBe(H)
      })
    })

    describe('generateBlindingETH', () => {
      it('should generate a random blinding factor', () => {
        const b1 = generateBlindingETH()
        const b2 = generateBlindingETH()

        expect(b1).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(b2).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(b1).not.toBe(b2)
      })
    })

    describe('toWei', () => {
      it('should convert ETH to wei', () => {
        expect(toWei(1)).toBe(10n ** 18n)
        expect(toWei('1.5')).toBe(15n * 10n ** 17n)
        expect(toWei(0.001)).toBe(10n ** 15n)
      })

      it('should handle custom decimals', () => {
        expect(toWei(100, 6)).toBe(100_000_000n)
      })
    })

    describe('fromWei', () => {
      it('should convert wei to ETH', () => {
        expect(fromWei(10n ** 18n)).toBe('1')
        expect(fromWei(15n * 10n ** 17n)).toBe('1.5')
        expect(fromWei(10n ** 15n)).toBe('0.001')
      })

      it('should handle custom decimals', () => {
        expect(fromWei(100_000_000n, 6)).toBe('100')
      })
    })

    describe('createZeroCommitmentETH', () => {
      it('should create a commitment to zero', () => {
        const zero = createZeroCommitmentETH()
        expect(verifyOpeningETH(zero.commitment, 0n, zero.blinding)).toBe(true)
      })
    })

    describe('isZeroCommitmentETH', () => {
      it('should detect a zero commitment', () => {
        const zero = createZeroCommitmentETH()
        expect(isZeroCommitmentETH(zero.commitment, zero.blinding)).toBe(true)
      })

      it('should return false for non-zero commitment', () => {
        const nonZero = commitETH(100n)
        expect(isZeroCommitmentETH(nonZero.commitment, nonZero.blinding)).toBe(false)
      })
    })
  })

  describe('constants', () => {
    it('should have correct SECP256K1_ORDER', () => {
      // secp256k1 curve order
      expect(SECP256K1_ORDER).toBe(
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
      )
    })

    it('should have correct MAX_COMMITMENT_VALUE', () => {
      expect(MAX_COMMITMENT_VALUE).toBe(SECP256K1_ORDER - 1n)
    })
  })
})
