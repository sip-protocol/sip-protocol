/**
 * Shielded Transaction Builder Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  ShieldedTransactionBuilder,
  createTransactionBuilder,
  estimateComputeUnits,
  calculatePriorityFee,
  ShieldedTransactionType,
  DEFAULT_COMPUTE_UNITS,
  DEFAULT_PRIORITY_FEE,
  MIN_COMPUTE_UNITS,
  MAX_COMPUTE_UNITS,
} from '../../../src/chains/solana/transaction-builder'
import type { StealthMetaAddress } from '@sip-protocol/types'

// Mock the stealth module
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

// Mock @solana/spl-token
vi.mock('@solana/spl-token', async () => {
  const actual = await vi.importActual<typeof import('@solana/spl-token')>('@solana/spl-token')
  return {
    ...actual,
    getAssociatedTokenAddress: vi.fn().mockImplementation(async () => {
      return new PublicKey('ATA1111111111111111111111111111111111111111')
    }),
    createAssociatedTokenAccountInstruction: vi.fn().mockReturnValue({
      keys: [],
      programId: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      data: Buffer.from([]),
    }),
    createTransferInstruction: vi.fn().mockReturnValue({
      keys: [],
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      data: Buffer.from([]),
    }),
    TOKEN_PROGRAM_ID: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    ASSOCIATED_TOKEN_PROGRAM_ID: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  }
})

// Mock connection
const createMockConnection = () => {
  return {
    getAccountInfo: vi.fn().mockResolvedValue(null),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
      lastValidBlockHeight: 1000,
    }),
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  } as unknown as Connection
}

// Test data
const mockMetaAddress: StealthMetaAddress = {
  chain: 'solana',
  spendingKey: ('0x' + '01'.repeat(32)) as `0x${string}`,
  viewingKey: ('0x' + '02'.repeat(32)) as `0x${string}`,
}

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

describe('Shielded Transaction Builder', () => {
  // ─── Constants ──────────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have valid defaults', () => {
      expect(DEFAULT_COMPUTE_UNITS).toBe(200_000)
      expect(DEFAULT_PRIORITY_FEE).toBe(1_000)
      expect(MIN_COMPUTE_UNITS).toBe(50_000)
      expect(MAX_COMPUTE_UNITS).toBe(1_400_000)
    })
  })

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('Constructor', () => {
    it('should create builder with minimal config', () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      const config = builder.getConfig()
      expect(config.computeUnits).toBe(DEFAULT_COMPUTE_UNITS)
      expect(config.priorityFee).toBe(DEFAULT_PRIORITY_FEE)
      expect(config.useVersioned).toBe(false)
    })

    it('should accept custom compute budget', () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
        computeBudget: { units: 300_000, priorityFee: 5_000 },
      })

      const config = builder.getConfig()
      expect(config.computeUnits).toBe(300_000)
      expect(config.priorityFee).toBe(5_000)
    })

    it('should enable versioned transactions', () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
        useVersionedTransaction: true,
      })

      expect(builder.getConfig().useVersioned).toBe(true)
    })

    it('should reject invalid compute units', () => {
      const connection = createMockConnection()

      expect(() => new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
        computeBudget: { units: 10 }, // Too low
      })).toThrow()

      expect(() => new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
        computeBudget: { units: 2_000_000 }, // Too high
      })).toThrow()
    })
  })

  // ─── Factory ────────────────────────────────────────────────────────────────

  describe('createTransactionBuilder', () => {
    it('should create builder via factory', () => {
      const connection = createMockConnection()
      const builder = createTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      expect(builder).toBeInstanceOf(ShieldedTransactionBuilder)
    })
  })

  // ─── SPL Transfer ───────────────────────────────────────────────────────────

  describe('buildSPLTransfer', () => {
    it('should build legacy SPL transfer transaction', async () => {
      const connection = createMockConnection()
      const feePayer = Keypair.generate().publicKey

      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer,
      })

      const result = await builder.buildSPLTransfer({
        mint: USDC_MINT,
        sourceAccount: feePayer,
        owner: feePayer,
        recipientMetaAddress: mockMetaAddress,
        amount: 5_000_000n,
      })

      expect(result.type).toBe(ShieldedTransactionType.SPL_TRANSFER)
      expect(result.transaction).toBeDefined()
      expect(result.versionedTransaction).toBeUndefined()
      expect(result.stealthDetails).toHaveLength(1)
      expect(result.stealthDetails[0].amount).toBe(5_000_000n)
      expect(result.blockhash).toBeDefined()
    })

    it('should build versioned SPL transfer transaction', async () => {
      const connection = createMockConnection()
      const feePayer = Keypair.generate().publicKey

      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer,
        useVersionedTransaction: true,
      })

      const result = await builder.buildSPLTransfer({
        mint: USDC_MINT,
        sourceAccount: feePayer,
        owner: feePayer,
        recipientMetaAddress: mockMetaAddress,
        amount: 5_000_000n,
      })

      expect(result.versionedTransaction).toBeDefined()
      expect(result.transaction).toBeUndefined()
    })

    it('should reject invalid chain', async () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      await expect(
        builder.buildSPLTransfer({
          mint: USDC_MINT,
          sourceAccount: Keypair.generate().publicKey,
          owner: Keypair.generate().publicKey,
          recipientMetaAddress: { ...mockMetaAddress, chain: 'ethereum' },
          amount: 1_000_000n,
        })
      ).rejects.toThrow("Invalid chain: expected 'solana'")
    })
  })

  // ─── SOL Transfer ───────────────────────────────────────────────────────────

  describe('buildSOLTransfer', () => {
    it('should build legacy SOL transfer transaction', async () => {
      const connection = createMockConnection()
      const sender = Keypair.generate().publicKey

      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: sender,
      })

      const result = await builder.buildSOLTransfer({
        sender,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      expect(result.type).toBe(ShieldedTransactionType.SOL_TRANSFER)
      expect(result.transaction).toBeDefined()
      expect(result.stealthDetails).toHaveLength(1)
      expect(result.stealthDetails[0].amount).toBe(BigInt(LAMPORTS_PER_SOL))
    })

    it('should build versioned SOL transfer', async () => {
      const connection = createMockConnection()
      const sender = Keypair.generate().publicKey

      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: sender,
        useVersionedTransaction: true,
      })

      const result = await builder.buildSOLTransfer({
        sender,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      expect(result.versionedTransaction).toBeDefined()
    })
  })

  // ─── Batch Transfer ─────────────────────────────────────────────────────────

  describe('buildBatchSPLTransfer', () => {
    it('should build batch SPL transfer', async () => {
      const connection = createMockConnection()
      const feePayer = Keypair.generate().publicKey

      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer,
      })

      const result = await builder.buildBatchSPLTransfer(
        USDC_MINT,
        feePayer,
        feePayer,
        [
          { recipientMetaAddress: mockMetaAddress, amount: 1_000_000n },
          { recipientMetaAddress: mockMetaAddress, amount: 2_000_000n },
        ]
      )

      expect(result.type).toBe(ShieldedTransactionType.BATCH_TRANSFER)
      expect(result.stealthDetails).toHaveLength(2)
      expect(result.stealthDetails[0].amount).toBe(1_000_000n)
      expect(result.stealthDetails[1].amount).toBe(2_000_000n)
    })
  })

  // ─── Serialization ──────────────────────────────────────────────────────────

  describe('Serialization', () => {
    it('should serialize legacy transaction', async () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      const built = await builder.buildSOLTransfer({
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      const serialized = builder.serializeForSigning(built)

      expect(serialized.serialized).toBeDefined()
      expect(serialized.isVersioned).toBe(false)
      expect(serialized.type).toBe(ShieldedTransactionType.SOL_TRANSFER)
    })

    it('should serialize versioned transaction', async () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
        useVersionedTransaction: true,
      })

      const built = await builder.buildSOLTransfer({
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      const serialized = builder.serializeForSigning(built)

      expect(serialized.serialized).toBeDefined()
      expect(serialized.isVersioned).toBe(true)
    })

    it('should deserialize legacy transaction', async () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      const built = await builder.buildSOLTransfer({
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })

      const serialized = builder.serializeForSigning(built)
      const deserialized = builder.deserializeSignedTransaction(
        serialized.serialized,
        serialized.isVersioned
      )

      expect(deserialized).toBeDefined()
    })
  })

  // ─── Configuration ──────────────────────────────────────────────────────────

  describe('Configuration', () => {
    it('should update compute budget', () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      builder.setComputeBudget({ units: 300_000, priorityFee: 10_000 })

      const config = builder.getConfig()
      expect(config.computeUnits).toBe(300_000)
      expect(config.priorityFee).toBe(10_000)
    })

    it('should toggle versioned transactions', () => {
      const connection = createMockConnection()
      const builder = new ShieldedTransactionBuilder({
        connection,
        feePayer: Keypair.generate().publicKey,
      })

      expect(builder.getConfig().useVersioned).toBe(false)

      builder.setVersionedTransactions(true)
      expect(builder.getConfig().useVersioned).toBe(true)

      builder.setVersionedTransactions(false)
      expect(builder.getConfig().useVersioned).toBe(false)
    })
  })

  // ─── Utilities ──────────────────────────────────────────────────────────────

  describe('estimateComputeUnits', () => {
    it('should estimate compute units for instructions', () => {
      const instructions = [
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), keys: [], data: Buffer.from([]) },
        { programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [], data: Buffer.from([]) },
      ]

      const units = estimateComputeUnits(instructions)

      expect(units).toBeGreaterThan(0)
      expect(units).toBeLessThanOrEqual(MAX_COMPUTE_UNITS)
    })
  })

  describe('calculatePriorityFee', () => {
    it('should calculate priority fees', () => {
      expect(calculatePriorityFee('low')).toBe(100)
      expect(calculatePriorityFee('medium')).toBe(1_000)
      expect(calculatePriorityFee('high')).toBe(10_000)
      expect(calculatePriorityFee('urgent')).toBe(100_000)
    })
  })

  // ─── Integration ────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support full workflow: build -> serialize -> deserialize', async () => {
      const connection = createMockConnection()
      const feePayer = Keypair.generate().publicKey

      const builder = createTransactionBuilder({
        connection,
        feePayer,
        computeBudget: { priorityFee: calculatePriorityFee('high') },
      })

      // Build
      const built = await builder.buildSPLTransfer({
        mint: USDC_MINT,
        sourceAccount: feePayer,
        owner: feePayer,
        recipientMetaAddress: mockMetaAddress,
        amount: 5_000_000n,
      })

      expect(built.estimatedFee).toBeGreaterThan(0n)

      // Serialize
      const serialized = builder.serializeForSigning(built)
      expect(serialized.serialized.length).toBeGreaterThan(0)

      // Deserialize
      const deserialized = builder.deserializeSignedTransaction(
        serialized.serialized,
        serialized.isVersioned
      )
      expect(deserialized).toBeDefined()
    })
  })
})
