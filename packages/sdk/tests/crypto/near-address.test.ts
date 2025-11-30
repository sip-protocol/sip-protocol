/**
 * NEAR Address Derivation Tests
 *
 * Tests for converting ed25519 stealth public keys to NEAR implicit accounts.
 */

import { describe, it, expect } from 'vitest'
import {
  ed25519PublicKeyToNearAddress,
  nearAddressToEd25519PublicKey,
  isValidNearImplicitAddress,
  isValidNearAccountId,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
} from '../../src/stealth'
import type { HexString } from '@sip-protocol/types'

describe('NEAR Address Derivation', () => {
  // ─── ed25519PublicKeyToNearAddress ────────────────────────────────────────────

  describe('ed25519PublicKeyToNearAddress', () => {
    it('should convert ed25519 public key to NEAR implicit address', () => {
      // Known test vector: 32 zero bytes should produce 64 zeros
      const zeroKey = '0x' + '00'.repeat(32) as HexString
      const nearAddress = ed25519PublicKeyToNearAddress(zeroKey)

      expect(nearAddress).toBe('00'.repeat(32))
      expect(nearAddress.length).toBe(64)
    })

    it('should convert arbitrary ed25519 public key to lowercase hex', () => {
      const testKey = '0x' + 'AB'.repeat(32) as HexString
      const nearAddress = ed25519PublicKeyToNearAddress(testKey)

      // Should be lowercase
      expect(nearAddress).toBe('ab'.repeat(32))
      expect(nearAddress.length).toBe(64)
      expect(isValidNearImplicitAddress(nearAddress)).toBe(true)
    })

    it('should produce valid NEAR addresses from stealth address generation', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)

      // Verify the address is valid
      expect(isValidNearImplicitAddress(nearAddress)).toBe(true)
      expect(nearAddress.length).toBe(64)
    })

    it('should produce unique addresses for different keys', () => {
      const key1 = '0x' + 'ab'.repeat(32) as HexString
      const key2 = '0x' + 'cd'.repeat(32) as HexString

      const address1 = ed25519PublicKeyToNearAddress(key1)
      const address2 = ed25519PublicKeyToNearAddress(key2)

      expect(address1).not.toBe(address2)
    })

    it('should throw for invalid hex string', () => {
      expect(() => ed25519PublicKeyToNearAddress('not-hex' as HexString)).toThrow()
      expect(() => ed25519PublicKeyToNearAddress('0xgg' as HexString)).toThrow()
    })

    it('should throw for wrong length key', () => {
      // 16 bytes instead of 32
      const shortKey = '0x' + 'ab'.repeat(16) as HexString
      expect(() => ed25519PublicKeyToNearAddress(shortKey)).toThrow()

      // 64 bytes instead of 32
      const longKey = '0x' + 'ab'.repeat(64) as HexString
      expect(() => ed25519PublicKeyToNearAddress(longKey)).toThrow()
    })

    it('should not include 0x prefix in output', () => {
      const testKey = '0x' + 'ab'.repeat(32) as HexString
      const nearAddress = ed25519PublicKeyToNearAddress(testKey)

      expect(nearAddress.startsWith('0x')).toBe(false)
    })
  })

  // ─── nearAddressToEd25519PublicKey ────────────────────────────────────────────

  describe('nearAddressToEd25519PublicKey', () => {
    it('should convert NEAR address back to ed25519 public key', () => {
      const zeroAddress = '00'.repeat(32)
      const pubKey = nearAddressToEd25519PublicKey(zeroAddress)

      expect(pubKey).toBe('0x' + '00'.repeat(32))
    })

    it('should be inverse of ed25519PublicKeyToNearAddress', () => {
      const originalKey = '0x' + 'ab'.repeat(32) as HexString
      const nearAddress = ed25519PublicKeyToNearAddress(originalKey)
      const recoveredKey = nearAddressToEd25519PublicKey(nearAddress)

      expect(recoveredKey).toBe(originalKey)
    })

    it('should work with stealth-generated addresses', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
      const recoveredKey = nearAddressToEd25519PublicKey(nearAddress)

      expect(recoveredKey).toBe(stealthAddress.address)
    })

    it('should handle uppercase input by normalizing to lowercase', () => {
      // Even if given uppercase, validation should fail since NEAR requires lowercase
      const upperAddress = 'AB'.repeat(32)
      expect(() => nearAddressToEd25519PublicKey(upperAddress)).toThrow()
    })

    it('should throw for invalid NEAR address', () => {
      expect(() => nearAddressToEd25519PublicKey('invalid')).toThrow()
      expect(() => nearAddressToEd25519PublicKey('')).toThrow()
      expect(() => nearAddressToEd25519PublicKey('0x' + 'ab'.repeat(32))).toThrow() // Has prefix
    })

    it('should throw for wrong length address', () => {
      // Too short
      expect(() => nearAddressToEd25519PublicKey('ab'.repeat(16))).toThrow()
      // Too long
      expect(() => nearAddressToEd25519PublicKey('ab'.repeat(64))).toThrow()
    })
  })

  // ─── isValidNearImplicitAddress ──────────────────────────────────────────────

  describe('isValidNearImplicitAddress', () => {
    it('should return true for valid implicit addresses', () => {
      // 64 lowercase hex chars
      expect(isValidNearImplicitAddress('00'.repeat(32))).toBe(true)
      expect(isValidNearImplicitAddress('ab'.repeat(32))).toBe(true)
      expect(isValidNearImplicitAddress('0123456789abcdef'.repeat(4))).toBe(true)

      // Generated address
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
      expect(isValidNearImplicitAddress(nearAddress)).toBe(true)
    })

    it('should return false for invalid addresses', () => {
      // Empty string
      expect(isValidNearImplicitAddress('')).toBe(false)

      // Too short
      expect(isValidNearImplicitAddress('ab'.repeat(16))).toBe(false)

      // Too long
      expect(isValidNearImplicitAddress('ab'.repeat(64))).toBe(false)

      // Has 0x prefix
      expect(isValidNearImplicitAddress('0x' + 'ab'.repeat(32))).toBe(false)

      // Uppercase (NEAR requires lowercase)
      expect(isValidNearImplicitAddress('AB'.repeat(32))).toBe(false)

      // Mixed case
      expect(isValidNearImplicitAddress('AbCd'.repeat(16))).toBe(false)

      // Invalid hex characters
      expect(isValidNearImplicitAddress('gg'.repeat(32))).toBe(false)
    })

    it('should return false for non-string inputs', () => {
      // @ts-expect-error - testing runtime behavior
      expect(isValidNearImplicitAddress(null)).toBe(false)
      // @ts-expect-error - testing runtime behavior
      expect(isValidNearImplicitAddress(undefined)).toBe(false)
      // @ts-expect-error - testing runtime behavior
      expect(isValidNearImplicitAddress(123)).toBe(false)
    })

    it('should return false for named accounts', () => {
      // Named accounts are valid NEAR account IDs but not implicit addresses
      expect(isValidNearImplicitAddress('alice.near')).toBe(false)
      expect(isValidNearImplicitAddress('bob.testnet')).toBe(false)
    })
  })

  // ─── isValidNearAccountId ────────────────────────────────────────────────────

  describe('isValidNearAccountId', () => {
    it('should return true for valid implicit accounts', () => {
      expect(isValidNearAccountId('00'.repeat(32))).toBe(true)
      expect(isValidNearAccountId('ab'.repeat(32))).toBe(true)
    })

    it('should return true for valid named accounts', () => {
      expect(isValidNearAccountId('alice.near')).toBe(true)
      expect(isValidNearAccountId('bob.testnet')).toBe(true)
      expect(isValidNearAccountId('a1')).toBe(true)
      expect(isValidNearAccountId('my-account.near')).toBe(true)
      expect(isValidNearAccountId('my_account.near')).toBe(true)
      expect(isValidNearAccountId('sub.account.near')).toBe(true)
    })

    it('should return false for invalid account IDs', () => {
      // Empty
      expect(isValidNearAccountId('')).toBe(false)

      // Too short (< 2 chars for named)
      expect(isValidNearAccountId('a')).toBe(false)

      // Invalid characters
      expect(isValidNearAccountId('alice!')).toBe(false)
      expect(isValidNearAccountId('alice@near')).toBe(false)
      expect(isValidNearAccountId('alice near')).toBe(false)

      // Uppercase (NEAR is lowercase only)
      expect(isValidNearAccountId('Alice.near')).toBe(false)

      // Starts/ends with special char
      expect(isValidNearAccountId('.alice')).toBe(false)
      expect(isValidNearAccountId('alice.')).toBe(false)
      expect(isValidNearAccountId('-alice')).toBe(false)
      expect(isValidNearAccountId('alice-')).toBe(false)

      // Consecutive periods
      expect(isValidNearAccountId('alice..near')).toBe(false)
    })

    it('should return false for non-string inputs', () => {
      // @ts-expect-error - testing runtime behavior
      expect(isValidNearAccountId(null)).toBe(false)
      // @ts-expect-error - testing runtime behavior
      expect(isValidNearAccountId(undefined)).toBe(false)
      // @ts-expect-error - testing runtime behavior
      expect(isValidNearAccountId(123)).toBe(false)
    })
  })

  // ─── Integration with Stealth Address Flow ─────────────────────────────────

  describe('Integration with Stealth Address Flow', () => {
    it('should derive valid NEAR addresses from full stealth flow', () => {
      // Generate stealth meta-address
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('near')

      // Generate stealth address (as sender would)
      const { stealthAddress, sharedSecret, ephemeralPublicKey } =
        generateEd25519StealthAddress(metaAddress)

      // Convert to NEAR address
      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)

      // Verify address is valid
      expect(isValidNearImplicitAddress(nearAddress)).toBe(true)
      expect(nearAddress.length).toBe(64)

      // Verify roundtrip
      const recoveredKey = nearAddressToEd25519PublicKey(nearAddress)
      expect(recoveredKey).toBe(stealthAddress.address)
    })

    it('should produce different NEAR addresses for multiple stealth addresses', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')

      const addresses: string[] = []
      for (let i = 0; i < 5; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
        const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
        addresses.push(nearAddress)
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(5)
    })

    it('should work with both Solana and NEAR chains', () => {
      // Solana stealth address
      const solanaResult = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress: solanaStealthAddr } = generateEd25519StealthAddress(solanaResult.metaAddress)

      // NEAR stealth address
      const nearResult = generateEd25519StealthMetaAddress('near')
      const { stealthAddress: nearStealthAddr } = generateEd25519StealthAddress(nearResult.metaAddress)

      // Both should produce valid NEAR addresses (since both are ed25519)
      const nearAddr1 = ed25519PublicKeyToNearAddress(solanaStealthAddr.address)
      const nearAddr2 = ed25519PublicKeyToNearAddress(nearStealthAddr.address)

      expect(isValidNearImplicitAddress(nearAddr1)).toBe(true)
      expect(isValidNearImplicitAddress(nearAddr2)).toBe(true)
    })
  })
})
