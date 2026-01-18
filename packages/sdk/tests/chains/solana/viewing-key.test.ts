/**
 * Solana Viewing Key Tests
 *
 * Tests for viewing key generation, export/import, encryption, and storage.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateViewingKeyFromSpending,
  generateRandomViewingKey,
  computeViewingKeyHash,
  computeViewingKeyHashFromPrivate,
  exportViewingKey,
  importViewingKey,
  encryptForViewing,
  decryptWithViewing,
  createMemoryStorage,
  isAnnouncementForViewingKey,
  deriveChildViewingKey,
  getViewingPublicKey,
  type SolanaViewingKey,
  type SolanaTransactionData,
} from '../../../src/chains/solana/viewing-key'
import { deriveSolanaStealthKeys } from '../../../src/chains/solana/key-derivation'
import type { Hash, HexString } from '@sip-protocol/types'

// Test mnemonic (standard BIP39 test vector)
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('Solana Viewing Key', () => {
  // ─── Generation ─────────────────────────────────────────────────────────────

  describe('generateViewingKeyFromSpending', () => {
    it('should generate viewing key from spending key', () => {
      const { spendingPrivateKey } = deriveSolanaStealthKeys({ mnemonic: TEST_MNEMONIC })
      const viewingKey = generateViewingKeyFromSpending(spendingPrivateKey, 'Test Key')

      expect(viewingKey.privateKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(viewingKey.publicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(viewingKey.hash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(viewingKey.label).toBe('Test Key')
      expect(viewingKey.createdAt).toBeLessThanOrEqual(Date.now())
    })

    it('should produce deterministic results', () => {
      const { spendingPrivateKey } = deriveSolanaStealthKeys({ mnemonic: TEST_MNEMONIC })

      const key1 = generateViewingKeyFromSpending(spendingPrivateKey)
      const key2 = generateViewingKeyFromSpending(spendingPrivateKey)

      expect(key1.privateKey).toBe(key2.privateKey)
      expect(key1.publicKey).toBe(key2.publicKey)
      expect(key1.hash).toBe(key2.hash)
    })

    it('should match key derivation viewing key', () => {
      const { spendingPrivateKey, viewingPrivateKey, metaAddress } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC,
      })

      const viewingKey = generateViewingKeyFromSpending(spendingPrivateKey)

      expect(viewingKey.privateKey).toBe(viewingPrivateKey)
      expect(viewingKey.publicKey).toBe(metaAddress.viewingKey)
    })

    it('should throw for invalid spending key', () => {
      expect(() => generateViewingKeyFromSpending('invalid' as HexString)).toThrow()
      expect(() => generateViewingKeyFromSpending('0xabc' as HexString)).toThrow() // Wrong length
      expect(() => generateViewingKeyFromSpending('' as HexString)).toThrow()
    })
  })

  describe('generateRandomViewingKey', () => {
    it('should generate random viewing key', () => {
      const key = generateRandomViewingKey('Random Key')

      expect(key.privateKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(key.publicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(key.hash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(key.label).toBe('Random Key')
    })

    it('should produce different keys each time', () => {
      const key1 = generateRandomViewingKey()
      const key2 = generateRandomViewingKey()

      expect(key1.privateKey).not.toBe(key2.privateKey)
      expect(key1.publicKey).not.toBe(key2.publicKey)
      expect(key1.hash).not.toBe(key2.hash)
    })
  })

  // ─── Hash Computation ───────────────────────────────────────────────────────

  describe('computeViewingKeyHash', () => {
    it('should compute hash from public key', () => {
      const key = generateRandomViewingKey()
      const hash = computeViewingKeyHash(key.publicKey)

      expect(hash).toBe(key.hash)
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should produce consistent results', () => {
      const key = generateRandomViewingKey()

      const hash1 = computeViewingKeyHash(key.publicKey)
      const hash2 = computeViewingKeyHash(key.publicKey)

      expect(hash1).toBe(hash2)
    })

    it('should throw for invalid public key', () => {
      expect(() => computeViewingKeyHash('invalid' as HexString)).toThrow()
      expect(() => computeViewingKeyHash('0xabc' as HexString)).toThrow()
    })
  })

  describe('computeViewingKeyHashFromPrivate', () => {
    it('should compute same hash as from public key', () => {
      const key = generateRandomViewingKey()

      const hashFromPublic = computeViewingKeyHash(key.publicKey)
      const hashFromPrivate = computeViewingKeyHashFromPrivate(key.privateKey)

      expect(hashFromPrivate).toBe(hashFromPublic)
      expect(hashFromPrivate).toBe(key.hash)
    })
  })

  describe('getViewingPublicKey', () => {
    it('should derive public key from private key', () => {
      const key = generateRandomViewingKey()
      const publicKey = getViewingPublicKey(key.privateKey)

      expect(publicKey).toBe(key.publicKey)
    })
  })

  // ─── Export/Import ──────────────────────────────────────────────────────────

  describe('exportViewingKey', () => {
    it('should export viewing key in standard format', () => {
      const key = generateRandomViewingKey('Export Test')
      const exported = exportViewingKey(key)

      expect(exported.version).toBe(1)
      expect(exported.chain).toBe('solana')
      expect(exported.privateKey).toBe(key.privateKey)
      expect(exported.publicKey).toBe(key.publicKey)
      expect(exported.hash).toBe(key.hash)
      expect(exported.label).toBe('Export Test')
      expect(exported.createdAt).toBe(key.createdAt)
      expect(exported.exportedAt).toBeLessThanOrEqual(Date.now())
    })

    it('should produce valid JSON', () => {
      const key = generateRandomViewingKey()
      const exported = exportViewingKey(key)
      const json = JSON.stringify(exported)

      expect(() => JSON.parse(json)).not.toThrow()
    })
  })

  describe('importViewingKey', () => {
    it('should import exported viewing key', () => {
      const original = generateRandomViewingKey('Import Test')
      const exported = exportViewingKey(original)
      const imported = importViewingKey(exported)

      expect(imported.privateKey).toBe(original.privateKey)
      expect(imported.publicKey).toBe(original.publicKey)
      expect(imported.hash).toBe(original.hash)
      expect(imported.label).toBe(original.label)
      expect(imported.createdAt).toBe(original.createdAt)
    })

    it('should verify hash matches public key', () => {
      const key = generateRandomViewingKey()
      const exported = exportViewingKey(key)

      // Tamper with hash
      exported.hash = '0x' + '00'.repeat(32) as Hash

      expect(() => importViewingKey(exported)).toThrow(/hash/i)
    })

    it('should verify public key matches private key', () => {
      const key1 = generateRandomViewingKey()
      const key2 = generateRandomViewingKey()
      const exported = exportViewingKey(key1)

      // Mix keys
      exported.publicKey = key2.publicKey
      exported.hash = key2.hash

      expect(() => importViewingKey(exported)).toThrow(/public key/i)
    })

    it('should reject invalid version', () => {
      const key = generateRandomViewingKey()
      const exported = exportViewingKey(key)
      exported.version = 999

      expect(() => importViewingKey(exported)).toThrow(/version/i)
    })

    it('should reject invalid chain', () => {
      const key = generateRandomViewingKey()
      const exported = exportViewingKey(key)
      ;(exported as any).chain = 'ethereum'

      expect(() => importViewingKey(exported)).toThrow(/chain/i)
    })
  })

  // ─── Encryption/Decryption ──────────────────────────────────────────────────

  describe('encryptForViewing', () => {
    it('should encrypt transaction data', () => {
      const key = generateRandomViewingKey()
      const data: SolanaTransactionData = {
        sender: 'So11111111111111111111111111111111111111112',
        recipient: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timestamp: Date.now(),
        memo: 'Test payment',
      }

      const encrypted = encryptForViewing(data, key)

      expect(encrypted.ciphertext).toMatch(/^0x[0-9a-f]+$/)
      expect(encrypted.nonce).toMatch(/^0x[0-9a-f]{48}$/) // 24 bytes = 48 hex chars
      expect(encrypted.viewingKeyHash).toBe(key.hash)
    })

    it('should produce different ciphertext each time', () => {
      const key = generateRandomViewingKey()
      const data: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '100',
        mint: null,
        timestamp: 12345,
      }

      const enc1 = encryptForViewing(data, key)
      const enc2 = encryptForViewing(data, key)

      expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
      expect(enc1.nonce).not.toBe(enc2.nonce)
    })
  })

  describe('decryptWithViewing', () => {
    it('should decrypt encrypted data', () => {
      const key = generateRandomViewingKey()
      const original: SolanaTransactionData = {
        sender: 'So11111111111111111111111111111111111111112',
        recipient: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timestamp: 1234567890,
        memo: 'Test payment',
      }

      const encrypted = encryptForViewing(original, key)
      const decrypted = decryptWithViewing(encrypted, key)

      expect(decrypted.sender).toBe(original.sender)
      expect(decrypted.recipient).toBe(original.recipient)
      expect(decrypted.amount).toBe(original.amount)
      expect(decrypted.mint).toBe(original.mint)
      expect(decrypted.timestamp).toBe(original.timestamp)
      expect(decrypted.memo).toBe(original.memo)
    })

    it('should handle null mint', () => {
      const key = generateRandomViewingKey()
      const data: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '100',
        mint: null,
        timestamp: 12345,
      }

      const encrypted = encryptForViewing(data, key)
      const decrypted = decryptWithViewing(encrypted, key)

      expect(decrypted.mint).toBeNull()
    })

    it('should reject wrong viewing key', () => {
      const key1 = generateRandomViewingKey()
      const key2 = generateRandomViewingKey()
      const data: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '100',
        mint: null,
        timestamp: 12345,
      }

      const encrypted = encryptForViewing(data, key1)

      expect(() => decryptWithViewing(encrypted, key2)).toThrow(/hash/i)
    })

    it('should detect tampered ciphertext', () => {
      const key = generateRandomViewingKey()
      const data: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '100',
        mint: null,
        timestamp: 12345,
      }

      const encrypted = encryptForViewing(data, key)

      // Tamper with ciphertext
      const tamperedCiphertext = encrypted.ciphertext.slice(0, -4) + 'ffff' as HexString

      expect(() =>
        decryptWithViewing({ ...encrypted, ciphertext: tamperedCiphertext }, key)
      ).toThrow(/decrypt/i)
    })
  })

  // ─── Storage ────────────────────────────────────────────────────────────────

  describe('createMemoryStorage', () => {
    let storage: ReturnType<typeof createMemoryStorage>

    beforeEach(() => {
      storage = createMemoryStorage()
    })

    it('should save and load viewing key', async () => {
      const key = generateRandomViewingKey('Storage Test')

      const savedHash = await storage.save(key)
      expect(savedHash).toBe(key.hash)

      const loaded = await storage.load(key.hash)
      expect(loaded).not.toBeNull()
      expect(loaded!.privateKey).toBe(key.privateKey)
      expect(loaded!.label).toBe(key.label)
    })

    it('should return null for unknown hash', async () => {
      const result = await storage.load('0x' + '00'.repeat(32) as Hash)
      expect(result).toBeNull()
    })

    it('should list all stored keys', async () => {
      const key1 = generateRandomViewingKey('Key 1')
      const key2 = generateRandomViewingKey('Key 2')

      await storage.save(key1)
      await storage.save(key2)

      const list = await storage.list()
      expect(list).toHaveLength(2)
      expect(list.map(k => k.label)).toContain('Key 1')
      expect(list.map(k => k.label)).toContain('Key 2')
    })

    it('should delete viewing key', async () => {
      const key = generateRandomViewingKey()

      await storage.save(key)
      expect(await storage.load(key.hash)).not.toBeNull()

      const deleted = await storage.delete(key.hash)
      expect(deleted).toBe(true)

      expect(await storage.load(key.hash)).toBeNull()
    })

    it('should return false when deleting non-existent key', async () => {
      const deleted = await storage.delete('0x' + '00'.repeat(32) as Hash)
      expect(deleted).toBe(false)
    })
  })

  // ─── Utilities ──────────────────────────────────────────────────────────────

  describe('isAnnouncementForViewingKey', () => {
    it('should return true for matching hash', () => {
      const key = generateRandomViewingKey()
      expect(isAnnouncementForViewingKey(key.hash, key)).toBe(true)
    })

    it('should return false for non-matching hash', () => {
      const key = generateRandomViewingKey()
      const otherHash = '0x' + '00'.repeat(32) as Hash
      expect(isAnnouncementForViewingKey(otherHash, key)).toBe(false)
    })
  })

  describe('deriveChildViewingKey', () => {
    it('should derive child key from parent', () => {
      const parent = generateRandomViewingKey('Parent')
      const child = deriveChildViewingKey(parent, 'child/path', 'Child Key')

      expect(child.privateKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(child.publicKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(child.hash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(child.label).toBe('Child Key')
    })

    it('should produce different key from parent', () => {
      const parent = generateRandomViewingKey()
      const child = deriveChildViewingKey(parent, 'path')

      expect(child.privateKey).not.toBe(parent.privateKey)
      expect(child.publicKey).not.toBe(parent.publicKey)
      expect(child.hash).not.toBe(parent.hash)
    })

    it('should produce deterministic results', () => {
      const parent = generateRandomViewingKey()

      const child1 = deriveChildViewingKey(parent, 'same/path')
      const child2 = deriveChildViewingKey(parent, 'same/path')

      expect(child1.privateKey).toBe(child2.privateKey)
      expect(child1.hash).toBe(child2.hash)
    })

    it('should produce different keys for different paths', () => {
      const parent = generateRandomViewingKey()

      const child1 = deriveChildViewingKey(parent, 'path/1')
      const child2 = deriveChildViewingKey(parent, 'path/2')

      expect(child1.privateKey).not.toBe(child2.privateKey)
    })

    it('should use default label from parent', () => {
      const parent = generateRandomViewingKey('Parent Key')
      const child = deriveChildViewingKey(parent, 'audit')

      expect(child.label).toBe('Parent Key/audit')
    })

    it('should throw for empty path', () => {
      const parent = generateRandomViewingKey()
      expect(() => deriveChildViewingKey(parent, '')).toThrow()
    })
  })

  // ─── Integration ────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should work end-to-end: derive, encrypt, store, load, decrypt', async () => {
      // Derive viewing key from spending key
      const { spendingPrivateKey } = deriveSolanaStealthKeys({ mnemonic: TEST_MNEMONIC })
      const viewingKey = generateViewingKeyFromSpending(spendingPrivateKey, 'Wallet Key')

      // Create transaction data
      const txData: SolanaTransactionData = {
        sender: 'SenderPubkey11111111111111111111111111111111',
        recipient: 'StealthAddress1111111111111111111111111111111',
        amount: '5000000',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timestamp: Date.now(),
        memo: 'Private USDC transfer',
      }

      // Encrypt
      const encrypted = encryptForViewing(txData, viewingKey)

      // Store
      const storage = createMemoryStorage()
      await storage.save(viewingKey)

      // Load
      const loaded = await storage.load(viewingKey.hash)
      expect(loaded).not.toBeNull()

      // Decrypt
      const decrypted = decryptWithViewing(encrypted, loaded!)

      expect(decrypted.amount).toBe(txData.amount)
      expect(decrypted.memo).toBe(txData.memo)
    })

    it('should support hierarchical key derivation for compliance', async () => {
      const { spendingPrivateKey } = deriveSolanaStealthKeys({ mnemonic: TEST_MNEMONIC })
      const masterKey = generateViewingKeyFromSpending(spendingPrivateKey, 'Master')

      // Derive department-specific keys
      const auditKey = deriveChildViewingKey(masterKey, 'audit/2024', 'Audit 2024')
      const accountingKey = deriveChildViewingKey(masterKey, 'accounting', 'Accounting')

      // Encrypt with master key
      const txData: SolanaTransactionData = {
        sender: 'sender',
        recipient: 'recipient',
        amount: '1000',
        mint: null,
        timestamp: 12345,
      }
      const encrypted = encryptForViewing(txData, masterKey)

      // Only master key can decrypt (not child keys)
      expect(() => decryptWithViewing(encrypted, masterKey)).not.toThrow()
      expect(() => decryptWithViewing(encrypted, auditKey)).toThrow()
      expect(() => decryptWithViewing(encrypted, accountingKey)).toThrow()

      // Each child key can only decrypt its own data
      const auditData = encryptForViewing(txData, auditKey)
      expect(() => decryptWithViewing(auditData, auditKey)).not.toThrow()
      expect(() => decryptWithViewing(auditData, masterKey)).toThrow()
    })
  })
})
