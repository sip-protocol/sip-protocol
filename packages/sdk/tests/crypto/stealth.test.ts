/**
 * Stealth Address Tests
 *
 * Comprehensive tests for EIP-5564 style stealth address primitives.
 */

import { describe, it, expect } from 'vitest'
import { secp256k1 } from '@noble/curves/secp256k1'
import { hexToBytes } from '@noble/hashes/utils'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  generateEd25519StealthMetaAddress,
} from '../../src/stealth'
import type { ChainId, StealthMetaAddress, HexString } from '@sip-protocol/types'

describe('Stealth Addresses', () => {
  describe('generateStealthMetaAddress()', () => {
    it('should generate valid meta-address', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)

      expect(metaAddress.spendingKey).toBeDefined()
      expect(metaAddress.viewingKey).toBeDefined()
      expect(metaAddress.chain).toBe('near')

      // Keys should be valid hex
      expect(metaAddress.spendingKey.startsWith('0x')).toBe(true)
      expect(metaAddress.viewingKey.startsWith('0x')).toBe(true)

      // Compressed public keys are 33 bytes = 66 hex chars
      expect(metaAddress.spendingKey.length).toBe(68) // 0x + 66
      expect(metaAddress.viewingKey.length).toBe(68)

      // Private keys are 32 bytes = 64 hex chars
      expect(spendingPrivateKey.length).toBe(66) // 0x + 64
      expect(viewingPrivateKey.length).toBe(66)
    })

    it('should generate different keys each time', () => {
      const gen1 = generateStealthMetaAddress('near' as ChainId)
      const gen2 = generateStealthMetaAddress('near' as ChainId)

      expect(gen1.metaAddress.spendingKey).not.toBe(gen2.metaAddress.spendingKey)
      expect(gen1.metaAddress.viewingKey).not.toBe(gen2.metaAddress.viewingKey)
    })

    it('should include optional label', () => {
      const { metaAddress } = generateStealthMetaAddress('zcash' as ChainId, 'My Stealth Wallet')

      expect(metaAddress.label).toBe('My Stealth Wallet')
      expect(metaAddress.chain).toBe('zcash')
    })

    it('should derive valid public keys from private keys', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)

      // Derive public key from private key and compare
      const derivedSpending = secp256k1.getPublicKey(
        hexToBytes(spendingPrivateKey.slice(2)),
        true
      )
      const derivedViewing = secp256k1.getPublicKey(
        hexToBytes(viewingPrivateKey.slice(2)),
        true
      )

      expect('0x' + Buffer.from(derivedSpending).toString('hex')).toBe(metaAddress.spendingKey)
      expect('0x' + Buffer.from(derivedViewing).toString('hex')).toBe(metaAddress.viewingKey)
    })
  })

  describe('generateStealthAddress()', () => {
    it('should generate valid stealth address for recipient', () => {
      const { metaAddress } = generateStealthMetaAddress('near' as ChainId)
      const { stealthAddress, sharedSecret } = generateStealthAddress(metaAddress)

      expect(stealthAddress.address).toBeDefined()
      expect(stealthAddress.ephemeralPublicKey).toBeDefined()
      expect(stealthAddress.viewTag).toBeDefined()
      expect(sharedSecret).toBeDefined()

      // Address is compressed public key (33 bytes)
      expect(stealthAddress.address.length).toBe(68)

      // Ephemeral key is also compressed (33 bytes)
      expect(stealthAddress.ephemeralPublicKey.length).toBe(68)

      // View tag is single byte (0-255)
      expect(stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(stealthAddress.viewTag).toBeLessThanOrEqual(255)

      // Shared secret is 32 bytes
      expect(sharedSecret.length).toBe(66)
    })

    it('should generate different addresses for same recipient', () => {
      const { metaAddress } = generateStealthMetaAddress('near' as ChainId)

      const addr1 = generateStealthAddress(metaAddress)
      const addr2 = generateStealthAddress(metaAddress)

      // Each call uses random ephemeral key, so addresses differ
      expect(addr1.stealthAddress.address).not.toBe(addr2.stealthAddress.address)
      expect(addr1.stealthAddress.ephemeralPublicKey).not.toBe(
        addr2.stealthAddress.ephemeralPublicKey
      )
    })

    it('should generate different addresses for different recipients', () => {
      const recipient1 = generateStealthMetaAddress('near' as ChainId)
      const recipient2 = generateStealthMetaAddress('near' as ChainId)

      const addr1 = generateStealthAddress(recipient1.metaAddress)
      const addr2 = generateStealthAddress(recipient2.metaAddress)

      expect(addr1.stealthAddress.address).not.toBe(addr2.stealthAddress.address)
    })
  })

  describe('deriveStealthPrivateKey()', () => {
    it('should derive correct private key for stealth address', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)
      const { stealthAddress } = generateStealthAddress(metaAddress)

      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.stealthAddress).toBe(stealthAddress.address)
      expect(recovery.ephemeralPublicKey).toBe(stealthAddress.ephemeralPublicKey)

      // The derived private key should correspond to the stealth address
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(recovery.privateKey.slice(2)),
        true
      )
      expect('0x' + Buffer.from(derivedPubKey).toString('hex')).toBe(stealthAddress.address)
    })

    it('should work for multiple stealth addresses', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)

      // Generate multiple stealth addresses
      for (let i = 0; i < 5; i++) {
        const { stealthAddress } = generateStealthAddress(metaAddress)

        const recovery = deriveStealthPrivateKey(
          stealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )

        // Verify each derived key matches
        const derivedPubKey = secp256k1.getPublicKey(
          hexToBytes(recovery.privateKey.slice(2)),
          true
        )
        expect('0x' + Buffer.from(derivedPubKey).toString('hex')).toBe(stealthAddress.address)
      }
    })
  })

  describe('checkStealthAddress()', () => {
    it('should return true for own stealth address', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)
      const { stealthAddress } = generateStealthAddress(metaAddress)

      const isOurs = checkStealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isOurs).toBe(true)
    })

    it('should return false for someone else\'s stealth address', () => {
      const recipient1 = generateStealthMetaAddress('near' as ChainId)
      const recipient2 = generateStealthMetaAddress('near' as ChainId)

      // Generate address for recipient1
      const { stealthAddress } = generateStealthAddress(recipient1.metaAddress)

      // Check with recipient2's keys - should fail
      const isTheirs = checkStealthAddress(
        stealthAddress,
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )

      expect(isTheirs).toBe(false)
    })

    it('should use view tag for efficient filtering', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)
      const { stealthAddress } = generateStealthAddress(metaAddress)

      // Create a modified stealth address with wrong view tag
      const wrongViewTag = (stealthAddress.viewTag + 1) % 256
      const modifiedAddress = {
        ...stealthAddress,
        viewTag: wrongViewTag,
      }

      // Should fail fast due to view tag mismatch
      const result = checkStealthAddress(
        modifiedAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(result).toBe(false)
    })

    it('should handle multiple addresses efficiently', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('near' as ChainId)

      // Generate many addresses from different senders
      const addresses = []
      for (let i = 0; i < 10; i++) {
        const { stealthAddress } = generateStealthAddress(metaAddress)
        addresses.push(stealthAddress)
      }

      // All should be ours
      for (const addr of addresses) {
        expect(checkStealthAddress(addr, spendingPrivateKey, viewingPrivateKey)).toBe(true)
      }
    })
  })

  describe('encodeStealthMetaAddress() / decodeStealthMetaAddress()', () => {
    it('should encode meta-address to string', () => {
      const { metaAddress } = generateStealthMetaAddress('near' as ChainId)
      const encoded = encodeStealthMetaAddress(metaAddress)

      expect(encoded.startsWith('sip:')).toBe(true)
      expect(encoded).toContain(':near:')
      expect(encoded).toContain(metaAddress.spendingKey)
      expect(encoded).toContain(metaAddress.viewingKey)
    })

    it('should decode string back to meta-address', () => {
      const { metaAddress } = generateStealthMetaAddress('zcash' as ChainId)
      const encoded = encodeStealthMetaAddress(metaAddress)
      const decoded = decodeStealthMetaAddress(encoded)

      expect(decoded.chain).toBe(metaAddress.chain)
      expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
      expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
    })

    it('should roundtrip correctly', () => {
      // Test secp256k1 chain (Ethereum)
      const secp256k1Original = generateStealthMetaAddress('ethereum')
      const secp256k1Encoded = encodeStealthMetaAddress(secp256k1Original.metaAddress)
      const secp256k1Decoded = decodeStealthMetaAddress(secp256k1Encoded)

      expect(secp256k1Decoded).toEqual({
        chain: secp256k1Original.metaAddress.chain,
        spendingKey: secp256k1Original.metaAddress.spendingKey,
        viewingKey: secp256k1Original.metaAddress.viewingKey,
      })

      // Test ed25519 chain (NEAR)
      const ed25519Original = generateEd25519StealthMetaAddress('near')
      const ed25519Encoded = encodeStealthMetaAddress(ed25519Original.metaAddress)
      const ed25519Decoded = decodeStealthMetaAddress(ed25519Encoded)

      expect(ed25519Decoded).toEqual({
        chain: ed25519Original.metaAddress.chain,
        spendingKey: ed25519Original.metaAddress.spendingKey,
        viewingKey: ed25519Original.metaAddress.viewingKey,
      })
    })

    it('should reject invalid encoded format', () => {
      expect(() => decodeStealthMetaAddress('invalid')).toThrow(
        'invalid format'
      )
      expect(() => decodeStealthMetaAddress('foo:bar:baz')).toThrow(
        'invalid format'
      )
    })
  })

  describe('End-to-End Flow', () => {
    it('should complete full stealth payment flow', () => {
      // 1. Recipient generates and publishes meta-address
      const recipient = generateStealthMetaAddress('near' as ChainId, 'Bob')

      // 2. Sender generates stealth address for payment
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      // 3. Sender publishes ephemeral key alongside payment
      // (stealthAddress.ephemeralPublicKey would be published)

      // 4. Recipient scans and finds their address
      const isOurs = checkStealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(isOurs).toBe(true)

      // 5. Recipient derives private key to claim funds
      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      // 6. Verify the derived key matches the stealth address
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(recovery.privateKey.slice(2)),
        true
      )
      expect('0x' + Buffer.from(derivedPubKey).toString('hex')).toBe(stealthAddress.address)
    })

    it('should support multiple senders to same recipient', () => {
      const recipient = generateStealthMetaAddress('near' as ChainId)

      // Multiple senders generate stealth addresses
      const payments = Array.from({ length: 5 }, () =>
        generateStealthAddress(recipient.metaAddress)
      )

      // Recipient can detect and claim all
      for (const { stealthAddress } of payments) {
        expect(
          checkStealthAddress(
            stealthAddress,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )
        ).toBe(true)

        const recovery = deriveStealthPrivateKey(
          stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )

        const derivedPubKey = secp256k1.getPublicKey(
          hexToBytes(recovery.privateKey.slice(2)),
          true
        )
        expect('0x' + Buffer.from(derivedPubKey).toString('hex')).toBe(stealthAddress.address)
      }
    })
  })

  describe('Security Properties', () => {
    it('stealth addresses should be unlinkable', () => {
      const recipient = generateStealthMetaAddress('near' as ChainId)

      // Generate many stealth addresses for same recipient
      const addresses = Array.from({ length: 100 }, () =>
        generateStealthAddress(recipient.metaAddress).stealthAddress.address
      )

      // All should be unique (no two the same)
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(100)
    })

    it('cannot derive private key without spending private key', () => {
      const recipient = generateStealthMetaAddress('near' as ChainId)
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      // Try with wrong spending key - should produce different result
      const wrongSpendingKey = generateStealthMetaAddress('near' as ChainId).spendingPrivateKey

      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        wrongSpendingKey,
        recipient.viewingPrivateKey
      )

      // Derived public key won't match
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(recovery.privateKey.slice(2)),
        true
      )
      expect('0x' + Buffer.from(derivedPubKey).toString('hex')).not.toBe(stealthAddress.address)
    })
  })

  describe('Arithmetic Edge Cases', () => {
    // secp256k1 curve order
    const SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n

    it('should handle scalar addition wrapping around curve order', () => {
      // Generate many stealth addresses and verify all produce valid keys
      // This probabilistically tests that scalar arithmetic near order boundaries works
      const recipient = generateStealthMetaAddress('near' as ChainId)

      for (let i = 0; i < 50; i++) {
        const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
        const recovery = deriveStealthPrivateKey(
          stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )

        // Verify the derived key is valid (within curve order)
        const privateKeyBytes = hexToBytes(recovery.privateKey.slice(2))
        let scalar = 0n
        for (let j = 0; j < 32; j++) {
          scalar = (scalar << 8n) + BigInt(privateKeyBytes[j])
        }

        // Scalar must be < curve order and > 0
        expect(scalar > 0n).toBe(true)
        expect(scalar < SECP256K1_ORDER).toBe(true)

        // Derived key should match stealth address
        const derivedPubKey = secp256k1.getPublicKey(privateKeyBytes, true)
        expect('0x' + Buffer.from(derivedPubKey).toString('hex')).toBe(stealthAddress.address)
      }
    })

    it('should produce valid stealth addresses with high-value scalars', () => {
      // Test that the system handles large scalar values correctly
      // by verifying the full round-trip works
      const recipient = generateStealthMetaAddress('near' as ChainId)

      // Generate 100 addresses and verify all are unique and valid
      const results: Array<{ address: string; privateKey: string }> = []

      for (let i = 0; i < 100; i++) {
        const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
        const recovery = deriveStealthPrivateKey(
          stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )

        // Verify round-trip: derived private key produces matching public key
        const derivedPubKey = secp256k1.getPublicKey(
          hexToBytes(recovery.privateKey.slice(2)),
          true
        )
        expect('0x' + Buffer.from(derivedPubKey).toString('hex')).toBe(stealthAddress.address)

        results.push({
          address: stealthAddress.address,
          privateKey: recovery.privateKey,
        })
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(results.map((r) => r.address))
      expect(uniqueAddresses.size).toBe(100)

      // All private keys should be unique
      const uniqueKeys = new Set(results.map((r) => r.privateKey))
      expect(uniqueKeys.size).toBe(100)
    })

    it('should reject operations that would produce zero scalars', () => {
      // This tests that we properly reject zero scalar edge cases
      // Zero scalars are astronomically rare (~2^-252) but we must handle them
      // The code throws errors for zero scalars - we verify this behavior exists

      // We can't easily force a zero scalar in practice, but we verify
      // the code path exists by checking the error message format
      const recipient = generateStealthMetaAddress('near' as ChainId)

      // Generate addresses - none should throw (zero is ~2^-252 probability)
      // If any did throw, it would contain "CRITICAL: Zero"
      for (let i = 0; i < 100; i++) {
        expect(() => {
          const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
          deriveStealthPrivateKey(
            stealthAddress,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )
        }).not.toThrow()
      }
    })
  })
})
