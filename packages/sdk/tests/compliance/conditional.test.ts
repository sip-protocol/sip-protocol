/**
 * Tests for ConditionalDisclosure (Time-locked disclosure)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConditionalDisclosure,
  type TimeLockResult,
} from '../../src/compliance/conditional'
import { ValidationError, CryptoError, ErrorCode } from '../../src/errors'

describe('ConditionalDisclosure', () => {
  let disclosure: ConditionalDisclosure

  beforeEach(() => {
    disclosure = new ConditionalDisclosure()
  })

  describe('createTimeLocked', () => {
    it('should create time-locked disclosure with Date', () => {
      const viewingKey = '0x' + '1234'.repeat(16) // 64 hex chars
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      const commitment = '0x' + 'abcd'.repeat(16)

      const result = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      expect(result.encryptedKey).toMatch(/^0x[0-9a-f]+$/)
      expect(result.nonce).toMatch(/^0x[0-9a-f]+$/)
      expect(result.nonce.slice(2).length).toBe(48) // 24 bytes = 48 hex chars
      expect(result.revealAfter).toBeGreaterThan(Date.now() / 1000)
      expect(result.verificationCommitment).toMatch(/^0x[0-9a-f]+$/)
      expect(result.encryptionCommitment).toBe(commitment)
      expect(result.type).toBe('timestamp')
    })

    it('should create time-locked disclosure with block height', () => {
      const viewingKey = '0x' + '5678'.repeat(16)
      const blockHeight = 1000000
      const commitment = '0x' + 'ef01'.repeat(16)

      const result = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: blockHeight,
        commitment,
      })

      expect(result.encryptedKey).toMatch(/^0x[0-9a-f]+$/)
      expect(result.revealAfter).toBe(blockHeight)
      expect(result.type).toBe('blockheight')
    })

    it('should create time-locked disclosure with timestamp in seconds', () => {
      const viewingKey = '0x' + '9abc'.repeat(16)
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 // +1 day
      const commitment = '0x' + 'def0'.repeat(16)

      const result = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureTimestamp,
        commitment,
      })

      expect(result.revealAfter).toBe(futureTimestamp)
      expect(result.type).toBe('blockheight') // Low numbers treated as block heights
    })

    it('should throw error for invalid viewing key format', () => {
      const futureDate = new Date(Date.now() + 86400000)
      const commitment = '0x' + 'abcd'.repeat(16)

      expect(() =>
        disclosure.createTimeLocked({
          viewingKey: 'invalid',
          revealAfter: futureDate,
          commitment,
        })
      ).toThrow(ValidationError)
    })

    it('should throw error for invalid commitment format', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const futureDate = new Date(Date.now() + 86400000)

      expect(() =>
        disclosure.createTimeLocked({
          viewingKey,
          revealAfter: futureDate,
          commitment: 'invalid',
        })
      ).toThrow(ValidationError)
    })

    it('should allow past timestamps (for testing/flexibility)', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const pastDate = new Date(Date.now() - 86400000) // -1 day
      const commitment = '0x' + 'abcd'.repeat(16)

      // Should not throw - past dates allowed for testing
      const result = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: pastDate,
        commitment,
      })

      expect(result.encryptedKey).toBeDefined()
      expect(result.type).toBe('timestamp')

      // Should be immediately unlockable
      const unlocked = disclosure.checkUnlocked(result)
      expect(unlocked.unlocked).toBe(true)
      expect(unlocked.viewingKey).toBe(viewingKey)
    })

    it('should throw error for negative block height', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const commitment = '0x' + 'abcd'.repeat(16)

      expect(() =>
        disclosure.createTimeLocked({
          viewingKey,
          revealAfter: -100,
          commitment,
        })
      ).toThrow(ValidationError)
    })

    it('should create deterministic commitment', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const futureDate = new Date(Date.now() + 86400000)
      const commitment = '0x' + 'abcd'.repeat(16)

      const result1 = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      const result2 = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      // Verification commitments should be the same (deterministic based on key + time)
      expect(result1.verificationCommitment).toBe(result2.verificationCommitment)
      // Encryption commitments should be the same (passed through)
      expect(result1.encryptionCommitment).toBe(result2.encryptionCommitment)
      // But encrypted keys should differ (random nonce)
      expect(result1.encryptedKey).not.toBe(result2.encryptedKey)
    })
  })

  describe('checkUnlocked', () => {
    it('should return unlocked=false before reveal time', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const futureDate = new Date(Date.now() + 86400000) // +1 day
      const commitment = '0x' + 'abcd'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      const result = disclosure.checkUnlocked(timeLock)

      expect(result.unlocked).toBe(false)
      expect(result.viewingKey).toBeUndefined()
    })

    it('should return unlocked=true and decrypt viewing key after reveal time', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const revealTime = new Date('2025-01-01T00:00:00Z') // Fixed time in the past for testing
      const commitment = '0x' + 'abcd'.repeat(16)

      // Create time-lock with a specific reveal time
      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: revealTime,
        commitment,
      })

      // Check with current time after reveal (simulate time has passed)
      const afterReveal = new Date('2025-01-02T00:00:00Z')
      const result = disclosure.checkUnlocked(timeLock, afterReveal)

      expect(result.unlocked).toBe(true)
      expect(result.viewingKey).toBe(viewingKey)
    })

    it('should unlock with custom current time parameter', () => {
      const viewingKey = '0x' + '5678'.repeat(16)
      const revealTime = new Date('2025-01-01T00:00:00Z')
      const commitment = '0x' + 'ef01'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: revealTime,
        commitment,
      })

      // Check with current time before reveal
      const beforeResult = disclosure.checkUnlocked(
        timeLock,
        new Date('2024-12-31T23:00:00Z')
      )
      expect(beforeResult.unlocked).toBe(false)

      // Check with current time after reveal
      const afterResult = disclosure.checkUnlocked(
        timeLock,
        new Date('2025-01-02T00:00:00Z')
      )
      expect(afterResult.unlocked).toBe(true)
      expect(afterResult.viewingKey).toBe(viewingKey)
    })

    it('should unlock with block height', () => {
      const viewingKey = '0x' + '9abc'.repeat(16)
      const blockHeight = 1000
      const commitment = '0x' + 'def0'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: blockHeight,
        commitment,
      })

      // Check before block height
      const beforeResult = disclosure.checkUnlocked(timeLock, 999)
      expect(beforeResult.unlocked).toBe(false)

      // Check at block height
      const atResult = disclosure.checkUnlocked(timeLock, 1000)
      expect(atResult.unlocked).toBe(true)
      expect(atResult.viewingKey).toBe(viewingKey)

      // Check after block height
      const afterResult = disclosure.checkUnlocked(timeLock, 1001)
      expect(afterResult.unlocked).toBe(true)
      expect(afterResult.viewingKey).toBe(viewingKey)
    })

    it('should throw error for invalid encrypted key format', () => {
      const invalidTimeLock: TimeLockResult = {
        encryptedKey: 'invalid',
        nonce: '0x' + '1234'.repeat(12),
        revealAfter: 0,
        verificationCommitment: '0x' + 'abcd'.repeat(16),
        encryptionCommitment: '0x' + 'ef01'.repeat(16),
        type: 'timestamp',
      }

      expect(() => disclosure.checkUnlocked(invalidTimeLock)).toThrow(ValidationError)
    })

    it('should throw error for invalid nonce format', () => {
      const invalidTimeLock: TimeLockResult = {
        encryptedKey: '0x' + '5678'.repeat(16),
        nonce: 'invalid',
        revealAfter: 0,
        verificationCommitment: '0x' + 'abcd'.repeat(16),
        encryptionCommitment: '0x' + 'ef01'.repeat(16),
        type: 'timestamp',
      }

      expect(() => disclosure.checkUnlocked(invalidTimeLock)).toThrow(ValidationError)
    })

    it('should throw error for invalid commitment format', () => {
      const invalidTimeLock: TimeLockResult = {
        encryptedKey: '0x' + '5678'.repeat(16),
        nonce: '0x' + '1234'.repeat(12),
        revealAfter: 0,
        verificationCommitment: 'invalid',
        encryptionCommitment: '0x' + 'ef01'.repeat(16),
        type: 'timestamp',
      }

      expect(() => disclosure.checkUnlocked(invalidTimeLock)).toThrow(ValidationError)
    })
  })

  describe('verifyCommitment', () => {
    it('should verify correct commitment', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const futureDate = new Date(Date.now() + 86400000)
      const commitment = '0x' + 'abcd'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      const isValid = disclosure.verifyCommitment(timeLock, viewingKey)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect viewing key', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const wrongKey = '0x' + '5678'.repeat(16)
      const futureDate = new Date(Date.now() + 86400000)
      const commitment = '0x' + 'abcd'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      const isValid = disclosure.verifyCommitment(timeLock, wrongKey)
      expect(isValid).toBe(false)
    })

    it('should reject tampered commitment', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const futureDate = new Date(Date.now() + 86400000)
      const commitment = '0x' + 'abcd'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: futureDate,
        commitment,
      })

      // Tamper with verification commitment
      const tamperedTimeLock: TimeLockResult = {
        ...timeLock,
        verificationCommitment: '0x' + 'ffff'.repeat(16),
      }

      const isValid = disclosure.verifyCommitment(tamperedTimeLock, viewingKey)
      expect(isValid).toBe(false)
    })

    it('should handle invalid hex strings gracefully', () => {
      const timeLock: TimeLockResult = {
        encryptedKey: '0x1234',
        nonce: '0x5678',
        revealAfter: 1000,
        verificationCommitment: '0x' + 'abcd'.repeat(16),
        encryptionCommitment: '0x' + 'ef01'.repeat(16),
        type: 'timestamp',
      }

      const isValid = disclosure.verifyCommitment(timeLock, 'invalid')
      expect(isValid).toBe(false)
    })
  })

  describe('End-to-End scenarios', () => {
    it('should handle complete time-lock lifecycle', () => {
      // 1. Create time-locked disclosure
      const originalKey = '0x' + 'deadbeef'.repeat(8)
      const futureDate = new Date(Date.now() + 86400000) // +1 day
      const txCommitment = '0x' + '1234567890abcdef'.repeat(4)

      const timeLock = disclosure.createTimeLocked({
        viewingKey: originalKey,
        revealAfter: futureDate,
        commitment: txCommitment,
      })

      // 2. Verify commitment is valid
      expect(disclosure.verifyCommitment(timeLock, originalKey)).toBe(true)

      // 3. Check it's locked before reveal time
      const beforeResult = disclosure.checkUnlocked(timeLock)
      expect(beforeResult.unlocked).toBe(false)

      // 4. Simulate time passing by checking with future date
      const afterReveal = new Date(futureDate.getTime() + 1000)
      const afterResult = disclosure.checkUnlocked(timeLock, afterReveal)
      expect(afterResult.unlocked).toBe(true)
      expect(afterResult.viewingKey).toBe(originalKey)

      // 5. Verify decrypted key is correct
      expect(disclosure.verifyCommitment(timeLock, afterResult.viewingKey!)).toBe(true)
    })

    it('should handle block-height-based disclosure', () => {
      const viewingKey = '0x' + 'cafebabe'.repeat(8)
      const unlockBlock = 500000
      const commitment = '0x' + 'fedcba9876543210'.repeat(4)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: unlockBlock,
        commitment,
      })

      // Before unlock block
      expect(disclosure.checkUnlocked(timeLock, unlockBlock - 1).unlocked).toBe(false)

      // At unlock block
      const result = disclosure.checkUnlocked(timeLock, unlockBlock)
      expect(result.unlocked).toBe(true)
      expect(result.viewingKey).toBe(viewingKey)
    })

    it('should support regulatory compliance scenario', () => {
      // Scenario: Transaction must be auditable after 90 days
      const complianceKey = '0x' + '1111222233334444'.repeat(4)
      const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      const transactionHash = '0x' + 'aaabbbcccdddeeef'.repeat(4)

      // Create time-locked disclosure
      const timeLock = disclosure.createTimeLocked({
        viewingKey: complianceKey,
        revealAfter: ninetyDaysLater,
        commitment: transactionHash,
      })

      // Store timeLock with transaction record
      expect(timeLock).toBeDefined()
      expect(timeLock.encryptionCommitment).toBe(transactionHash)

      // Regulator requests disclosure before 90 days - denied
      const tooEarly = new Date(Date.now() + 89 * 24 * 60 * 60 * 1000)
      expect(disclosure.checkUnlocked(timeLock, tooEarly).unlocked).toBe(false)

      // After 90 days - automatic disclosure
      const afterDeadline = new Date(ninetyDaysLater.getTime() + 1000)
      const unlocked = disclosure.checkUnlocked(timeLock, afterDeadline)
      expect(unlocked.unlocked).toBe(true)
      expect(unlocked.viewingKey).toBe(complianceKey)
    })
  })

  describe('Edge cases', () => {
    it('should handle very long viewing keys', () => {
      const longKey = '0x' + 'a'.repeat(128)
      const futureDate = new Date(Date.now() + 86400000)
      const commitment = '0x' + 'b'.repeat(64)

      const timeLock = disclosure.createTimeLocked({
        viewingKey: longKey,
        revealAfter: futureDate,
        commitment,
      })

      expect(timeLock.encryptedKey).toBeDefined()
    })

    it('should handle minimum valid inputs', () => {
      const minKey = '0x01'
      const futureDate = new Date(Date.now() + 1000)
      const minCommitment = '0x02'

      const timeLock = disclosure.createTimeLocked({
        viewingKey: minKey,
        revealAfter: futureDate,
        commitment: minCommitment,
      })

      expect(timeLock).toBeDefined()
    })

    it('should handle large block heights', () => {
      const viewingKey = '0x' + '1234'.repeat(16)
      const largeBlock = 999999999
      const commitment = '0x' + 'abcd'.repeat(16)

      const timeLock = disclosure.createTimeLocked({
        viewingKey,
        revealAfter: largeBlock,
        commitment,
      })

      expect(timeLock.revealAfter).toBe(largeBlock)
    })
  })
})
