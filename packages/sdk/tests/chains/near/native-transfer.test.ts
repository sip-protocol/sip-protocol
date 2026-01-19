/**
 * Tests for NEAR Native Transfer with Stealth Addresses
 *
 * @module tests/chains/near/native-transfer
 */

import { describe, it, expect } from 'vitest'
import {
  // Privacy-wrapped transfers
  buildPrivateNativeTransferWithCommitment,
  buildBatchPrivateNativeTransfer,
  // Gas sponsorship
  buildGasSponsoredTransfer,
  // Account creation helpers
  getAccountCreationCost,
  meetsMinimumBalance,
  calculateRecommendedAmount,
  adjustTransferAmount,
  // Amount formatting
  formatNEARAmount,
  parseNEARAmount,
  // Commitment verification
  verifyNativeTransferCommitment,
  createTransferCommitmentProof,
  // Constants
  IMPLICIT_ACCOUNT_CREATION_COST,
  STORAGE_COST_PER_BYTE,
  RECOMMENDED_STEALTH_MINIMUM,
  RELAYER_GAS,
  // Dependencies
  generateNEARStealthMetaAddress,
  ONE_NEAR,
  verifyOpeningNEAR,
} from '../../../src/chains/near'

describe('Native NEAR Transfer with Stealth Addresses', () => {
  // Generate test meta-address
  const { metaAddress } = generateNEARStealthMetaAddress()

  describe('buildPrivateNativeTransferWithCommitment', () => {
    it('should build native NEAR transfer with amount commitment', () => {
      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
        hideAmount: true,
      })

      expect(result.transfer).toBeDefined()
      expect(result.commitment).toBeDefined()
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.minimumBalance).toBe(IMPLICIT_ACCOUNT_CREATION_COST)
      expect(result.meetsMinimum).toBe(true)

      // Verify commitment can be opened
      expect(
        verifyOpeningNEAR(result.commitment!.commitment, ONE_NEAR, result.commitment!.blinding)
      ).toBe(true)
    })

    it('should build native transfer without commitment', () => {
      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
        hideAmount: false,
      })

      expect(result.transfer).toBeDefined()
      expect(result.commitment).toBeUndefined()
      expect(result.stealthAddress).toBeDefined()
    })

    it('should indicate when transfer is below minimum', () => {
      const smallAmount = IMPLICIT_ACCOUNT_CREATION_COST / 2n

      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: smallAmount,
        hideAmount: false,
      })

      expect(result.meetsMinimum).toBe(false)
      expect(result.minimumBalance).toBe(IMPLICIT_ACCOUNT_CREATION_COST)
    })

    it('should generate unique stealth addresses', () => {
      const result1 = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
      })
      const result2 = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
      })

      expect(result1.stealthAccountId).not.toBe(result2.stealthAccountId)
    })

    it('should build correct transfer action', () => {
      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
      })

      expect(result.transfer.actions.length).toBe(1)
      expect(result.transfer.actions[0].type).toBe('Transfer')

      const params = result.transfer.actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(ONE_NEAR)
    })

    it('should throw for zero amount', () => {
      expect(() =>
        buildPrivateNativeTransferWithCommitment({
          recipientMetaAddress: metaAddress,
          amount: 0n,
        })
      ).toThrow('amount must be greater than 0')
    })

    it('should throw for wrong chain', () => {
      const wrongChain = {
        chain: 'solana' as const,
        spendingKey: metaAddress.spendingKey,
        viewingKey: metaAddress.viewingKey,
      }

      expect(() =>
        buildPrivateNativeTransferWithCommitment({
          recipientMetaAddress: wrongChain,
          amount: ONE_NEAR,
        })
      ).toThrow("Expected NEAR meta-address, got chain 'solana'")
    })
  })

  describe('buildBatchPrivateNativeTransfer', () => {
    it('should build batch transfers', () => {
      const meta1 = generateNEARStealthMetaAddress()
      const meta2 = generateNEARStealthMetaAddress()
      const meta3 = generateNEARStealthMetaAddress()

      const result = buildBatchPrivateNativeTransfer({
        transfers: [
          { recipientMetaAddress: meta1.metaAddress, amount: ONE_NEAR },
          { recipientMetaAddress: meta2.metaAddress, amount: 2n * ONE_NEAR },
          { recipientMetaAddress: meta3.metaAddress, amount: 500_000_000_000_000_000_000_000n },
        ],
      })

      expect(result.transfers.length).toBe(3)
      expect(result.transactions.length).toBe(3)
      expect(result.totalAmount).toBe(35n * ONE_NEAR / 10n)

      // Each should be a separate transaction
      expect(result.transactions[0].receiverId).toBe(result.transfers[0].stealthAccountId)
      expect(result.transactions[1].receiverId).toBe(result.transfers[1].stealthAccountId)
    })

    it('should build batch transfers with commitments', () => {
      const meta1 = generateNEARStealthMetaAddress()
      const meta2 = generateNEARStealthMetaAddress()

      const result = buildBatchPrivateNativeTransfer({
        transfers: [
          { recipientMetaAddress: meta1.metaAddress, amount: ONE_NEAR },
          { recipientMetaAddress: meta2.metaAddress, amount: 2n * ONE_NEAR },
        ],
        hideAmounts: true,
      })

      expect(result.transfers[0].commitment).toBeDefined()
      expect(result.transfers[1].commitment).toBeDefined()

      // Verify commitments
      expect(
        verifyOpeningNEAR(
          result.transfers[0].commitment!.commitment,
          ONE_NEAR,
          result.transfers[0].commitment!.blinding
        )
      ).toBe(true)
    })

    it('should count valid transfers', () => {
      const meta1 = generateNEARStealthMetaAddress()
      const meta2 = generateNEARStealthMetaAddress()

      const result = buildBatchPrivateNativeTransfer({
        transfers: [
          { recipientMetaAddress: meta1.metaAddress, amount: ONE_NEAR }, // Valid
          { recipientMetaAddress: meta2.metaAddress, amount: 1000n }, // Below minimum
        ],
      })

      expect(result.validTransferCount).toBe(1)
    })

    it('should throw for empty transfers', () => {
      expect(() =>
        buildBatchPrivateNativeTransfer({
          transfers: [],
        })
      ).toThrow('At least one transfer is required')
    })

    it('should throw for too many transfers', () => {
      const transfers = Array(101).fill(null).map(() => ({
        recipientMetaAddress: generateNEARStealthMetaAddress().metaAddress,
        amount: ONE_NEAR,
      }))

      expect(() =>
        buildBatchPrivateNativeTransfer({ transfers })
      ).toThrow('Maximum 100 transfers per batch')
    })
  })

  describe('buildGasSponsoredTransfer', () => {
    it('should build gas-sponsored transfer', () => {
      const result = buildGasSponsoredTransfer({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
        relayerAccountId: 'relayer.near',
      })

      expect(result.relayerActions).toBeDefined()
      expect(result.relayerActions.length).toBe(1)
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.announcementMemo).toBeDefined()
      expect(result.estimatedFee).toBeGreaterThan(0n)
    })

    it('should build gas-sponsored transfer with commitment', () => {
      const result = buildGasSponsoredTransfer({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
        relayerAccountId: 'relayer.near',
        hideAmount: true,
      })

      expect(result.commitment).toBeDefined()
      expect(
        verifyOpeningNEAR(result.commitment!.commitment, ONE_NEAR, result.commitment!.blinding)
      ).toBe(true)
    })

    it('should throw for invalid relayer', () => {
      expect(() =>
        buildGasSponsoredTransfer({
          recipientMetaAddress: metaAddress,
          amount: ONE_NEAR,
          relayerAccountId: '',
        })
      ).toThrow('Invalid relayerAccountId')
    })
  })

  describe('getAccountCreationCost', () => {
    it('should return correct cost values', () => {
      const cost = getAccountCreationCost()

      expect(cost.minimumBalance).toBe(IMPLICIT_ACCOUNT_CREATION_COST)
      expect(cost.storagePerByte).toBe(STORAGE_COST_PER_BYTE)
      expect(cost.recommendedMinimum).toBe(RECOMMENDED_STEALTH_MINIMUM)
    })
  })

  describe('meetsMinimumBalance', () => {
    it('should return true for sufficient amount', () => {
      expect(meetsMinimumBalance(ONE_NEAR)).toBe(true)
      expect(meetsMinimumBalance(IMPLICIT_ACCOUNT_CREATION_COST)).toBe(true)
    })

    it('should return false for insufficient amount', () => {
      expect(meetsMinimumBalance(1000n)).toBe(false)
      expect(meetsMinimumBalance(IMPLICIT_ACCOUNT_CREATION_COST - 1n)).toBe(false)
    })
  })

  describe('calculateRecommendedAmount', () => {
    it('should return original amount if above recommended', () => {
      expect(calculateRecommendedAmount(ONE_NEAR)).toBe(ONE_NEAR)
      expect(calculateRecommendedAmount(10n * ONE_NEAR)).toBe(10n * ONE_NEAR)
    })

    it('should return recommended minimum for small amounts', () => {
      expect(calculateRecommendedAmount(1000n)).toBe(RECOMMENDED_STEALTH_MINIMUM)
    })
  })

  describe('adjustTransferAmount', () => {
    it('should not adjust amount above minimum', () => {
      const result = adjustTransferAmount(ONE_NEAR)

      expect(result.amount).toBe(ONE_NEAR)
      expect(result.adjusted).toBe(false)
      expect(result.originalAmount).toBe(ONE_NEAR)
    })

    it('should adjust amount below minimum', () => {
      const result = adjustTransferAmount(1000n)

      expect(result.amount).toBe(IMPLICIT_ACCOUNT_CREATION_COST)
      expect(result.adjusted).toBe(true)
      expect(result.originalAmount).toBe(1000n)
    })

    it('should not adjust when ensureMinimum is false', () => {
      const result = adjustTransferAmount(1000n, false)

      expect(result.amount).toBe(1000n)
      expect(result.adjusted).toBe(false)
    })
  })

  describe('formatNEARAmount', () => {
    it('should format whole numbers', () => {
      expect(formatNEARAmount(ONE_NEAR)).toBe('1 NEAR')
      expect(formatNEARAmount(10n * ONE_NEAR)).toBe('10 NEAR')
    })

    it('should format decimals', () => {
      expect(formatNEARAmount(ONE_NEAR / 2n)).toBe('0.5 NEAR')
      expect(formatNEARAmount(ONE_NEAR + ONE_NEAR / 4n)).toBe('1.25 NEAR')
    })

    it('should format small amounts', () => {
      expect(formatNEARAmount(1n)).toBe('0.000000000000000000000001 NEAR')
    })

    it('should format zero', () => {
      expect(formatNEARAmount(0n)).toBe('0 NEAR')
    })
  })

  describe('parseNEARAmount', () => {
    it('should parse whole numbers', () => {
      expect(parseNEARAmount('1')).toBe(ONE_NEAR)
      expect(parseNEARAmount('10')).toBe(10n * ONE_NEAR)
    })

    it('should parse decimals', () => {
      expect(parseNEARAmount('0.5')).toBe(ONE_NEAR / 2n)
      expect(parseNEARAmount('1.25')).toBe(ONE_NEAR + ONE_NEAR / 4n)
    })

    it('should parse amounts with NEAR suffix', () => {
      expect(parseNEARAmount('1 NEAR')).toBe(ONE_NEAR)
      expect(parseNEARAmount('2.5 NEAR')).toBe(25n * ONE_NEAR / 10n)
    })
  })

  describe('verifyNativeTransferCommitment', () => {
    it('should verify correct commitment', () => {
      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
        hideAmount: true,
      })

      expect(
        verifyNativeTransferCommitment(result.commitment!, ONE_NEAR)
      ).toBe(true)
    })

    it('should reject incorrect amount', () => {
      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        amount: ONE_NEAR,
        hideAmount: true,
      })

      expect(
        verifyNativeTransferCommitment(result.commitment!, 2n * ONE_NEAR)
      ).toBe(false)
    })
  })

  describe('createTransferCommitmentProof', () => {
    it('should create commitment proof', () => {
      const proof = createTransferCommitmentProof(ONE_NEAR)

      expect(proof.commitment).toBeDefined()
      expect(proof.amount).toBe(ONE_NEAR)
      expect(proof.amountFormatted).toBe('1 NEAR')

      // Verify commitment
      expect(
        verifyOpeningNEAR(proof.commitment.commitment, ONE_NEAR, proof.commitment.blinding)
      ).toBe(true)
    })
  })

  describe('constants', () => {
    it('should have expected values', () => {
      expect(IMPLICIT_ACCOUNT_CREATION_COST).toBe(1_820_000_000_000_000_000_000n)
      expect(STORAGE_COST_PER_BYTE).toBe(10_000_000_000_000_000_000n)
      expect(RECOMMENDED_STEALTH_MINIMUM).toBe(10_000_000_000_000_000_000_000n)
      expect(RELAYER_GAS).toBe(100_000_000_000_000n)
    })
  })

  describe('integration: full native transfer flow', () => {
    it('should complete send with commitment flow', () => {
      // 1. Recipient generates meta-address
      const recipient = generateNEARStealthMetaAddress('Recipient')

      // 2. Sender checks minimum balance
      const cost = getAccountCreationCost()

      // 3. Sender builds private transfer with commitment
      const result = buildPrivateNativeTransferWithCommitment({
        recipientMetaAddress: recipient.metaAddress,
        amount: ONE_NEAR,
        hideAmount: true,
      })

      // 4. Verify transfer meets minimum
      expect(result.meetsMinimum).toBe(true)

      // 5. Verify commitment can be opened with correct amount
      expect(result.commitment).toBeDefined()
      expect(
        verifyNativeTransferCommitment(result.commitment!, ONE_NEAR)
      ).toBe(true)

      // 6. Verify commitment cannot be opened with wrong amount
      expect(
        verifyNativeTransferCommitment(result.commitment!, 999_999_999n)
      ).toBe(false)
    })

    it('should complete batch transfer flow', () => {
      // 1. Multiple recipients generate meta-addresses
      const recipient1 = generateNEARStealthMetaAddress('Recipient 1')
      const recipient2 = generateNEARStealthMetaAddress('Recipient 2')

      // 2. Sender builds batch transfer
      const result = buildBatchPrivateNativeTransfer({
        transfers: [
          { recipientMetaAddress: recipient1.metaAddress, amount: ONE_NEAR },
          { recipientMetaAddress: recipient2.metaAddress, amount: 2n * ONE_NEAR },
        ],
        hideAmounts: true,
      })

      // 3. Verify batch
      expect(result.totalAmount).toBe(3n * ONE_NEAR)
      expect(result.transfers.length).toBe(2)
      expect(result.validTransferCount).toBe(2)

      // 4. Each transfer has unique stealth address and valid commitment
      expect(result.transfers[0].stealthAccountId).not.toBe(
        result.transfers[1].stealthAccountId
      )

      expect(
        verifyOpeningNEAR(
          result.transfers[0].commitment!.commitment,
          ONE_NEAR,
          result.transfers[0].commitment!.blinding
        )
      ).toBe(true)
      expect(
        verifyOpeningNEAR(
          result.transfers[1].commitment!.commitment,
          2n * ONE_NEAR,
          result.transfers[1].commitment!.blinding
        )
      ).toBe(true)
    })
  })
})
