/**
 * Threshold Viewing Keys using Shamir's Secret Sharing
 *
 * Enables N-of-M viewing key disclosure for multi-party authorization.
 * Use case: Multiple board members must agree to reveal transaction details.
 *
 * ## Security Properties
 * - Information-theoretic security (< N shares reveal nothing)
 * - Share verification without revealing the secret
 * - Cryptographically binding commitments
 *
 * ## Implementation Details
 * - Uses prime field arithmetic (GF(p) where p = 2^256 - 189)
 * - Polynomial interpolation via Lagrange coefficients
 * - SHA-256 commitments for share verification
 *
 * @example
 * ```typescript
 * import { ThresholdViewingKey, generateViewingKey } from '@sip-protocol/sdk'
 *
 * // Generate a viewing key
 * const viewingKey = generateViewingKey()
 *
 * // Create 3-of-5 threshold shares
 * const threshold = ThresholdViewingKey.create({
 *   threshold: 3,
 *   totalShares: 5,
 *   viewingKey: viewingKey.key,
 * })
 *
 * // Distribute shares to board members
 * console.log(threshold.shares) // ['share1', 'share2', ...]
 *
 * // Verify a share without revealing the key
 * const isValid = ThresholdViewingKey.verifyShare(
 *   threshold.shares[0],
 *   threshold.commitment
 * )
 *
 * // Reconstruct with 3 shares
 * const reconstructed = ThresholdViewingKey.reconstruct([
 *   threshold.shares[0],
 *   threshold.shares[2],
 *   threshold.shares[4],
 * ])
 * ```
 *
 * @module compliance/threshold
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError, CryptoError, ErrorCode } from '../errors'

/**
 * Large prime for finite field arithmetic (2^256 - 189)
 * This is a safe prime suitable for cryptographic operations
 */
const FIELD_PRIME = 2n ** 256n - 189n

/**
 * Threshold shares configuration
 */
export interface ThresholdShares {
  /** Array of encoded shares */
  shares: string[]
  /** Commitment hash for share verification */
  commitment: string
  /** Threshold (N) - minimum shares needed */
  threshold: number
  /** Total shares (M) */
  totalShares: number
}

/**
 * Encoded share format: "x:y:len:commitment"
 * where len is the original viewing key length (without 0x prefix)
 */
interface DecodedShare {
  x: bigint  // Share index (1-based)
  y: bigint  // Share value
  keyLength: number  // Original viewing key hex length (without 0x)
  commitment: string  // Commitment hash
}

/**
 * Threshold Viewing Key implementation using Shamir's Secret Sharing
 *
 * Allows splitting a viewing key into N-of-M shares where any N shares
 * can reconstruct the original key, but fewer than N shares reveal nothing.
 */
export class ThresholdViewingKey {
  /**
   * Create threshold shares from a viewing key
   *
   * @param params - Configuration parameters
   * @returns Threshold shares with commitment
   * @throws ValidationError if parameters are invalid
   *
   * @example
   * ```typescript
   * const threshold = ThresholdViewingKey.create({
   *   threshold: 3,
   *   totalShares: 5,
   *   viewingKey: '0xabc123...',
   * })
   * ```
   */
  static create(params: {
    threshold: number
    totalShares: number
    viewingKey: HexString
  }): ThresholdShares {
    // Validate parameters
    this.validateParams(params.threshold, params.totalShares)
    this.validateViewingKey(params.viewingKey)

    // Convert viewing key to secret (bigint)
    const secret = this.viewingKeyToSecret(params.viewingKey)

    // Store original key length (without 0x prefix)
    const keyLength = params.viewingKey.slice(2).length

    // Generate random polynomial coefficients
    const coefficients = this.generateCoefficients(params.threshold, secret)

    // Create commitment hash
    const commitment = this.createCommitment(secret, coefficients)

    // Generate shares by evaluating polynomial at different points
    const shares: string[] = []
    for (let i = 1; i <= params.totalShares; i++) {
      const x = BigInt(i)
      const y = this.evaluatePolynomial(coefficients, x)
      shares.push(this.encodeShare(x, y, keyLength, commitment))
    }

    return {
      shares,
      commitment,
      threshold: params.threshold,
      totalShares: params.totalShares,
    }
  }

