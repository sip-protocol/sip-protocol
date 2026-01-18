/**
 * Native SOL Transfer Tests
 *
 * Tests for SOL transfers to stealth addresses.
 */

import { describe, it, expect, vi } from 'vitest'
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  validateSOLTransfer,
  estimateSOLTransfer,
  sendSOLTransfer,
  sendMaxSOLTransfer,
  sendBatchSOLTransfer,
  formatLamports,
  parseSOLToLamports,
  getSOLBalance,
  RENT_EXEMPT_MINIMUM,
  STEALTH_ACCOUNT_BUFFER,
} from '../../../src/chains/solana/sol-transfer'
import type { StealthMetaAddress } from '@sip-protocol/types'

// Mock the stealth module to avoid ed25519 key validation issues
vi.mock('../../../src/stealth', () => ({
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'ab'.repeat(32),
      ephemeralPublicKey: '0x' + 'cd'.repeat(32),
      viewTag: 42,
    },
  }),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue('7777777777777777777777777777777777777777777'),
}))

// Mock connection
const createMockConnection = (balance: number = 5 * LAMPORTS_PER_SOL) => {
  return {
    getBalance: vi.fn().mockResolvedValue(balance),
    getAccountInfo: vi.fn().mockResolvedValue(null), // Account doesn't exist by default
    getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(890880),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
      lastValidBlockHeight: 1000,
    }),
    sendRawTransaction: vi.fn().mockResolvedValue('mockTxSignature123'),
    confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  } as unknown as Connection
}

// Test data
const mockMetaAddress: StealthMetaAddress = {
  chain: 'solana',
  spendingKey: ('0x' + '01'.repeat(32)) as `0x${string}`,
  viewingKey: ('0x' + '02'.repeat(32)) as `0x${string}`,
}

const mockSignTransaction = vi.fn().mockImplementation(async (tx) => {
  // Mock the serialize method to avoid signature verification
  tx.serialize = vi.fn().mockReturnValue(Buffer.from([0, 1, 2, 3]))
  return tx
})

