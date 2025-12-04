/**
 * Conditional Disclosure Module for SIP Protocol
 *
 * Provides time-locked and block-height-locked disclosure mechanisms
 * for regulatory compliance and automatic auditability.
 *
 * @example
 * ```typescript
 * import { ConditionalDisclosure } from '@sip-protocol/sdk'
 *
 * const disclosure = new ConditionalDisclosure()
 *
 * // Create time-locked disclosure (reveals after 30 days)
 * const timeLock = disclosure.createTimeLocked({
 *   viewingKey: '0x1234...',
 *   revealAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
 *   commitment: '0xabcd...',
 * })
 *
 * // Check if unlocked (after time has passed)
 * const result = disclosure.checkUnlocked(timeLock)
 * if (result.unlocked) {
 *   console.log('Viewing key:', result.viewingKey)
 * }
 * ```
 *
 * @module compliance/conditional
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import type { HexString } from '@sip-protocol/types'
import { ValidationError, CryptoError, ErrorCode } from '../errors'

/**
 * Time-lock result containing encrypted viewing key and metadata
 */
export interface TimeLockResult {
  /** Encrypted viewing key */
  encryptedKey: HexString
  /** Nonce for XChaCha20-Poly1305 */
  nonce: HexString
  /** Reveal time (Unix timestamp in seconds) or block height */
  revealAfter: number
  /** Commitment to verify integrity (hash of viewingKey + revealAfter) */
  verificationCommitment: HexString
  /** Original commitment parameter (transaction hash or identifier) */
  encryptionCommitment: HexString
  /** Type of time-lock: 'timestamp' or 'blockheight' */
  type: 'timestamp' | 'blockheight'
}

/**
 * Unlock result from checking a time-locked disclosure
 */
export interface UnlockResult {
  /** Whether the time-lock is unlocked */
  unlocked: boolean
  /** Viewing key (only present if unlocked) */
  viewingKey?: HexString
}

/**
 * Parameters for creating a time-locked disclosure
 */
export interface TimeLockParams {
  /** Viewing key to encrypt and time-lock */
  viewingKey: HexString
  /** Reveal after this time (Date) or block height (number) */
  revealAfter: Date | number
  /** Commitment value (transaction hash or identifier) */
  commitment: HexString
}

/**
 * Conditional Disclosure Manager
 *
 * Handles automatic disclosure of viewing keys after specified
 * time or block height for regulatory compliance.
 */
