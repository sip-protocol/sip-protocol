/**
 * NEAR Pedersen Commitment Implementation
 *
 * Ed25519-based Pedersen commitments for NEP-141 token privacy on NEAR.
 *
 * ## Security Properties
 *
 * - **Hiding (Computational)**: Cannot determine value from commitment
 * - **Binding (Computational)**: Cannot open commitment to different value
 * - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2) when blindings sum
 *
 * ## Ed25519 Curve
 *
 * This implementation uses ed25519 (Curve25519 in Edwards form) for
 * compatibility with NEAR's native cryptography and implicit accounts.
 *
 * ## NEAR Token Amounts
 *
 * NEAR uses u128 for native NEAR (24 decimals) and u128 for NEP-141 tokens.
 * Pedersen commitments operate on values < curve order (2^252 + ...).
 *
 * @module chains/near/commitment
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError, CryptoError, ErrorCode } from '../../errors'
import { isValidHex } from '../../validation'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A Pedersen commitment with associated blinding factor
 */
export interface NEARPedersenCommitment {
  /**
   * The commitment point C = v*G + r*H (compressed ed25519, 32 bytes)
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
export interface NEARCommitmentPoint {
  /**
   * The commitment point (compressed ed25519, 32 bytes)
   */
  commitment: HexString
}

/**
 * NEP-141 token commitment with amount and token info
 */
export interface NEP141TokenCommitment extends NEARPedersenCommitment {
  /**
   * NEP-141 token contract address
   */
  tokenContract: string

  /**
   * Token decimals (e.g., 24 for NEAR, 6 for USDC)
   */
  decimals: number

