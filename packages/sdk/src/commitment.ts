/**
 * Pedersen Commitment Implementation
 *
 * Cryptographically secure Pedersen commitments on secp256k1.
 *
 * ## Security Properties
 *
 * - **Hiding (Computational)**: Cannot determine value from commitment
 * - **Binding (Computational)**: Cannot open commitment to different value
 * - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2) when blindings sum
 *
 * ## Generator H Construction
 *
 * H is constructed using "nothing-up-my-sleeve" (NUMS) method:
 * - Take a well-known string "SIP-PEDERSEN-GENERATOR-H"
 * - Hash it to get x-coordinate candidate
 * - Iterate until we find a valid curve point
 * - This ensures nobody knows the discrete log of H w.r.t. G
 *
 * @see docs/specs/SIP-SPEC.md Section 3.3 - Pedersen Commitment
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError, CryptoError, ErrorCode } from './errors'
import { isValidHex } from './validation'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A Pedersen commitment with associated blinding factor
 */
export interface PedersenCommitment {
  /**
   * The commitment point C = v*G + r*H (compressed, 33 bytes)
   */
  commitment: HexString

  /**
   * The blinding factor r (32 bytes, secret)
   * Required to open/verify the commitment
   */
  blinding: HexString
}

/**
 * A commitment point without the blinding factor (for public sharing)
 */