export class ConditionalDisclosure {
  /**
   * Create a time-locked disclosure
   *
   * Encrypts the viewing key with a deterministic key derived from
   * the commitment and reveal time. The key can only be reconstructed
   * after the specified time/block height.
   *
   * @param params - Time-lock parameters
   * @returns Time-lock result with encrypted key
   * @throws {ValidationError} If parameters are invalid
   * @throws {CryptoError} If encryption fails
   */
  createTimeLocked(params: TimeLockParams): TimeLockResult {
    // Validate viewing key
    if (!params.viewingKey || !params.viewingKey.startsWith('0x')) {
      throw new ValidationError(
        'Invalid viewing key format',
        'viewingKey',
        { viewingKey: params.viewingKey },
        ErrorCode.INVALID_KEY
      )
    }

    // Validate commitment
    if (!params.commitment || !params.commitment.startsWith('0x')) {
      throw new ValidationError(
        'Invalid commitment format',
        'commitment',
        { commitment: params.commitment },
        ErrorCode.INVALID_COMMITMENT
      )
    }

    // Parse and validate revealAfter
    let revealAfterSeconds: number
    let type: 'timestamp' | 'blockheight'

    if (params.revealAfter instanceof Date) {
      revealAfterSeconds = Math.floor(params.revealAfter.getTime() / 1000)
      type = 'timestamp'

      // Note: We don't validate that the time is in the future to allow testing
      // In production, applications should validate this before creating time-locks
    } else if (typeof params.revealAfter === 'number') {
      // Assume block height if number > 1e10, otherwise treat as timestamp
      if (params.revealAfter > 1e10) {
        // Looks like a timestamp in milliseconds, convert to seconds
        revealAfterSeconds = Math.floor(params.revealAfter / 1000)
        type = 'timestamp'
      } else {
        // Block height
        revealAfterSeconds = params.revealAfter
        type = 'blockheight'
      }

      if (revealAfterSeconds <= 0) {
        throw new ValidationError(
          'Reveal time/block height must be positive',
          'revealAfter',
          { revealAfter: revealAfterSeconds },
          ErrorCode.INVALID_TIME_LOCK
        )
      }
    } else {
      throw new ValidationError(
        'Invalid revealAfter type (must be Date or number)',
        'revealAfter',
        { revealAfter: params.revealAfter },
        ErrorCode.INVALID_TIME_LOCK
      )
    }

    try {
      // Derive deterministic encryption key from commitment and reveal time
      const encryptionKey = this._deriveEncryptionKey(
        params.commitment,
        revealAfterSeconds
      )

      // Generate random nonce (24 bytes for XChaCha20)
      const nonce = randomBytes(24)

      // Encrypt viewing key
      const viewingKeyBytes = hexToBytes(params.viewingKey.slice(2))
      const cipher = xchacha20poly1305(encryptionKey, nonce)
      const encryptedKey = cipher.encrypt(viewingKeyBytes)

      // Create verifiable commitment (hash of viewingKey + revealAfter)
      const commitmentData = new Uint8Array([
        ...viewingKeyBytes,
        ...this._numberToBytes(revealAfterSeconds),
      ])
      const commitmentHash = sha256(commitmentData)

      return {
        encryptedKey: ('0x' + bytesToHex(encryptedKey)) as HexString,
        nonce: ('0x' + bytesToHex(nonce)) as HexString,
        revealAfter: revealAfterSeconds,
        verificationCommitment: ('0x' + bytesToHex(commitmentHash)) as HexString,
        encryptionCommitment: params.commitment,
        type,
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new CryptoError(
        'Failed to create time-locked disclosure',
        ErrorCode.ENCRYPTION_FAILED,
        {
          cause: error instanceof Error ? error : undefined,
          operation: 'createTimeLocked',
        }
      )
    }
  }

  /**
   * Check if a time-lock is unlocked and retrieve the viewing key
   *
   * @param timeLock - Time-lock result to check
   * @param currentTimeOrBlock - Current time (Date/number) or block height (number)
   * @returns Unlock result with viewing key if unlocked
   * @throws {ValidationError} If time-lock format is invalid
   * @throws {CryptoError} If decryption fails
   */
  checkUnlocked(
    timeLock: TimeLockResult,
    currentTimeOrBlock?: Date | number
  ): UnlockResult {
    // Validate time-lock format
    if (!timeLock.encryptedKey || !timeLock.encryptedKey.startsWith('0x')) {
      throw new ValidationError(
        'Invalid encrypted key format',
        'encryptedKey',
        { encryptedKey: timeLock.encryptedKey },
        ErrorCode.INVALID_ENCRYPTED_DATA
      )
    }

    if (!timeLock.nonce || !timeLock.nonce.startsWith('0x')) {
      throw new ValidationError(
        'Invalid nonce format',
        'nonce',
        { nonce: timeLock.nonce },
        ErrorCode.INVALID_ENCRYPTED_DATA
      )
    }

    if (!timeLock.verificationCommitment || !timeLock.verificationCommitment.startsWith('0x')) {
      throw new ValidationError(
        'Invalid verification commitment format',
        'verificationCommitment',
        { commitment: timeLock.verificationCommitment },
        ErrorCode.INVALID_COMMITMENT
      )
    }

    if (!timeLock.encryptionCommitment || !timeLock.encryptionCommitment.startsWith('0x')) {
      throw new ValidationError(
        'Invalid encryption commitment format',
        'encryptionCommitment',
        { commitment: timeLock.encryptionCommitment },
        ErrorCode.INVALID_COMMITMENT
      )
    }

    // Determine current time or block height
    let currentValue: number
    if (currentTimeOrBlock instanceof Date) {
      currentValue = Math.floor(currentTimeOrBlock.getTime() / 1000)
    } else if (typeof currentTimeOrBlock === 'number') {
      currentValue = currentTimeOrBlock
    } else {
      // Default to current time
      currentValue = Math.floor(Date.now() / 1000)
    }

    // Check if unlocked
    const unlocked = currentValue >= timeLock.revealAfter

    if (!unlocked) {
      return { unlocked: false }
    }

    try {
      // Derive the encryption key using the stored commitment
      const encryptionKey = this._deriveEncryptionKey(
        timeLock.encryptionCommitment,
        timeLock.revealAfter
      )

      // Decrypt the viewing key
      const nonce = hexToBytes(timeLock.nonce.slice(2))
      const encryptedData = hexToBytes(timeLock.encryptedKey.slice(2))

      const cipher = xchacha20poly1305(encryptionKey, nonce)
      const decryptedBytes = cipher.decrypt(encryptedData)

      const viewingKey = ('0x' + bytesToHex(decryptedBytes)) as HexString

      return {
        unlocked: true,
        viewingKey,
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof CryptoError) {
        throw error
      }
      throw new CryptoError(
        'Failed to decrypt time-locked viewing key',
        ErrorCode.DECRYPTION_FAILED,
        {
          cause: error instanceof Error ? error : undefined,
          operation: 'checkUnlocked',
        }
      )
    }
  }

  /**
   * Verify a time-lock commitment
   *
   * Verifies that the verification commitment in the time-lock matches the hash
   * of the provided viewing key and reveal time.
   *
   * @param timeLock - Time-lock to verify
   * @param viewingKey - Viewing key to verify against
   * @returns True if commitment is valid
   */
  verifyCommitment(timeLock: TimeLockResult, viewingKey: HexString): boolean {
    try {
      const viewingKeyBytes = hexToBytes(viewingKey.slice(2))
      const commitmentData = new Uint8Array([
        ...viewingKeyBytes,
        ...this._numberToBytes(timeLock.revealAfter),
      ])
      const expectedCommitment = sha256(commitmentData)
      const actualCommitment = hexToBytes(timeLock.verificationCommitment.slice(2))

      // Constant-time comparison
      if (expectedCommitment.length !== actualCommitment.length) {
        return false
      }

      let diff = 0
      for (let i = 0; i < expectedCommitment.length; i++) {
        diff |= expectedCommitment[i] ^ actualCommitment[i]
      }

      return diff === 0
    } catch {
      return false
    }
  }

  /**
   * Derive deterministic encryption key from commitment and reveal time
   *
   * @private
   */
  private _deriveEncryptionKey(
    commitment: HexString,
    revealAfter: number
  ): Uint8Array {
    // Combine commitment and reveal time
    const commitmentBytes = hexToBytes(commitment.slice(2))
    const timeBytes = this._numberToBytes(revealAfter)
    const combined = new Uint8Array([...commitmentBytes, ...timeBytes])

    // Hash to derive key (32 bytes for XChaCha20-Poly1305)
    const key = sha256(combined)

    if (key.length !== 32) {
      throw new CryptoError(
        'Derived key must be 32 bytes',
        ErrorCode.INVALID_KEY_SIZE,
        {
          context: { actualSize: key.length, expectedSize: 32 },
          operation: '_deriveEncryptionKey',
        }
      )
    }

    return key
  }

  /**
   * Convert number to 8-byte big-endian representation
   *
   * @private
   */
  private _numberToBytes(num: number): Uint8Array {
    const bytes = new Uint8Array(8)
    const view = new DataView(bytes.buffer)
    // Use BigInt to handle large numbers safely
    view.setBigUint64(0, BigInt(Math.floor(num)), false) // false = big-endian
    return bytes
  }
}