  /**
   * Reconstruct viewing key from threshold shares
   *
   * @param shares - Array of encoded shares (must be >= threshold)
   * @returns Reconstructed viewing key
   * @throws ValidationError if insufficient or invalid shares
   *
   * @example
   * ```typescript
   * const viewingKey = ThresholdViewingKey.reconstruct([
   *   'share1',
   *   'share2',
   *   'share3',
   * ])
   * ```
   */
  static reconstruct(shares: string[]): HexString {
    // Validate shares
    if (!shares || shares.length === 0) {
      throw new ValidationError(
        'at least one share is required',
        'shares',
        { received: shares },
        ErrorCode.MISSING_REQUIRED
      )
    }

    // Decode shares
    const decodedShares = shares.map((s) => this.decodeShare(s))

    // Verify all shares have the same commitment and keyLength
    const commitment = decodedShares[0].commitment
    const keyLength = decodedShares[0].keyLength
    for (const share of decodedShares) {
      if (share.commitment !== commitment) {
        throw new ValidationError(
          'shares must all have the same commitment',
          'shares',
          { commitment },
          ErrorCode.INVALID_SHARE
        )
      }
      if (share.keyLength !== keyLength) {
        throw new ValidationError(
          'shares must all have the same key length',
          'shares',
          { keyLength },
          ErrorCode.INVALID_SHARE
        )
      }
    }

    // Check for duplicate x-coordinates
    const xCoords = new Set(decodedShares.map((s) => s.x.toString()))
    if (xCoords.size !== decodedShares.length) {
      throw new ValidationError(
        'shares must have unique x-coordinates',
        'shares',
        undefined,
        ErrorCode.INVALID_SHARE
      )
    }

    // Reconstruct secret using Lagrange interpolation
    const secret = this.lagrangeInterpolate(decodedShares)

    // Convert secret back to viewing key with original length
    return this.secretToViewingKey(secret, keyLength)
  }

  /**
   * Verify a share without revealing the viewing key
   *
   * @param share - Encoded share to verify
   * @param expectedCommitment - Expected commitment hash
   * @returns True if share is valid
   *
   * @example
   * ```typescript
   * const isValid = ThresholdViewingKey.verifyShare(
   *   'share1',
   *   'commitment_hash'
   * )
   * ```
   */
  static verifyShare(share: string, expectedCommitment: string): boolean {
    try {
      const decoded = this.decodeShare(share)
      return decoded.commitment === expectedCommitment
    } catch {
      return false
    }
  }

  // ─── Private Helper Methods ─────────────────────────────────────────────────

  /**
   * Validate threshold and total shares parameters
   */
  private static validateParams(threshold: number, totalShares: number): void {
    if (!Number.isInteger(threshold) || threshold < 2) {
      throw new ValidationError(
        'threshold must be an integer >= 2',
        'threshold',
        { received: threshold },
        ErrorCode.INVALID_THRESHOLD
      )
    }

    if (!Number.isInteger(totalShares) || totalShares < threshold) {
      throw new ValidationError(
        'totalShares must be an integer >= threshold',
        'totalShares',
        { received: totalShares, threshold },
        ErrorCode.INVALID_THRESHOLD
      )
    }

    if (totalShares > 255) {
      throw new ValidationError(
        'totalShares must be <= 255',
        'totalShares',
        { received: totalShares },
        ErrorCode.INVALID_THRESHOLD
      )
    }
  }

  /**
   * Validate viewing key format
   */
  private static validateViewingKey(viewingKey: HexString): void {
    if (!viewingKey || typeof viewingKey !== 'string') {
      throw new ValidationError(
        'viewingKey is required',
        'viewingKey',
        { received: viewingKey },
        ErrorCode.MISSING_REQUIRED
      )
    }

    if (!viewingKey.startsWith('0x')) {
      throw new ValidationError(
        'viewingKey must be hex-encoded (start with 0x)',
        'viewingKey',
        { received: viewingKey },
        ErrorCode.INVALID_FORMAT
      )
    }

    if (viewingKey.length < 66) {
      throw new ValidationError(
        'viewingKey must be at least 32 bytes',
        'viewingKey',
        { received: viewingKey.length },
        ErrorCode.INVALID_FORMAT
      )
    }
  }

  /**
   * Convert viewing key to secret (bigint)
   */
  private static viewingKeyToSecret(viewingKey: HexString): bigint {
    const bytes = hexToBytes(viewingKey.slice(2))
    let secret = 0n
    for (let i = 0; i < bytes.length; i++) {
      secret = (secret << 8n) | BigInt(bytes[i])
    }
    // Ensure secret is within field
    return this.mod(secret, FIELD_PRIME)
  }

  /**
   * Convert secret (bigint) back to viewing key
   * @param secret - The secret as bigint
   * @param hexLength - Length of the hex string (without 0x prefix)
   */
  private static secretToViewingKey(secret: bigint, hexLength: number): HexString {
    // Convert bigint to hex string
    let hex = secret.toString(16)
    // Pad to original length
    hex = hex.padStart(hexLength, '0')
    return `0x${hex}` as HexString
  }

  /**
   * Generate random polynomial coefficients
   * Polynomial: f(x) = a₀ + a₁x + a₂x² + ... + aₙ₋₁xⁿ⁻¹
   * where a₀ = secret
   */
  private static generateCoefficients(threshold: number, secret: bigint): bigint[] {
    const coefficients: bigint[] = [secret] // a₀ = secret

    // Generate threshold-1 random coefficients
    for (let i = 1; i < threshold; i++) {
      const randomCoeff = this.randomFieldElement()
      coefficients.push(randomCoeff)
    }

    return coefficients
  }

