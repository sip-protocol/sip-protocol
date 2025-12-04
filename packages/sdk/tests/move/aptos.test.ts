/**
 * Aptos Stealth Address Tests
 *
 * Tests for Aptos stealth address generation and address format conversion.
 */

import { describe, it, expect } from 'vitest'
import {
  AptosStealthService,
  generateAptosStealthAddress,
  deriveAptosStealthPrivateKey,
  checkAptosStealthAddress,
  ed25519PublicKeyToAptosAddress,
  aptosAddressToAuthKey,
  isValidAptosAddress,
} from '../../src/move'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
} from '../../src/stealth'
import type { HexString, StealthMetaAddress } from '@sip-protocol/types'
import { ed25519 } from '@noble/curves/ed25519'
import { bytesToHex } from '@noble/hashes/utils'

describe('Aptos Stealth Addresses', () => {
  // ─── ed25519PublicKeyToAptosAddress ────────────────────────────────────────

  describe('ed25519PublicKeyToAptosAddress', () => {
    it('should convert ed25519 public key to Aptos address', () => {
      // Known test vector: 32 zero bytes
      const zeroKey = '0x' + '00'.repeat(32) as HexString
      const aptosAddress = ed25519PublicKeyToAptosAddress(zeroKey)

      // Should be a valid Aptos address
      expect(aptosAddress).toMatch(/^0x[0-9a-f]{64}$/)
      expect(isValidAptosAddress(aptosAddress)).toBe(true)
    })

    it('should produce deterministic addresses', () => {
      const testKey = '0x' + 'ab'.repeat(32) as HexString
      const address1 = ed25519PublicKeyToAptosAddress(testKey)
      const address2 = ed25519PublicKeyToAptosAddress(testKey)

      expect(address1).toBe(address2)
    })

    it('should produce unique addresses for different keys', () => {
      const key1 = '0x' + 'ab'.repeat(32) as HexString
      const key2 = '0x' + 'cd'.repeat(32) as HexString

      const address1 = ed25519PublicKeyToAptosAddress(key1)
      const address2 = ed25519PublicKeyToAptosAddress(key2)

      expect(address1).not.toBe(address2)
    })

    it('should produce valid Aptos addresses from stealth generation', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('aptos')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const aptosAddress = ed25519PublicKeyToAptosAddress(stealthAddress.address)

      expect(isValidAptosAddress(aptosAddress)).toBe(true)
      expect(aptosAddress.length).toBe(66) // '0x' + 64 hex chars
    })

    it('should throw for invalid hex string', () => {
      expect(() => ed25519PublicKeyToAptosAddress('not-hex' as HexString)).toThrow('valid hex string')
      expect(() => ed25519PublicKeyToAptosAddress('0xgg' as HexString)).toThrow()
    })

    it('should throw for wrong length key', () => {
      // 16 bytes instead of 32
      const shortKey = '0x' + 'ab'.repeat(16) as HexString
      expect(() => ed25519PublicKeyToAptosAddress(shortKey)).toThrow('32 bytes')

      // 64 bytes instead of 32
      const longKey = '0x' + 'ab'.repeat(64) as HexString
      expect(() => ed25519PublicKeyToAptosAddress(longKey)).toThrow('32 bytes')
    })

    it('should handle keys with leading zeros', () => {
      const keyWithLeadingZeros = '0x' + '0000' + 'ab'.repeat(30) as HexString
      const address = ed25519PublicKeyToAptosAddress(keyWithLeadingZeros)

      expect(isValidAptosAddress(address)).toBe(true)
    })

    it('should match known Aptos address derivation', () => {
      // Test with a real ed25519 public key pattern
      const publicKey = '0x' + '01'.repeat(32) as HexString
      const address = ed25519PublicKeyToAptosAddress(publicKey)

      // Should be exactly 64 hex characters after 0x
      expect(address.slice(2).length).toBe(64)
      expect(address.startsWith('0x')).toBe(true)
    })
  })

  // ─── isValidAptosAddress ───────────────────────────────────────────────────

  describe('isValidAptosAddress', () => {
    it('should return true for valid Aptos addresses', () => {
      // Generated address
      const { metaAddress } = generateEd25519StealthMetaAddress('aptos')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      const aptosAddress = ed25519PublicKeyToAptosAddress(stealthAddress.address)

      expect(isValidAptosAddress(aptosAddress)).toBe(true)
    })

    it('should return true for 0x-prefixed 64-character hex strings', () => {
      const validAddress = '0x' + 'a'.repeat(64)
      expect(isValidAptosAddress(validAddress)).toBe(true)

      const validAddress2 = '0x' + '1234567890abcdef'.repeat(4)
      expect(isValidAptosAddress(validAddress2)).toBe(true)
    })

    it('should return false for invalid addresses', () => {
      // Empty string
      expect(isValidAptosAddress('')).toBe(false)

      // No 0x prefix
      expect(isValidAptosAddress('a'.repeat(64))).toBe(false)

      // Too short
      expect(isValidAptosAddress('0xabc')).toBe(false)

      // Too long
      expect(isValidAptosAddress('0x' + 'a'.repeat(65))).toBe(false)

      // Invalid hex characters
      expect(isValidAptosAddress('0x' + 'g'.repeat(64))).toBe(false)

      // Not a string
      expect(isValidAptosAddress(null as unknown as any)).toBe(false)
      expect(isValidAptosAddress(undefined as unknown as any)).toBe(false)
      expect(isValidAptosAddress(123 as unknown as number)).toBe(false)
    })

    it('should accept both uppercase and lowercase hex', () => {
      const lowercase = '0x' + 'abcdef123456'.repeat(5) + 'abcd'
      const uppercase = '0x' + 'ABCDEF123456'.repeat(5) + 'ABCD'
      const mixed = '0x' + 'aBcDeF123456'.repeat(5) + 'AbCd'

      expect(isValidAptosAddress(lowercase)).toBe(true)
      expect(isValidAptosAddress(uppercase)).toBe(true)
      expect(isValidAptosAddress(mixed)).toBe(true)
    })
  })

  // ─── aptosAddressToAuthKey ─────────────────────────────────────────────────

  describe('aptosAddressToAuthKey', () => {
    it('should normalize Aptos address to lowercase', () => {
      const uppercase = '0x' + 'ABCDEF123456'.repeat(5) + 'ABCD'
      const authKey = aptosAddressToAuthKey(uppercase)

      expect(authKey).toBe(uppercase.toLowerCase())
    })

    it('should preserve valid lowercase addresses', () => {
      const lowercase = '0x' + 'abcdef123456'.repeat(5) + 'abcd'
      const authKey = aptosAddressToAuthKey(lowercase)

      expect(authKey).toBe(lowercase)
    })

    it('should throw for invalid addresses', () => {
      expect(() => aptosAddressToAuthKey('invalid')).toThrow('Invalid Aptos address')
      expect(() => aptosAddressToAuthKey('0xshort')).toThrow()
      expect(() => aptosAddressToAuthKey('')).toThrow()
    })
  })

  // ─── generateAptosStealthAddress ───────────────────────────────────────────

  describe('generateAptosStealthAddress', () => {
    it('should generate valid Aptos stealth address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('aptos')
      const result = generateAptosStealthAddress(metaAddress)

      // Check all fields are present
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthPublicKey).toBeDefined()
      expect(result.ephemeralPublicKey).toBeDefined()
      expect(result.viewTag).toBeDefined()
      expect(result.sharedSecret).toBeDefined()

      // Validate formats
      expect(isValidAptosAddress(result.stealthAddress)).toBe(true)
      expect(result.stealthPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.viewTag).toBeLessThanOrEqual(255)
      expect(result.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should generate unique addresses for same recipient', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('aptos')

      const result1 = generateAptosStealthAddress(metaAddress)
      const result2 = generateAptosStealthAddress(metaAddress)

      // Each generation should produce unique stealth addresses
      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
      expect(result1.ephemeralPublicKey).not.toBe(result2.ephemeralPublicKey)
    })

    it('should generate different addresses for different recipients', () => {
      const { metaAddress: recipient1 } = generateEd25519StealthMetaAddress('aptos')
      const { metaAddress: recipient2 } = generateEd25519StealthMetaAddress('aptos')

      const result1 = generateAptosStealthAddress(recipient1)
      const result2 = generateAptosStealthAddress(recipient2)

      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
    })

    it('should throw for wrong chain in meta-address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      expect(() => generateAptosStealthAddress(metaAddress)).toThrow("Expected chain 'aptos'")
    })

    it('should throw for invalid meta-address', () => {
      const invalidMetaAddress = {
        spendingKey: 'invalid' as HexString,
        viewingKey: 'invalid' as HexString,
        chain: 'aptos' as const,
      }

      expect(() => generateAptosStealthAddress(invalidMetaAddress)).toThrow()
    })
  })

  // ─── deriveAptosStealthPrivateKey ──────────────────────────────────────────

  describe('deriveAptosStealthPrivateKey', () => {
    it('should derive private key for stealth address', () => {
      // Generate recipient keys
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('aptos')

      // Sender generates stealth address
      const { stealthAddress, stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(metaAddress)

      // Recipient derives private key
      const recovery = deriveAptosStealthPrivateKey(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Check all fields
      expect(recovery.stealthAddress).toBe(stealthPublicKey)
      expect(recovery.ephemeralPublicKey).toBe(ephemeralPublicKey)
      expect(recovery.privateKey).toBeDefined()
      expect(recovery.aptosAddress).toBe(stealthAddress)
      expect(isValidAptosAddress(recovery.aptosAddress)).toBe(true)
    })

    it('should derive key that matches stealth public key', () => {
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('aptos')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(metaAddress)

      const recovery = deriveAptosStealthPrivateKey(
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
      } = generateEd25519StealthMetaAddress('aptos')

      const invalidStealthAddress = {
        address: 'invalid' as HexString,
        ephemeralPublicKey: '0x' + '00'.repeat(32) as HexString,
        viewTag: 0,
      }

      expect(() =>
        deriveAptosStealthPrivateKey(
          invalidStealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )
      ).toThrow()
    })

    it('should throw for invalid private keys', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('aptos')
      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(metaAddress)

      const stealthAddr = { address: stealthPublicKey, ephemeralPublicKey, viewTag }

      expect(() =>
        deriveAptosStealthPrivateKey(
          stealthAddr,
          'invalid' as HexString,
          '0x' + '00'.repeat(32) as HexString
        )
      ).toThrow()

      expect(() =>
        deriveAptosStealthPrivateKey(
          stealthAddr,
          '0x' + '00'.repeat(32) as HexString,
          'invalid' as HexString
        )
      ).toThrow()
    })
  })

  // ─── checkAptosStealthAddress ──────────────────────────────────────────────

  describe('checkAptosStealthAddress', () => {
    it('should return true for matching stealth address', () => {
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('aptos')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(metaAddress)

      const isMatch = checkAptosStealthAddress(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(true)
    })

    it('should return false for non-matching stealth address', () => {
      const recipient1 = generateEd25519StealthMetaAddress('aptos')
      const recipient2 = generateEd25519StealthMetaAddress('aptos')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(recipient1.metaAddress)

      // Try to check with recipient2's keys
      const isMatch = checkAptosStealthAddress(
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
      } = generateEd25519StealthMetaAddress('aptos')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(metaAddress)

      // Create address with wrong view tag
      const wrongViewTag = (viewTag + 1) % 256
      const wrongTagAddress = {
        address: stealthPublicKey,
        ephemeralPublicKey,
        viewTag: wrongViewTag,
      }

      const isMatch = checkAptosStealthAddress(
        wrongTagAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(false)
    })
  })

  // ─── AptosStealthService Class ─────────────────────────────────────────────

  describe('AptosStealthService', () => {
    it('should provide service-based interface for stealth operations', () => {
      const service = new AptosStealthService()
      const { metaAddress } = generateEd25519StealthMetaAddress('aptos')

      const result = service.generateStealthAddress(metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(isValidAptosAddress(result.stealthAddress)).toBe(true)
    })

    it('should convert stealth keys to Aptos addresses', () => {
      const service = new AptosStealthService()
      const testKey = '0x' + 'ab'.repeat(32) as HexString

      const address = service.stealthKeyToAptosAddress(testKey)

      expect(isValidAptosAddress(address)).toBe(true)
    })

    it('should derive stealth private keys', () => {
      const service = new AptosStealthService()
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('aptos')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        service.generateStealthAddress(metaAddress)

      const recovery = service.deriveStealthPrivateKey(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.aptosAddress).toBeDefined()
    })

    it('should check stealth address ownership', () => {
      const service = new AptosStealthService()
      const {
        metaAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      } = generateEd25519StealthMetaAddress('aptos')

      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        service.generateStealthAddress(metaAddress)

      const isMatch = service.checkStealthAddress(
        { address: stealthPublicKey, ephemeralPublicKey, viewTag },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(true)
    })

    it('should validate Aptos addresses', () => {
      const service = new AptosStealthService()

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
      } = generateEd25519StealthMetaAddress('aptos')

      // 2. Sender generates stealth address
      const senderResult = generateAptosStealthAddress(metaAddress)

      // 3. Sender publishes ephemeral key and sends to stealth address
      const announcement = {
        address: senderResult.stealthPublicKey,
        ephemeralPublicKey: senderResult.ephemeralPublicKey,
        viewTag: senderResult.viewTag,
      }

      // 4. Recipient scans and checks if address is theirs
      const isMine = checkAptosStealthAddress(
        announcement,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMine).toBe(true)

      // 5. Recipient derives private key to claim funds
      const recovery = deriveAptosStealthPrivateKey(
        announcement,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.aptosAddress).toBe(senderResult.stealthAddress)
      expect(recovery.privateKey).toBeDefined()
    })

    it('should work with multiple recipients scanning', () => {
      // Create 3 recipients
      const recipient1 = generateEd25519StealthMetaAddress('aptos')
      const recipient2 = generateEd25519StealthMetaAddress('aptos')
      const recipient3 = generateEd25519StealthMetaAddress('aptos')

      // Sender creates stealth address for recipient2
      const { stealthPublicKey, ephemeralPublicKey, viewTag } =
        generateAptosStealthAddress(recipient2.metaAddress)

      const announcement = { address: stealthPublicKey, ephemeralPublicKey, viewTag }

      // All recipients scan
      const match1 = checkAptosStealthAddress(
        announcement,
        recipient1.spendingPrivateKey,
        recipient1.viewingPrivateKey
      )
      const match2 = checkAptosStealthAddress(
        announcement,
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )
      const match3 = checkAptosStealthAddress(
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
})
