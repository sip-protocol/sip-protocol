/**
 * Solana Pedersen Commitment Implementation
 *
 * Ed25519-based Pedersen commitments for SPL token privacy on Solana.
 *
 * ## Security Properties
 *
 * - **Hiding (Computational)**: Cannot determine value from commitment
 * - **Binding (Computational)**: Cannot open commitment to different value
 * - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2) when blindings sum
 *
 * ## Ed25519 vs Secp256k1
 *
 * This implementation uses ed25519 (Curve25519 in Edwards form) for
 * compatibility with Solana's native cryptography. The core SDK uses
 * secp256k1 for EVM compatibility.
 *
 * @module chains/solana/commitment
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
export interface SolanaPedersenCommitment {
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
export interface SolanaCommitmentPoint {
  /**
   * The commitment point (compressed ed25519, 32 bytes)
   */
  commitment: HexString
}

/**
 * SPL token commitment with amount and token info
 */
export interface SPLTokenCommitment extends SolanaPedersenCommitment {
  /**
   * SPL token mint address
   */
  mint: string

  /**
   * Token decimals (for display/calculation)
   */
  decimals: number

  /**
   * Original amount in smallest units (u64)
   */
  amountRaw?: bigint
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Domain separation tag for H generation (ed25519 version)
 */
const H_DOMAIN = 'SIP-SOLANA-PEDERSEN-GENERATOR-H-v1'

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
 * We multiply hash-derived points by the cofactor to ensure they're in the
 * prime-order subgroup, which is required for correct homomorphic properties.
 */
const ED25519_COFACTOR = 8n

/**
 * Maximum SPL token amount (u64::MAX)
 */
export const MAX_SPL_AMOUNT = 2n ** 64n - 1n

// ─── Generator H Construction ─────────────────────────────────────────────────

/**
 * The independent generator H (NUMS point)
 * Constructed via hash-to-curve with nothing-up-my-sleeve string.
 * IMPORTANT: Must be defined after ED25519_COFACTOR for proper initialization order.
 */
const H = generateH()

/**
 * Generate the independent generator H using NUMS method for ed25519
 *
 * We use a simple hash-and-check approach:
 * 1. Hash domain||counter to get 32 bytes
 * 2. Try to decode as an ed25519 point
 * 3. Clear the cofactor by multiplying by 8 (ensures point is in prime-order subgroup)
 * 4. If valid and not identity/G, use it
 *
 * This ensures nobody knows the discrete log of H w.r.t. G.
 *
 * IMPORTANT: The cofactor clearing step is essential for Pedersen commitments.
 * Without it, H might not have order L, breaking the homomorphic property:
 * (r1 + r2) mod L * H would not equal r1*H + r2*H
 */
function generateH(): typeof G {
  let counter = 0

  while (counter < 256) {
    // Create candidate by hashing domain + counter
    const input = new TextEncoder().encode(`${H_DOMAIN}:${counter}`)
    const hashBytes = sha256(input)

    try {
      // Try to interpret hash as a compressed ed25519 point
      // Ed25519 points are encoded as the y-coordinate with sign bit
      const rawPoint = ed25519.ExtendedPoint.fromHex(hashBytes)

      // Clear the cofactor: multiply by 8 to get a point in the prime-order subgroup
      // This ensures the point has order L (not 2L, 4L, or 8L)
      const point = rawPoint.multiply(ED25519_COFACTOR)

      // Ensure point is not identity (could happen if rawPoint had small order)
      if (!point.equals(ed25519.ExtendedPoint.ZERO)) {
        // Check it's not G by comparing serialized form
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
 * // Commit to 1000 tokens (smallest units)
 * const { commitment, blinding } = commitSolana(1000n)
 *
 * // Verify the commitment
 * const valid = verifyOpeningSolana(commitment, 1000n, blinding)
 * ```
 */
export function commitSolana(
  value: bigint,
  blinding?: Uint8Array,
): SolanaPedersenCommitment {
  // Validate value type
  if (typeof value !== 'bigint') {
    throw new ValidationError('must be a bigint', 'value', { received: typeof value })
  }

  // Validate value is in valid range
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

  // Generate or use provided blinding factor
  const r = blinding ?? randomBytes(32)
  if (r.length !== 32) {
    throw new ValidationError('must be 32 bytes', 'blinding', { received: r.length })
  }

  // Ensure blinding is in valid range (mod L)
  const rScalar = bytesToBigInt(r) % ED25519_ORDER
  if (rScalar === 0n) {
    // Regenerate if we got zero (extremely rare)
    return commitSolana(value, randomBytes(32))
  }

  // C = v*G + r*H
  let C: typeof G

  if (value === 0n) {
    // Only blinding contributes: C = r*H
    C = H.multiply(rScalar)
  } else {
    // Normal case: C = v*G + r*H
    const vG = G.multiply(value)
    const rH = H.multiply(rScalar)
    C = vG.add(rH)
  }

  // Return the reduced scalar as blinding (important for homomorphic ops)
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
export function verifyOpeningSolana(
  commitment: HexString,
  value: bigint,
  blinding: HexString,
): boolean {
  try {
    // Parse the commitment point
    const commitmentBytes = hexToBytes(commitment.slice(2))
    const C = ed25519.ExtendedPoint.fromHex(commitmentBytes)

    // Parse blinding factor
    const blindingBytes = hexToBytes(blinding.slice(2))
    const rScalar = bytesToBigInt(blindingBytes) % ED25519_ORDER

    // Recompute expected commitment
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

// ─── SPL Token Specific Functions ─────────────────────────────────────────────

/**
 * Create a commitment for an SPL token amount
 *
 * Handles SPL token decimals and u64 amount validation.
 *
 * @param amount - Token amount in smallest units (u64)
 * @param mint - SPL token mint address
 * @param decimals - Token decimals (e.g., 6 for USDC, 9 for SOL)
 * @returns SPL token commitment with metadata
 *
 * @example
 * ```typescript
 * // Commit to 100 USDC (6 decimals)
 * const commitment = commitSPLToken(
 *   100_000_000n, // 100 USDC in smallest units
 *   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
 *   6
 * )
 * ```
 */
export function commitSPLToken(
  amount: bigint,
  mint: string,
  decimals: number,
  blinding?: Uint8Array,
): SPLTokenCommitment {
  // Validate amount is valid u64
  if (amount < 0n || amount > MAX_SPL_AMOUNT) {
    throw new ValidationError(
      'SPL token amount must be a valid u64 (0 to 2^64-1)',
      'amount',
      { max: MAX_SPL_AMOUNT.toString() }
    )
  }

  // Validate decimals
  if (decimals < 0 || decimals > 18 || !Number.isInteger(decimals)) {
    throw new ValidationError(
      'decimals must be an integer between 0 and 18',
      'decimals'
    )
  }

  // Create the commitment
  const { commitment, blinding: blindingHex } = commitSolana(amount, blinding)

  return {
    commitment,
    blinding: blindingHex,
    mint,
    decimals,
    amountRaw: amount,
  }
}

/**
 * Verify an SPL token commitment
 *
 * @param tokenCommitment - The SPL token commitment to verify
 * @param expectedAmount - The expected amount in smallest units
 * @returns true if the commitment opens correctly
 */
export function verifySPLTokenCommitment(
  tokenCommitment: SPLTokenCommitment,
  expectedAmount: bigint,
): boolean {
  return verifyOpeningSolana(
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
 * // 100.5 USDC (6 decimals) = 100,500,000 units
 * const units = toSmallestUnits(100.5, 6)
 * // 100_500_000n
 * ```
 */
export function toSmallestUnits(amount: number | string, decimals: number): bigint {
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
 * // 100,500,000 units (6 decimals) = "100.5"
 * const readable = fromSmallestUnits(100_500_000n, 6)
 * // "100.5"
 * ```
 */
export function fromSmallestUnits(amount: bigint, decimals: number): string {
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
export function addCommitmentsSolana(
  c1: HexString,
  c2: HexString,
): SolanaCommitmentPoint {
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
export function subtractCommitmentsSolana(
  c1: HexString,
  c2: HexString,
): SolanaCommitmentPoint {
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

  // Handle identity point
  if (diff.equals(ed25519.ExtendedPoint.ZERO)) {
    // Return zero point representation
    return {
      commitment: '0x' + '00'.repeat(32) as HexString,
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
 * @returns Sum of blindings (mod curve order)
 */
export function addBlindingsSolana(b1: HexString, b2: HexString): HexString {
  const r1 = bytesToBigInt(hexToBytes(b1.slice(2)))
  const r2 = bytesToBigInt(hexToBytes(b2.slice(2)))

  const sum = (r1 + r2) % ED25519_ORDER
  const sumBytes = bigIntToBytes(sum, 32)

  return `0x${bytesToHex(sumBytes)}` as HexString
}

/**
 * Subtract blinding factors (ed25519)
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor (to subtract)
 * @returns Difference of blindings (mod curve order)
 */
export function subtractBlindingsSolana(b1: HexString, b2: HexString): HexString {
  const r1 = bytesToBigInt(hexToBytes(b1.slice(2)))
  const r2 = bytesToBigInt(hexToBytes(b2.slice(2)))

  const diff = (r1 - r2 + ED25519_ORDER) % ED25519_ORDER
  const diffBytes = bigIntToBytes(diff, 32)

  return `0x${bytesToHex(diffBytes)}` as HexString
}

// ─── Generator Access ─────────────────────────────────────────────────────────

/**
 * Get the ed25519 generators for ZK proof integration
 */
export function getGeneratorsSolana(): {
  G: HexString
  H: HexString
} {
  return {
    G: `0x${bytesToHex(G.toRawBytes())}` as HexString,
    H: `0x${bytesToHex(H.toRawBytes())}` as HexString,
  }
}

/**
 * Generate a random blinding factor (32 bytes)
 */
export function generateBlindingSolana(): HexString {
  return `0x${bytesToHex(randomBytes(32))}` as HexString
}

// ─── Utility Functions ────────────────────────────────────────────────────────

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

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}
