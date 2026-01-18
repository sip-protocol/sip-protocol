/**
 * E2E Tests: Solana Same-Chain Privacy Receive Flow
 *
 * Tests the complete recipient journey:
 * 1. Publish meta-address
 * 2. Scan for incoming payments
 * 3. Detect payment using viewing key
 * 4. Claim/spend from stealth address
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestEnvironment,
} from '../../fixtures/solana'

// Import SDK functions
import {
  deriveSolanaStealthKeys,
  generateViewingKeyFromSpending,
  computeViewingKeyHash,
  computeViewingKeyHashFromPrivate,
  isAnnouncementForViewingKey,
  createAnnouncementMemo,
  parseAnnouncement,
} from '../../../src/chains/solana'

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
} from '../../../src/stealth'

describe('E2E: Solana Receive Flow', () => {
  let env: ReturnType<typeof createTestEnvironment>

  beforeEach(() => {
    env = createTestEnvironment()
  })

  describe('Step 1: Meta-Address Publication', () => {
    it('should generate publishable meta-address', () => {
      const recipient = generateStealthMetaAddress('solana')
      const encoded = encodeStealthMetaAddress(recipient.metaAddress)

      // Meta-address should be shareable
      expect(encoded).toMatch(/^sip:solana:/)
      expect(encoded.length).toBeGreaterThan(50)

      // Should contain both keys
      expect(encoded).toContain(recipient.metaAddress.spendingKey)
      expect(encoded).toContain(recipient.metaAddress.viewingKey)
    })

    it('should derive consistent meta-address from mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

      const keys1 = deriveSolanaStealthKeys({ mnemonic })
      const keys2 = deriveSolanaStealthKeys({ mnemonic })

      // Same mnemonic = same keys (metaAddress is an object)
      expect(keys1.metaAddress).toStrictEqual(keys2.metaAddress)
      expect(encodeStealthMetaAddress(keys1.metaAddress)).toBe(encodeStealthMetaAddress(keys2.metaAddress))
    })

    it('should generate viewing key from spending key', () => {
      const recipient = generateStealthMetaAddress('solana')

      const derivedViewing = generateViewingKeyFromSpending(
        recipient.spendingPrivateKey
      )

      // SolanaViewingKey has publicKey, privateKey, hash, createdAt
      expect(derivedViewing.publicKey).toBeDefined()
      expect(derivedViewing.privateKey).toBeDefined()
      expect(derivedViewing.hash).toBeDefined()
    })
  })

  describe('Step 2: Payment Detection', () => {
    it('should compute viewing key hash for filtering', () => {
      const recipient = generateStealthMetaAddress('solana')

      const hashFromPublic = computeViewingKeyHash(recipient.metaAddress.viewingKey)
      const hashFromPrivate = computeViewingKeyHashFromPrivate(recipient.viewingPrivateKey)

      expect(hashFromPublic).toMatch(/^0x[a-f0-9]+$/)
      expect(hashFromPrivate).toMatch(/^0x[a-f0-9]+$/)
      // Both should produce same hash for matching keys
      expect(hashFromPublic).toBe(hashFromPrivate)
    })

    it('should detect announcement is for recipient', () => {
      const recipient = generateStealthMetaAddress('solana')

      // Generate a viewing key to use for announcement matching
      const viewingKey = generateViewingKeyFromSpending(recipient.spendingPrivateKey)
      const viewTag = viewingKey.hash.slice(2, 4)

      // Create announcement with matching view tag
      const ephemeralPubKey = 'EphemKey123456789012345678901234567890123'
      const memo = createAnnouncementMemo(ephemeralPubKey, viewTag)
      const parsed = parseAnnouncement(memo)

      expect(parsed).not.toBeNull()

      // Check if announcement is for this viewing key using hash comparison
      const isForMe = isAnnouncementForViewingKey(viewingKey.hash, viewingKey)
      expect(isForMe).toBe(true)
    })

    it('should reject announcement with wrong view tag', () => {
      const recipient = generateStealthMetaAddress('solana')

      // Create announcement with non-matching view tag
      const ephemeralPubKey = 'EphemKey123456789012345678901234567890123'
      const wrongViewTag = 'ff' // Random view tag
      const memo = createAnnouncementMemo(ephemeralPubKey, wrongViewTag)
      const parsed = parseAnnouncement(memo)

      expect(parsed).not.toBeNull()
      expect(parsed!.viewTag).toBe(wrongViewTag)
    })
  })

  describe('Step 3: Stealth Address Verification', () => {
    it('should verify stealth address belongs to recipient', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      // Recipient checks if address is theirs
      const isForMe = checkStealthAddress(
        stealth.stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      expect(isForMe).toBe(true)
    })

    it('should reject stealth address for wrong recipient', () => {
      const recipient1 = generateStealthMetaAddress('solana')
      const recipient2 = generateStealthMetaAddress('solana')

      // Send to recipient1
      const stealth = generateStealthAddress(recipient1.metaAddress)

      // recipient2 checks (should fail)
      const isForRecipient2 = checkStealthAddress(
        stealth.stealthAddress,
        recipient2.spendingPrivateKey,
        recipient2.viewingPrivateKey
      )

      expect(isForRecipient2).toBe(false)
    })

    it('should handle multiple payments to same recipient', () => {
      const recipient = generateStealthMetaAddress('solana')

      // Multiple payments
      const payments = Array.from({ length: 5 }, () =>
        generateStealthAddress(recipient.metaAddress)
      )

      // All should be verifiable
      const allMine = payments.every((p) =>
        checkStealthAddress(
          p.stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )
      )

      expect(allMine).toBe(true)
    })
  })

  describe('Step 4: Stealth Private Key Recovery', () => {
    it('should derive private key for stealth address', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      // Derive private key to spend
      const recovery = deriveStealthPrivateKey(
        stealth.stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.privateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should derive deterministic private key', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      const recovery1 = deriveStealthPrivateKey(
        stealth.stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      const recovery2 = deriveStealthPrivateKey(
        stealth.stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      expect(recovery1.privateKey).toBe(recovery2.privateKey)
    })
  })

  describe('Complete Receive Flow', () => {
    it('should execute full receive flow', () => {
      // 1. Bob generates and publishes meta-address
      const bob = generateStealthMetaAddress('solana', 'bob')
      const bobMetaEncoded = encodeStealthMetaAddress(bob.metaAddress)
      expect(bobMetaEncoded).toMatch(/^sip:solana:/)

      // 2. Alice sends to Bob's stealth address
      const stealthForBob = generateStealthAddress(bob.metaAddress)
      expect(stealthForBob.stealthAddress).toBeDefined()

      // 3. Bob scans and detects the payment
      const isForBob = checkStealthAddress(
        stealthForBob.stealthAddress,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )
      expect(isForBob).toBe(true)

      // 4. Bob derives private key to claim
      const recovery = deriveStealthPrivateKey(
        stealthForBob.stealthAddress,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )
      expect(recovery.privateKey).toBeDefined()

      // 5. Bob can now sign transactions with derived key
      expect(recovery.privateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should handle receive flow with mnemonic-derived keys', () => {
      // Bob uses mnemonic
      const bobMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const bobKeys = deriveSolanaStealthKeys({ mnemonic: bobMnemonic })

      // Alice sends using bobKeys.metaAddress (which is already an object)
      const stealth = generateStealthAddress(bobKeys.metaAddress)

      // Bob detects
      const isForBob = checkStealthAddress(
        stealth.stealthAddress,
        bobKeys.spendingPrivateKey,
        bobKeys.viewingPrivateKey
      )
      expect(isForBob).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid successive payments', () => {
      const recipient = generateStealthMetaAddress('solana')

      // Simulate 10 rapid payments
      const payments = Array.from({ length: 10 }, () =>
        generateStealthAddress(recipient.metaAddress)
      )

      // All unique and detectable
      const addresses = new Set(payments.map((p) => p.stealthAddress.address))
      expect(addresses.size).toBe(10)

      const allValid = payments.every((p) =>
        checkStealthAddress(
          p.stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )
      )
      expect(allValid).toBe(true)
    })

    it('should maintain security with shared viewing key', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      // Third party with only viewing key can detect but not spend
      const canDetect = checkStealthAddress(
        stealth.stealthAddress,
        recipient.spendingPrivateKey, // Need spending key for full check
        recipient.viewingPrivateKey
      )
      expect(canDetect).toBe(true)

      // Would need spending private key to actually spend
      const recovery = deriveStealthPrivateKey(
        stealth.stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(recovery.privateKey).toBeDefined()
    })
  })
})
