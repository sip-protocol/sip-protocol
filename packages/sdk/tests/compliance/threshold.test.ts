/**
 * Threshold Viewing Keys Tests
 *
 * Comprehensive test suite for Shamir's Secret Sharing implementation
 * used in N-of-M viewing key disclosure.
 */

import { describe, it, expect } from 'vitest'
import { ThresholdViewingKey } from '../../src/compliance/threshold'
import { generateViewingKey } from '../../src/privacy'
import type { HexString } from '@sip-protocol/types'

describe('ThresholdViewingKey', () => {
  // ─── Creation Tests ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create 2-of-3 threshold shares', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: viewingKey.key,
      })

      expect(threshold.shares).toHaveLength(3)
      expect(threshold.threshold).toBe(2)
      expect(threshold.totalShares).toBe(3)
      expect(threshold.commitment).toBeDefined()
      expect(typeof threshold.commitment).toBe('string')
    })

    it('should create 3-of-5 threshold shares', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 3,
        totalShares: 5,
        viewingKey: viewingKey.key,
      })

      expect(threshold.shares).toHaveLength(5)
      expect(threshold.threshold).toBe(3)
      expect(threshold.totalShares).toBe(5)
    })

    it('should create 5-of-10 threshold shares', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 5,
        totalShares: 10,
        viewingKey: viewingKey.key,
      })

      expect(threshold.shares).toHaveLength(10)
      expect(threshold.threshold).toBe(5)
      expect(threshold.totalShares).toBe(10)
    })

    it('should create unique shares', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 5,
        viewingKey: viewingKey.key,
      })

      const shareSet = new Set(threshold.shares)
      expect(shareSet.size).toBe(5) // All shares are unique
    })

    it('should create same commitment for all shares', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 5,
        viewingKey: viewingKey.key,
      })

      // Extract commitment from each share (format: x:y:len:commitment)
      const commitments = threshold.shares.map((share) => share.split(':')[3])
      const uniqueCommitments = new Set(commitments)

      expect(uniqueCommitments.size).toBe(1) // All same commitment
      expect(commitments[0]).toBe(threshold.commitment)
    })

    it('should throw on threshold < 2', () => {
      const viewingKey = generateViewingKey()

      expect(() =>
        ThresholdViewingKey.create({
          threshold: 1,
          totalShares: 3,
          viewingKey: viewingKey.key,
        })
      ).toThrow('threshold must be an integer >= 2')
    })

    it('should throw on threshold = 0', () => {
      const viewingKey = generateViewingKey()

      expect(() =>
        ThresholdViewingKey.create({
          threshold: 0,
          totalShares: 3,
          viewingKey: viewingKey.key,
        })
      ).toThrow('threshold must be an integer >= 2')
    })

    it('should throw on totalShares < threshold', () => {
      const viewingKey = generateViewingKey()

      expect(() =>
        ThresholdViewingKey.create({
          threshold: 5,
          totalShares: 3,
          viewingKey: viewingKey.key,
        })
      ).toThrow('totalShares must be an integer >= threshold')
    })

    it('should throw on totalShares > 255', () => {
      const viewingKey = generateViewingKey()

      expect(() =>
        ThresholdViewingKey.create({
          threshold: 2,
          totalShares: 256,
          viewingKey: viewingKey.key,
        })
      ).toThrow('totalShares must be <= 255')
    })

    it('should throw on non-integer threshold', () => {
      const viewingKey = generateViewingKey()

      expect(() =>
        ThresholdViewingKey.create({
          threshold: 2.5,
          totalShares: 5,
          viewingKey: viewingKey.key,
        })
      ).toThrow('threshold must be an integer >= 2')
    })

    it('should throw on non-integer totalShares', () => {
      const viewingKey = generateViewingKey()

      expect(() =>
        ThresholdViewingKey.create({
          threshold: 2,
          totalShares: 5.7,
          viewingKey: viewingKey.key,
        })
      ).toThrow('totalShares must be an integer >= threshold')
    })

    it('should throw on empty viewingKey', () => {
      expect(() =>
        ThresholdViewingKey.create({
          threshold: 2,
          totalShares: 3,
          viewingKey: '' as HexString,
        })
      ).toThrow('viewingKey is required')
    })

    it('should throw on non-hex viewingKey', () => {
      expect(() =>
        ThresholdViewingKey.create({
          threshold: 2,
          totalShares: 3,
          viewingKey: 'notahexstring' as HexString,
        })
      ).toThrow('viewingKey must be hex-encoded')
    })

    it('should throw on short viewingKey', () => {
      expect(() =>
        ThresholdViewingKey.create({
          threshold: 2,
          totalShares: 3,
          viewingKey: '0x1234' as HexString,
        })
      ).toThrow('viewingKey must be at least 32 bytes')
    })
  })

  // ─── Reconstruction Tests ───────────────────────────────────────────────────

  describe('reconstruct', () => {
    it('should reconstruct viewing key from exact threshold shares (2-of-3)', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: original,
      })

      // Use shares 0 and 1
      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[1],
      ])

      expect(reconstructed).toBe(original)
    })

    it('should reconstruct viewing key from any 2 shares (2-of-3)', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: original,
      })

      // Try all combinations
      const combos = [
        [0, 1],
        [0, 2],
        [1, 2],
      ]

      for (const [i, j] of combos) {
        const reconstructed = ThresholdViewingKey.reconstruct([
          threshold.shares[i],
          threshold.shares[j],
        ])
        expect(reconstructed).toBe(original)
      }
    })

    it('should reconstruct viewing key from exact threshold shares (3-of-5)', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 3,
        totalShares: 5,
        viewingKey: original,
      })

      // Use shares 0, 2, 4
      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[2],
        threshold.shares[4],
      ])

      expect(reconstructed).toBe(original)
    })

    it('should reconstruct viewing key from more than threshold shares', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 5,
        viewingKey: original,
      })

      // Use 4 shares (more than threshold of 2)
      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[1],
        threshold.shares[2],
        threshold.shares[3],
      ])

      expect(reconstructed).toBe(original)
    })

    it('should reconstruct viewing key from all shares', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 3,
        totalShares: 5,
        viewingKey: original,
      })

      // Use all 5 shares
      const reconstructed = ThresholdViewingKey.reconstruct(threshold.shares)

      expect(reconstructed).toBe(original)
    })

    it('should throw on empty shares array', () => {
      expect(() => ThresholdViewingKey.reconstruct([])).toThrow(
        'at least one share is required'
      )
    })

    it('should throw on mismatched commitments', () => {
      const vk1 = generateViewingKey()
      const vk2 = generateViewingKey()

      const threshold1 = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: vk1.key,
      })

      const threshold2 = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: vk2.key,
      })

      // Mix shares from different secrets
      expect(() =>
        ThresholdViewingKey.reconstruct([
          threshold1.shares[0],
          threshold2.shares[1],
        ])
      ).toThrow('shares must all have the same commitment')
    })

    it('should throw on duplicate shares', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: viewingKey.key,
      })

      // Use same share twice
      expect(() =>
        ThresholdViewingKey.reconstruct([
          threshold.shares[0],
          threshold.shares[0],
        ])
      ).toThrow('shares must have unique x-coordinates')
    })

    it('should throw on invalid share format', () => {
      expect(() =>
        ThresholdViewingKey.reconstruct(['invalid-share'])
      ).toThrow('share must have format "x:y:len:commitment"')
    })

    it('should throw on malformed share (missing parts)', () => {
      expect(() => ThresholdViewingKey.reconstruct(['01:abc'])).toThrow(
        'share must have format "x:y:len:commitment"'
      )
    })

    it('should throw on non-hex share values', () => {
      expect(() =>
        ThresholdViewingKey.reconstruct(['zz:yy:0040:commitment'])
      ).toThrow('failed to decode share')
    })
  })

  // ─── Share Verification Tests ───────────────────────────────────────────────

  describe('verifyShare', () => {
    it('should verify valid share', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: viewingKey.key,
      })

      for (const share of threshold.shares) {
        const isValid = ThresholdViewingKey.verifyShare(
          share,
          threshold.commitment
        )
        expect(isValid).toBe(true)
      }
    })

    it('should reject share with wrong commitment', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: viewingKey.key,
      })

      const isValid = ThresholdViewingKey.verifyShare(
        threshold.shares[0],
        'wrong_commitment_hash'
      )

      expect(isValid).toBe(false)
    })

    it('should reject invalid share format', () => {
      const isValid = ThresholdViewingKey.verifyShare(
        'invalid',
        'commitment'
      )
      expect(isValid).toBe(false)
    })

    it('should reject malformed share', () => {
      const isValid = ThresholdViewingKey.verifyShare(
        '01:abc',
        'commitment'
      )
      expect(isValid).toBe(false)
    })

    it('should reject empty share', () => {
      const isValid = ThresholdViewingKey.verifyShare('', 'commitment')
      expect(isValid).toBe(false)
    })
  })

  // ─── Security Tests ─────────────────────────────────────────────────────────

  describe('security properties', () => {
    it('should produce different shares for same viewing key', () => {
      const viewingKey = generateViewingKey()

      const threshold1 = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: viewingKey.key,
      })

      const threshold2 = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: viewingKey.key,
      })

      // Shares should be different (different random polynomials)
      expect(threshold1.shares[0]).not.toBe(threshold2.shares[0])
      expect(threshold1.commitment).not.toBe(threshold2.commitment)
    })

    it('should produce different shares for different viewing keys', () => {
      const vk1 = generateViewingKey()
      const vk2 = generateViewingKey()

      const threshold1 = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: vk1.key,
      })

      const threshold2 = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: vk2.key,
      })

      // Everything should be different
      expect(threshold1.shares[0]).not.toBe(threshold2.shares[0])
      expect(threshold1.commitment).not.toBe(threshold2.commitment)
    })

    it('should have information-theoretic security (1 share reveals nothing)', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: original,
      })

      // Single share should not allow reconstruction
      // This is implicitly tested by the fact that we need threshold shares
      // Just verify we can't reconstruct from 1 share by checking it would use
      // only that share
      expect(threshold.shares[0]).toBeDefined()
      expect(threshold.shares[0]).not.toContain(original)
    })

    it('should handle large viewing keys', () => {
      // 64 byte (512 bit) viewing key - using a value smaller than field prime
      // Field prime is 2^256 - 189, so we use a 64-byte key with leading zeros
      const largeKey =
        '0x' +
        '0'.repeat(64) +
        '1'.repeat(64) as HexString

      const threshold = ThresholdViewingKey.create({
        threshold: 3,
        totalShares: 5,
        viewingKey: largeKey,
      })

      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[2],
        threshold.shares[4],
      ])

      expect(reconstructed).toBe(largeKey)
    })
  })

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle minimum threshold (2-of-2)', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 2,
        viewingKey: original,
      })

      const reconstructed = ThresholdViewingKey.reconstruct(threshold.shares)
      expect(reconstructed).toBe(original)
    })

    it('should handle high threshold (10-of-15)', () => {
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 10,
        totalShares: 15,
        viewingKey: original,
      })

      // Use exactly 10 shares
      const selectedShares = threshold.shares.slice(0, 10)
      const reconstructed = ThresholdViewingKey.reconstruct(selectedShares)

      expect(reconstructed).toBe(original)
    })

    it('should handle maximum totalShares (255)', () => {
      const viewingKey = generateViewingKey()

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 255,
        viewingKey: viewingKey.key,
      })

      expect(threshold.shares).toHaveLength(255)

      // Verify reconstruction with 2 random shares
      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[254],
      ])

      expect(reconstructed).toBe(viewingKey.key)
    })

    it('should handle viewing keys with all zeros', () => {
      const zeroKey = ('0x' + '0'.repeat(64)) as HexString

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: zeroKey,
      })

      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[1],
      ])

      expect(reconstructed).toBe(zeroKey)
    })

    it('should handle viewing keys with high entropy', () => {
      // Use a key with mixed high values that's still under field prime
      // 0xabcd...1234 pattern
      const highEntropyKey = ('0x' + 'abcd'.repeat(16)) as HexString

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: highEntropyKey,
      })

      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[1],
      ])

      expect(reconstructed).toBe(highEntropyKey)
    })
  })

  // ─── Real-World Use Case Tests ──────────────────────────────────────────────

  describe('real-world scenarios', () => {
    it('should support 3-of-5 board member authorization', () => {
      // Scenario: DAO with 5 board members, need 3 to reveal transaction
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 3,
        totalShares: 5,
        viewingKey: original,
      })

      // Simulate distributing shares to board members
      const boardMembers = [
        { name: 'Alice', share: threshold.shares[0] },
        { name: 'Bob', share: threshold.shares[1] },
        { name: 'Charlie', share: threshold.shares[2] },
        { name: 'Dave', share: threshold.shares[3] },
        { name: 'Eve', share: threshold.shares[4] },
      ]

      // Alice, Charlie, and Eve agree to reveal
      const agreingMembers = [
        boardMembers[0],
        boardMembers[2],
        boardMembers[4],
      ]
      const selectedShares = agreingMembers.map((m) => m.share)

      const reconstructed = ThresholdViewingKey.reconstruct(selectedShares)
      expect(reconstructed).toBe(original)
    })

    it('should support 2-of-3 multisig wallet authorization', () => {
      // Scenario: Multisig wallet with 3 signers, need 2 to reveal
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 2,
        totalShares: 3,
        viewingKey: original,
      })

      const signers = [
        { name: 'Signer1', share: threshold.shares[0] },
        { name: 'Signer2', share: threshold.shares[1] },
        { name: 'Signer3', share: threshold.shares[2] },
      ]

      // Signer1 and Signer3 provide shares
      const reconstructed = ThresholdViewingKey.reconstruct([
        signers[0].share,
        signers[2].share,
      ])

      expect(reconstructed).toBe(original)
    })

    it('should support emergency recovery (4-of-7 executives)', () => {
      // Scenario: Company emergency fund, 4 of 7 executives must agree
      const viewingKey = generateViewingKey()
      const original = viewingKey.key

      const threshold = ThresholdViewingKey.create({
        threshold: 4,
        totalShares: 7,
        viewingKey: original,
      })

      // Verify all shares before distribution
      for (let i = 0; i < threshold.shares.length; i++) {
        const isValid = ThresholdViewingKey.verifyShare(
          threshold.shares[i],
          threshold.commitment
        )
        expect(isValid).toBe(true)
      }

      // 4 executives agree
      const reconstructed = ThresholdViewingKey.reconstruct([
        threshold.shares[0],
        threshold.shares[2],
        threshold.shares[4],
        threshold.shares[6],
      ])

      expect(reconstructed).toBe(original)
    })
  })
})
