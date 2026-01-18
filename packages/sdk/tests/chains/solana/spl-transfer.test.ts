/**
 * Enhanced SPL Transfer Tests
 *
 * Tests for token metadata resolution, balance checking, and enhanced transfers.
 */

import { describe, it, expect, vi } from 'vitest'
import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import {
  resolveTokenMetadata,
  batchResolveTokenMetadata,
  getTokenBalance,
  batchGetTokenBalances,
  validateTransfer,
  formatTokenAmount,
  parseTokenAmount,
} from '../../../src/chains/solana/spl-transfer'
import type { StealthMetaAddress } from '@sip-protocol/types'

// Mock @solana/spl-token
vi.mock('@solana/spl-token', async () => {
  const actual = await vi.importActual<typeof import('@solana/spl-token')>('@solana/spl-token')
  return {
    ...actual,
    getAssociatedTokenAddress: vi.fn().mockImplementation(async (_mint, _owner) => {
      // Return a deterministic ATA address
      return new PublicKey('ATA1111111111111111111111111111111111111111')
    }),
    getAccount: vi.fn().mockImplementation(async () => {
      return {
        address: new PublicKey('ATA1111111111111111111111111111111111111111'),
        mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        owner: new PublicKey('So11111111111111111111111111111111111111112'),
        amount: BigInt(10_000_000), // 10 USDC
        delegate: null,
        delegatedAmount: BigInt(0),
        isInitialized: true,
        isFrozen: false,
        isNative: false,
        rentExemptReserve: null,
        closeAuthority: null,
      }
    }),
    getMint: vi.fn().mockImplementation(async (_connection, mint) => {
      return {
        address: mint,
        decimals: 6,
        supply: BigInt(1_000_000_000_000),
        mintAuthority: null,
        freezeAuthority: null,
        isInitialized: true,
      }
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
    getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(2039280),
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
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const UNKNOWN_MINT = new PublicKey('9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i')

const mockMetaAddress: StealthMetaAddress = {
  chain: 'solana',
  spendingKey: ('0x' + '01'.repeat(32)) as `0x${string}`,
  viewingKey: ('0x' + '02'.repeat(32)) as `0x${string}`,
}

describe('SPL Transfer Enhanced', () => {
  // ─── Token Metadata ─────────────────────────────────────────────────────────

  describe('resolveTokenMetadata', () => {
    it('should resolve known token metadata (USDC)', async () => {
      const connection = createMockConnection()
      const metadata = await resolveTokenMetadata(connection, USDC_MINT)

      expect(metadata.mint).toBe(USDC_MINT.toBase58())
      expect(metadata.name).toBe('USD Coin')
      expect(metadata.symbol).toBe('USDC')
      expect(metadata.decimals).toBe(6)
      expect(metadata.logoUri).toContain('logo.png')
    })

    it('should resolve unknown token with basic info', async () => {
      const connection = createMockConnection()
      const metadata = await resolveTokenMetadata(connection, UNKNOWN_MINT)

      expect(metadata.mint).toBe(UNKNOWN_MINT.toBase58())
      expect(metadata.decimals).toBe(6) // From mock
      expect(metadata.symbol).toMatch(/^[A-Z0-9]+$/)
    })

    it('should include supply from on-chain data', async () => {
      const connection = createMockConnection()
      const metadata = await resolveTokenMetadata(connection, USDC_MINT)

      expect(metadata.supply).toBe(BigInt(1_000_000_000_000))
    })
  })

  describe('batchResolveTokenMetadata', () => {
    it('should resolve multiple tokens', async () => {
      const connection = createMockConnection()
      const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')

      const metadataList = await batchResolveTokenMetadata(connection, [USDC_MINT, USDT_MINT])

      expect(metadataList).toHaveLength(2)
      expect(metadataList[0].symbol).toBe('USDC')
      expect(metadataList[1].symbol).toBe('USDT')
    })
  })

  // ─── Token Balance ──────────────────────────────────────────────────────────

  describe('getTokenBalance', () => {
    it('should get token balance', async () => {
      const connection = createMockConnection()
      const owner = Keypair.generate().publicKey

      const balance = await getTokenBalance(connection, owner, USDC_MINT)

      expect(balance).not.toBeNull()
      expect(balance!.amount).toBe(BigInt(10_000_000))
      expect(balance!.uiAmount).toBe(10) // 10 USDC
      expect(balance!.decimals).toBe(6)
    })

    it('should return null for missing account', async () => {
      const { getAccount } = await import('@solana/spl-token')
      vi.mocked(getAccount).mockRejectedValueOnce(new Error('Account not found'))

      const connection = createMockConnection()
      const owner = Keypair.generate().publicKey

      const balance = await getTokenBalance(connection, owner, USDC_MINT)

      expect(balance).toBeNull()
    })
  })

  describe('batchGetTokenBalances', () => {
    it('should get multiple token balances', async () => {
      const connection = createMockConnection()
      const owner = Keypair.generate().publicKey
      const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')

      const balances = await batchGetTokenBalances(connection, owner, [USDC_MINT, USDT_MINT])

      expect(balances).toHaveLength(2)
      expect(balances[0]).not.toBeNull()
      expect(balances[1]).not.toBeNull()
    })
  })

  // ─── Transfer Validation ────────────────────────────────────────────────────

  describe('validateTransfer', () => {
    it('should validate valid transfer', async () => {
      const connection = createMockConnection()

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: 5_000_000n, // 5 USDC
      })

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.senderBalance).toBeDefined()
      expect(validation.tokenMetadata?.symbol).toBe('USDC')
    })

    it('should reject invalid chain', async () => {
      const connection = createMockConnection()

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: { ...mockMetaAddress, chain: 'ethereum' },
        mint: USDC_MINT,
        amount: 5_000_000n,
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain("Invalid chain: expected 'solana', got 'ethereum'")
    })

    it('should reject zero amount', async () => {
      const connection = createMockConnection()

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: 0n,
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Amount must be greater than 0')
    })

    it('should reject insufficient balance', async () => {
      const connection = createMockConnection()

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: 100_000_000n, // 100 USDC (more than 10 USDC balance)
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('Insufficient balance'))).toBe(true)
    })

    it('should calculate estimated fee', async () => {
      const connection = createMockConnection()

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: 5_000_000n,
      })

      expect(validation.estimatedFee).toBeGreaterThan(0n)
    })
  })

  // ─── Format & Parse ─────────────────────────────────────────────────────────

  describe('formatTokenAmount', () => {
    it('should format token amount with decimals', () => {
      expect(formatTokenAmount(1_000_000n, 6)).toBe('1')
      expect(formatTokenAmount(1_500_000n, 6)).toBe('1.5')
      expect(formatTokenAmount(1_234_567n, 6)).toBe('1.2346')
    })

    it('should handle zero', () => {
      expect(formatTokenAmount(0n, 6)).toBe('0')
    })

    it('should handle small amounts', () => {
      const result = formatTokenAmount(1n, 6)
      expect(result).toMatch(/^1(\.0+)?e-6$/)
    })

    it('should respect maxDecimals', () => {
      expect(formatTokenAmount(1_234_567n, 6, 2)).toBe('1.23')
    })

    it('should remove trailing zeros', () => {
      expect(formatTokenAmount(1_000_000n, 6)).toBe('1')
      expect(formatTokenAmount(1_100_000n, 6)).toBe('1.1')
    })
  })

  describe('parseTokenAmount', () => {
    it('should parse token amount to raw', () => {
      expect(parseTokenAmount('1', 6)).toBe(1_000_000n)
      expect(parseTokenAmount('1.5', 6)).toBe(1_500_000n)
      expect(parseTokenAmount('0.000001', 6)).toBe(1n)
    })

    it('should handle commas and whitespace', () => {
      expect(parseTokenAmount('1,000', 6)).toBe(1_000_000_000n)
      expect(parseTokenAmount(' 100 ', 6)).toBe(100_000_000n)
    })

    it('should throw on invalid input', () => {
      expect(() => parseTokenAmount('abc', 6)).toThrow()
      expect(() => parseTokenAmount('-1', 6)).toThrow()
    })
  })

  // ─── Known Tokens ───────────────────────────────────────────────────────────

  describe('Known Tokens', () => {
    const knownMints = [
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
      { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
      { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
      { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK' },
      { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP' },
    ]

    it.each(knownMints)('should resolve $symbol metadata', async ({ mint, symbol }) => {
      const connection = createMockConnection()
      const metadata = await resolveTokenMetadata(connection, new PublicKey(mint))

      expect(metadata.symbol).toBe(symbol)
      expect(metadata.decimals).toBeGreaterThan(0)
    })
  })

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle max SPL amount', async () => {
      const connection = createMockConnection()
      const maxAmount = 2n ** 64n - 1n

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: maxAmount,
      })

      // Should be invalid due to insufficient balance, not overflow
      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('Insufficient'))).toBe(true)
    })

    it('should reject amount exceeding max SPL', async () => {
      const connection = createMockConnection()
      const overflowAmount = 2n ** 64n

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: overflowAmount,
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Amount exceeds maximum SPL token amount')
    })

    it('should handle missing meta-address', async () => {
      const connection = createMockConnection()

      const validation = await validateTransfer({
        connection,
        sender: Keypair.generate().publicKey,
        recipientMetaAddress: undefined as any,
        mint: USDC_MINT,
        amount: 1_000_000n,
      })

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Recipient meta-address is required')
    })
  })

  // ─── Integration ────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support full validation + metadata workflow', async () => {
      const connection = createMockConnection()
      const sender = Keypair.generate().publicKey

      // Step 1: Get token metadata
      const metadata = await resolveTokenMetadata(connection, USDC_MINT)
      expect(metadata.symbol).toBe('USDC')

      // Step 2: Check balance
      const balance = await getTokenBalance(connection, sender, USDC_MINT)
      expect(balance).not.toBeNull()

      // Step 3: Validate transfer
      const validation = await validateTransfer({
        connection,
        sender,
        recipientMetaAddress: mockMetaAddress,
        mint: USDC_MINT,
        amount: 5_000_000n,
      })

      expect(validation.isValid).toBe(true)
      expect(validation.tokenMetadata?.symbol).toBe('USDC')
    })
  })
})