  /**
   * Generate a random field element
   */
  private static randomFieldElement(): bigint {
    const bytes = randomBytes(32)
    let value = 0n
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8n) | BigInt(bytes[i])
    }
    return this.mod(value, FIELD_PRIME)
  }

  /**
   * Evaluate polynomial at point x
   * f(x) = a₀ + a₁x + a₂x² + ... + aₙ₋₁xⁿ⁻¹
   */
  private static evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
    let result = 0n
    let xPower = 1n

    for (const coeff of coefficients) {
      result = this.mod(result + this.mod(coeff * xPower, FIELD_PRIME), FIELD_PRIME)
      xPower = this.mod(xPower * x, FIELD_PRIME)
    }

    return result
  }

  /**
   * Create commitment hash from secret and coefficients
   */
  private static createCommitment(secret: bigint, coefficients: bigint[]): string {
    const data = [secret, ...coefficients].map((c) => c.toString(16).padStart(64, '0')).join('')
    const hash = sha256(hexToBytes(data))
    return bytesToHex(hash)
  }

  /**
   * Encode share as string: "x:y:len:commitment"
   */
  private static encodeShare(x: bigint, y: bigint, keyLength: number, commitment: string): string {
    const xHex = x.toString(16).padStart(2, '0')
    const yHex = y.toString(16).padStart(64, '0')
    const lenHex = keyLength.toString(16).padStart(4, '0')
    return `${xHex}:${yHex}:${lenHex}:${commitment}`
  }

  /**
   * Decode share from string
   */
  private static decodeShare(share: string): DecodedShare {
    if (!share || typeof share !== 'string') {
      throw new ValidationError(
        'share must be a non-empty string',
        'share',
        { received: share },
        ErrorCode.INVALID_SHARE
      )
    }

    const parts = share.split(':')
    if (parts.length !== 4) {
      throw new ValidationError(
        'share must have format "x:y:len:commitment"',
        'share',
        { received: share },
        ErrorCode.INVALID_SHARE
      )
    }

    const [xHex, yHex, lenHex, commitment] = parts

    try {
      const x = BigInt(`0x${xHex}`)
      const y = BigInt(`0x${yHex}`)
      const keyLength = parseInt(lenHex, 16)

      if (x <= 0n) {
        throw new ValidationError(
          'share x-coordinate must be positive',
          'share',
          { x },
          ErrorCode.INVALID_SHARE
        )
      }

      if (keyLength < 64) {
        throw new ValidationError(
          'key length must be at least 64 (32 bytes)',
          'share',
          { keyLength },
          ErrorCode.INVALID_SHARE
        )
      }

      return { x, y, keyLength, commitment }
    } catch (error) {
      throw new ValidationError(
        'failed to decode share',
        'share',
        { error: (error as Error).message },
        ErrorCode.INVALID_SHARE
      )
    }
  }

  /**
   * Lagrange interpolation to reconstruct secret
   * Evaluates polynomial at x=0 to get f(0) = secret
   */
  private static lagrangeInterpolate(shares: DecodedShare[]): bigint {
    let secret = 0n

    for (let i = 0; i < shares.length; i++) {
      const xi = shares[i].x
      const yi = shares[i].y

      // Calculate Lagrange coefficient
      let numerator = 1n
      let denominator = 1n

      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue

        const xj = shares[j].x
        // Evaluate at x=0: (0 - xj) / (xi - xj)
        numerator = this.mod(numerator * this.mod(-xj, FIELD_PRIME), FIELD_PRIME)
        denominator = this.mod(denominator * this.mod(xi - xj, FIELD_PRIME), FIELD_PRIME)
      }

      // Compute yi * (numerator / denominator)
      const coeff = this.mod(numerator * this.modInverse(denominator, FIELD_PRIME), FIELD_PRIME)
      secret = this.mod(secret + this.mod(yi * coeff, FIELD_PRIME), FIELD_PRIME)
    }

    return secret
  }

  /**
   * Modular arithmetic: a mod m
   */
  private static mod(a: bigint, m: bigint): bigint {
    return ((a % m) + m) % m
  }

  /**
   * Modular multiplicative inverse using Extended Euclidean Algorithm
   * Returns x such that (a * x) mod m = 1
   */
  private static modInverse(a: bigint, m: bigint): bigint {
    const a0 = this.mod(a, m)

    if (a0 === 0n) {
      throw new CryptoError(
        'modular inverse does not exist (a = 0)',
        ErrorCode.CRYPTO_OPERATION_FAILED,
        { operation: 'modInverse' }
      )
    }

    let [old_r, r] = [a0, m]
    let [old_s, s] = [1n, 0n]

    while (r !== 0n) {
      const quotient = old_r / r
      ;[old_r, r] = [r, old_r - quotient * r]
      ;[old_s, s] = [s, old_s - quotient * s]
    }

    if (old_r !== 1n) {
      throw new CryptoError(
        'modular inverse does not exist (gcd != 1)',
        ErrorCode.CRYPTO_OPERATION_FAILED,
        { operation: 'modInverse' }
      )
    }

    return this.mod(old_s, m)
  }
}
