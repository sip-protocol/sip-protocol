/**
 * Solana Payment Scanning Tests
 *
 * Tests for stealth payment scanning and claiming on Solana.
 */

import { describe, it, expect } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  checkEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
} from '../../../src/stealth'
import type { ChainId } from '@sip-protocol/types'

// Helper to convert bytes to bigint (little-endian, for ed25519 scalars)
function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

// Helper to get public key from scalar (not seed) - for verifying derived stealth keys
function scalarToPublicKey(scalarHex: string): Uint8Array {
  const scalarBytes = hexToBytes(scalarHex.slice(2))
  const scalar = bytesToBigIntLE(scalarBytes)
  // ed25519 curve order
  const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n
  // Ensure valid scalar for multiplication
  let validScalar = scalar % ED25519_ORDER
  if (validScalar === 0n) validScalar = 1n
  return ed25519.ExtendedPoint.BASE.multiply(validScalar).toRawBytes()
}

describe('Solana Payment Scanning', () => {
  describe('checkEd25519StealthAddress', () => {
    it('should correctly identify own stealth addresses', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate a stealth address (simulating sender)
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Check if this is our address (simulating recipient scan)
      // Function signature: checkEd25519StealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isOurs).toBe(true)
    })

    it('should reject addresses from different meta-address', () => {
      const recipient1 = generateEd25519StealthMetaAddress('solana' as ChainId)
      const recipient2 = generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate stealth address for recipient 1
      const { stealthAddress } = generateEd25519StealthAddress(recipient1.metaAddress)

      // Try to check with recipient 2's keys - should fail
      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )

      expect(isOurs).toBe(false)
    })

    it('should use view tag for efficient filtering', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate stealth address
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Check that view tag is used (0-255)
      expect(stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(stealthAddress.viewTag).toBeLessThanOrEqual(255)
    })
  })

  describe('deriveEd25519StealthPrivateKey', () => {
    it('should derive correct private key for claiming', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate stealth address
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Derive private key
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.stealthAddress).toBe(stealthAddress.address)
      expect(recovery.ephemeralPublicKey).toBe(stealthAddress.ephemeralPublicKey)
    })

    it('should derive private key that matches stealth public key', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate stealth address
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Derive private key
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Verify the derived private key (scalar) produces the correct public key
      // Note: SIP derives a scalar, not a seed - we use scalar multiplication
      const derivedPubKeyBytes = scalarToPublicKey(recovery.privateKey)
      const derivedPubKeyHex = '0x' + bytesToHex(derivedPubKeyBytes)

      expect(derivedPubKeyHex).toBe(stealthAddress.address)
    })
  })

  describe('Solana Address Conversion', () => {
    it('should convert ed25519 public key to Solana address and back', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Convert to Solana address (base58)
      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      expect(solanaAddress).toBeDefined()

      // Convert back to ed25519 public key (hex)
      const backToHex = solanaAddressToEd25519PublicKey(solanaAddress)
      expect(backToHex).toBe(stealthAddress.address)
    })

    it('should handle ephemeral public key conversion', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Convert ephemeral key to base58
      const ephemeralBase58 = ed25519PublicKeyToSolanaAddress(
        stealthAddress.ephemeralPublicKey
      )
      expect(ephemeralBase58).toBeDefined()

      // Convert back
      const backToHex = solanaAddressToEd25519PublicKey(ephemeralBase58)
      expect(backToHex).toBe(stealthAddress.ephemeralPublicKey)
    })
  })

  describe('Keypair Construction Validation', () => {
    it('should validate that derived key produces expected public key', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana' as ChainId)

      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Derive private key
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      // This simulates the validation in scan.ts - using scalar multiplication
      // SIP derives a scalar, not a seed, so we use scalarToPublicKey
      const derivedPubKeyBytes = scalarToPublicKey(recovery.privateKey)
      const expectedPubKeyBytes = hexToBytes(stealthAddress.address.slice(2))

      // Verify bytes match
      expect(derivedPubKeyBytes.length).toBe(expectedPubKeyBytes.length)
      expect(derivedPubKeyBytes.every((b, i) => b === expectedPubKeyBytes[i])).toBe(true)
    })

    it('should fail validation with wrong keys', () => {
      const recipient1 = generateEd25519StealthMetaAddress('solana' as ChainId)
      const recipient2 = generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate stealth address for recipient 1
      const { stealthAddress } = generateEd25519StealthAddress(recipient1.metaAddress)

      // Try to derive with wrong keys - this should produce wrong result
      const wrongRecovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        recipient2.spendingPrivateKey, // Wrong!
        recipient2.viewingPrivateKey   // Wrong!
      )

      // The derived public key won't match - using scalar multiplication
      const derivedPubKeyBytes = scalarToPublicKey(wrongRecovery.privateKey)
      const expectedPubKeyBytes = hexToBytes(stealthAddress.address.slice(2))

      // Should NOT match
      const matches = derivedPubKeyBytes.every((b, i) => b === expectedPubKeyBytes[i])
      expect(matches).toBe(false)
    })
  })

  describe('Announcement Parsing', () => {
    it('should parse valid SIP announcement format', () => {
      const memo = 'SIP:1:BpxDqRZ3tLhY6bxmZgSYfTNqQeK5HmXa9jF3MnYz7WsK:a5:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'

      // Simulate parseAnnouncement logic
      const SIP_PREFIX = 'SIP:1:'
      if (memo.startsWith(SIP_PREFIX)) {
        const data = memo.slice(SIP_PREFIX.length)
        const parts = data.split(':')

        expect(parts.length).toBe(3)
        expect(parts[0]).toBe('BpxDqRZ3tLhY6bxmZgSYfTNqQeK5HmXa9jF3MnYz7WsK') // ephemeral
        expect(parts[1]).toBe('a5') // view tag
        expect(parts[2]).toBe('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH') // stealth
      }
    })

    it('should reject invalid announcement format', () => {
      const invalidMemos = [
        'INVALID:1:abc:def',
        'SIP:2:abc:def', // Wrong version
        'SIP:1:abc', // Missing parts
        '', // Empty
        'random garbage',
      ]

      invalidMemos.forEach(memo => {
        const isValid = memo.startsWith('SIP:1:') && memo.split(':').length >= 4
        expect(isValid).toBe(false)
      })
    })
  })
})
