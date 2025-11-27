/**
 * Encryption Tests
 *
 * Tests for XChaCha20-Poly1305 authenticated encryption in privacy.ts
 */

import { describe, it, expect } from 'vitest'
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '../../src/privacy'
import type { TransactionData } from '../../src/privacy'
import type { HexString, Hash } from '@sip-protocol/types'

describe('XChaCha20-Poly1305 Encryption', () => {
  const testData: TransactionData = {
    sender: '0x1234567890abcdef1234567890abcdef12345678',
    recipient: '0xabcdef1234567890abcdef1234567890abcdef12',
    amount: '1000000000000000000', // 1 ETH in wei
    timestamp: 1700000000,
  }

  describe('encryptForViewing()', () => {
    it('should encrypt data with viewing key', () => {
      const viewingKey = generateViewingKey('/m/44/60/0')

      const encrypted = encryptForViewing(testData, viewingKey)

      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.ciphertext.startsWith('0x')).toBe(true)
      expect(encrypted.nonce).toBeDefined()
      expect(encrypted.nonce.startsWith('0x')).toBe(true)
      expect(encrypted.viewingKeyHash).toBe(viewingKey.hash)
    })

    it('should produce different ciphertext for same data (random nonce)', () => {
      const viewingKey = generateViewingKey()

      const encrypted1 = encryptForViewing(testData, viewingKey)
      const encrypted2 = encryptForViewing(testData, viewingKey)

      // Ciphertexts should be different due to random nonces
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
      expect(encrypted1.nonce).not.toBe(encrypted2.nonce)
    })

    it('should use 24-byte nonce (XChaCha20)', () => {
      const viewingKey = generateViewingKey()
      const encrypted = encryptForViewing(testData, viewingKey)

      // Remove 0x prefix and calculate byte length
      const nonceHex = encrypted.nonce.slice(2)
      const nonceBytes = nonceHex.length / 2

      expect(nonceBytes).toBe(24)
    })

    it('should include authentication tag in ciphertext', () => {
      const viewingKey = generateViewingKey()
      const encrypted = encryptForViewing(testData, viewingKey)

      // Ciphertext should be larger than plaintext due to auth tag (16 bytes)
      const plaintextLen = JSON.stringify(testData).length
      const ciphertextBytes = (encrypted.ciphertext.length - 2) / 2

      expect(ciphertextBytes).toBeGreaterThan(plaintextLen)
    })
  })

  describe('decryptWithViewing()', () => {
    it('should decrypt data with correct viewing key', () => {
      const viewingKey = generateViewingKey('/m/44/60/0')

      const encrypted = encryptForViewing(testData, viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted).toEqual(testData)
    })

    it('should fail with wrong viewing key', () => {
      const correctKey = generateViewingKey('/m/44/60/0')
      const wrongKey = generateViewingKey('/m/44/60/1')

      const encrypted = encryptForViewing(testData, correctKey)

      // Modify the hash so it doesn't trigger the early check
      const tampered = {
        ...encrypted,
        viewingKeyHash: wrongKey.hash,
      }

      expect(() => decryptWithViewing(tampered, wrongKey)).toThrow()
    })

    it('should detect viewing key hash mismatch', () => {
      const key1 = generateViewingKey('/m/1')
      const key2 = generateViewingKey('/m/2')

      const encrypted = encryptForViewing(testData, key1)

      expect(() => decryptWithViewing(encrypted, key2)).toThrow(
        'Viewing key hash mismatch'
      )
    })

    it('should detect tampered ciphertext', () => {
      const viewingKey = generateViewingKey()
      const encrypted = encryptForViewing(testData, viewingKey)

      // Tamper with the ciphertext (flip a byte)
      const ciphertextHex = encrypted.ciphertext.slice(2)
      const firstByte = parseInt(ciphertextHex.slice(0, 2), 16)
      const flippedByte = (firstByte ^ 0xff).toString(16).padStart(2, '0')
      const tamperedCiphertext = `0x${flippedByte}${ciphertextHex.slice(2)}` as HexString

      const tampered = { ...encrypted, ciphertext: tamperedCiphertext }

      expect(() => decryptWithViewing(tampered, viewingKey)).toThrow(
        'authentication tag verification failed'
      )
    })

    it('should detect tampered nonce', () => {
      const viewingKey = generateViewingKey()
      const encrypted = encryptForViewing(testData, viewingKey)

      // Tamper with the nonce
      const nonceHex = encrypted.nonce.slice(2)
      const firstByte = parseInt(nonceHex.slice(0, 2), 16)
      const flippedByte = (firstByte ^ 0xff).toString(16).padStart(2, '0')
      const tamperedNonce = `0x${flippedByte}${nonceHex.slice(2)}` as HexString

      const tampered = { ...encrypted, nonce: tamperedNonce }

      expect(() => decryptWithViewing(tampered, viewingKey)).toThrow()
    })
  })

  describe('round-trip encryption', () => {
    it('should round-trip various data sizes', () => {
      const viewingKey = generateViewingKey()

      const testCases: TransactionData[] = [
        // Small data
        { sender: '0x1', recipient: '0x2', amount: '1', timestamp: 1 },
        // Large data
        {
          sender: '0x' + 'a'.repeat(100),
          recipient: '0x' + 'b'.repeat(100),
          amount: '9'.repeat(50),
          timestamp: Date.now(),
        },
        // Unicode in amount (edge case)
        { sender: '0x1', recipient: '0x2', amount: '100.00', timestamp: 123456789 },
      ]

      for (const data of testCases) {
        const encrypted = encryptForViewing(data, viewingKey)
        const decrypted = decryptWithViewing(encrypted, viewingKey)
        expect(decrypted).toEqual(data)
      }
    })

    it('should work with derived viewing keys', () => {
      const masterKey = generateViewingKey('m/0')
      const childKey = deriveViewingKey(masterKey, 'audit/2024')

      const encrypted = encryptForViewing(testData, childKey)
      const decrypted = decryptWithViewing(encrypted, childKey)

      expect(decrypted).toEqual(testData)

      // Master key should NOT be able to decrypt child's data
      expect(() => decryptWithViewing(encrypted, masterKey)).toThrow()
    })
  })

  describe('key derivation', () => {
    it('should derive different encryption keys from different viewing keys', () => {
      const key1 = generateViewingKey('/m/1')
      const key2 = generateViewingKey('/m/2')

      const encrypted1 = encryptForViewing(testData, key1)
      const encrypted2 = encryptForViewing(testData, key2)

      // Different keys should produce different ciphertexts
      // (even though nonces are also different, the point is they can't decrypt each other's data)
      expect(() => decryptWithViewing(encrypted1, key2)).toThrow()
      expect(() => decryptWithViewing(encrypted2, key1)).toThrow()
    })

    it('should use HKDF with domain separation', () => {
      // Same key bytes but different paths should produce different encryption keys
      const key1 = generateViewingKey('/m/1')
      const key2 = { ...key1, path: '/m/2' }

      const encrypted = encryptForViewing(testData, key1)

      // key2 has same raw key but different path, so different derived key
      // Update the hash to bypass the hash check
      const tamperedEncrypted = { ...encrypted, viewingKeyHash: key2.hash as Hash }

      expect(() => decryptWithViewing(tamperedEncrypted, key2)).toThrow()
    })
  })
})
