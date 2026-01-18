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
import { createTestEnvironment } from '../../fixtures/solana'

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
  type SolanaTransactionData,
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
      expect(viewingKey.privateKey).toBeDefined()
      expect(viewingKey.publicKey).toBeDefined()
      expect(viewingKey.hash).toBeDefined()
    })

    it('should generate random viewing key', () => {
      const viewingKey1 = generateRandomViewingKey()
      const viewingKey2 = generateRandomViewingKey()

      expect(viewingKey1).toBeDefined()
      expect(viewingKey2).toBeDefined()
      // Keys should be different
      expect(viewingKey1.privateKey).not.toBe(viewingKey2.privateKey)
    })

    it('should derive consistent viewing key hash', () => {
      const recipient = generateStealthMetaAddress('solana')

      const hash1 = computeViewingKeyHash(recipient.metaAddress.viewingKey)
      const hash2 = computeViewingKeyHash(recipient.metaAddress.viewingKey)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^0x[a-f0-9]+$/)
    })

    it('should get public key from viewing private key', () => {
      const viewingKey = generateRandomViewingKey()
      const publicKey = getViewingPublicKey(viewingKey.privateKey)

      expect(publicKey).toBeDefined()
      expect(publicKey).toMatch(/^0x[a-f0-9]+$/)
      // Derived public key should match the one in the viewing key
      expect(publicKey).toBe(viewingKey.publicKey)
    })
  })

  describe('Viewing Key Export/Import', () => {
    it('should export viewing key', () => {
      const viewingKey = generateRandomViewingKey()

      // Export takes only the viewingKey (no password in this API)
      const exported = exportViewingKey(viewingKey)

      expect(exported).toBeDefined()
      expect(typeof exported).toBe('object')
      expect(exported.version).toBeDefined()
      expect(exported.privateKey).toBe(viewingKey.privateKey)
      expect(exported.publicKey).toBe(viewingKey.publicKey)
    })

    it('should import viewing key from export', () => {
      const original = generateRandomViewingKey()

      const exported = exportViewingKey(original)
      const imported = importViewingKey(exported)

      expect(imported).toBeDefined()
      // Imported key should match original
      expect(imported.publicKey).toBe(original.publicKey)
      expect(imported.privateKey).toBe(original.privateKey)
      expect(imported.hash).toBe(original.hash)
    })

    it('should fail import with invalid version', () => {
      const viewingKey = generateRandomViewingKey()
      const exported = exportViewingKey(viewingKey)

      // Corrupt the version
      const corrupted = { ...exported, version: 999 }

      expect(() => {
        importViewingKey(corrupted)
      }).toThrow()
    })

    it('should support key derivation paths', () => {
      const parentKey = generateRandomViewingKey()

      const child1 = deriveChildViewingKey(parentKey, 'path/0')
      const child2 = deriveChildViewingKey(parentKey, 'path/1')
      const child1Again = deriveChildViewingKey(parentKey, 'path/0')

      // Same path = same child
      expect(child1.publicKey).toBe(child1Again.publicKey)

      // Different path = different child
      expect(child1.publicKey).not.toBe(child2.publicKey)
    })
  })

  describe('Encryption/Decryption', () => {
    it('should encrypt data for viewing key', () => {
      const viewingKey = generateRandomViewingKey()

      // encryptForViewing expects SolanaTransactionData, not raw bytes
      const data: SolanaTransactionData = {
        sender: 'SenderPubkey111111111111111111111111111111111',
        recipient: 'RecipientPubkey11111111111111111111111111111',
        amount: '1000000',
        mint: 'TokenMint11111111111111111111111111111111111',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(data, viewingKey)

      expect(encrypted).toBeDefined()
      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.nonce).toBeDefined()
      expect(encrypted.viewingKeyHash).toBe(viewingKey.hash)
    })

    it('should decrypt with correct viewing key', () => {
      const viewingKey = generateRandomViewingKey()

      const originalData: SolanaTransactionData = {
        sender: 'SenderPubkey111111111111111111111111111111111',
        recipient: 'RecipientPubkey11111111111111111111111111111',
        amount: '5000000',
        mint: 'USDCMint1111111111111111111111111111111111111',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(originalData, viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted.sender).toBe(originalData.sender)
      expect(decrypted.recipient).toBe(originalData.recipient)
      expect(decrypted.amount).toBe(originalData.amount)
      expect(decrypted.mint).toBe(originalData.mint)
    })

    it('should fail decrypt with wrong viewing key', () => {
      const viewingKey1 = generateRandomViewingKey()
      const viewingKey2 = generateRandomViewingKey()

      const data: SolanaTransactionData = {
        sender: 'SenderPubkey111111111111111111111111111111111',
        recipient: 'RecipientPubkey11111111111111111111111111111',
        amount: '1000000',
        mint: null, // Native SOL
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(data, viewingKey1)

      expect(() => {
        decryptWithViewing(encrypted, viewingKey2)
      }).toThrow()
    })
  })

  describe('Auditor Access Flow', () => {
    it('should allow auditor to verify payments', () => {
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
      const auditorViewingKey = generateRandomViewingKey()

      // Payment metadata as SolanaTransactionData
      const metadata: SolanaTransactionData = {
        sender: 'alice@company.com',
        recipient: 'bob@company.com',
        amount: '1000000000', // 1000 USDC in smallest units
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timestamp: Date.now(),
        memo: 'Invoice #12345',
      }

      // Encrypt for auditor
      const encrypted = encryptForViewing(metadata, auditorViewingKey)

      // Auditor decrypts
      const decrypted = decryptWithViewing(encrypted, auditorViewingKey)

      expect(decrypted.sender).toBe('alice@company.com')
      expect(decrypted.amount).toBe('1000000000')
      expect(decrypted.memo).toBe('Invoice #12345')
    })

    it('should support multiple auditors with different keys', () => {
      const auditor1Key = generateRandomViewingKey()
      const auditor2Key = generateRandomViewingKey()

      const data: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '100',
        mint: null,
        timestamp: Date.now(),
      }

      // Encrypt for each auditor separately
      const encryptedForAuditor1 = encryptForViewing(data, auditor1Key)
      const encryptedForAuditor2 = encryptForViewing(data, auditor2Key)

      // Each can decrypt their own
      const dec1 = decryptWithViewing(encryptedForAuditor1, auditor1Key)
      const dec2 = decryptWithViewing(encryptedForAuditor2, auditor2Key)

      expect(dec1.amount).toBe(data.amount)
      expect(dec2.amount).toBe(data.amount)

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
    it('should handle minimal data encryption', () => {
      const viewingKey = generateRandomViewingKey()

      // Minimal valid transaction data
      const data: SolanaTransactionData = {
        sender: 's',
        recipient: 'r',
        amount: '0',
        mint: null,
        timestamp: 0,
      }

      const encrypted = encryptForViewing(data, viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted.amount).toBe('0')
    })

    it('should handle large data encryption', () => {
      const viewingKey = generateRandomViewingKey()

      // Large memo
      const largeMemo = 'x'.repeat(10000)

      const data: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '1000000000000000000',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        timestamp: Date.now(),
        memo: largeMemo,
      }

      const encrypted = encryptForViewing(data, viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted.memo).toBe(largeMemo)
    })

    it('should derive many child keys efficiently', () => {
      const parentKey = generateRandomViewingKey()
      const childKeys = []

      for (let i = 0; i < 100; i++) {
        childKeys.push(deriveChildViewingKey(parentKey, `child/${i}`))
      }

      // All unique
      const publicKeys = new Set(childKeys.map(k => k.publicKey))
      expect(publicKeys.size).toBe(100)
    })
  })
})
