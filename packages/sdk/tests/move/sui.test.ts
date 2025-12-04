/**
 * Sui Stealth Address Tests
 *
 * Tests for Sui stealth address generation and address format conversion.
 * Sui uses ed25519 like Aptos, but with BLAKE2b-256 instead of SHA3-256 for address derivation.
 */

import { describe, it, expect } from 'vitest'
import {
  SuiStealthService,
  generateSuiStealthAddress,
  deriveSuiStealthPrivateKey,
  checkSuiStealthAddress,
  ed25519PublicKeyToSuiAddress,
  normalizeSuiAddress,
  isValidSuiAddress,
  // Import Aptos for comparison tests
  ed25519PublicKeyToAptosAddress,
  generateAptosStealthAddress,
  isValidAptosAddress,
} from '../../src/move'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
} from '../../src/stealth'
import type { HexString, StealthMetaAddress } from '@sip-protocol/types'
import { ed25519 } from '@noble/curves/ed25519'
import { bytesToHex } from '@noble/hashes/utils'

describe('Sui Stealth Addresses', () => {
  // ─── ed25519PublicKeyToSuiAddress ──────────────────────────────────────────

  describe('ed25519PublicKeyToSuiAddress', () => {
    it('should convert ed25519 public key to Sui address', () => {
      // Known test vector: 32 zero bytes
      const zeroKey = '0x' + '00'.repeat(32) as HexString
      const suiAddress = ed25519PublicKeyToSuiAddress(zeroKey)

      // Should be a valid Sui address
      expect(suiAddress).toMatch(/^0x[0-9a-f]{64}$/)
      expect(isValidSuiAddress(suiAddress)).toBe(true)
    })

    it('should produce deterministic addresses', () => {
      const testKey = '0x' + 'ab'.repeat(32) as HexString
      const address1 = ed25519PublicKeyToSuiAddress(testKey)
      const address2 = ed25519PublicKeyToSuiAddress(testKey)

      expect(address1).toBe(address2)
    })

    it('should produce unique addresses for different keys', () => {
      const key1 = '0x' + 'ab'.repeat(32) as HexString
      const key2 = '0x' + 'cd'.repeat(32) as HexString

      const address1 = ed25519PublicKeyToSuiAddress(key1)
      const address2 = ed25519PublicKeyToSuiAddress(key2)

      expect(address1).not.toBe(address2)
    })

    it('should produce different addresses from Aptos (BLAKE2b vs SHA3)', () => {
      const testKey = '0x' + 'ab'.repeat(32) as HexString
      const suiAddress = ed25519PublicKeyToSuiAddress(testKey)
      const aptosAddress = ed25519PublicKeyToAptosAddress(testKey)

      // Same public key, different address due to different hash functions
      expect(suiAddress).not.toBe(aptosAddress)
      expect(isValidSuiAddress(suiAddress)).toBe(true)
    })

    it('should produce valid Sui addresses from stealth generation', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const suiAddress = ed25519PublicKeyToSuiAddress(stealthAddress.address)

      expect(isValidSuiAddress(suiAddress)).toBe(true)
      expect(suiAddress.length).toBe(66) // '0x' + 64 hex chars
    })

    it('should throw for invalid hex string', () => {
      expect(() => ed25519PublicKeyToSuiAddress('not-hex' as HexString)).toThrow('valid hex string')
      expect(() => ed25519PublicKeyToSuiAddress('0xgg' as HexString)).toThrow()
    })

    it('should throw for wrong length key', () => {
      // 16 bytes instead of 32
      const shortKey = '0x' + 'ab'.repeat(16) as HexString
      expect(() => ed25519PublicKeyToSuiAddress(shortKey)).toThrow('32 bytes')

      // 64 bytes instead of 32
      const longKey = '0x' + 'ab'.repeat(64) as HexString
      expect(() => ed25519PublicKeyToSuiAddress(longKey)).toThrow('32 bytes')
    })

    it('should handle keys with leading zeros', () => {
      const keyWithLeadingZeros = '0x' + '0000' + 'ab'.repeat(30) as HexString
      const address = ed25519PublicKeyToSuiAddress(keyWithLeadingZeros)

      expect(isValidSuiAddress(address)).toBe(true)
    })

    it('should match known Sui address derivation pattern', () => {
      // Test with a real ed25519 public key pattern
      const publicKey = '0x' + '01'.repeat(32) as HexString
      const address = ed25519PublicKeyToSuiAddress(publicKey)

      // Should be exactly 64 hex characters after 0x
      expect(address.slice(2).length).toBe(64)
      expect(address.startsWith('0x')).toBe(true)
    })
  })

  // ─── isValidSuiAddress ─────────────────────────────────────────────────────

  describe('isValidSuiAddress', () => {
    it('should return true for valid Sui addresses', () => {
      // Generated address
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      const suiAddress = ed25519PublicKeyToSuiAddress(stealthAddress.address)

      expect(isValidSuiAddress(suiAddress)).toBe(true)
    })

    it('should return true for 0x-prefixed 64-character hex strings', () => {
      const validAddress = '0x' + 'a'.repeat(64)
      expect(isValidSuiAddress(validAddress)).toBe(true)

      const validAddress2 = '0x' + '1234567890abcdef'.repeat(4)
      expect(isValidSuiAddress(validAddress2)).toBe(true)
    })

    it('should return false for invalid addresses', () => {
      // Empty string
      expect(isValidSuiAddress('')).toBe(false)

      // No 0x prefix
      expect(isValidSuiAddress('a'.repeat(64))).toBe(false)

      // Too short
      expect(isValidSuiAddress('0xabc')).toBe(false)

      // Too long
      expect(isValidSuiAddress('0x' + 'a'.repeat(65))).toBe(false)

      // Invalid hex characters
      expect(isValidSuiAddress('0x' + 'g'.repeat(64))).toBe(false)

      // Not a string
      expect(isValidSuiAddress(null as unknown as any)).toBe(false)
      expect(isValidSuiAddress(undefined as unknown as any)).toBe(false)
      expect(isValidSuiAddress(123 as unknown as number)).toBe(false)
    })

    it('should accept both uppercase and lowercase hex', () => {
      const lowercase = '0x' + 'abcdef123456'.repeat(5) + 'abcd'
      const uppercase = '0x' + 'ABCDEF123456'.repeat(5) + 'ABCD'
      const mixed = '0x' + 'aBcDeF123456'.repeat(5) + 'AbCd'

      expect(isValidSuiAddress(lowercase)).toBe(true)
      expect(isValidSuiAddress(uppercase)).toBe(true)
      expect(isValidSuiAddress(mixed)).toBe(true)
    })
  })

  // ─── normalizeSuiAddress ───────────────────────────────────────────────────

  describe('normalizeSuiAddress', () => {
    it('should normalize Sui address to lowercase', () => {
      const uppercase = '0x' + 'ABCDEF123456'.repeat(5) + 'ABCD'
      const normalized = normalizeSuiAddress(uppercase)

      expect(normalized).toBe(uppercase.toLowerCase())
    })

    it('should preserve valid lowercase addresses', () => {
      const lowercase = '0x' + 'abcdef123456'.repeat(5) + 'abcd'
      const normalized = normalizeSuiAddress(lowercase)

      expect(normalized).toBe(lowercase)
    })

    it('should throw for invalid addresses', () => {
      expect(() => normalizeSuiAddress('invalid')).toThrow('Invalid Sui address')
      expect(() => normalizeSuiAddress('0xshort')).toThrow()
      expect(() => normalizeSuiAddress('')).toThrow()
    })
  })

  // ─── generateSuiStealthAddress ─────────────────────────────────────────────

  describe('generateSuiStealthAddress', () => {
    it('should generate valid Sui stealth address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')
      const result = generateSuiStealthAddress(metaAddress)

      // Check all fields are present
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthPublicKey).toBeDefined()
      expect(result.ephemeralPublicKey).toBeDefined()
      expect(result.viewTag).toBeDefined()
      expect(result.sharedSecret).toBeDefined()

      // Validate formats
      expect(isValidSuiAddress(result.stealthAddress)).toBe(true)
      expect(result.stealthPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.viewTag).toBeLessThanOrEqual(255)
      expect(result.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should generate unique addresses for same recipient', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')

      const result1 = generateSuiStealthAddress(metaAddress)
      const result2 = generateSuiStealthAddress(metaAddress)

      // Each generation should produce unique stealth addresses
      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
      expect(result1.ephemeralPublicKey).not.toBe(result2.ephemeralPublicKey)
    })

    it('should generate different addresses for different recipients', () => {
      const { metaAddress: recipient1 } = generateEd25519StealthMetaAddress('sui')
      const { metaAddress: recipient2 } = generateEd25519StealthMetaAddress('sui')

      const result1 = generateSuiStealthAddress(recipient1)
      const result2 = generateSuiStealthAddress(recipient2)

      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
    })

    it('should throw for wrong chain in meta-address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      expect(() => generateSuiStealthAddress(metaAddress)).toThrow("Expected chain 'sui'")
    })

    it('should throw for invalid meta-address', () => {
      const invalidMetaAddress = {
        spendingKey: 'invalid' as HexString,
        viewingKey: 'invalid' as HexString,
        chain: 'sui' as const,
      }

      expect(() => generateSuiStealthAddress(invalidMetaAddress)).toThrow()
    })
  })

  // ─── deriveSuiStealthPrivateKey ────────────────────────────────────────────

  describe('deriveSuiStealthPrivateKey', () => {
    it('should derive private key for stealth address', () => {
      // Generate recipient keys
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      // Sender generates stealth address
      const { stealthAddress, stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(metaAddress)

      // Recipient derives private key
      const recovery = deriveSuiStealthPrivateKey(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Check all fields
      expect(recovery.stealthAddress).toBe(stealthPublicKey)
      expect(recovery.ephemeralPublicKey).toBe(ephemeralPublicKey)
      expect(recovery.privateKey).toBeDefined()
      expect(recovery.suiAddress).toBe(stealthAddress)
      expect(isValidSuiAddress(recovery.suiAddress)).toBe(true)
    })

    it('should derive key that matches stealth public key', () => {
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(metaAddress)

      const recovery = deriveSuiStealthPrivateKey(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Verify the derived private key produces the correct public key
      // Note: The derived key is a raw scalar, not a seed
      // We need to use it with ExtendedPoint multiplication
      const privateKeyBytes = new Uint8Array(
        Buffer.from(recovery.privateKey.slice(2), 'hex')
      )

      // Convert to scalar (little-endian)
      let scalar = 0n
      for (let i = privateKeyBytes.length - 1; i >= 0; i--) {
        scalar = (scalar << 8n) + BigInt(privateKeyBytes[i])
      }

      // Derive public key from scalar
      const derivedPublicKey = ed25519.ExtendedPoint.BASE.multiply(scalar)
      const derivedPublicKeyHex = '0x' + bytesToHex(derivedPublicKey.toRawBytes())

      expect(derivedPublicKeyHex).toBe(stealthPublicKey)
    })

    it('should throw for invalid stealth address', () => {
      const {
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      const invalidStealthAddress = {
        address: 'invalid' as HexString,
        ephemeralPublicKey: '0x' + '00'.repeat(32) as HexString,
        viewTag: 0,
      }

      expect(() =>
        deriveSuiStealthPrivateKey(
          invalidStealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )
      ).toThrow()
    })

    it('should throw for invalid private keys', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')
      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(metaAddress)

      const stealthAddr = { address: stealthPublicKey, ephemeralPublicKey, viewTag }

      expect(() =>
        deriveSuiStealthPrivateKey(
          stealthAddr,
          'invalid' as HexString,
          '0x' + '00'.repeat(32) as HexString
        )
      ).toThrow()

      expect(() =>
        deriveSuiStealthPrivateKey(
          stealthAddr,
          '0x' + '00'.repeat(32) as HexString,
          'invalid' as HexString
        )
      ).toThrow()
    })
  })

  // ─── checkSuiStealthAddress ────────────────────────────────────────────────

  describe('checkSuiStealthAddress', () => {
    it('should return true for matching stealth address', () => {
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(metaAddress)

      const isMatch = checkSuiStealthAddress(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(true)
    })

    it('should return false for non-matching stealth address', () => {
      const recipient1 = generateEd25519StealthMetaAddress('sui')
      const recipient2 = generateEd25519StealthMetaAddress('sui')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(recipient1.metaAddress)

      // Try to check with recipient2's keys
      const isMatch = checkSuiStealthAddress(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )

      expect(isMatch).toBe(false)
    })

    it('should use view tag for efficient filtering', () => {
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(metaAddress)

      // Create address with wrong view tag
      const wrongViewTag = (viewTag + 1) % 256
      const wrongTagAddress = {
        address: stealthPublicKey,
        ephemeralPublicKey,
        viewTag: wrongViewTag,
      }

      const isMatch = checkSuiStealthAddress(
        wrongTagAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(false)
    })
  })

  // ─── SuiStealthService Class ───────────────────────────────────────────────

  describe('SuiStealthService', () => {
    it('should provide service-based interface for stealth operations', () => {
      const service = new SuiStealthService()
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')

      const result = service.generateStealthAddress(metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(isValidSuiAddress(result.stealthAddress)).toBe(true)
    })

    it('should convert stealth keys to Sui addresses', () => {
      const service = new SuiStealthService()
      const testKey = '0x' + 'ab'.repeat(32) as HexString

      const address = service.stealthKeyToSuiAddress(testKey)

      expect(isValidSuiAddress(address)).toBe(true)
    })

    it('should derive stealth private keys', () => {
      const service = new SuiStealthService()
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        service.generateStealthAddress(metaAddress)

      const recovery = service.deriveStealthPrivateKey(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.suiAddress).toBeDefined()
    })

    it('should check stealth address ownership', () => {
      const service = new SuiStealthService()
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        service.generateStealthAddress(metaAddress)

      const isMatch = service.checkStealthAddress(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(true)
    })

    it('should validate Sui addresses', () => {
      const service = new SuiStealthService()

      expect(service.isValidAddress('0x' + 'a'.repeat(64))).toBe(true)
      expect(service.isValidAddress('invalid')).toBe(false)
      expect(service.isValidAddress('0xshort')).toBe(false)
    })
  })

  // ─── Round-trip Tests ──────────────────────────────────────────────────────

  describe('Round-trip Tests', () => {
    it('should complete full sender → recipient flow', () => {
      // 1. Recipient generates meta-address and publishes it
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('sui')

      // 2. Sender generates stealth address
      const senderResult = generateSuiStealthAddress(metaAddress)

      // 3. Sender publishes ephemeral key and sends to stealth address
      const announcement = {
        address: senderResult.stealthPublicKey,
        ephemeralPublicKey: senderResult.ephemeralPublicKey,
        viewTag: senderResult.viewTag,
      }

      // 4. Recipient scans and checks if address is theirs
      const isMine = checkSuiStealthAddress(
        announcement,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMine).toBe(true)

      // 5. Recipient derives private key to claim funds
      const recovery = deriveSuiStealthPrivateKey(
        announcement,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.suiAddress).toBe(senderResult.stealthAddress)
      expect(recovery.privateKey).toBeDefined()
    })

    it('should work with multiple recipients scanning', () => {
      // Create 3 recipients
      const recipient1 = generateEd25519StealthMetaAddress('sui')
      const recipient2 = generateEd25519StealthMetaAddress('sui')
      const recipient3 = generateEd25519StealthMetaAddress('sui')

      // Sender creates stealth address for recipient2
      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateSuiStealthAddress(recipient2.metaAddress)

      const announcement = { address: stealthPublicKey, ephemeralPublicKey, viewTag }

      // All recipients scan
      const match1 = checkSuiStealthAddress(
        announcement,
        recipient1.spendingPrivateKey,
        recipient1.viewingPrivateKey
      )
      const match2 = checkSuiStealthAddress(
        announcement,
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )
      const match3 = checkSuiStealthAddress(
        announcement,
        recipient3.spendingPrivateKey,
        recipient3.viewingPrivateKey
      )

      // Only recipient2 should match
      expect(match1).toBe(false)
      expect(match2).toBe(true)
      expect(match3).toBe(false)
    })
  })

  // ─── Sui vs Aptos Comparison Tests ────────────────────────────────────────

  describe('Sui vs Aptos Address Derivation', () => {
    it('should produce different addresses from same stealth public key', () => {
      // Generate an ed25519 stealth public key
      const { metaAddress } = generateEd25519StealthMetaAddress('sui')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Convert the same ed25519 public key to both Sui and Aptos addresses
      const suiAddress = ed25519PublicKeyToSuiAddress(stealthAddress.address)
      const aptosAddress = ed25519PublicKeyToAptosAddress(stealthAddress.address)

      // Same stealth public key should produce different chain-specific addresses
      expect(suiAddress).not.toBe(aptosAddress)

      // Both should be valid for their respective chains
      expect(isValidSuiAddress(suiAddress)).toBe(true)
      expect(isValidAptosAddress(aptosAddress)).toBe(true)

      // Both are 32 bytes (64 hex chars + 0x)
      expect(suiAddress.length).toBe(66)
      expect(aptosAddress.length).toBe(66)
    })

    it('should use same stealth math but different address encoding', () => {
      // Test vector: known public key
      const testKey = '0x' + '42'.repeat(32) as HexString

      const suiAddress = ed25519PublicKeyToSuiAddress(testKey)
      const aptosAddress = ed25519PublicKeyToAptosAddress(testKey)

      // Different addresses due to different hash functions (BLAKE2b vs SHA3)
      expect(suiAddress).not.toBe(aptosAddress)

      // But both valid
      expect(isValidSuiAddress(suiAddress)).toBe(true)
      expect(isValidAptosAddress(aptosAddress)).toBe(true)

      // Both are 32 bytes (64 hex chars + 0x)
      expect(suiAddress.length).toBe(66)
      expect(aptosAddress.length).toBe(66)
    })
  })
})
