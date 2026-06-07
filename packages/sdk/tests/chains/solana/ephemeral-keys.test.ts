/**
 * Solana Ephemeral Keypair Tests
 *
 * Tests for ephemeral keypair generation and management.
 */

import { describe, it, expect } from 'vitest'
import {
  generateEphemeralKeypair,
  generateManagedEphemeralKeypair,
  batchGenerateEphemeralKeypairs,
  batchGenerateManagedEphemeralKeypairs,
  disposeEphemeralKeypairs,
  wipeEphemeralPrivateKey,
} from '../../../src/chains/solana/ephemeral-keys'

describe('Solana Ephemeral Keypair Management', () => {
  // ─── Basic Generation ─────────────────────────────────────────────────────

  describe('generateEphemeralKeypair', () => {
    it('should generate valid ephemeral keypair', () => {
      const keypair = generateEphemeralKeypair()

      expect(keypair).toHaveProperty('privateKey')
      expect(keypair).toHaveProperty('publicKey')
      expect(keypair).toHaveProperty('publicKeyBase58')

      // Validate hex format
      expect(keypair.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(keypair.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)

      // Validate base58 format (32-44 chars)
      expect(keypair.publicKeyBase58.length).toBeGreaterThanOrEqual(32)
      expect(keypair.publicKeyBase58.length).toBeLessThanOrEqual(44)
    })

    it('should generate unique keypairs', () => {
      const keypair1 = generateEphemeralKeypair()
      const keypair2 = generateEphemeralKeypair()

      expect(keypair1.privateKey).not.toBe(keypair2.privateKey)
      expect(keypair1.publicKey).not.toBe(keypair2.publicKey)
    })
  })

  // ─── Managed Keypairs ─────────────────────────────────────────────────────

  describe('generateManagedEphemeralKeypair', () => {
    it('should create managed keypair', () => {
      const managed = generateManagedEphemeralKeypair()

      expect(managed.isDisposed).toBe(false)
      expect(managed.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(managed.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should dispose keypair', () => {
      const managed = generateManagedEphemeralKeypair()

      managed.dispose()

      expect(managed.isDisposed).toBe(true)
    })

    it('should throw when accessing disposed private key', () => {
      const managed = generateManagedEphemeralKeypair()
      managed.dispose()

      expect(() => managed.privateKey).toThrow('disposed')
    })

    it('should allow multiple dispose calls', () => {
      const managed = generateManagedEphemeralKeypair()

      managed.dispose()
      managed.dispose() // Should not throw

      expect(managed.isDisposed).toBe(true)
    })
  })

  // ─── Batch Generation ─────────────────────────────────────────────────────

  describe('batchGenerateEphemeralKeypairs', () => {
    it('should generate specified count', () => {
      const keypairs = batchGenerateEphemeralKeypairs({ count: 5 })

      expect(keypairs).toHaveLength(5)
      keypairs.forEach(kp => {
        expect(kp.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      })
    })

    it('should generate unique keypairs in batch', () => {
      const keypairs = batchGenerateEphemeralKeypairs({ count: 10 })
      const privateKeys = keypairs.map(kp => kp.privateKey)
      const uniqueKeys = new Set(privateKeys)

      expect(uniqueKeys.size).toBe(10)
    })

    it('should throw for invalid count', () => {
      expect(() => batchGenerateEphemeralKeypairs({ count: 0 }))
        .toThrow('positive integer')

      expect(() => batchGenerateEphemeralKeypairs({ count: -1 }))
        .toThrow('positive integer')

      expect(() => batchGenerateEphemeralKeypairs({ count: 1.5 }))
        .toThrow('positive integer')
    })

    it('should throw for count exceeding limit', () => {
      expect(() => batchGenerateEphemeralKeypairs({ count: 1001 }))
        .toThrow('cannot exceed 1000')
    })

    it('should support entropy mixing option', () => {
      // With entropy mixing (default)
      const withMixing = batchGenerateEphemeralKeypairs({ count: 3, entropyMixing: true })
      expect(withMixing).toHaveLength(3)

      // Without entropy mixing
      const withoutMixing = batchGenerateEphemeralKeypairs({ count: 3, entropyMixing: false })
      expect(withoutMixing).toHaveLength(3)
    })
  })

  describe('batchGenerateManagedEphemeralKeypairs', () => {
    it('should generate managed keypairs in batch', () => {
      const managed = batchGenerateManagedEphemeralKeypairs({ count: 5 })

      expect(managed).toHaveLength(5)
      managed.forEach(kp => {
        expect(kp.isDisposed).toBe(false)
        expect(typeof kp.dispose).toBe('function')
      })
    })

    it('should throw for invalid count', () => {
      expect(() => batchGenerateManagedEphemeralKeypairs({ count: 0 }))
        .toThrow('positive integer')
    })
  })

  // ─── Disposal Utilities ───────────────────────────────────────────────────

  describe('disposeEphemeralKeypairs', () => {
    it('should dispose all keypairs', () => {
      const keypairs = batchGenerateManagedEphemeralKeypairs({ count: 5 })

      disposeEphemeralKeypairs(keypairs)

      keypairs.forEach(kp => {
        expect(kp.isDisposed).toBe(true)
      })
    })

    it('should handle empty array', () => {
      expect(() => disposeEphemeralKeypairs([])).not.toThrow()
    })

    it('should handle already disposed keypairs', () => {
      const keypairs = batchGenerateManagedEphemeralKeypairs({ count: 3 })
      keypairs[0].dispose()
      keypairs[2].dispose()

      expect(() => disposeEphemeralKeypairs(keypairs)).not.toThrow()
    })
  })

  describe('wipeEphemeralPrivateKey', () => {
    it('should wipe private key hex', () => {
      const keypair = generateEphemeralKeypair()

      // Should not throw
      expect(() => wipeEphemeralPrivateKey(keypair.privateKey)).not.toThrow()
    })
  })

  // ─── Security Properties ──────────────────────────────────────────────────

  describe('Security Properties', () => {
    it('should generate cryptographically random keypairs', () => {
      // Generate many keypairs and check distribution
      const keypairs = batchGenerateEphemeralKeypairs({ count: 100 })
      const firstBytes = keypairs.map(kp => parseInt(kp.privateKey.slice(2, 4), 16))

      // First bytes should have reasonable distribution (not all same)
      const uniqueFirstBytes = new Set(firstBytes)
      expect(uniqueFirstBytes.size).toBeGreaterThan(10)
    })

    it('should not leak private key after dispose', () => {
      const managed = generateManagedEphemeralKeypair()
      const publicKey = managed.publicKey // Save public key reference

      managed.dispose()

      // Private key should be inaccessible
      expect(() => managed.privateKey).toThrow()

      // But public key is still accessible (it's not sensitive)
      expect(managed.publicKey).toBe(publicKey)
    })

    it('should use entropy mixing by default', () => {
      // Verify batch generation works with default options
      const keypairs = batchGenerateEphemeralKeypairs({ count: 5 })
      expect(keypairs).toHaveLength(5)
    })
  })
})
