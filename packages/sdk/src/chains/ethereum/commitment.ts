/**
 * Ethereum Pedersen Commitment Implementation
 *
 * Secp256k1-based Pedersen commitments for ERC-20 token privacy on Ethereum.
 *
 * ## Security Properties
 *
 * - **Hiding (Computational)**: Cannot determine value from commitment
 * - **Binding (Computational)**: Cannot open commitment to different value
 * - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2) when blindings sum
 *
 * ## Secp256k1 Curve
 *
 * This implementation uses secp256k1 for compatibility with Ethereum's
 * native cryptography and existing EVM tooling.
 *
 * ## Ethereum Token Amounts
 *
 * Ethereum uses uint256 for token amounts (18 decimals for ETH, varies for ERC-20).
 * Pedersen commitments operate on values < curve order.
 *
 * @module chains/ethereum/commitment
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError, CryptoError, ErrorCode } from '../../errors'
import type { EthereumPedersenCommitment, ERC20TokenCommitment } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A commitment point without the blinding factor (for public sharing)
 */
export interface EthereumCommitmentPoint {
  /** The commitment point (compressed secp256k1, 33 bytes) */
  commitment: HexString
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Domain separation tag for H generation (Ethereum version)
 */
const H_DOMAIN = 'SIP-ETHEREUM-PEDERSEN-GENERATOR-H-v1'

/**
 * The generator G (secp256k1 base point)
 */
const G = secp256k1.ProjectivePoint.BASE

/**
 * The secp256k1 curve order n
 */
export const SECP256K1_ORDER = secp256k1.CURVE.n

/**
 * Maximum ETH amount (theoretical max uint256, but we limit to curve order)
 */
export const MAX_ETH_AMOUNT = 2n ** 256n - 1n

/**
 * Maximum value that can be committed (must be < curve order)
 */
export const MAX_COMMITMENT_VALUE = SECP256K1_ORDER - 1n

// ─── Generator H Construction ─────────────────────────────────────────────────

/**
 * The independent generator H (NUMS point)
 * Constructed via hash-to-curve with nothing-up-my-sleeve string.
 */
const H = generateH()

/**
 * Generate the independent generator H using NUMS method for secp256k1
 *
 * Uses a hash-and-check approach:
 * 1. Hash domain||counter to get 32 bytes
 * 2. Try to use as x-coordinate with even y
 * 3. If valid point and not identity/G, use it
 */
function generateH(): typeof G {
  let counter = 0

  while (counter < 256) {
    // Create input: domain || counter
    const input = new TextEncoder().encode(`${H_DOMAIN}:${counter}`)
    const hashBytes = sha256(input)

    try {
      // Try to create a point with the hash as x-coordinate (compressed, even y = 0x02)
      const compressedPoint = new Uint8Array(33)
      compressedPoint[0] = 0x02 // even y prefix
      compressedPoint.set(hashBytes, 1)

      const point = secp256k1.ProjectivePoint.fromHex(compressedPoint)

      // Verify it's not identity or G
      if (!point.equals(secp256k1.ProjectivePoint.ZERO)) {
        const gBytes = G.toRawBytes(true)
        const hBytes = point.toRawBytes(true)
        if (bytesToHex(gBytes) !== bytesToHex(hBytes)) {
          return point
        }
      }
    } catch {
      // Not a valid x-coordinate, try next counter
    }

    counter++
  }

  // Should never reach here with a proper hash function
  throw new CryptoError(
    'Failed to generate independent generator H after 256 attempts',
    ErrorCode.CRYPTO_FAILED
  )
}

// ─── Core Commitment Functions ────────────────────────────────────────────────

/**
 * Create a Pedersen commitment for an Ethereum amount
 *
 * Commitment: C = v*G + r*H where:
 * - v is the value (amount in wei)
 * - G is the secp256k1 generator
 * - r is a random blinding factor
 * - H is an independent generator (NUMS)
 *
 * @param value - Amount to commit (in wei or token smallest units)
 * @param blinding - Optional blinding factor (32 bytes). Random if not provided.
 * @returns Commitment and blinding factor
 *
 * @example
 * ```typescript
 * // Commit to 1 ETH (in wei)
 * const commitment = commitETH(10n ** 18n)
 * console.log(commitment.commitment) // '0x02...'
 * console.log(commitment.blinding)   // '0x...' (keep secret!)
 * ```
 */
export function commitETH(
  value: bigint,
  blinding?: Uint8Array
): EthereumPedersenCommitment {
  // Validate value
  if (value < 0n) {
    throw new ValidationError('value must be non-negative', 'value')
  }

  if (value > MAX_COMMITMENT_VALUE) {
    throw new ValidationError(
      `value must be less than curve order (${MAX_COMMITMENT_VALUE})`,
      'value'
    )
  }

  // Generate or use provided blinding factor
  const blindingBytes = blinding ?? randomBytes(32)

  // Convert blinding to scalar (mod n)
  const blindingScalar = bytesToBigInt(blindingBytes) % SECP256K1_ORDER

  // Compute commitment: C = v*G + r*H
  // Special case: if value is 0, commitment is just r*H
  let commitment: typeof G
  if (value === 0n) {
    commitment = H.multiply(blindingScalar)
  } else {
    const vG = G.multiply(value)
    const rH = H.multiply(blindingScalar)
    commitment = vG.add(rH)
  }

  // Compress the commitment point
  const commitmentBytes = commitment.toRawBytes(true)

  return {
    commitment: `0x${bytesToHex(commitmentBytes)}` as HexString,
    blinding: `0x${bytesToHex(blindingBytes)}` as HexString,
  }
}

/**
 * Verify a Pedersen commitment opening
 *
 * Checks that C = v*G + r*H for the given value and blinding.
 *
 * @param commitment - The commitment to verify
 * @param value - The claimed value
 * @param blinding - The blinding factor
 * @returns True if the opening is valid
 *
 * @example
 * ```typescript
 * const isValid = verifyOpeningETH(
 *   commitment.commitment,
 *   originalValue,
 *   commitment.blinding
 * )
 * console.log(isValid) // true
 * ```
 */
export function verifyOpeningETH(
  commitment: HexString,
  value: bigint,
  blinding: HexString
): boolean {
  try {
    // Parse commitment point
    const commitmentBytes = hexToBytes(commitment.slice(2))
    const commitmentPoint = secp256k1.ProjectivePoint.fromHex(commitmentBytes)

    // Parse blinding factor
    const blindingBytes = hexToBytes(blinding.slice(2))
    const blindingScalar = bytesToBigInt(blindingBytes) % SECP256K1_ORDER

    // Recompute expected commitment
    let expectedCommitment: typeof G
    if (value === 0n) {
      expectedCommitment = H.multiply(blindingScalar)
    } else {
      const vG = G.multiply(value)
      const rH = H.multiply(blindingScalar)
      expectedCommitment = vG.add(rH)
    }

    // Compare
    return commitmentPoint.equals(expectedCommitment)
  } catch {
    return false
  }
}

// ─── ERC-20 Token Commitments ─────────────────────────────────────────────────

/**
 * Create a Pedersen commitment for an ERC-20 token amount
 *
 * @param amount - Amount in token's smallest units
 * @param tokenContract - ERC-20 token contract address
 * @param decimals - Token decimals
 * @param blinding - Optional blinding factor
 * @returns Token commitment with metadata
 *
 * @example
 * ```typescript
 * // Commit to 100 USDC (6 decimals)
 * const commitment = commitERC20Token(
 *   100_000_000n, // 100 USDC in smallest units
 *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *   6
 * )
 * ```
 */
export function commitERC20Token(
  amount: bigint,
  tokenContract: HexString,
  decimals: number,
  blinding?: Uint8Array
): ERC20TokenCommitment {
  const base = commitETH(amount, blinding)

  return {
    ...base,
    tokenContract,
    decimals,
    amountRaw: amount,
  }
}

/**
 * Verify an ERC-20 token commitment
 *
 * @param tokenCommitment - The token commitment to verify
 * @param expectedAmount - The expected amount
 * @returns True if valid
 */
export function verifyERC20TokenCommitment(
  tokenCommitment: ERC20TokenCommitment,
  expectedAmount: bigint
): boolean {
  return verifyOpeningETH(
    tokenCommitment.commitment,
    expectedAmount,
    tokenCommitment.blinding
  )
}

// ─── Homomorphic Operations ───────────────────────────────────────────────────

/**
 * Add two commitments (homomorphic addition)
 *
 * C(v1, r1) + C(v2, r2) = C(v1+v2, r1+r2)
 *
 * @param c1 - First commitment
 * @param c2 - Second commitment
 * @returns Sum commitment point
 *
 * @example
 * ```typescript
 * const c1 = commitETH(100n)
 * const c2 = commitETH(50n)
 * const sum = addCommitmentsETH(c1.commitment, c2.commitment)
 * // sum.commitment == commitment of 150n with r1+r2 blinding
 * ```
 */
export function addCommitmentsETH(
  c1: HexString,
  c2: HexString
): EthereumCommitmentPoint {
  const point1 = secp256k1.ProjectivePoint.fromHex(hexToBytes(c1.slice(2)))
  const point2 = secp256k1.ProjectivePoint.fromHex(hexToBytes(c2.slice(2)))

  const sum = point1.add(point2)
  const sumBytes = sum.toRawBytes(true)

  return {
    commitment: `0x${bytesToHex(sumBytes)}` as HexString,
  }
}

/**
 * Subtract two commitments (homomorphic subtraction)
 *
 * C(v1, r1) - C(v2, r2) = C(v1-v2, r1-r2)
 *
 * @param c1 - First commitment
 * @param c2 - Second commitment
 * @returns Difference commitment point
 */
export function subtractCommitmentsETH(
  c1: HexString,
  c2: HexString
): EthereumCommitmentPoint {
  const point1 = secp256k1.ProjectivePoint.fromHex(hexToBytes(c1.slice(2)))
  const point2 = secp256k1.ProjectivePoint.fromHex(hexToBytes(c2.slice(2)))

  const diff = point1.subtract(point2)
  const diffBytes = diff.toRawBytes(true)

  return {
    commitment: `0x${bytesToHex(diffBytes)}` as HexString,
  }
}

/**
 * Add two blinding factors (mod curve order)
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor
 * @returns Sum of blindings
 */
export function addBlindingsETH(b1: HexString, b2: HexString): HexString {
  const scalar1 = bytesToBigInt(hexToBytes(b1.slice(2)))
  const scalar2 = bytesToBigInt(hexToBytes(b2.slice(2)))

  const sum = (scalar1 + scalar2) % SECP256K1_ORDER
  const sumBytes = bigIntToBytes(sum, 32)

  return `0x${bytesToHex(sumBytes)}` as HexString
}

/**
 * Subtract two blinding factors (mod curve order)
 *
 * @param b1 - First blinding factor
 * @param b2 - Second blinding factor
 * @returns Difference of blindings
 */
export function subtractBlindingsETH(b1: HexString, b2: HexString): HexString {
  const scalar1 = bytesToBigInt(hexToBytes(b1.slice(2)))
  const scalar2 = bytesToBigInt(hexToBytes(b2.slice(2)))

  // Handle underflow with modular arithmetic
  const diff = (scalar1 - scalar2 + SECP256K1_ORDER) % SECP256K1_ORDER
  const diffBytes = bigIntToBytes(diff, 32)

  return `0x${bytesToHex(diffBytes)}` as HexString
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Get the generators G and H
 *
 * @returns Object with G and H as hex strings
 */
export function getGeneratorsETH(): { G: HexString; H: HexString } {
  return {
    G: `0x${bytesToHex(G.toRawBytes(true))}` as HexString,
    H: `0x${bytesToHex(H.toRawBytes(true))}` as HexString,
  }
}

/**
 * Generate a random blinding factor
 *
 * @returns Random 32-byte blinding factor
 */
export function generateBlindingETH(): HexString {
  const blinding = randomBytes(32)
  return `0x${bytesToHex(blinding)}` as HexString
}

/**
 * Convert ETH amount to wei
 *
 * @param amount - Amount in ETH (as number or string)
 * @param decimals - Decimals (default 18 for ETH)
 * @returns Amount in wei
 *
 * @example
 * ```typescript
 * const wei = toWei(1.5) // 1.5 ETH
 * console.log(wei) // 1500000000000000000n
 * ```
 */
export function toWei(amount: number | string, decimals: number = 18): bigint {
  const str = typeof amount === 'number' ? amount.toString() : amount
  const [whole, fraction = ''] = str.split('.')

  // Pad or truncate fraction to match decimals
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const combined = `${whole}${paddedFraction}`

  return BigInt(combined)
}

/**
 * Convert wei to ETH
 *
 * @param wei - Amount in wei
 * @param decimals - Decimals (default 18 for ETH)
 * @returns Amount in ETH as string
 *
 * @example
 * ```typescript
 * const eth = fromWei(1500000000000000000n)
 * console.log(eth) // '1.5'
 * ```
 */
export function fromWei(wei: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = wei / divisor
  const fraction = wei % divisor

  if (fraction === 0n) {
    return whole.toString()
  }

  const fractionStr = fraction.toString().padStart(decimals, '0')
  // Remove trailing zeros
  const trimmed = fractionStr.replace(/0+$/, '')

  return `${whole}.${trimmed}`
}

/**
 * Create a zero commitment (for proving zero balance)
 *
 * @returns Commitment to zero value
 */
export function createZeroCommitmentETH(): EthereumPedersenCommitment {
  return commitETH(0n)
}

/**
 * Check if a commitment is to zero (given the blinding)
 *
 * @param commitment - The commitment
 * @param blinding - The blinding factor
 * @returns True if commitment is to zero
 */
export function isZeroCommitmentETH(
  commitment: HexString,
  blinding: HexString
): boolean {
  return verifyOpeningETH(commitment, 0n, blinding)
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Convert bytes to bigint (big-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) + BigInt(bytes[i])
  }
  return result
}

/**
 * Convert bigint to bytes (big-endian)
 */
function bigIntToBytes(num: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let n = num
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return bytes
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}
