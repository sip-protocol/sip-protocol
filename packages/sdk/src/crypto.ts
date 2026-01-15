/**
 * Cryptographic utilities for SIP Protocol
 *
 * This module provides low-level cryptographic primitives including:
 * - Hash functions (SHA-256)
 * - Random number generation
 * - Pedersen commitments (legacy wrappers)
 *
 * **Important:**
 * - For ZK proofs, use {@link ProofProvider} interface (see ./proofs/)
 * - For Pedersen commitments in new code, use ./commitment.ts directly
 * - This module maintains legacy functions for backward compatibility
 *
 * @module crypto
 * @see {@link ProofProvider} for zero-knowledge proof generation
 * @see ./commitment.ts for modern Pedersen commitment API
 * @see ./stealth.ts for stealth address cryptography
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type { Commitment, HexString, Hash } from '@sip-protocol/types'
import { commit, verifyOpening } from './commitment'
import { ValidationError, ErrorCode } from './errors'
import { warnOnce, deprecationMessage } from './utils'

/**
 * Create a Pedersen commitment to a value
 *
 * @deprecated Use `commit()` from './commitment' for new code.
 *             This wrapper maintains backward compatibility.
 *
 * @param value - The value to commit to
 * @param blindingFactor - Optional blinding factor (random if not provided)
 * @returns Commitment object (legacy format)
 */
export function createCommitment(
  value: bigint,
  blindingFactor?: Uint8Array,
): Commitment {
  warnOnce('createCommitment', deprecationMessage(
    'createCommitment()',
    'commit() from "./commitment"',
    '2026-06-01'
  ))

  const { commitment, blinding } = commit(value, blindingFactor)

  return {
    value: commitment,
    blindingFactor: blinding,
  }
}

/**
 * Verify a Pedersen commitment (requires knowing the value and blinding factor)
 *
 * @deprecated Use `verifyOpening()` from './commitment' for new code.
 */
export function verifyCommitment(
  commitment: Commitment,
  expectedValue: bigint,
): boolean {
  warnOnce('verifyCommitment', deprecationMessage(
    'verifyCommitment()',
    'verifyOpening() from "./commitment"',
    '2026-06-01'
  ))

  if (!commitment.blindingFactor) {
    throw new ValidationError(
      'cannot verify commitment without blinding factor',
      'commitment.blindingFactor',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  return verifyOpening(commitment.value, expectedValue, commitment.blindingFactor)
}

/**
 * Generate a unique intent identifier
 *
 * Creates a cryptographically random intent ID with the `sip-` prefix.
 * IDs are globally unique with negligible collision probability (128-bit randomness).
 *
 * @returns Intent ID string in format: `sip-<32 hex chars>`
 *
 * @example
 * ```typescript
 * const intentId = generateIntentId()
 * console.log(intentId) // "sip-a1b2c3d4e5f67890a1b2c3d4e5f67890"
 * ```
 */
export function generateIntentId(): string {
  const bytes = randomBytes(16)
  return `sip-${bytesToHex(bytes)}`
}

/**
 * Compute SHA-256 hash of data
 *
 * General-purpose cryptographic hash function used throughout SIP protocol
 * for commitment derivation, data integrity, and key derivation.
 *
 * **Use cases:**
 * - Hash transaction data for commitments
 * - Derive deterministic IDs from inputs
 * - Verify data integrity
 *
 * @param data - Input data as UTF-8 string or raw bytes
 * @returns 32-byte hash as hex string with `0x` prefix
 *
 * @example Hash a string
 * ```typescript
 * const messageHash = hash('Hello, SIP Protocol!')
 * console.log(messageHash) // "0xabc123..."
 * ```
 *
 * @example Hash binary data
 * ```typescript
 * const dataBytes = new Uint8Array([1, 2, 3, 4])
 * const dataHash = hash(dataBytes)
 * ```
 *
 * @example Use in commitment scheme
 * ```typescript
 * const intentHash = hash(intent.intentId)
 * const commitment = commit(amount, hexToBytes(intentHash))
 * ```
 */
export function hash(data: string | Uint8Array): Hash {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return `0x${bytesToHex(sha256(input))}` as Hash
}

/**
 * Generate cryptographically secure random bytes
 *
 * Uses the platform's secure random source (Web Crypto API in browsers,
 * crypto.randomBytes in Node.js) to generate unpredictable random data.
 *
 * **Use cases:**
 * - Generate private keys
 * - Create nonces for encryption
 * - Produce blinding factors for commitments
 * - Generate ephemeral keypairs
 *
 * @param length - Number of random bytes to generate
 * @returns Random bytes as hex string with `0x` prefix
 *
 * @example Generate a 32-byte private key
 * ```typescript
 * const privateKey = generateRandomBytes(32)
 * console.log(privateKey) // "0xabc123...def" (64 hex chars)
 * ```
 *
 * @example Generate a nonce
 * ```typescript
 * const nonce = generateRandomBytes(24) // For XChaCha20
 * ```
 */
export function generateRandomBytes(length: number): HexString {
  return `0x${bytesToHex(randomBytes(length))}` as HexString
}
