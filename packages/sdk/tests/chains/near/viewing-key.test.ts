/**
 * NEAR Viewing Key Tests
 *
 * Tests for M17-NEAR-04: NEAR viewing key generation and management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import {
  generateNEARViewingKeyFromSpending,
  generateRandomNEARViewingKey,
  computeNEARViewingKeyHash,
  computeNEARViewingKeyHashFromPrivate,
  exportNEARViewingKey,
  importNEARViewingKey,
  encryptForNEARViewing,
  decryptWithNEARViewing,
  createNEARMemoryStorage,
  isNEARAnnouncementForViewingKey,
  deriveNEARChildViewingKey,
  getNEARViewingPublicKey,
  validateNEARViewingKey,
} from '../../../src/chains/near'
import type {
  NEARViewingKey,
  NEARViewingKeyExport,
  NEARTransactionData,
} from '../../../src/chains/near'
import type { HexString, Hash } from '@sip-protocol/types'

describe('NEAR Viewing Key (M17-NEAR-04)', () => {
  describe('generateNEARViewingKeyFromSpending', () => {
    it('should generate a viewing key from spending private key', () => {
      const spendingPrivateKey = `0x${bytesToHex(randomBytes(32))}` as HexString
      const viewingKey = generateNEARViewingKeyFromSpending(spendingPrivateKey)

      expect(viewingKey.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(viewingKey.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(viewingKey.hash).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(viewingKey.createdAt).toBeGreaterThan(0)
    })

    it('should generate deterministic viewing key from same spending key', () => {
      const spendingPrivateKey = `0x${bytesToHex(randomBytes(32))}` as HexString

      const viewingKey1 = generateNEARViewingKeyFromSpending(spendingPrivateKey)
      const viewingKey2 = generateNEARViewingKeyFromSpending(spendingPrivateKey)

      expect(viewingKey1.privateKey).toBe(viewingKey2.privateKey)
      expect(viewingKey1.publicKey).toBe(viewingKey2.publicKey)
      expect(viewingKey1.hash).toBe(viewingKey2.hash)
    })

    it('should generate different viewing keys for different spending keys', () => {
      const spending1 = `0x${bytesToHex(randomBytes(32))}` as HexString
      const spending2 = `0x${bytesToHex(randomBytes(32))}` as HexString

      const viewingKey1 = generateNEARViewingKeyFromSpending(spending1)
      const viewingKey2 = generateNEARViewingKeyFromSpending(spending2)

      expect(viewingKey1.privateKey).not.toBe(viewingKey2.privateKey)
      expect(viewingKey1.publicKey).not.toBe(viewingKey2.publicKey)
    })

    it('should include label when provided', () => {
      const spendingPrivateKey = `0x${bytesToHex(randomBytes(32))}` as HexString
      const viewingKey = generateNEARViewingKeyFromSpending(spendingPrivateKey, 'My NEAR Wallet')

      expect(viewingKey.label).toBe('My NEAR Wallet')
    })

    it('should throw for invalid spending key (no 0x prefix)', () => {
      const invalid = bytesToHex(randomBytes(32)) // no 0x
      expect(() => generateNEARViewingKeyFromSpending(invalid as HexString)).toThrow(/0x prefix/)
    })

    it('should throw for invalid spending key (wrong length)', () => {
      const invalid = '0x1234' as HexString
      expect(() => generateNEARViewingKeyFromSpending(invalid)).toThrow(/32 bytes/)
    })
  })

  describe('generateRandomNEARViewingKey', () => {
    it('should generate a random viewing key', () => {
      const viewingKey = generateRandomNEARViewingKey()

      expect(viewingKey.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(viewingKey.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(viewingKey.hash).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should generate unique keys each time', () => {
      const key1 = generateRandomNEARViewingKey()
      const key2 = generateRandomNEARViewingKey()

      expect(key1.privateKey).not.toBe(key2.privateKey)
      expect(key1.publicKey).not.toBe(key2.publicKey)
      expect(key1.hash).not.toBe(key2.hash)
    })

    it('should include label when provided', () => {
      const viewingKey = generateRandomNEARViewingKey('Audit Key')
      expect(viewingKey.label).toBe('Audit Key')
    })
  })

  describe('computeNEARViewingKeyHash', () => {
    it('should compute hash from public key', () => {
      const viewingKey = generateRandomNEARViewingKey()
      const hash = computeNEARViewingKeyHash(viewingKey.publicKey)

      expect(hash).toBe(viewingKey.hash)
    })

    it('should throw for invalid public key (no 0x prefix)', () => {
      const invalid = bytesToHex(randomBytes(32))
      expect(() => computeNEARViewingKeyHash(invalid as HexString)).toThrow(/0x prefix/)
    })

    it('should throw for invalid public key (wrong length)', () => {
      const invalid = '0x1234' as HexString
      expect(() => computeNEARViewingKeyHash(invalid)).toThrow(/32 bytes/)
    })
  })

  describe('computeNEARViewingKeyHashFromPrivate', () => {
    it('should compute hash from private key', () => {
      const viewingKey = generateRandomNEARViewingKey()
      const hash = computeNEARViewingKeyHashFromPrivate(viewingKey.privateKey)

      expect(hash).toBe(viewingKey.hash)
    })

    it('should throw for invalid private key', () => {
      expect(() => computeNEARViewingKeyHashFromPrivate('invalid' as HexString)).toThrow(/0x prefix/)
    })
  })

  describe('Export/Import', () => {
    let viewingKey: NEARViewingKey

    beforeEach(() => {
      viewingKey = generateRandomNEARViewingKey('Test Key')
    })

    describe('exportNEARViewingKey', () => {
      it('should export viewing key in standard format', () => {
        const exported = exportNEARViewingKey(viewingKey)

        expect(exported.version).toBe(1)
        expect(exported.chain).toBe('near')
        expect(exported.privateKey).toBe(viewingKey.privateKey)
        expect(exported.publicKey).toBe(viewingKey.publicKey)
        expect(exported.hash).toBe(viewingKey.hash)
        expect(exported.label).toBe('Test Key')
        expect(exported.createdAt).toBe(viewingKey.createdAt)
        expect(exported.exportedAt).toBeGreaterThan(0)
      })
    })

    describe('importNEARViewingKey', () => {
      it('should import exported viewing key', () => {
        const exported = exportNEARViewingKey(viewingKey)
        const imported = importNEARViewingKey(exported)

        expect(imported.privateKey).toBe(viewingKey.privateKey)
        expect(imported.publicKey).toBe(viewingKey.publicKey)
        expect(imported.hash).toBe(viewingKey.hash)
        expect(imported.label).toBe(viewingKey.label)
      })

      it('should reject invalid version', () => {
        const exported = exportNEARViewingKey(viewingKey)
        exported.version = 999

        expect(() => importNEARViewingKey(exported)).toThrow(/Unsupported export version/)
      })

      it('should reject wrong chain', () => {
        const exported = exportNEARViewingKey(viewingKey)
        ;(exported as unknown as { chain: string }).chain = 'solana'

        expect(() => importNEARViewingKey(exported as NEARViewingKeyExport)).toThrow(/Invalid chain/)
      })

      it('should reject mismatched hash', () => {
        const exported = exportNEARViewingKey(viewingKey)
        exported.hash = '0x' + '00'.repeat(32) as Hash

        expect(() => importNEARViewingKey(exported)).toThrow(/Hash does not match/)
      })

      it('should reject mismatched public key', () => {
        const exported = exportNEARViewingKey(viewingKey)
        // Swap with different key's public key
        const otherKey = generateRandomNEARViewingKey()
        exported.publicKey = otherKey.publicKey
        exported.hash = otherKey.hash

        expect(() => importNEARViewingKey(exported)).toThrow(/Public key does not match/)
      })
    })

    it('should roundtrip through JSON serialization', () => {
      const exported = exportNEARViewingKey(viewingKey)
      const json = JSON.stringify(exported)
      const parsed = JSON.parse(json) as NEARViewingKeyExport
      const imported = importNEARViewingKey(parsed)

      expect(imported.privateKey).toBe(viewingKey.privateKey)
      expect(imported.publicKey).toBe(viewingKey.publicKey)
      expect(imported.hash).toBe(viewingKey.hash)
    })
  })

  describe('Encryption/Decryption', () => {
    let viewingKey: NEARViewingKey
    let transactionData: NEARTransactionData

    beforeEach(() => {
      viewingKey = generateRandomNEARViewingKey()
      transactionData = {
        sender: 'alice.near',
        recipient: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        amount: '1000000000000000000000000',
        tokenContract: null,
        decimals: 24,
        timestamp: Date.now(),
        memo: 'Test payment',
      }
    })

    describe('encryptForNEARViewing', () => {
      it('should encrypt transaction data', () => {
        const encrypted = encryptForNEARViewing(transactionData, viewingKey)

        expect(encrypted.ciphertext).toMatch(/^0x[0-9a-f]+$/i)
        expect(encrypted.nonce).toMatch(/^0x[0-9a-f]{48}$/i) // 24 bytes = 48 hex chars
        expect(encrypted.viewingKeyHash).toBe(viewingKey.hash)
      })

      it('should produce different ciphertext each time (random nonce)', () => {
        const enc1 = encryptForNEARViewing(transactionData, viewingKey)
        const enc2 = encryptForNEARViewing(transactionData, viewingKey)

        expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
        expect(enc1.nonce).not.toBe(enc2.nonce)
      })
    })

    describe('decryptWithNEARViewing', () => {
      it('should decrypt encrypted data', () => {
        const encrypted = encryptForNEARViewing(transactionData, viewingKey)
        const decrypted = decryptWithNEARViewing(encrypted, viewingKey)

        expect(decrypted.sender).toBe(transactionData.sender)
        expect(decrypted.recipient).toBe(transactionData.recipient)
        expect(decrypted.amount).toBe(transactionData.amount)
        expect(decrypted.tokenContract).toBe(transactionData.tokenContract)
        expect(decrypted.decimals).toBe(transactionData.decimals)
        expect(decrypted.memo).toBe(transactionData.memo)
      })

      it('should reject wrong viewing key', () => {
        const encrypted = encryptForNEARViewing(transactionData, viewingKey)
        const wrongKey = generateRandomNEARViewingKey()

        expect(() => decryptWithNEARViewing(encrypted, wrongKey)).toThrow(/does not match/)
      })

      it('should reject tampered ciphertext', () => {
        const encrypted = encryptForNEARViewing(transactionData, viewingKey)
        // Tamper with ciphertext
        encrypted.ciphertext = encrypted.ciphertext.slice(0, -2) + 'ff' as HexString

        expect(() => decryptWithNEARViewing(encrypted, viewingKey)).toThrow(/Failed to decrypt/)
      })

      it('should handle NEP-141 token data', () => {
        const tokenData: NEARTransactionData = {
          sender: 'alice.near',
          recipient: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
          amount: '100000000',
          tokenContract: 'usdc.near',
          decimals: 6,
          timestamp: Date.now(),
        }

        const encrypted = encryptForNEARViewing(tokenData, viewingKey)
        const decrypted = decryptWithNEARViewing(encrypted, viewingKey)

        expect(decrypted.tokenContract).toBe('usdc.near')
        expect(decrypted.decimals).toBe(6)
        expect(decrypted.amount).toBe('100000000')
      })
    })
  })

  describe('Memory Storage', () => {
    it('should save and load viewing keys', async () => {
      const storage = createNEARMemoryStorage()
      const viewingKey = generateRandomNEARViewingKey('Stored Key')

      const hash = await storage.save(viewingKey)
      expect(hash).toBe(viewingKey.hash)

      const loaded = await storage.load(hash)
      expect(loaded).not.toBeNull()
      expect(loaded!.privateKey).toBe(viewingKey.privateKey)
      expect(loaded!.label).toBe('Stored Key')
    })

    it('should list all stored keys', async () => {
      const storage = createNEARMemoryStorage()
      const key1 = generateRandomNEARViewingKey('Key 1')
      const key2 = generateRandomNEARViewingKey('Key 2')

      await storage.save(key1)
      await storage.save(key2)

      const keys = await storage.list()
      expect(keys).toHaveLength(2)
      expect(keys.map((k) => k.label)).toContain('Key 1')
      expect(keys.map((k) => k.label)).toContain('Key 2')
    })

    it('should delete keys', async () => {
      const storage = createNEARMemoryStorage()
      const viewingKey = generateRandomNEARViewingKey()

      await storage.save(viewingKey)
      const deleted = await storage.delete(viewingKey.hash)

      expect(deleted).toBe(true)
      expect(await storage.load(viewingKey.hash)).toBeNull()
    })

    it('should return false when deleting non-existent key', async () => {
      const storage = createNEARMemoryStorage()
      const deleted = await storage.delete('0x' + '00'.repeat(32) as Hash)

      expect(deleted).toBe(false)
    })

    it('should return null for non-existent key', async () => {
      const storage = createNEARMemoryStorage()
      const loaded = await storage.load('0x' + '00'.repeat(32) as Hash)

      expect(loaded).toBeNull()
    })
  })

  describe('Utilities', () => {
    describe('isNEARAnnouncementForViewingKey', () => {
      it('should return true for matching hash', () => {
        const viewingKey = generateRandomNEARViewingKey()
        const result = isNEARAnnouncementForViewingKey(viewingKey.hash, viewingKey)

        expect(result).toBe(true)
      })

      it('should return false for non-matching hash', () => {
        const viewingKey = generateRandomNEARViewingKey()
        const wrongHash = '0x' + '11'.repeat(32) as Hash
        const result = isNEARAnnouncementForViewingKey(wrongHash, viewingKey)

        expect(result).toBe(false)
      })
    })

    describe('deriveNEARChildViewingKey', () => {
      it('should derive child viewing key', () => {
        const parentKey = generateRandomNEARViewingKey('Parent')
        const childKey = deriveNEARChildViewingKey(parentKey, 'audit/2024', 'Audit 2024')

        expect(childKey.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(childKey.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(childKey.hash).toMatch(/^0x[0-9a-f]{64}$/i)
        expect(childKey.label).toBe('Audit 2024')
      })

      it('should derive deterministic child keys', () => {
        const parentKey = generateRandomNEARViewingKey('Parent')
        const child1 = deriveNEARChildViewingKey(parentKey, 'path/a')
        const child2 = deriveNEARChildViewingKey(parentKey, 'path/a')

        expect(child1.privateKey).toBe(child2.privateKey)
        expect(child1.hash).toBe(child2.hash)
      })

      it('should derive different keys for different paths', () => {
        const parentKey = generateRandomNEARViewingKey('Parent')
        const child1 = deriveNEARChildViewingKey(parentKey, 'path/a')
        const child2 = deriveNEARChildViewingKey(parentKey, 'path/b')

        expect(child1.privateKey).not.toBe(child2.privateKey)
      })

      it('should use auto-generated label when not provided', () => {
        const parentKey = generateRandomNEARViewingKey('Parent')
        const childKey = deriveNEARChildViewingKey(parentKey, 'child/path')

        expect(childKey.label).toBe('Parent/child/path')
      })

      it('should throw for empty path', () => {
        const parentKey = generateRandomNEARViewingKey()
        expect(() => deriveNEARChildViewingKey(parentKey, '')).toThrow(/non-empty string/)
      })
    })

    describe('getNEARViewingPublicKey', () => {
      it('should derive public key from private key', () => {
        const viewingKey = generateRandomNEARViewingKey()
        const publicKey = getNEARViewingPublicKey(viewingKey.privateKey)

        expect(publicKey).toBe(viewingKey.publicKey)
      })

      it('should throw for invalid private key', () => {
        expect(() => getNEARViewingPublicKey('invalid' as HexString)).toThrow(/0x prefix/)
      })

      it('should throw for wrong length', () => {
        expect(() => getNEARViewingPublicKey('0x1234' as HexString)).toThrow(/32 bytes/)
      })
    })

    describe('validateNEARViewingKey', () => {
      it('should validate a correct viewing key', () => {
        const viewingKey = generateRandomNEARViewingKey()
        expect(validateNEARViewingKey(viewingKey)).toBe(true)
      })

      it('should throw for null viewing key', () => {
        expect(() => validateNEARViewingKey(null as unknown as NEARViewingKey)).toThrow(/required/)
      })

      it('should throw for invalid privateKey format', () => {
        const viewingKey = generateRandomNEARViewingKey()
        viewingKey.privateKey = 'invalid' as HexString
        expect(() => validateNEARViewingKey(viewingKey)).toThrow(/0x prefix/)
      })

      it('should throw for mismatched hash', () => {
        const viewingKey = generateRandomNEARViewingKey()
        viewingKey.hash = '0x' + '00'.repeat(32) as Hash
        expect(() => validateNEARViewingKey(viewingKey)).toThrow(/does not match/)
      })

      it('should throw for mismatched public key', () => {
        const viewingKey = generateRandomNEARViewingKey()
        const otherKey = generateRandomNEARViewingKey()
        viewingKey.publicKey = otherKey.publicKey
        viewingKey.hash = otherKey.hash
        expect(() => validateNEARViewingKey(viewingKey)).toThrow(/does not match/)
      })
    })
  })

  describe('Integration', () => {
    it('should work with stealth address flow', () => {
      // Spending key generates viewing key
      const spendingPrivateKey = `0x${bytesToHex(randomBytes(32))}` as HexString
      const viewingKey = generateNEARViewingKeyFromSpending(spendingPrivateKey, 'Main Wallet')

      // Sender encrypts transaction data with viewing key
      const txData: NEARTransactionData = {
        sender: 'sender.near',
        recipient: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        amount: '5000000000000000000000000', // 5 NEAR
        tokenContract: null,
        decimals: 24,
        timestamp: Date.now(),
      }

      const encrypted = encryptForNEARViewing(txData, viewingKey)

      // Recipient can decrypt with same viewing key
      const decrypted = decryptWithNEARViewing(encrypted, viewingKey)
      expect(decrypted.sender).toBe('sender.near')
      expect(decrypted.amount).toBe('5000000000000000000000000')

      // Auditor with same viewing key can also decrypt
      const auditorKey = generateNEARViewingKeyFromSpending(spendingPrivateKey, 'Auditor Copy')
      expect(auditorKey.hash).toBe(viewingKey.hash)

      const auditDecrypted = decryptWithNEARViewing(encrypted, auditorKey)
      expect(auditDecrypted.sender).toBe('sender.near')
    })

    it('should support hierarchical key derivation for departments', () => {
      const masterKey = generateRandomNEARViewingKey('Treasury')

      const financeKey = deriveNEARChildViewingKey(masterKey, 'finance', 'Finance Dept')
      const opsKey = deriveNEARChildViewingKey(masterKey, 'operations', 'Operations Dept')

      // Each department key is independent
      expect(financeKey.hash).not.toBe(opsKey.hash)

      // Finance encrypts their transaction
      const financeTx: NEARTransactionData = {
        sender: 'finance.treasury.near',
        recipient: 'abcd' + '0'.repeat(60),
        amount: '1000000000000000000000000',
        tokenContract: null,
        decimals: 24,
        timestamp: Date.now(),
      }

      const encrypted = encryptForNEARViewing(financeTx, financeKey)

      // Only finance can decrypt
      const decrypted = decryptWithNEARViewing(encrypted, financeKey)
      expect(decrypted.sender).toBe('finance.treasury.near')

      // Operations cannot decrypt finance's data
      expect(() => decryptWithNEARViewing(encrypted, opsKey)).toThrow(/does not match/)
    })
  })
})
