/**
 * Cryptographic utilities for SIP Protocol
 *
 * For ZK proofs, use ProofProvider:
 * @see ./proofs/interface.ts for the proof provider interface
 * @see ./proofs/mock.ts for testing
 * @see ./proofs/noir.ts for production (Noir circuits)
 *
 * For Pedersen commitments, use the dedicated commitment module:
 * @see ./commitment.ts for secure Pedersen commitment implementation
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type { Commitment, HexString, Hash } from '@sip-protocol/types'
import { commit, verifyOpening } from './commitment'
import { ValidationError, ErrorCode } from './errors'

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
 * Generate a random intent ID
 */
export function generateIntentId(): string {
  const bytes = randomBytes(16)
  return `sip-${bytesToHex(bytes)}`
}

/**
 * Hash data using SHA256
 */
export function hash(data: string | Uint8Array): Hash {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return `0x${bytesToHex(sha256(input))}` as Hash
}

/**
 * Generate random bytes
 */
export function generateRandomBytes(length: number): HexString {
  return `0x${bytesToHex(randomBytes(length))}` as HexString
}
