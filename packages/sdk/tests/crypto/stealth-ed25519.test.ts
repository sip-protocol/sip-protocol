/**
 * Ed25519 Stealth Address Tests
 *
 * Comprehensive tests for ed25519 stealth address primitives (Solana, NEAR chains).
 */

import { describe, it, expect } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import {
  isEd25519Chain,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
} from '../../src/stealth'
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

describe('Ed25519 Stealth Addresses', () => {
  describe('isEd25519Chain()', () => {
    it('should return true for solana', () => {
      expect(isEd25519Chain('solana')).toBe(true)
    })

    it('should return true for near', () => {
      expect(isEd25519Chain('near')).toBe(true)
    })

    it('should return false for ethereum', () => {
      expect(isEd25519Chain('ethereum')).toBe(false)
    })

    it('should return false for other EVM chains', () => {
      expect(isEd25519Chain('polygon')).toBe(false)
      expect(isEd25519Chain('arbitrum')).toBe(false)
      expect(isEd25519Chain('optimism')).toBe(false)
      expect(isEd25519Chain('base')).toBe(false)
    })
  })

  describe('generateEd25519StealthMetaAddress()', () => {
    it('should generate valid meta-address for solana', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')

      expect(metaAddress.spendingKey).toBeDefined()
      expect(metaAddress.viewingKey).toBeDefined()
      expect(metaAddress.chain).toBe('solana')

      // Keys should be valid hex
      expect(metaAddress.spendingKey.startsWith('0x')).toBe(true)
      expect(metaAddress.viewingKey.startsWith('0x')).toBe(true)

      // ed25519 public keys are 32 bytes = 64 hex chars
      expect(metaAddress.spendingKey.length).toBe(66) // 0x + 64
      expect(metaAddress.viewingKey.length).toBe(66)

      // Private keys are 32 bytes = 64 hex chars
      expect(spendingPrivateKey.length).toBe(66) // 0x + 64
      expect(viewingPrivateKey.length).toBe(66)
    })

    it('should generate valid meta-address for near', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('near')

      expect(metaAddress.chain).toBe('near')
      expect(metaAddress.spendingKey.length).toBe(66)
      expect(metaAddress.viewingKey.length).toBe(66)
      expect(spendingPrivateKey.length).toBe(66)
      expect(viewingPrivateKey.length).toBe(66)
    })

    it('should generate different keys each time', () => {
      const gen1 = generateEd25519StealthMetaAddress('solana')
      const gen2 = generateEd25519StealthMetaAddress('solana')

      expect(gen1.metaAddress.spendingKey).not.toBe(gen2.metaAddress.spendingKey)
      expect(gen1.metaAddress.viewingKey).not.toBe(gen2.metaAddress.viewingKey)
    })

    it('should include optional label', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana', 'My Solana Stealth')

      expect(metaAddress.label).toBe('My Solana Stealth')
      expect(metaAddress.chain).toBe('solana')
    })

    it('should derive valid public keys from private keys', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')

      // Derive public key from private key and compare
      const derivedSpending = ed25519.getPublicKey(
        hexToBytes(spendingPrivateKey.slice(2))
      )
      const derivedViewing = ed25519.getPublicKey(
        hexToBytes(viewingPrivateKey.slice(2))
      )

      expect('0x' + Buffer.from(derivedSpending).toString('hex')).toBe(metaAddress.spendingKey)
      expect('0x' + Buffer.from(derivedViewing).toString('hex')).toBe(metaAddress.viewingKey)
    })

    it('should throw for non-ed25519 chain', () => {
      expect(() => generateEd25519StealthMetaAddress('ethereum')).toThrow(
        'does not use ed25519'
      )
    })
  })

  describe('generateEd25519StealthAddress()', () => {
    it('should generate valid stealth address for recipient', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(metaAddress)

      expect(stealthAddress.address).toBeDefined()
      expect(stealthAddress.ephemeralPublicKey).toBeDefined()
      expect(stealthAddress.viewTag).toBeDefined()
      expect(sharedSecret).toBeDefined()

      // ed25519 address is public key (32 bytes)
      expect(stealthAddress.address.length).toBe(66)

      // Ephemeral key is also 32 bytes
      expect(stealthAddress.ephemeralPublicKey.length).toBe(66)

      // View tag is single byte (0-255)
      expect(stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(stealthAddress.viewTag).toBeLessThanOrEqual(255)

      // Shared secret is 32 bytes
      expect(sharedSecret.length).toBe(66)
    })

    it('should generate different addresses for same recipient', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      const addr1 = generateEd25519StealthAddress(metaAddress)
      const addr2 = generateEd25519StealthAddress(metaAddress)

      // Each call uses random ephemeral key, so addresses differ
      expect(addr1.stealthAddress.address).not.toBe(addr2.stealthAddress.address)
      expect(addr1.stealthAddress.ephemeralPublicKey).not.toBe(
        addr2.stealthAddress.ephemeralPublicKey
      )
    })

    it('should generate different addresses for different recipients', () => {
      const recipient1 = generateEd25519StealthMetaAddress('solana')
      const recipient2 = generateEd25519StealthMetaAddress('solana')

      const addr1 = generateEd25519StealthAddress(recipient1.metaAddress)
      const addr2 = generateEd25519StealthAddress(recipient2.metaAddress)

      expect(addr1.stealthAddress.address).not.toBe(addr2.stealthAddress.address)
    })

    it('should work with near chain', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      expect(stealthAddress.address.length).toBe(66)
      expect(stealthAddress.ephemeralPublicKey.length).toBe(66)
    })
  })

  describe('deriveEd25519StealthPrivateKey()', () => {
    it('should derive correct private key for stealth address', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.stealthAddress).toBe(stealthAddress.address)
      expect(recovery.ephemeralPublicKey).toBe(stealthAddress.ephemeralPublicKey)

      // The derived private key should correspond to the stealth address
      // Note: We use scalarToPublicKey because the derived key is a scalar, not a seed
      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
    })

    it('should work for multiple stealth addresses', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')

      // Generate multiple stealth addresses
      for (let i = 0; i < 5; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

        const recovery = deriveEd25519StealthPrivateKey(
          stealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )

        // Verify each derived key matches (using scalar multiplication, not getPublicKey)
        const derivedPubKey = scalarToPublicKey(recovery.privateKey)
        expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
      }
    })

    it('should work for near chain', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
    })
  })

  describe('checkEd25519StealthAddress()', () => {
    it('should return true for own stealth address', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isOurs).toBe(true)
    })

    it('should return false for someone else\'s stealth address', () => {
      const recipient1 = generateEd25519StealthMetaAddress('solana')
      const recipient2 = generateEd25519StealthMetaAddress('solana')

      // Generate address for recipient1
      const { stealthAddress } = generateEd25519StealthAddress(recipient1.metaAddress)

      // Check with recipient2's keys - should fail
      const isTheirs = checkEd25519StealthAddress(
        stealthAddress,
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )

      expect(isTheirs).toBe(false)
    })

    it('should use view tag for efficient filtering', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Create a modified stealth address with wrong view tag
      const wrongViewTag = (stealthAddress.viewTag + 1) % 256
      const modifiedAddress = {
        ...stealthAddress,
        viewTag: wrongViewTag,
      }

      // Should fail fast due to view tag mismatch
      const result = checkEd25519StealthAddress(
        modifiedAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(result).toBe(false)
    })

    it('should handle multiple addresses efficiently', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')

      // Generate many addresses from different senders
      const addresses = []
      for (let i = 0; i < 10; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
        addresses.push(stealthAddress)
      }

      // All should be ours
      for (const addr of addresses) {
        expect(checkEd25519StealthAddress(addr, spendingPrivateKey, viewingPrivateKey)).toBe(true)
      }
    })
  })

  describe('End-to-End Flow', () => {
    it('should complete full stealth payment flow for Solana', () => {
      // 1. Recipient generates and publishes meta-address
      const recipient = generateEd25519StealthMetaAddress('solana', 'Bob Solana Wallet')

      // 2. Sender generates stealth address for payment
      const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

      // 3. Sender publishes ephemeral key alongside payment
      // (stealthAddress.ephemeralPublicKey would be published)

      // 4. Recipient scans and finds their address
      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(isOurs).toBe(true)

      // 5. Recipient derives private key to claim funds
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      // 6. Verify the derived key matches the stealth address
      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
    })

    it('should complete full stealth payment flow for NEAR', () => {
      // 1. Recipient generates and publishes meta-address
      const recipient = generateEd25519StealthMetaAddress('near', 'Alice NEAR Wallet')

      // 2. Sender generates stealth address for payment
      const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

      // 3. Recipient scans and finds their address
      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(isOurs).toBe(true)

      // 4. Recipient derives private key to claim funds
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      // 5. Verify the derived key matches the stealth address
      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
    })

    it('should support multiple senders to same recipient', () => {
      const recipient = generateEd25519StealthMetaAddress('solana')

      // Multiple senders generate stealth addresses
      const payments = Array.from({ length: 5 }, () =>
        generateEd25519StealthAddress(recipient.metaAddress)
      )

      // Recipient can detect and claim all
      for (const { stealthAddress } of payments) {
        expect(
          checkEd25519StealthAddress(
            stealthAddress,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )
        ).toBe(true)

        const recovery = deriveEd25519StealthPrivateKey(
          stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )

        const derivedPubKey = scalarToPublicKey(recovery.privateKey)
        expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
      }
    })
  })

  describe('Security Properties', () => {
    it('stealth addresses should be unlinkable', () => {
      const recipient = generateEd25519StealthMetaAddress('solana')

      // Generate many stealth addresses for same recipient
      const addresses = Array.from({ length: 100 }, () =>
        generateEd25519StealthAddress(recipient.metaAddress).stealthAddress.address
      )

      // All should be unique (no two the same)
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(100)
    })

    it('cannot derive private key without spending private key', () => {
      const recipient = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

      // Try with wrong spending key - should produce different result
      const wrongSpendingKey = generateEd25519StealthMetaAddress('solana').spendingPrivateKey

      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        wrongSpendingKey,
        recipient.viewingPrivateKey
      )

      // Derived public key won't match
      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).not.toBe(stealthAddress.address)
    })

    it('cannot derive private key without viewing private key', () => {
      const recipient = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

      // Try with wrong viewing key - should produce different result
      const wrongViewingKey = generateEd25519StealthMetaAddress('solana').viewingPrivateKey

      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        wrongViewingKey
      )

      // Derived public key won't match
      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).not.toBe(stealthAddress.address)
    })
  })

  describe('Cross-chain Isolation', () => {
    it('solana and near addresses should be independent', () => {
      // Same label, different chains
      const solanaWallet = generateEd25519StealthMetaAddress('solana', 'My Wallet')
      const nearWallet = generateEd25519StealthMetaAddress('near', 'My Wallet')

      // Keys should be completely different
      expect(solanaWallet.metaAddress.spendingKey).not.toBe(nearWallet.metaAddress.spendingKey)
      expect(solanaWallet.metaAddress.viewingKey).not.toBe(nearWallet.metaAddress.viewingKey)
    })

    it('cannot use solana keys to claim near address', () => {
      const solanaRecipient = generateEd25519StealthMetaAddress('solana')
      const nearRecipient = generateEd25519StealthMetaAddress('near')

      // Generate address for solana recipient
      const { stealthAddress } = generateEd25519StealthAddress(solanaRecipient.metaAddress)

      // Try to check with near keys - should fail
      const canClaim = checkEd25519StealthAddress(
        stealthAddress,
        nearRecipient.spendingPrivateKey,
        nearRecipient.viewingPrivateKey
      )

      expect(canClaim).toBe(false)
    })
  })
})
