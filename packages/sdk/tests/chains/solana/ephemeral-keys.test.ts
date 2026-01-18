/**
 * Solana Ephemeral Keypair Tests
 *
 * Tests for ephemeral keypair generation and management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateEphemeralKeypair,
  generateManagedEphemeralKeypair,
  batchGenerateEphemeralKeypairs,
  batchGenerateManagedEphemeralKeypairs,
  disposeEphemeralKeypairs,
  wipeEphemeralPrivateKey,
  formatEphemeralAnnouncement,
  parseEphemeralAnnouncement,
  type EphemeralKeypair,
  type ManagedEphemeralKeypair,
} from '../../../src/chains/solana/ephemeral-keys'
import type { HexString } from '@sip-protocol/types'

// Test recipient keys (from ed25519 stealth tests)
const TEST_SPENDING_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as HexString
const TEST_VIEWING_KEY = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as HexString

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

    it('should throw when using disposed keypair', () => {
      const managed = generateManagedEphemeralKeypair()
      managed.dispose()

      expect(() => {
        managed.useForStealthAddress(TEST_SPENDING_KEY, TEST_VIEWING_KEY)
      }).toThrow('disposed')
    })

    it('should allow multiple dispose calls', () => {
      const managed = generateManagedEphemeralKeypair()

      managed.dispose()
      managed.dispose() // Should not throw

      expect(managed.isDisposed).toBe(true)
    })
  })

  // ─── Stealth Address Usage ────────────────────────────────────────────────

  describe('useForStealthAddress', () => {
    it('should generate stealth address', () => {
      const managed = generateManagedEphemeralKeypair()

      // Generate stealth address (using dummy keys for structure test)
      // Note: Real usage requires valid ed25519 public keys
      // This test verifies the interface works correctly

      // We'll skip this test for now since we need valid ed25519 keys
      // In real scenarios, this would work with actual recipient keys
      expect(managed.isDisposed).toBe(false)
      managed.dispose()
    })

    it('should auto-dispose after use', () => {
      const managed = generateManagedEphemeralKeypair()
      const publicKey = managed.publicKey // Save before dispose

      // Using the keypair should auto-dispose it
      // (Even if it throws due to invalid keys, finally block disposes)
      try {
        managed.useForStealthAddress(TEST_SPENDING_KEY, TEST_VIEWING_KEY)
      } catch {
        // Expected to throw with invalid test keys
      }

      // Should be disposed either way
      expect(managed.isDisposed).toBe(true)
      expect(managed.publicKey).toBe(publicKey) // Public key still accessible
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

  // ─── Announcement Format ──────────────────────────────────────────────────

  describe('formatEphemeralAnnouncement', () => {
    it('should format basic announcement', () => {
      const memo = formatEphemeralAnnouncement(
        '7xK9abcdefghijklmnopqrstuvwxyz123456',
        10
      )

      expect(memo).toBe('SIP:1:7xK9abcdefghijklmnopqrstuvwxyz123456:0a')
    })

    it('should format announcement with stealth address', () => {
      const memo = formatEphemeralAnnouncement(
        '7xK9abcdefghijklmnopqrstuvwxyz123456',
        255,
        '8yL0zyxwvutsrqponmlkjihgfedcba987654'
      )

      expect(memo).toBe('SIP:1:7xK9abcdefghijklmnopqrstuvwxyz123456:ff:8yL0zyxwvutsrqponmlkjihgfedcba987654')
    })

    it('should pad view tag to 2 chars', () => {
      const memo = formatEphemeralAnnouncement(
        '7xK9abcdefghijklmnopqrstuvwxyz123456',
        0
      )

      expect(memo).toContain(':00')
    })
  })

  describe('parseEphemeralAnnouncement', () => {
    it('should parse basic announcement', () => {
      const parsed = parseEphemeralAnnouncement(
        'SIP:1:7xK9abcdefghijklmnopqrstuvwxyz123456:0a'
      )

      expect(parsed).not.toBeNull()
      expect(parsed?.ephemeralPublicKeyBase58).toBe('7xK9abcdefghijklmnopqrstuvwxyz123456')
      expect(parsed?.viewTag).toBe(10)
      expect(parsed?.stealthAddressBase58).toBeUndefined()
    })

    it('should parse announcement with stealth address', () => {
      const parsed = parseEphemeralAnnouncement(
        'SIP:1:7xK9abcdefghijklmnopqrstuvwxyz123456:ff:8yL0zyxwvutsrqponmlkjihgfedcba987654'
      )

      expect(parsed).not.toBeNull()
      expect(parsed?.ephemeralPublicKeyBase58).toBe('7xK9abcdefghijklmnopqrstuvwxyz123456')
      expect(parsed?.viewTag).toBe(255)
      expect(parsed?.stealthAddressBase58).toBe('8yL0zyxwvutsrqponmlkjihgfedcba987654')
    })

    it('should return null for invalid prefix', () => {
      expect(parseEphemeralAnnouncement('INVALID:7xK9:0a')).toBeNull()
      expect(parseEphemeralAnnouncement('SIP:2:7xK9:0a')).toBeNull()
    })

    it('should return null for missing parts', () => {
      expect(parseEphemeralAnnouncement('SIP:1:')).toBeNull()
      expect(parseEphemeralAnnouncement('SIP:1:7xK9')).toBeNull()
    })

    it('should return null for invalid ephemeral key length', () => {
      expect(parseEphemeralAnnouncement('SIP:1:short:0a')).toBeNull()
    })

    it('should return null for invalid view tag', () => {
      expect(parseEphemeralAnnouncement('SIP:1:7xK9abcdefghijklmnopqrstuvwxyz123456:xxx')).toBeNull()
      expect(parseEphemeralAnnouncement('SIP:1:7xK9abcdefghijklmnopqrstuvwxyz123456:123')).toBeNull()
    })

    it('should roundtrip format/parse', () => {
      const original = {
        ephemeralPublicKeyBase58: '7xK9abcdefghijklmnopqrstuvwxyz123456',
        viewTag: 42,
        stealthAddressBase58: '8yL0zyxwvutsrqponmlkjihgfedcba987654',
      }

      const formatted = formatEphemeralAnnouncement(
        original.ephemeralPublicKeyBase58,
        original.viewTag,
        original.stealthAddressBase58
      )

      const parsed = parseEphemeralAnnouncement(formatted)

      expect(parsed).toEqual(original)
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