export interface CommitmentPoint {
  /**
   * The commitment point (compressed, 33 bytes)
   */
  commitment: HexString
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Domain separation tag for H generation
 */
const H_DOMAIN = 'SIP-PEDERSEN-GENERATOR-H-v1'

/**
 * The generator G (secp256k1 base point)
 */
const G = secp256k1.ProjectivePoint.BASE

/**
 * The independent generator H (NUMS point)
 *
 * Constructed via hash-to-curve with nothing-up-my-sleeve string.
 * Nobody knows log_G(H), making the commitment binding.
 */
const H = generateH()

/**
 * The curve order (number of points in the group)
 */
const CURVE_ORDER = secp256k1.CURVE.n

// ─── Generator H Construction ────────────────────────────────────────────────

/**
 * Generate the independent generator H using NUMS method
 *
 * This uses a try-and-increment approach:
 * 1. Hash the domain separator to get a candidate x-coordinate
 * 2. Try to lift x to a curve point
 * 3. If it fails, increment counter and retry
 *
 * This is similar to how Zcash generates their Pedersen generators.
 */
function generateH(): typeof G {
  let counter = 0

  while (counter < 256) {
    // Create candidate x-coordinate
    const input = new TextEncoder().encode(`${H_DOMAIN}:${counter}`)
    const hashBytes = sha256(input)

    try {
      // Try to create a point from this x-coordinate (with even y)
      // The '02' prefix indicates compressed point with even y
      const pointBytes = new Uint8Array(33)
      pointBytes[0] = 0x02
      pointBytes.set(hashBytes, 1)

      // This will throw if not a valid point
      const point = secp256k1.ProjectivePoint.fromHex(pointBytes)

      // Ensure point is not identity and not G
      if (!point.equals(secp256k1.ProjectivePoint.ZERO) && !point.equals(G)) {
        return point
      }
    } catch {
      // Not a valid point, try next counter
    }

    counter++
  }

  // This should never happen with a properly chosen domain separator
  throw new CryptoError(
    'Failed to generate H point - this should never happen',
    ErrorCode.CRYPTO_FAILED,
    { context: { domain: H_DOMAIN } }
  )
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Create a Pedersen commitment to a value
 *
 * C = v*G + r*H
 *
 * Where:
 * - v = value (the amount being committed)
 * - r = blinding factor (random, keeps value hidden)
 * - G = base generator
 * - H = independent generator (NUMS)
 *
 * @param value - The value to commit to (must be < curve order)
 * @param blinding - Optional blinding factor (random 32 bytes if not provided)
 * @returns The commitment and blinding factor
 *
 * @example
 * ```typescript
 * // Create a commitment to 100 tokens
 * const { commitment, blinding } = commit(100n)
 *
 * // Later, prove the commitment contains 100
 * const valid = verifyOpening(commitment, 100n, blinding)
 * ```
 */
export function commit(
  value: bigint,
  blinding?: Uint8Array,
): PedersenCommitment {
  // Validate value type
  if (typeof value !== 'bigint') {
    throw new ValidationError('must be a bigint', 'value', { received: typeof value })
  }

  // Validate value is in valid range
  if (value < 0n) {
    throw new ValidationError('must be non-negative', 'value')
  }
  if (value >= CURVE_ORDER) {
    throw new ValidationError(
      'must be less than curve order',
      'value',
      { curveOrder: CURVE_ORDER.toString(16) }
    )
  }

  // Generate or use provided blinding factor
  const r = blinding ?? randomBytes(32)
  if (r.length !== 32) {
    throw new ValidationError('must be 32 bytes', 'blinding', { received: r.length })
  }

  // Ensure blinding is in valid range (mod n), and non-zero for valid scalar
  const rScalar = bytesToBigInt(r) % CURVE_ORDER
  if (rScalar === 0n) {
    throw new Error('CRITICAL: Zero blinding scalar after reduction - investigate RNG')
  }

  // C = v*G + r*H
  // Handle edge cases where value or blinding could be zero
  let C: typeof G

  if (value === 0n && rScalar === 0n) {
    // Both zero - use identity point (edge case, shouldn't happen with above fix)
    C = secp256k1.ProjectivePoint.ZERO
  } else if (value === 0n) {
    // Only blinding contributes: C = r*H
    C = H.multiply(rScalar)
  } else if (rScalar === 0n) {
    // Only value contributes: C = v*G (shouldn't happen with above fix)
    C = G.multiply(value)
  } else {
    // Normal case: C = v*G + r*H
    const vG = G.multiply(value)
    const rH = H.multiply(rScalar)
    C = vG.add(rH)
  }

  return {
    commitment: `0x${bytesToHex(C.toRawBytes(true))}` as HexString,
    blinding: `0x${bytesToHex(r)}` as HexString,
  }
}

/**
 * Verify that a commitment opens to a specific value
 *
 * Recomputes C' = v*G + r*H and checks if C' == C
 *
 * @param commitment - The commitment point to verify
 * @param value - The claimed value
 * @param blinding - The blinding factor used
 * @returns true if the commitment opens correctly
 */
export function verifyOpening(
  commitment: HexString,
  value: bigint,
  blinding: HexString,
): boolean {
  try {
    // Handle special case of zero commitment (point at infinity)
    if (commitment === '0x00') {
      // Zero commitment only opens to (0, 0) - but that's not valid with our blinding adjustment
      // Actually, zero point means C = C, so it should verify for 0, 0 blinding
      return value === 0n && blinding === ('0x' + '0'.repeat(64))
    }

    // Parse the commitment point
    const C = secp256k1.ProjectivePoint.fromHex(commitment.slice(2))

    // Recompute expected commitment
    const blindingBytes = hexToBytes(blinding.slice(2))
    const rScalar = bytesToBigInt(blindingBytes) % CURVE_ORDER
    if (rScalar === 0n) {
      throw new Error('CRITICAL: Zero blinding scalar after reduction - investigate RNG')
    }

    // Handle edge cases
    let expected: typeof G
    if (value === 0n) {
      expected = H.multiply(rScalar)
    } else if (rScalar === 0n) {
      expected = G.multiply(value)
    } else {
      const vG = G.multiply(value)
      const rH = H.multiply(rScalar)
      expected = vG.add(rH)
    }

    // Check equality
    return C.equals(expected)
  } catch {
    return false
  }
}

/**
 * Create a commitment to zero with a specific blinding factor
 *
 * C = 0*G + r*H = r*H
 *
 * Useful for creating balance proofs.
 *
 * @param blinding - The blinding factor
 * @returns Commitment to zero
 */
export function commitZero(blinding: Uint8Array): PedersenCommitment {
  return commit(0n, blinding)
}

// ─── Homomorphic Operations ──────────────────────────────────────────────────

/**
 * Add two commitments homomorphically
 *
 * C1 + C2 = (v1*G + r1*H) + (v2*G + r2*H) = (v1+v2)*G + (r1+r2)*H
 *
 * Note: The blinding factors also add. If you need to verify the sum,
 * you must also sum the blinding factors.
 *
 * @param c1 - First commitment point
 * @param c2 - Second commitment point
 * @returns Sum of commitments
 * @throws {ValidationError} If commitments are invalid hex strings
 */
export function addCommitments(
  c1: HexString,
  c2: HexString,
): CommitmentPoint {
  // Validate inputs
  if (!isValidHex(c1)) {
    throw new ValidationError('must be a valid hex string', 'c1')
  }
  if (!isValidHex(c2)) {
    throw new ValidationError('must be a valid hex string', 'c2')
  }

  let point1: typeof G
  let point2: typeof G
  try {
    point1 = secp256k1.ProjectivePoint.fromHex(c1.slice(2))
  } catch {
    throw new ValidationError('must be a valid curve point', 'c1')
  }
  try {
    point2 = secp256k1.ProjectivePoint.fromHex(c2.slice(2))
  } catch {
    throw new ValidationError('must be a valid curve point', 'c2')
  }

  const sum = point1.add(point2)

  return {
    commitment: `0x${bytesToHex(sum.toRawBytes(true))}` as HexString,
  }
}

/**
 * Subtract two commitments homomorphically
 *
 * C1 - C2 = (v1-v2)*G + (r1-r2)*H
 *
 * @param c1 - First commitment point
 * @param c2 - Second commitment point (to subtract)
 * @returns Difference of commitments
 * @throws {ValidationError} If commitments are invalid
 */
export function subtractCommitments(
  c1: HexString,
  c2: HexString,
): CommitmentPoint {
  // Validate inputs
  if (!isValidHex(c1)) {
    throw new ValidationError('must be a valid hex string', 'c1')
  }
  if (!isValidHex(c2)) {
    throw new ValidationError('must be a valid hex string', 'c2')
  }

  let point1: typeof G
  let point2: typeof G
  try {
    point1 = secp256k1.ProjectivePoint.fromHex(c1.slice(2))
  } catch {
    throw new ValidationError('must be a valid curve point', 'c1')
  }
  try {
    point2 = secp256k1.ProjectivePoint.fromHex(c2.slice(2))
  } catch {
    throw new ValidationError('must be a valid curve point', 'c2')
  }

  const diff = point1.subtract(point2)

  // Handle ZERO point (identity element) - can't serialize directly
  if (diff.equals(secp256k1.ProjectivePoint.ZERO)) {
    // Return a special marker for zero commitment
    // This is the point at infinity, represented as all zeros
    return {
      commitment: '0x00' as HexString,
    }
  }

  return {
    commitment: `0x${bytesToHex(diff.toRawBytes(true))}` as HexString,
  }
}

/**
 * Add blinding factors (for use with homomorphic addition)
 *
 * When you add commitments, the result commits to (v1+v2) with
 * blinding (r1+r2). Use this to compute the combined blinding.
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor
 * @returns Sum of blindings (mod curve order)
 */
export function addBlindings(b1: HexString, b2: HexString): HexString {
  const r1 = bytesToBigInt(hexToBytes(b1.slice(2)))
  const r2 = bytesToBigInt(hexToBytes(b2.slice(2)))

  const sum = (r1 + r2) % CURVE_ORDER
  const sumBytes = bigIntToBytes(sum, 32)

  return `0x${bytesToHex(sumBytes)}` as HexString
}

/**
 * Subtract blinding factors (for use with homomorphic subtraction)
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor (to subtract)
 * @returns Difference of blindings (mod curve order)
 */
export function subtractBlindings(b1: HexString, b2: HexString): HexString {
  const r1 = bytesToBigInt(hexToBytes(b1.slice(2)))
  const r2 = bytesToBigInt(hexToBytes(b2.slice(2)))

  // Handle underflow with modular arithmetic
  const diff = (r1 - r2 + CURVE_ORDER) % CURVE_ORDER
  const diffBytes = bigIntToBytes(diff, 32)

  return `0x${bytesToHex(diffBytes)}` as HexString
}

// ─── Range Proof Support ─────────────────────────────────────────────────────

/**
 * Get the generators for ZK proof integration
 *
 * Returns the G and H points for use in Noir circuits.
 */
export function getGenerators(): {
  G: { x: HexString; y: HexString }
  H: { x: HexString; y: HexString }
} {
  const gAffine = G.toAffine()
  const hAffine = H.toAffine()

  return {
    G: {
      x: `0x${gAffine.x.toString(16).padStart(64, '0')}` as HexString,
      y: `0x${gAffine.y.toString(16).padStart(64, '0')}` as HexString,
    },
    H: {
      x: `0x${hAffine.x.toString(16).padStart(64, '0')}` as HexString,
      y: `0x${hAffine.y.toString(16).padStart(64, '0')}` as HexString,
    },
  }
}

/**
 * Generate a random blinding factor
 */
export function generateBlinding(): HexString {
  return `0x${bytesToHex(randomBytes(32))}` as HexString
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte)
  }
  return result
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let v = value
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return bytes
}