describe('SOL Transfer', () => {
  // ─── Constants ──────────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have rent-exempt minimum', () => {
      expect(RENT_EXEMPT_MINIMUM).toBe(890_880n)
    })

    it('should have stealth account buffer', () => {
      expect(STEALTH_ACCOUNT_BUFFER).toBe(1_000_000n)
    })
  })

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('validateSOLTransfer', () => {
    it('should validate valid transfer', async () => {
      const connection = createMockConnection()

      const validation = await validateSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.senderBalance).toBe(BigInt(5 * LAMPORTS_PER_SOL))
    })

    it('should reject invalid chain', async () => {
      const connection = createMockConnection()

      const validation = await validateSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: { ...mockMetaAddress, chain: 'ethereum' },
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain("Invalid chain: expected 'solana', got 'ethereum'")
    })

    it('should reject zero amount', async () => {
      const connection = createMockConnection()

      const validation = await validateSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: 0n,
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Amount must be greater than 0')
    })

    it('should reject insufficient balance', async () => {
      const connection = createMockConnection(100_000) // Very low balance

      const validation = await validateSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('Insufficient balance'))).toBe(true)
    })

    it('should reject amount below rent-exempt minimum for new accounts', async () => {
      const connection = createMockConnection()

      const validation = await validateSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: 1000n, // Way below minimum
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('rent-exempt minimum'))).toBe(true)
    })

    it('should calculate max transferable', async () => {
      const connection = createMockConnection(5 * LAMPORTS_PER_SOL)

      const validation = await validateSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      expect(validation.maxTransferable).toBeDefined()
      expect(validation.maxTransferable!).toBeGreaterThan(0n)
    })
  })

  // ─── Estimation ─────────────────────────────────────────────────────────────

  describe('estimateSOLTransfer', () => {
    it('should estimate for new account', async () => {
      const connection = createMockConnection()

      const estimate = await estimateSOLTransfer(connection, mockMetaAddress)

      expect(estimate.baseFee).toBeGreaterThan(0n)
      expect(estimate.rentBuffer).toBe(STEALTH_ACCOUNT_BUFFER)
      expect(estimate.stealthAccountExists).toBe(false)
      expect(estimate.totalCost).toBe(estimate.baseFee + estimate.rentBuffer)
    })

    it('should estimate for existing account', async () => {
      const connection = createMockConnection()
      vi.mocked(connection.getAccountInfo).mockResolvedValueOnce({
        data: Buffer.from([]),
        executable: false,
        lamports: LAMPORTS_PER_SOL,
        owner: PublicKey.default,
        rentEpoch: 0,
      })

      const estimate = await estimateSOLTransfer(connection, mockMetaAddress)

      expect(estimate.rentBuffer).toBe(0n)
      expect(estimate.stealthAccountExists).toBe(true)
    })
  })

  // ─── Format & Parse ─────────────────────────────────────────────────────────

  describe('formatLamports', () => {
    it('should format lamports to SOL', () => {
      expect(formatLamports(BigInt(LAMPORTS_PER_SOL))).toBe('1')
      expect(formatLamports(BigInt(LAMPORTS_PER_SOL * 1.5))).toBe('1.5')
      expect(formatLamports(BigInt(LAMPORTS_PER_SOL * 0.001))).toBe('0.001')
    })

    it('should handle zero', () => {
      expect(formatLamports(0n)).toBe('0')
    })

    it('should handle very small amounts', () => {
      expect(formatLamports(100n)).toMatch(/e-/)
    })
  })

  describe('parseSOLToLamports', () => {
    it('should parse SOL string to lamports', () => {
      expect(parseSOLToLamports('1')).toBe(BigInt(LAMPORTS_PER_SOL))
      expect(parseSOLToLamports('0.5')).toBe(BigInt(LAMPORTS_PER_SOL / 2))
      expect(parseSOLToLamports('1.5')).toBe(BigInt(LAMPORTS_PER_SOL * 1.5))
    })

    it('should parse number to lamports', () => {
      expect(parseSOLToLamports(1)).toBe(BigInt(LAMPORTS_PER_SOL))
      expect(parseSOLToLamports(0.001)).toBe(BigInt(LAMPORTS_PER_SOL / 1000))
    })

    it('should throw on invalid input', () => {
      expect(() => parseSOLToLamports('abc')).toThrow()
      expect(() => parseSOLToLamports(-1)).toThrow()
    })
  })

  // ─── Balance ────────────────────────────────────────────────────────────────

  describe('getSOLBalance', () => {
    it('should get SOL balance', async () => {
      const connection = createMockConnection(5 * LAMPORTS_PER_SOL)

      const balance = await getSOLBalance(connection, Keypair.generate().publicKey)

      expect(balance.lamports).toBe(BigInt(5 * LAMPORTS_PER_SOL))
      expect(balance.sol).toBe(5)
    })
  })

  // ─── Send Transfer ──────────────────────────────────────────────────────────

  describe('sendSOLTransfer', () => {
    it('should send SOL transfer', async () => {
      const connection = createMockConnection()

      const result = await sendSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
        signTransaction: mockSignTransaction,
      })

      expect(result.txSignature).toBe('mockTxSignature123')
      expect(result.stealthAddress).toBeDefined()
      expect(result.ephemeralPublicKey).toBeDefined()
      expect(result.amount).toBe(BigInt(LAMPORTS_PER_SOL))
      expect(result.amountSol).toBe(1)
    })

    it('should reject invalid meta-address chain', async () => {
      const connection = createMockConnection()

      await expect(
        sendSOLTransfer({
          connection,
          sender: Keypair.generate().publicKey,
          recipientMetaAddress: { ...mockMetaAddress, chain: 'ethereum' },
          amount: BigInt(LAMPORTS_PER_SOL),
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow("Invalid chain: expected 'solana'")
    })

    it('should reject zero amount', async () => {
      const connection = createMockConnection()

      await expect(
        sendSOLTransfer({
          connection,
          sender: Keypair.generate().publicKey,
          recipientMetaAddress: mockMetaAddress,
          amount: 0n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('amount must be greater than 0')
    })

    it('should reject amount below rent minimum for new accounts', async () => {
      const connection = createMockConnection()

      await expect(
        sendSOLTransfer({
          connection,
          sender: Keypair.generate().publicKey,
          recipientMetaAddress: mockMetaAddress,
          amount: 1000n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('rent-exempt minimum')
    })
  })

  // ─── Max Transfer ───────────────────────────────────────────────────────────

  describe('sendMaxSOLTransfer', () => {
    it('should send max available SOL', async () => {
      const connection = createMockConnection(5 * LAMPORTS_PER_SOL)

      const result = await sendMaxSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        signTransaction: mockSignTransaction,
      })

      expect(result.txSignature).toBe('mockTxSignature123')
      // Should be close to 5 SOL minus fees
      expect(result.amountSol).toBeGreaterThan(4.99)
    })

    it('should respect keepMinimum', async () => {
      const connection = createMockConnection(5 * LAMPORTS_PER_SOL)

      const result = await sendMaxSOLTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        keepMinimum: BigInt(LAMPORTS_PER_SOL), // Keep 1 SOL
        signTransaction: mockSignTransaction,
      })

      // Should be close to 4 SOL (5 - 1 kept - fees)
      expect(result.amountSol).toBeLessThan(4)
      expect(result.amountSol).toBeGreaterThan(3.99)
    })

    it('should reject if insufficient balance for max transfer', async () => {
      const connection = createMockConnection(5000) // Very low balance

      await expect(
        sendMaxSOLTransfer({
          connection,
          sender: Keypair.generate().publicKey,
          recipientMetaAddress: mockMetaAddress,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('Insufficient balance')
    })
  })

  // ─── Batch Transfer ─────────────────────────────────────────────────────────

  describe('sendBatchSOLTransfer', () => {
    it('should send to multiple recipients', async () => {
      const connection = createMockConnection(10 * LAMPORTS_PER_SOL)

      const result = await sendBatchSOLTransfer(
        connection,
        Keypair.generate().publicKey,
        [
          { recipientMetaAddress: mockMetaAddress, amount: BigInt(LAMPORTS_PER_SOL) },
          { recipientMetaAddress: mockMetaAddress, amount: BigInt(LAMPORTS_PER_SOL * 2) },
        ],
        mockSignTransaction
      )

      expect(result.txSignature).toBe('mockTxSignature123')
      expect(result.transfers).toHaveLength(2)
      expect(result.totalAmount).toBe(BigInt(LAMPORTS_PER_SOL * 3))
      expect(result.totalAmountSol).toBe(3)
    })

    it('should reject batch size over limit', async () => {
      const connection = createMockConnection(100 * LAMPORTS_PER_SOL)

      const transfers = Array(10).fill({
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      await expect(
        sendBatchSOLTransfer(
          connection,
          Keypair.generate().publicKey,
          transfers,
          mockSignTransaction
        )
      ).rejects.toThrow('exceeds maximum')
    })

    it('should reject empty batch', async () => {
      const connection = createMockConnection()

      await expect(
        sendBatchSOLTransfer(
          connection,
          Keypair.generate().publicKey,
          [],
          mockSignTransaction
        )
      ).rejects.toThrow('At least one transfer is required')
    })

    it('should reject insufficient balance for batch', async () => {
      const connection = createMockConnection(LAMPORTS_PER_SOL) // Only 1 SOL

      await expect(
        sendBatchSOLTransfer(
          connection,
          Keypair.generate().publicKey,
          [
            { recipientMetaAddress: mockMetaAddress, amount: BigInt(LAMPORTS_PER_SOL * 5) },
          ],
          mockSignTransaction
        )
      ).rejects.toThrow('Insufficient balance')
    })
  })

  // ─── Integration ────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support validation + estimation + transfer workflow', async () => {
      const connection = createMockConnection(5 * LAMPORTS_PER_SOL)
      const sender = Keypair.generate().publicKey
      const amount = BigInt(LAMPORTS_PER_SOL)

      // Step 1: Validate
      const validation = await validateSOLTransfer({
        connection,
        sender,
        recipientMetaAddress: mockMetaAddress,
        amount,
      })
      expect(validation.isValid).toBe(true)

      // Step 2: Estimate
      const estimate = await estimateSOLTransfer(connection, mockMetaAddress)
      expect(estimate.totalCost).toBeGreaterThan(0n)

      // Step 3: Transfer
      const result = await sendSOLTransfer({
        connection,
        sender,
        recipientMetaAddress: mockMetaAddress,
        amount,
        signTransaction: mockSignTransaction,
      })
      expect(result.txSignature).toBeDefined()
    })
  })
})
