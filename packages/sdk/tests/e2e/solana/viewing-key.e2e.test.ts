/**
 * E2E Tests: Solana Viewing Key Flow
 *
 * Tests viewing key functionality for compliance:
 * 1. Derive viewing keys
 * 2. Export/import viewing keys
 * 3. Selective disclosure to auditors
 * 4. Encrypt/decrypt with viewing keys
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestEnvironment,
  aliceKeypair,
  bobKeypair,
  charlieKeypair,
} from '../../fixtures/solana'

// Import SDK functions
import {
  generateViewingKeyFromSpending,
  generateRandomViewingKey,
  computeViewingKeyHash,
  exportViewingKey,
  importViewingKey,
  encryptForViewing,
  decryptWithViewing,
  deriveChildViewingKey,
  getViewingPublicKey,
} from '../../../src/chains/solana'

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
} from '../../../src/stealth'

describe('E2E: Solana Viewing Key Flow', () => {
  let env: ReturnType<typeof createTestEnvironment>

  beforeEach(() => {
    env = createTestEnvironment()
  })

  describe('Viewing Key Generation', () => {
    it('should generate viewing key from spending key', () => {
      const recipient = generateStealthMetaAddress('solana')

      const viewingKey = generateViewingKeyFromSpending(
        recipient.spendingPrivateKey
      )

      expect(viewingKey).toBeDefined()
      expect(typeof viewingKey).toBe('object')
    })

    it('should generate random viewing key', () => {
      const viewingKey1 = generateRandomViewingKey()
      const viewingKey2 = generateRandomViewingKey()

      expect(viewingKey1).toBeDefined()
      expect(viewingKey2).toBeDefined()
      expect(viewingKey1).not.toEqual(viewingKey2)
    })

    it('should derive consistent viewing key hash', () => {
      const recipient = generateStealthMetaAddress('solana')

      const hash1 = computeViewingKeyHash(recipient.metaAddress.viewingKey)
      const hash2 = computeViewingKeyHash(recipient.metaAddress.viewingKey)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^0x[a-f0-9]+$/)
    })

    it('should get public key from viewing key', () => {
      const viewingKey = generateRandomViewingKey()
      const publicKey = getViewingPublicKey(viewingKey)

      expect(publicKey).toBeDefined()
      expect(publicKey).toMatch(/^0x[a-f0-9]+$/)
    })
  })

  describe('Viewing Key Export/Import', () => {
    it('should export viewing key securely', () => {
      const viewingKey = generateRandomViewingKey()
      const password = 'secure-password-123'

      const exported = exportViewingKey(viewingKey, password)

      expect(exported).toBeDefined()
      expect(typeof exported).toBe('object')
      expect(exported.encrypted).toBeDefined()
    })

    it('should import viewing key with correct password', () => {
      const original = generateRandomViewingKey()
      const password = 'secure-password-123'

      const exported = exportViewingKey(original, password)
      const imported = importViewingKey(exported, password)

      expect(imported).toBeDefined()
      // Imported key should match original
      const originalPub = getViewingPublicKey(original)
      const importedPub = getViewingPublicKey(imported)
      expect(importedPub).toBe(originalPub)
    })

    it('should fail import with wrong password', () => {
      const viewingKey = generateRandomViewingKey()
      const exported = exportViewingKey(viewingKey, 'correct-password')

      expect(() => {
        importViewingKey(exported, 'wrong-password')
      }).toThrow()
    })

    it('should support key derivation paths', () => {
      const parentKey = generateRandomViewingKey()

      const child1 = deriveChildViewingKey(parentKey, 0)
      const child2 = deriveChildViewingKey(parentKey, 1)
      const child1Again = deriveChildViewingKey(parentKey, 0)

      // Same index = same child
      expect(getViewingPublicKey(child1)).toBe(getViewingPublicKey(child1Again))

      // Different index = different child
      expect(getViewingPublicKey(child1)).not.toBe(getViewingPublicKey(child2))
    })
  })

  describe('Encryption/Decryption', () => {
    it('should encrypt data for viewing key', () => {
      const viewingKey = generateRandomViewingKey()
      const data = 'secret payment metadata'

      const encrypted = encryptForViewing(
        new TextEncoder().encode(data),
        viewingKey
      )

      expect(encrypted).toBeDefined()
      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.nonce).toBeDefined()
    })

    it('should decrypt with correct viewing key', () => {
      const viewingKey = generateRandomViewingKey()
      const originalData = 'payment details: 100 USDC'

      const encrypted = encryptForViewing(
        new TextEncoder().encode(originalData),
        viewingKey
      )

      const decrypted = decryptWithViewing(encrypted, viewingKey)
      const decryptedStr = new TextDecoder().decode(decrypted)

      expect(decryptedStr).toBe(originalData)
    })

    it('should fail decrypt with wrong viewing key', () => {
      const viewingKey1 = generateRandomViewingKey()
      const viewingKey2 = generateRandomViewingKey()
      const data = 'sensitive information'

      const encrypted = encryptForViewing(
        new TextEncoder().encode(data),
        viewingKey1
      )

      expect(() => {
        decryptWithViewing(encrypted, viewingKey2)
      }).toThrow()
    })
  })

  describe('Auditor Access Flow', () => {
    it('should allow auditor to detect payments', () => {
      // Bob generates stealth meta-address
      const bob = generateStealthMetaAddress('solana')

      // Alice sends to Bob's stealth address
      const stealth = generateStealthAddress(bob.metaAddress)

      // Bob shares viewing key with Auditor
      // Auditor can verify the payment was to Bob
      const isForBob = checkStealthAddress(
        stealth.stealthAddress,
        bob.spendingPrivateKey, // Auditor would need this for full verification
        bob.viewingPrivateKey
      )

      expect(isForBob).toBe(true)
    })

    it('should encrypt payment metadata for auditor', () => {
      const bob = generateStealthMetaAddress('solana')
      const auditorViewingKey = generateRandomViewingKey()

      // Payment metadata
      const metadata = JSON.stringify({
        sender: 'alice@company.com',
        amount: '1000 USDC',
        purpose: 'Invoice #12345',
        timestamp: Date.now(),
      })

      // Encrypt for auditor
      const encrypted = encryptForViewing(
        new TextEncoder().encode(metadata),
        auditorViewingKey
      )

      // Auditor decrypts
      const decrypted = decryptWithViewing(encrypted, auditorViewingKey)
      const parsed = JSON.parse(new TextDecoder().decode(decrypted))

      expect(parsed.sender).toBe('alice@company.com')
      expect(parsed.amount).toBe('1000 USDC')
      expect(parsed.purpose).toBe('Invoice #12345')
    })

    it('should support multiple auditors with different keys', () => {
      const auditor1Key = generateRandomViewingKey()
      const auditor2Key = generateRandomViewingKey()
      const data = 'compliance data'

      // Encrypt for each auditor separately
      const encryptedForAuditor1 = encryptForViewing(
        new TextEncoder().encode(data),
        auditor1Key
      )
      const encryptedForAuditor2 = encryptForViewing(
        new TextEncoder().encode(data),
        auditor2Key
      )

      // Each can decrypt their own
      const dec1 = new TextDecoder().decode(
        decryptWithViewing(encryptedForAuditor1, auditor1Key)
      )
      const dec2 = new TextDecoder().decode(
        decryptWithViewing(encryptedForAuditor2, auditor2Key)
      )

      expect(dec1).toBe(data)
      expect(dec2).toBe(data)

      // Cross-decryption fails
      expect(() => decryptWithViewing(encryptedForAuditor1, auditor2Key)).toThrow()
    })
  })

  describe('Privacy Levels', () => {
    it('should support transparent mode (no encryption)', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      // Transparent = address is public, anyone can verify
      expect(stealth.stealthAddress.address).toBeDefined()
    })

    it('should support shielded mode (full privacy)', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      // Only recipient with both keys can verify
      const isForRecipient = checkStealthAddress(
        stealth.stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(isForRecipient).toBe(true)

      // Third party cannot verify (would need spending key)
      const thirdParty = generateStealthMetaAddress('solana')
      const isForThirdParty = checkStealthAddress(
        stealth.stealthAddress,
        thirdParty.spendingPrivateKey,
        thirdParty.viewingPrivateKey
      )
      expect(isForThirdParty).toBe(false)
    })

    it('should support compliant mode (viewing key disclosure)', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      // Recipient shares viewing key for compliance
      // Auditor can detect payment but not spend
      const viewingKeyHash = computeViewingKeyHash(recipient.metaAddress.viewingKey)

      expect(viewingKeyHash).toBeDefined()
      // Auditor uses viewing key hash to filter announcements
      expect(viewingKeyHash).toMatch(/^0x[a-f0-9]+$/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty data encryption', () => {
      const viewingKey = generateRandomViewingKey()
      const encrypted = encryptForViewing(new Uint8Array(0), viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted).toHaveLength(0)
    })

    it('should handle large data encryption', () => {
      const viewingKey = generateRandomViewingKey()
      const largeData = new Uint8Array(100000).fill(0x42)

      const encrypted = encryptForViewing(largeData, viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted).toEqual(largeData)
    })

    it('should derive many child keys efficiently', () => {
      const parentKey = generateRandomViewingKey()
      const childKeys = []

      for (let i = 0; i < 100; i++) {
        childKeys.push(deriveChildViewingKey(parentKey, i))
      }

      // All unique
      const publicKeys = new Set(childKeys.map(getViewingPublicKey))
      expect(publicKeys.size).toBe(100)
    })
  })
})
