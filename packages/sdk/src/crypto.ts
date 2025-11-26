/**
 * Cryptographic utilities for SIP Protocol
 *
 * IMPORTANT: ZK proof generation requires real Noir circuits.
 * Proof functions will throw ProofNotImplementedError until
 * real implementations are available (#14, #15, #16).
 *
 * For Pedersen commitments, use the dedicated commitment module:
 * @see ./commitment.ts for secure Pedersen commitment implementation
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'
import type { Commitment, ZKProof, HexString, Hash } from '@sip-protocol/types'
import { ProofNotImplementedError } from './errors'
import { commit, verifyOpening } from './commitment'

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
    throw new Error('Cannot verify commitment without blinding factor')
  }

  return verifyOpening(commitment.value, expectedValue, commitment.blindingFactor)
}

/**
 * Create a funding proof (ZK proof of sufficient funds)
 *
 * Proves: balance >= minimum_required without revealing balance.
 *
 * @throws {ProofNotImplementedError} Real Noir circuit implementation required
 * @see docs/specs/FUNDING-PROOF.md for specification (~22,000 constraints)
 */
export function createFundingProof(
  _inputAmount: bigint,
  _inputCommitment: Commitment,
): ZKProof {
  throw new ProofNotImplementedError(
    'funding',
    'docs/specs/FUNDING-PROOF.md',
  )
}

/**
 * Create a validity proof (ZK proof of intent authorization)
 *
 * Proves: intent is authorized by sender without revealing sender identity.
 *
 * @throws {ProofNotImplementedError} Real Noir circuit implementation required
 * @see docs/specs/VALIDITY-PROOF.md for specification (~72,000 constraints)
 */
export function createValidityProof(
  _intentId: string,
  _senderCommitment: Commitment,
): ZKProof {
  throw new ProofNotImplementedError(
    'validity',
    'docs/specs/VALIDITY-PROOF.md',
  )
}

/**
 * Create a fulfillment proof (ZK proof of correct execution)
 *
 * Proves: solver delivered output >= minimum to correct recipient.
 *
 * @throws {ProofNotImplementedError} Real Noir circuit implementation required
 * @see docs/specs/FULFILLMENT-PROOF.md for specification (~22,000 constraints)
 */
export function createFulfillmentProof(
  _intentId: string,
  _outputAmount: bigint,
): ZKProof {
  throw new ProofNotImplementedError(
    'fulfillment',
    'docs/specs/FULFILLMENT-PROOF.md',
  )
}

/**
 * Verify a ZK proof
 *
 * Verifies proof validity using the appropriate verification circuit.
 *
 * @throws {ProofNotImplementedError} Real Noir verifier implementation required
 */
export function verifyProof(_proof: ZKProof): boolean {
  // TODO: Implement real verification when circuits are ready (#14, #15, #16)
  // For now, throw error to prevent false security assumptions
  throw new ProofNotImplementedError(
    'funding', // Generic - could be any proof type
    'docs/specs/',
  )
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
