/**
 * C-SPL Solana Address Validation Tests
 *
 * Tests for Solana base58 address validation in the C-SPL module.
 * Addresses issue #517: Add Solana base58 address validation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { isValidSolanaAddressFormat } from '../src/validation'
import { CSPLClient } from '../src/privacy-backends/cspl'

// ─── Valid Test Addresses ────────────────────────────────────────────────────────

// Well-known Solana addresses (all valid base58, 32-44 chars)
const VALID_ADDRESSES = [
  // System Program (32 chars, all 1s is valid base58)
  '11111111111111111111111111111111',
  // Token Program (44 chars)
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  // Associated Token Program (44 chars)
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  // Native Mint (SOL wrapped) (44 chars)
  'So11111111111111111111111111111111111111112',
  // USDC mint (44 chars)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  // Random valid address (43 chars)
  '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
  // Minimum length valid address (32 chars)
  '123456789ABCDEFGHJKLMNPQRSTUVWXab',
]

// ─── Invalid Test Addresses ──────────────────────────────────────────────────────

const INVALID_ADDRESSES = {
  // Contains invalid base58 character '0'
  containsZero: '0x1234567890abcdef1234567890abcdef',
  // Contains invalid base58 character 'O'
  containsO: 'OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO',
  // Contains invalid base58 character 'I'
  containsI: 'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
  // Contains invalid base58 character 'l'
  containsL: 'llllllllllllllllllllllllllllllll',
  // Too short (31 chars)
  tooShort: '1234567890123456789012345678901',
  // Too long (45 chars)
  tooLong: '123456789012345678901234567890123456789012345',
  // Empty string
  empty: '',
  // Whitespace only
  whitespace: '   ',
  // Contains space
  containsSpace: '11111111111111111 11111111111111',
  // Contains special character
  containsSpecial: '11111111111111111@1111111111111',
}

// ─── isValidSolanaAddressFormat Tests ────────────────────────────────────────────

describe('isValidSolanaAddressFormat', () => {
  describe('valid addresses', () => {
    it.each(VALID_ADDRESSES)('should accept valid address: %s', (address) => {
      expect(isValidSolanaAddressFormat(address)).toBe(true)
    })

    it('should accept addresses at minimum length (32 chars)', () => {
      const minLengthAddress = '1'.repeat(32)
      expect(isValidSolanaAddressFormat(minLengthAddress)).toBe(true)
    })

    it('should accept addresses at maximum length (44 chars)', () => {
      const maxLengthAddress = '1'.repeat(44)
      expect(isValidSolanaAddressFormat(maxLengthAddress)).toBe(true)
    })
  })

  describe('invalid addresses', () => {
    it('should reject address containing 0', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.containsZero)).toBe(false)
    })

    it('should reject address containing O', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.containsO)).toBe(false)
    })

    it('should reject address containing I', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.containsI)).toBe(false)
    })

    it('should reject address containing l', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.containsL)).toBe(false)
    })

    it('should reject address that is too short (< 32 chars)', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.tooShort)).toBe(false)
    })

    it('should reject address that is too long (> 44 chars)', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.tooLong)).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.empty)).toBe(false)
    })

    it('should reject whitespace only', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.whitespace)).toBe(false)
    })

    it('should reject address containing space', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.containsSpace)).toBe(false)
    })

    it('should reject address containing special characters', () => {
      expect(isValidSolanaAddressFormat(INVALID_ADDRESSES.containsSpecial)).toBe(false)
    })
  })
})

// ─── CSPLClient Validation Integration Tests ─────────────────────────────────────

describe('CSPLClient address validation', () => {
  let client: CSPLClient

  beforeEach(() => {
    client = new CSPLClient()
  })

  describe('wrapToken', () => {
    it('should reject invalid mint address', async () => {
      const result = await client.wrapToken({
        mint: 'invalid0mint', // Contains '0'
        owner: 'So11111111111111111111111111111111111111112',
        amount: BigInt(1000000000),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('mint')
      expect(result.error).toContain('base58')
    })

    it('should reject invalid owner address', async () => {
      const result = await client.wrapToken({
        mint: 'So11111111111111111111111111111111111111112',
        owner: 'tooShort',
        amount: BigInt(1000000000),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('owner')
      expect(result.error).toContain('base58')
    })

    it('should accept valid addresses', async () => {
      const result = await client.wrapToken({
        mint: 'So11111111111111111111111111111111111111112',
        owner: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: BigInt(1000000000),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('transfer', () => {
    it('should reject invalid sender address', async () => {
      const result = await client.transfer({
        from: 'invalid0sender',
        to: 'So11111111111111111111111111111111111111112',
        token: {
          mint: 'So11111111111111111111111111111111111111112',
          confidentialMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 9,
        },
        encryptedAmount: new Uint8Array([1, 2, 3]),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('sender')
      expect(result.error).toContain('base58')
    })

    it('should reject invalid recipient address', async () => {
      const result = await client.transfer({
        from: 'So11111111111111111111111111111111111111112',
        to: 'invalid0recipient',
        token: {
          mint: 'So11111111111111111111111111111111111111112',
          confidentialMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 9,
        },
        encryptedAmount: new Uint8Array([1, 2, 3]),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('recipient')
      expect(result.error).toContain('base58')
    })

    it('should accept all valid addresses', async () => {
      const result = await client.transfer({
        from: 'So11111111111111111111111111111111111111112',
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        token: {
          mint: 'So11111111111111111111111111111111111111112',
          confidentialMint: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          decimals: 9,
        },
        encryptedAmount: new Uint8Array([1, 2, 3]),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('unwrapToken', () => {
    it('should reject invalid owner address', async () => {
      const result = await client.unwrapToken({
        token: {
          mint: 'So11111111111111111111111111111111111111112',
          confidentialMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 9,
        },
        owner: 'invalid0owner',
        encryptedAmount: new Uint8Array([1, 2, 3]),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('owner')
      expect(result.error).toContain('base58')
    })
  })

  describe('applyPendingBalance', () => {
    it('should reject invalid owner address', async () => {
      const result = await client.applyPendingBalance('invalid0owner', {
        mint: 'So11111111111111111111111111111111111111112',
        confidentialMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 9,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('owner')
      expect(result.error).toContain('base58')
    })

    it('should reject invalid token confidentialMint', async () => {
      const result = await client.applyPendingBalance(
        'So11111111111111111111111111111111111111112',
        {
          mint: 'So11111111111111111111111111111111111111112',
          confidentialMint: 'badMint0',
          decimals: 9,
        }
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('confidentialMint')
      expect(result.error).toContain('base58')
    })
  })
})

// ─── Edge Cases ──────────────────────────────────────────────────────────────────

describe('Solana address edge cases', () => {
  it('should handle addresses with all valid base58 characters', () => {
    // Use all characters in base58 alphabet (no 0, O, I, l)
    const allBase58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    // Take first 44 characters for a valid-length address
    const validAddress = allBase58.slice(0, 44)
    expect(isValidSolanaAddressFormat(validAddress)).toBe(true)
  })

  it('should correctly identify length boundaries', () => {
    // 31 chars - too short
    expect(isValidSolanaAddressFormat('1'.repeat(31))).toBe(false)
    // 32 chars - valid
    expect(isValidSolanaAddressFormat('1'.repeat(32))).toBe(true)
    // 44 chars - valid
    expect(isValidSolanaAddressFormat('1'.repeat(44))).toBe(true)
    // 45 chars - too long
    expect(isValidSolanaAddressFormat('1'.repeat(45))).toBe(false)
  })

  it('should handle mixed case correctly (case sensitive)', () => {
    // Both upper and lowercase letters are valid in base58
    const mixedCase = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkm'
    expect(isValidSolanaAddressFormat(mixedCase)).toBe(true)
  })
})