  /**
   * Original amount in smallest units (u128)
   */
  amountRaw?: bigint
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Domain separation tag for H generation (NEAR version)
 */
const H_DOMAIN = 'SIP-NEAR-PEDERSEN-GENERATOR-H-v1'

/**
 * The generator G (ed25519 base point)
 */
const G = ed25519.ExtendedPoint.BASE

/**
 * The ed25519 curve order L (number of points in the subgroup)
 */
export const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

/**
 * Ed25519 cofactor (the curve has order 8*L where L is the prime subgroup order)
 */
const ED25519_COFACTOR = 8n

/**
 * Maximum NEAR amount (u128::MAX)
 * Note: Actual NEAR total supply is much less, but u128 is the storage type
 */
export const MAX_NEAR_AMOUNT = 2n ** 128n - 1n

/**
 * Maximum value that can be committed (must be < curve order)
 */
export const MAX_COMMITMENT_VALUE = ED25519_ORDER - 1n

// ─── Generator H Construction ─────────────────────────────────────────────────

/**
 * The independent generator H (NUMS point)
 * Constructed via hash-to-curve with nothing-up-my-sleeve string.
 */
const H = generateH()

/**
 * Generate the independent generator H using NUMS method for ed25519
 *
 * Uses a hash-and-check approach:
 * 1. Hash domain||counter to get 32 bytes
 * 2. Try to decode as an ed25519 point
 * 3. Clear the cofactor by multiplying by 8
 * 4. If valid and not identity/G, use it
 */
function generateH(): typeof G {
  let counter = 0

  while (counter < 256) {
    const input = new TextEncoder().encode(`${H_DOMAIN}:${counter}`)
    const hashBytes = sha256(input)

    try {
      const rawPoint = ed25519.ExtendedPoint.fromHex(hashBytes)
      const point = rawPoint.multiply(ED25519_COFACTOR)

      if (!point.equals(ed25519.ExtendedPoint.ZERO)) {
        const gBytes = G.toRawBytes()
        const hBytes = point.toRawBytes()
        if (bytesToHex(gBytes) !== bytesToHex(hBytes)) {
          return point
        }
      }
    } catch {
      // Not a valid point encoding, try next counter
    }

    counter++
  }

  throw new CryptoError(
    'Failed to generate H point - this should never happen',
    ErrorCode.CRYPTO_FAILED,
    { context: { domain: H_DOMAIN } }
  )
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert bytes to bigint (little-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = result * 256n + BigInt(bytes[i])
  }
  return result
}

/**
 * Convert bigint to bytes (little-endian)
 */
function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const result = new Uint8Array(length)
  let temp = n
  for (let i = 0; i < length; i++) {
    result[i] = Number(temp & 0xffn)
    temp = temp >> 8n
  }
  return result
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return result
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a Pedersen commitment to a value (ed25519)
 *
 * C = v*G + r*H
 *
 * @param value - The value to commit to (must be < curve order)
 * @param blinding - Optional blinding factor (random 32 bytes if not provided)
 * @returns The commitment and blinding factor
 *
 * @example
 * ```typescript
 * // Commit to 1 NEAR (in yoctoNEAR)
 * const { commitment, blinding } = commitNEAR(1_000_000_000_000_000_000_000_000n)
 *
 * // Verify the commitment
 * const valid = verifyOpeningNEAR(commitment, 1_000_000_000_000_000_000_000_000n, blinding)
 * ```
 */
export function commitNEAR(
  value: bigint,
  blinding?: Uint8Array
): NEARPedersenCommitment {
  if (typeof value !== 'bigint') {
    throw new ValidationError('must be a bigint', 'value', { received: typeof value })
  }

  if (value < 0n) {
    throw new ValidationError('must be non-negative', 'value')
  }

  if (value >= ED25519_ORDER) {
    throw new ValidationError(
      'must be less than curve order',
      'value',
      { curveOrder: ED25519_ORDER.toString(16) }
    )
  }

  const r = blinding ?? randomBytes(32)
  if (r.length !== 32) {
    throw new ValidationError('must be 32 bytes', 'blinding', { received: r.length })
  }

  const rScalar = bytesToBigInt(r) % ED25519_ORDER
  if (rScalar === 0n) {
    return commitNEAR(value, randomBytes(32))
  }

  let C: typeof G

  if (value === 0n) {
    C = H.multiply(rScalar)
  } else {
    const vG = G.multiply(value)
    const rH = H.multiply(rScalar)
    C = vG.add(rH)
  }

  const rScalarBytes = bigIntToBytes(rScalar, 32)

  return {
    commitment: `0x${bytesToHex(C.toRawBytes())}` as HexString,
    blinding: `0x${bytesToHex(rScalarBytes)}` as HexString,
  }
}

/**
 * Verify that a commitment opens to a specific value
 *
 * @param commitment - The commitment point to verify
 * @param value - The claimed value
 * @param blinding - The blinding factor used
 * @returns true if the commitment opens correctly
 */
export function verifyOpeningNEAR(
  commitment: HexString,
  value: bigint,
  blinding: HexString
): boolean {
  try {
    const commitmentBytes = hexToBytes(commitment.slice(2))
    const C = ed25519.ExtendedPoint.fromHex(commitmentBytes)

    const blindingBytes = hexToBytes(blinding.slice(2))
    const rScalar = bytesToBigInt(blindingBytes) % ED25519_ORDER

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

    return C.equals(expected)
  } catch {
    return false
  }
}

// ─── NEP-141 Token Specific Functions ─────────────────────────────────────────

/**
 * Create a commitment for a NEP-141 token amount
 *
 * Handles NEAR token decimals and u128 amount validation.
 *
 * @param amount - Token amount in smallest units (u128)
 * @param tokenContract - NEP-141 token contract address
 * @param decimals - Token decimals (e.g., 24 for NEAR, 6 for USDC)
 * @returns NEP-141 token commitment with metadata
 *
 * @example
 * ```typescript
 * // Commit to 100 USDC (6 decimals)
 * const commitment = commitNEP141Token(
 *   100_000_000n, // 100 USDC in smallest units
 *   'usdc.near',
 *   6
 * )
 * ```
 */
export function commitNEP141Token(
  amount: bigint,
  tokenContract: string,
  decimals: number,
  blinding?: Uint8Array
): NEP141TokenCommitment {
  if (amount < 0n || amount > MAX_NEAR_AMOUNT) {
    throw new ValidationError(
      'NEP-141 token amount must be a valid u128 (0 to 2^128-1)',
      'amount',
      { max: MAX_NEAR_AMOUNT.toString() }
    )
  }

  // For amounts larger than curve order, we need to split
  // However, for most practical purposes (total NEAR supply is ~1.1B * 10^24),
  // we can commit directly as long as amount < ED25519_ORDER
  if (amount >= ED25519_ORDER) {
    throw new ValidationError(
      'Amount exceeds maximum committable value (curve order)',
      'amount',
      { max: MAX_COMMITMENT_VALUE.toString() }
    )
  }

  if (decimals < 0 || decimals > 24 || !Number.isInteger(decimals)) {
    throw new ValidationError(
      'decimals must be an integer between 0 and 24',
      'decimals'
    )
  }

  const { commitment, blinding: blindingHex } = commitNEAR(amount, blinding)

  return {
    commitment,
    blinding: blindingHex,
    tokenContract,
    decimals,
    amountRaw: amount,
  }
}

/**
 * Verify a NEP-141 token commitment
 *
 * @param tokenCommitment - The NEP-141 token commitment to verify
 * @param expectedAmount - The expected amount in smallest units
 * @returns true if the commitment opens correctly
 */
export function verifyNEP141TokenCommitment(
  tokenCommitment: NEP141TokenCommitment,
  expectedAmount: bigint
): boolean {
  return verifyOpeningNEAR(
    tokenCommitment.commitment,
    expectedAmount,
    tokenCommitment.blinding
  )
}

/**
 * Convert human-readable token amount to smallest units
 *
 * @param amount - Human-readable amount (e.g., 100.5)
 * @param decimals - Token decimals
 * @returns Amount in smallest units as bigint
 *
 * @example
 * ```typescript
 * // 1 NEAR (24 decimals) = 10^24 yoctoNEAR
 * const units = toYoctoNEAR(1, 24)
 * // 1_000_000_000_000_000_000_000_000n
 *
 * // 100.5 USDC (6 decimals) = 100,500,000 units
 * const usdc = toYoctoNEAR(100.5, 6)
 * // 100_500_000n
 * ```
 */
export function toYoctoNEAR(amount: number | string, decimals: number): bigint {
  const [whole, fraction = ''] = String(amount).split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

/**
 * Convert smallest units to human-readable amount
 *
 * @param amount - Amount in smallest units
 * @param decimals - Token decimals
 * @returns Human-readable string
 *
 * @example
 * ```typescript
 * // 1_000_000_000_000_000_000_000_000 yoctoNEAR = "1"
 * const readable = fromYoctoNEAR(1_000_000_000_000_000_000_000_000n, 24)
 * // "1"
 * ```
 */
export function fromYoctoNEAR(amount: bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, '0')
  const whole = str.slice(0, -decimals) || '0'
  const fraction = str.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

// ─── Homomorphic Operations ───────────────────────────────────────────────────

/**
 * Add two commitments homomorphically (ed25519)
 *
 * C1 + C2 = (v1+v2)*G + (r1+r2)*H
 *
 * @param c1 - First commitment point
 * @param c2 - Second commitment point
 * @returns Sum of commitments
 */
export function addCommitmentsNEAR(
  c1: HexString,
  c2: HexString
): NEARCommitmentPoint {
  if (!isValidHex(c1)) {
    throw new ValidationError('must be a valid hex string', 'c1')
  }
  if (!isValidHex(c2)) {
    throw new ValidationError('must be a valid hex string', 'c2')
  }

  let point1: typeof G
  let point2: typeof G

  try {
    point1 = ed25519.ExtendedPoint.fromHex(hexToBytes(c1.slice(2)))
  } catch {
    throw new ValidationError('must be a valid ed25519 point', 'c1')
  }
  try {
    point2 = ed25519.ExtendedPoint.fromHex(hexToBytes(c2.slice(2)))
  } catch {
    throw new ValidationError('must be a valid ed25519 point', 'c2')
  }

  const sum = point1.add(point2)

  return {
    commitment: `0x${bytesToHex(sum.toRawBytes())}` as HexString,
  }
}

/**
 * Subtract two commitments homomorphically (ed25519)
 *
 * C1 - C2 = (v1-v2)*G + (r1-r2)*H
 *
 * @param c1 - First commitment point
 * @param c2 - Second commitment point (to subtract)
 * @returns Difference of commitments
 */
export function subtractCommitmentsNEAR(
  c1: HexString,
  c2: HexString
): NEARCommitmentPoint {
  if (!isValidHex(c1)) {
    throw new ValidationError('must be a valid hex string', 'c1')
  }
  if (!isValidHex(c2)) {
    throw new ValidationError('must be a valid hex string', 'c2')
  }

  let point1: typeof G
  let point2: typeof G

  try {
    point1 = ed25519.ExtendedPoint.fromHex(hexToBytes(c1.slice(2)))
  } catch {
    throw new ValidationError('must be a valid ed25519 point', 'c1')
  }
  try {
    point2 = ed25519.ExtendedPoint.fromHex(hexToBytes(c2.slice(2)))
  } catch {
    throw new ValidationError('must be a valid ed25519 point', 'c2')
  }

  const diff = point1.subtract(point2)

  if (diff.equals(ed25519.ExtendedPoint.ZERO)) {
    return {
      commitment: ('0x' + '00'.repeat(32)) as HexString,
    }
  }

  return {
    commitment: `0x${bytesToHex(diff.toRawBytes())}` as HexString,
  }
}

/**
 * Add blinding factors (ed25519)
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor
 * @returns Sum of blindings mod curve order
 */
export function addBlindingsNEAR(b1: HexString, b2: HexString): HexString {
  if (!isValidHex(b1)) {
    throw new ValidationError('must be a valid hex string', 'b1')
  }
  if (!isValidHex(b2)) {
    throw new ValidationError('must be a valid hex string', 'b2')
  }

  const b1Bytes = hexToBytes(b1.slice(2))
  const b2Bytes = hexToBytes(b2.slice(2))

  const b1Scalar = bytesToBigInt(b1Bytes)
  const b2Scalar = bytesToBigInt(b2Bytes)

  const sum = (b1Scalar + b2Scalar) % ED25519_ORDER
  const sumBytes = bigIntToBytes(sum, 32)

  return `0x${bytesToHex(sumBytes)}` as HexString
}

/**
 * Subtract blinding factors (ed25519)
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor (to subtract)
 * @returns Difference of blindings mod curve order
 */
export function subtractBlindingsNEAR(b1: HexString, b2: HexString): HexString {
  if (!isValidHex(b1)) {
    throw new ValidationError('must be a valid hex string', 'b1')
  }
  if (!isValidHex(b2)) {
    throw new ValidationError('must be a valid hex string', 'b2')
  }

  const b1Bytes = hexToBytes(b1.slice(2))
  const b2Bytes = hexToBytes(b2.slice(2))

  const b1Scalar = bytesToBigInt(b1Bytes)
  const b2Scalar = bytesToBigInt(b2Bytes)

  // Handle subtraction with modular arithmetic
  const diff = (b1Scalar - b2Scalar + ED25519_ORDER) % ED25519_ORDER
  const diffBytes = bigIntToBytes(diff, 32)

  return `0x${bytesToHex(diffBytes)}` as HexString
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Get the generators G and H for verification/debugging
 *
 * @returns The generator points as hex strings
 */
export function getGeneratorsNEAR(): { G: HexString; H: HexString } {
  return {
    G: `0x${bytesToHex(G.toRawBytes())}` as HexString,
    H: `0x${bytesToHex(H.toRawBytes())}` as HexString,
  }
}

/**
 * Generate a random blinding factor
 *
 * @returns Random 32-byte blinding factor as hex string
 */
export function generateBlindingNEAR(): HexString {
  const bytes = randomBytes(32)
  const scalar = bytesToBigInt(bytes) % ED25519_ORDER

  // Ensure non-zero
  if (scalar === 0n) {
    return generateBlindingNEAR()
  }

  const scalarBytes = bigIntToBytes(scalar, 32)
  return `0x${bytesToHex(scalarBytes)}` as HexString
}
