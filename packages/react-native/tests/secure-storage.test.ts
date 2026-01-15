/**
 * Secure Storage Tests
 *
 * Tests for the SecureStorage API using memory fallback.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SecureStorage } from '../src/storage/secure-storage'

describe('SecureStorage', () => {
  beforeEach(async () => {
    // Clear storage before each test
    await SecureStorage.clearAll({ backend: 'memory' })
  })

  describe('key operations', () => {
    it('should store and retrieve a viewing key', async () => {
      const testKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      await SecureStorage.setViewingKey('test-wallet', testKey, { backend: 'memory' })
      const retrieved = await SecureStorage.getViewingKey('test-wallet', { backend: 'memory' })

      expect(retrieved).toBe(testKey)
    })

    it('should store and retrieve a spending key', async () => {
      const testKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      await SecureStorage.setSpendingKey('test-wallet', testKey, { backend: 'memory' })
      const retrieved = await SecureStorage.getSpendingKey('test-wallet', { backend: 'memory' })

      expect(retrieved).toBe(testKey)
    })

    it('should store and retrieve a meta address', async () => {
      const testMeta = 'sip:solana:0x123:0x456'

      await SecureStorage.setMetaAddress('test-wallet', testMeta, { backend: 'memory' })
      const retrieved = await SecureStorage.getMetaAddress('test-wallet', { backend: 'memory' })

      expect(retrieved).toBe(testMeta)
    })

    it('should return null for non-existent keys', async () => {
      const retrieved = await SecureStorage.getViewingKey('non-existent', { backend: 'memory' })
      expect(retrieved).toBeNull()
    })

    it('should delete keys', async () => {
      const testKey = '0x123'

      await SecureStorage.setViewingKey('test-wallet', testKey, { backend: 'memory' })
      await SecureStorage.deleteViewingKey('test-wallet', { backend: 'memory' })

      const retrieved = await SecureStorage.getViewingKey('test-wallet', { backend: 'memory' })
      expect(retrieved).toBeNull()
    })
  })

  describe('key isolation', () => {
    it('should store different key types separately', async () => {
      const spendingKey = '0xspending'
      const viewingKey = '0xviewing'
      const metaAddress = 'sip:solana:...'

      await SecureStorage.setSpendingKey('wallet-1', spendingKey, { backend: 'memory' })
      await SecureStorage.setViewingKey('wallet-1', viewingKey, { backend: 'memory' })
      await SecureStorage.setMetaAddress('wallet-1', metaAddress, { backend: 'memory' })

      expect(await SecureStorage.getSpendingKey('wallet-1', { backend: 'memory' })).toBe(spendingKey)
      expect(await SecureStorage.getViewingKey('wallet-1', { backend: 'memory' })).toBe(viewingKey)
      expect(await SecureStorage.getMetaAddress('wallet-1', { backend: 'memory' })).toBe(metaAddress)
    })

    it('should store keys for different wallets separately', async () => {
      const key1 = '0xkey1'
      const key2 = '0xkey2'

      await SecureStorage.setViewingKey('wallet-1', key1, { backend: 'memory' })
      await SecureStorage.setViewingKey('wallet-2', key2, { backend: 'memory' })

      expect(await SecureStorage.getViewingKey('wallet-1', { backend: 'memory' })).toBe(key1)
      expect(await SecureStorage.getViewingKey('wallet-2', { backend: 'memory' })).toBe(key2)
    })
  })

  describe('clearAll', () => {
    it('should clear all stored keys', async () => {
      await SecureStorage.setViewingKey('wallet-1', '0x1', { backend: 'memory' })
      await SecureStorage.setSpendingKey('wallet-2', '0x2', { backend: 'memory' })

      await SecureStorage.clearAll({ backend: 'memory' })

      expect(await SecureStorage.getViewingKey('wallet-1', { backend: 'memory' })).toBeNull()
      expect(await SecureStorage.getSpendingKey('wallet-2', { backend: 'memory' })).toBeNull()
    })
  })

  describe('availability', () => {
    it('should report availability', () => {
      // In test environment, keychain is not available
      expect(typeof SecureStorage.isAvailable()).toBe('boolean')
    })

    it('should report biometrics support', async () => {
      const support = await SecureStorage.getSupportedBiometrics()

      expect(support).toHaveProperty('available')
      expect(support).toHaveProperty('biometryType')
      expect(['FaceID', 'TouchID', 'Fingerprint', 'None']).toContain(support.biometryType)
    })
  })
})
