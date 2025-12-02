/**
 * Solana Address Derivation Tests
 *
 * Tests for converting ed25519 stealth public keys to Solana addresses.
 */

import { describe, it, expect } from 'vitest'
import {
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
  isValidSolanaAddress,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
} from '../../src/stealth'
import type { HexString } from '@sip-protocol/types'

describe('Solana Address Derivation', () => {
  // ─── ed25519PublicKeyToSolanaAddress ────────────────────────────────────────

  describe('ed25519PublicKeyToSolanaAddress', () => {
    it('should convert ed25519 public key to Solana base58 address', () => {
      // Known test vector: 32 zero bytes should produce a specific base58 address
      const zeroKey = '0x' + '00'.repeat(32) as HexString
      const solanaAddress = ed25519PublicKeyToSolanaAddress(zeroKey)

      // 32 zero bytes in base58 should be '11111111111111111111111111111111'
      expect(solanaAddress).toBe('11111111111111111111111111111111')
    })

    it('should convert arbitrary ed25519 public key to base58', () => {
      // Test with a known key pattern
      const testKey = '0x' + 'ab'.repeat(32) as HexString
      const solanaAddress = ed25519PublicKeyToSolanaAddress(testKey)

      // Verify it's a valid base58 string (32-44 chars)
      expect(solanaAddress.length).toBeGreaterThanOrEqual(32)
      expect(solanaAddress.length).toBeLessThanOrEqual(44)
      expect(isValidSolanaAddress(solanaAddress)).toBe(true)
    })

    it('should produce valid Solana addresses from stealth address generation', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

      // Verify the address is valid
      expect(isValidSolanaAddress(solanaAddress)).toBe(true)
      expect(solanaAddress.length).toBeGreaterThanOrEqual(32)
      expect(solanaAddress.length).toBeLessThanOrEqual(44)
    })

    it('should produce unique addresses for different keys', () => {
      const key1 = '0x' + 'ab'.repeat(32) as HexString
      const key2 = '0x' + 'cd'.repeat(32) as HexString

      const address1 = ed25519PublicKeyToSolanaAddress(key1)
      const address2 = ed25519PublicKeyToSolanaAddress(key2)

      expect(address1).not.toBe(address2)
    })

    it('should throw for invalid hex string', () => {
      expect(() => ed25519PublicKeyToSolanaAddress('not-hex' as HexString)).toThrow()
      expect(() => ed25519PublicKeyToSolanaAddress('0xgg' as HexString)).toThrow()
    })

    it('should throw for wrong length key', () => {
      // 16 bytes instead of 32
      const shortKey = '0x' + 'ab'.repeat(16) as HexString
      expect(() => ed25519PublicKeyToSolanaAddress(shortKey)).toThrow()

      // 64 bytes instead of 32
      const longKey = '0x' + 'ab'.repeat(64) as HexString
      expect(() => ed25519PublicKeyToSolanaAddress(longKey)).toThrow()
    })

    it('should handle keys with leading zeros', () => {
      // Key starting with zeros
      const keyWithLeadingZeros = '0x' + '0000' + 'ab'.repeat(30) as HexString
      const address = ed25519PublicKeyToSolanaAddress(keyWithLeadingZeros)

      expect(isValidSolanaAddress(address)).toBe(true)
    })
  })

  // ─── solanaAddressToEd25519PublicKey ────────────────────────────────────────

  describe('solanaAddressToEd25519PublicKey', () => {
    it('should convert Solana address back to ed25519 public key', () => {
      const zeroAddress = '11111111111111111111111111111111'
      const pubKey = solanaAddressToEd25519PublicKey(zeroAddress)

      expect(pubKey).toBe('0x' + '00'.repeat(32))
    })

    it('should be inverse of ed25519PublicKeyToSolanaAddress', () => {
      const originalKey = '0x' + 'ab'.repeat(32) as HexString
      const solanaAddress = ed25519PublicKeyToSolanaAddress(originalKey)
      const recoveredKey = solanaAddressToEd25519PublicKey(solanaAddress)

      expect(recoveredKey).toBe(originalKey)
    })

    it('should work with stealth-generated addresses', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      const recoveredKey = solanaAddressToEd25519PublicKey(solanaAddress)

      expect(recoveredKey).toBe(stealthAddress.address)
    })

    it('should throw for invalid Solana address', () => {
      expect(() => solanaAddressToEd25519PublicKey('invalid')).toThrow()
      expect(() => solanaAddressToEd25519PublicKey('')).toThrow()
      expect(() => solanaAddressToEd25519PublicKey('0OIl')).toThrow() // Invalid base58 chars
    })

    it('should throw for wrong length address', () => {
      // Too short (< 32 chars)
      expect(() => solanaAddressToEd25519PublicKey('1111111111')).toThrow()
    })
  })

  // ─── isValidSolanaAddress ──────────────────────────────────────────────────

  describe('isValidSolanaAddress', () => {
    it('should return true for valid Solana addresses', () => {
      // System program
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true)

      // Token program
      expect(isValidSolanaAddress('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(true)

      // Generated address
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      expect(isValidSolanaAddress(solanaAddress)).toBe(true)
    })

    it('should return false for invalid addresses', () => {
      // Empty string
      expect(isValidSolanaAddress('')).toBe(false)

      // Too short
      expect(isValidSolanaAddress('abc')).toBe(false)

      // Invalid characters (0, O, I, l not in base58)
      expect(isValidSolanaAddress('0OIl1111111111111111111111111111')).toBe(false)

      // Too long
      expect(isValidSolanaAddress('1'.repeat(50))).toBe(false)
    })

    it('should return false for non-string inputs', () => {
      // @ts-expect-error - testing runtime behavior
      expect(isValidSolanaAddress(null)).toBe(false)
      // @ts-expect-error - testing runtime behavior
      expect(isValidSolanaAddress(undefined)).toBe(false)
      // @ts-expect-error - testing runtime behavior
      expect(isValidSolanaAddress(123)).toBe(false)
    })

    it('should validate addresses are exactly 32 bytes when decoded', () => {
      // Valid 32-byte address
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true)

      // This creates a base58 string that doesn't decode to 32 bytes
      // '1' in base58 represents a zero byte, so '1' alone would be 1 byte
      expect(isValidSolanaAddress('1')).toBe(false)
    })
  })

  // ─── Integration with Stealth Address Flow ─────────────────────────────────

  describe('Integration with Stealth Address Flow', () => {
    it('should derive valid Solana addresses from full stealth flow', () => {
      // Generate stealth meta-address
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')

      // Generate stealth address (as sender would)
      const { stealthAddress, sharedSecret, ephemeralPublicKey } =
        generateEd25519StealthAddress(metaAddress)

      // Convert to Solana address
      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

      // Verify address is valid
      expect(isValidSolanaAddress(solanaAddress)).toBe(true)

      // Verify roundtrip
      const recoveredKey = solanaAddressToEd25519PublicKey(solanaAddress)
      expect(recoveredKey).toBe(stealthAddress.address)
    })

    it('should produce different Solana addresses for multiple stealth addresses', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      const addresses: string[] = []
      for (let i = 0; i < 5; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
        const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
        addresses.push(solanaAddress)
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(5)
    })
  })

  // ─── Ed25519 Arithmetic Edge Cases ────────────────────────────────────────────

  describe('ed25519 Arithmetic Edge Cases', () => {
    // ed25519 curve order (L)
    const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

    it('should handle scalar operations with high-value inputs', () => {
      // Generate many ed25519 stealth addresses and verify all produce valid keys
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')

      for (let i = 0; i < 50; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

        // Verify the stealth address is valid
        expect(stealthAddress.address.startsWith('0x')).toBe(true)
        expect(stealthAddress.address.length).toBe(66) // 0x + 64 hex chars = 32 bytes

        // Verify it converts to valid Solana address
        const solanaAddr = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
        expect(isValidSolanaAddress(solanaAddr)).toBe(true)
      }
    })

    it('should produce unique addresses for repeated generation', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      // Generate 100 addresses
      const addresses: string[] = []
      for (let i = 0; i < 100; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
        addresses.push(stealthAddress.address)
      }

      // All should be unique
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(100)
    })

    it('should not throw for any generated stealth address', () => {
      // Verify that the zero-scalar protection doesn't trigger for valid random inputs
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      // Generate many addresses - none should throw
      for (let i = 0; i < 100; i++) {
        expect(() => {
          generateEd25519StealthAddress(metaAddress)
        }).not.toThrow()
      }
    })
  })
})
