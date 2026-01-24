/**
 * Anchor Shielded Transfer Tests
 *
 * Tests for the SIP Privacy Anchor program SDK integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey, Connection, Transaction } from '@solana/web3.js'
import {
  shieldedTransfer,
  SIP_PRIVACY_PROGRAM_ID,
  CONFIG_PDA,
  FEE_COLLECTOR,
} from '../../../src/chains/solana/anchor-transfer'
import { generateStealthMetaAddress } from '../../../src/stealth'
import type { StealthMetaAddress } from '@sip-protocol/types'

// Mock @solana/web3.js
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getAccountInfo: vi.fn().mockResolvedValue({
        data: Buffer.alloc(100), // Mock config account data
      }),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        // Must be valid base58 (32 bytes)
        blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
        lastValidBlockHeight: 100,
      }),
      sendRawTransaction: vi.fn().mockResolvedValue(
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      ),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
      rpcEndpoint: 'https://api.devnet.solana.com',
    })),
  }
})

describe('Anchor Shielded Transfer', () => {
  // Generate valid test stealth meta-address
  const { metaAddress: testMetaAddress } = generateStealthMetaAddress('solana')

  const mockSender = new PublicKey('11111111111111111111111111111111')
  let mockConnection: Connection
  let mockSignTransaction: <T extends Transaction>(tx: T) => Promise<T>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConnection = new Connection('https://api.devnet.solana.com')
    mockSignTransaction = vi.fn().mockImplementation(async (tx) => {
      // Mock signature
      tx.addSignature(mockSender, Buffer.alloc(64))
      return tx
    })
  })

  describe('Program Constants', () => {
    it('exports correct program ID', () => {
      expect(SIP_PRIVACY_PROGRAM_ID.toBase58()).toBe(
        'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
      )
    })

    it('exports correct config PDA', () => {
      expect(CONFIG_PDA.toBase58()).toBe(
        'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ'
      )
    })

    it('exports correct fee collector', () => {
      expect(FEE_COLLECTOR.toBase58()).toBe(
        'S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd'
      )
    })
  })

  describe('Input Validation', () => {
    it('throws on missing connection', async () => {
      await expect(
        shieldedTransfer({
          connection: null as any,
          sender: mockSender,
          recipient: testMetaAddress,
          amount: 1_000_000_000n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('connection is required')
    })

    it('throws on missing sender', async () => {
      await expect(
        shieldedTransfer({
          connection: mockConnection,
          sender: null as any,
          recipient: testMetaAddress,
          amount: 1_000_000_000n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('sender is required')
    })

    it('throws on missing recipient', async () => {
      await expect(
        shieldedTransfer({
          connection: mockConnection,
          sender: mockSender,
          recipient: null as any,
          amount: 1_000_000_000n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('recipient is required')
    })

    it('throws on zero amount', async () => {
      await expect(
        shieldedTransfer({
          connection: mockConnection,
          sender: mockSender,
          recipient: testMetaAddress,
          amount: 0n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('amount must be positive')
    })

    it('throws on negative amount', async () => {
      await expect(
        shieldedTransfer({
          connection: mockConnection,
          sender: mockSender,
          recipient: testMetaAddress,
          amount: -100n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('amount must be positive')
    })

    it('throws on wrong chain', async () => {
      const ethMeta: StealthMetaAddress = {
        chain: 'ethereum',
        spendingKey: testMetaAddress.spendingKey,
        viewingKey: testMetaAddress.viewingKey,
      }
      await expect(
        shieldedTransfer({
          connection: mockConnection,
          sender: mockSender,
          recipient: ethMeta,
          amount: 1_000_000_000n,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('Expected solana chain')
    })
  })

  describe('SIP Address Parsing', () => {
    it('accepts StealthMetaAddress object', async () => {
      // Mock successful execution
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(result.signature).toBeDefined()
      expect(result.noteId).toBeDefined()
      expect(result.stealthAddress).toBeDefined()
    })

    it('accepts StealthMetaAddress object with valid keys', async () => {
      // This test validates that the function accepts StealthMetaAddress format
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(result.signature).toBeDefined()
    })
  })

  describe('Commitment Generation', () => {
    it('generates valid commitment', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      // Commitment should be a hex string starting with 0x
      expect(result.commitment).toMatch(/^0x[0-9a-f]+$/i)
      // Compressed point is 33 bytes = 66 hex chars + 0x prefix
      expect(result.commitment.length).toBe(68)
    })

    it('generates different commitments for same amount', async () => {
      const result1 = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      const result2 = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      // Commitments should be different due to random blinding
      expect(result1.commitment).not.toBe(result2.commitment)
    })
  })

  describe('Stealth Address Generation', () => {
    it('generates valid stealth address', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      // Stealth address should be a valid Solana pubkey
      expect(result.stealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
      expect(() => new PublicKey(result.stealthAddress)).not.toThrow()
    })

    it('generates different stealth addresses for same recipient', async () => {
      const result1 = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      const result2 = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      // Stealth addresses should be different (ephemeral key randomness)
      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
    })

    it('returns ephemeral public key', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(result.ephemeralPublicKey).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('returns view tag', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(result.viewTag).toMatch(/^0x[0-9a-f]+$/i)
    })
  })

  describe('Viewing Key', () => {
    it('returns viewing key hash', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      // SHA-256 hash = 32 bytes = 64 hex chars + 0x prefix
      expect(result.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/i)
    })
  })

  describe('Transfer Record', () => {
    it('returns note ID (transfer record PDA)', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      // Note ID should be a valid Solana pubkey
      expect(result.noteId).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
      expect(() => new PublicKey(result.noteId)).not.toThrow()
    })
  })

  describe('Transaction Submission', () => {
    it('signs transaction', async () => {
      await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(mockSignTransaction).toHaveBeenCalled()
    })

    it('returns transaction signature', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(result.signature).toBe(
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      )
    })

    it('returns explorer URL', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n,
        signTransaction: mockSignTransaction,
      })

      expect(result.explorerUrl).toContain('solscan.io')
      expect(result.explorerUrl).toContain('5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW')
      expect(result.explorerUrl).toContain('devnet')
    })
  })

  describe('Amount Handling', () => {
    it('handles 1 SOL', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1_000_000_000n, // 1 SOL
        signTransaction: mockSignTransaction,
      })

      expect(result.signature).toBeDefined()
    })

    it('handles small amounts (1 lamport)', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1n,
        signTransaction: mockSignTransaction,
      })

      expect(result.signature).toBeDefined()
    })

    it('handles large amounts (1000 SOL)', async () => {
      const result = await shieldedTransfer({
        connection: mockConnection,
        sender: mockSender,
        recipient: testMetaAddress,
        amount: 1000_000_000_000n, // 1000 SOL
        signTransaction: mockSignTransaction,
      })

      expect(result.signature).toBeDefined()
    })
  })
})
