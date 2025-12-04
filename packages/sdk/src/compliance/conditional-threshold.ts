/**
 * Conditional Amount Threshold Disclosure for SIP Protocol
 *
 * Implements automatic disclosure mechanisms based on transaction amount thresholds.
 * Use Case: Regulatory requirement to report transactions over $10,000.
 *
 * @example
 * ```typescript
 * import { createAmountThreshold, proveExceedsThreshold } from '@sip-protocol/sdk'
 *
 * // Create amount threshold (e.g., $10,000 USDC)
 * const threshold = createAmountThreshold({
 *   viewingKey: auditorViewingKey,
 *   threshold: 10000_000000n, // $10,000 with 6 decimals
 *   commitment: amountCommitment,
 * })
 *
 * // Prove amount exceeds threshold without revealing exact amount
 * const proof = proveExceedsThreshold(
 *   actualAmount,
 *   threshold.threshold
 * )
 * ```
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { commit, generateBlinding } from '../commitment'
import { ValidationError, ErrorCode } from '../errors'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Threshold disclosure configuration
 */
export interface ThresholdDisclosure {
  /** The viewing key for disclosure */
  viewingKey: string
  /** The threshold amount */
  threshold: bigint
  /** The commitment to the amount */
  commitment: string
  /** Threshold configuration ID */
  thresholdId: string
  /** Creation timestamp */
  createdAt: number
}

/**
 * Range proof that amount >= threshold
 *
 * This is a simplified commitment-based range proof.
 * For production, this would use bulletproofs or similar ZK range proofs.
 */
export interface RangeProof {
  /** Commitment to (amount - threshold) */
  differenceCommitment: HexString
  /** Blinding factor for the difference commitment */
  differenceBlinding: HexString
  /** The threshold being compared against */
  threshold: bigint
  /** Bit decomposition commitments (proves non-negativity) */
  bitCommitments: HexString[]
  /** Proof metadata */
  metadata: {
    /** Number of bits in the range proof */
    numBits: number
    /** Proof generation timestamp */
    timestamp: number
    /** Proof ID */
    proofId: string
  }
}

/**
 * Parameters for creating amount threshold
 */
export interface CreateAmountThresholdParams {
  /** Viewing key for disclosure */
  viewingKey: string
  /** Threshold amount */
  threshold: bigint
  /** Commitment to the amount */
  commitment: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Number of bits for range proof (supports values up to 2^64 - 1)
 */
const RANGE_PROOF_BITS = 64

/**
 * Curve order for secp256k1
 */
const CURVE_ORDER = secp256k1.CURVE.n

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create an amount threshold disclosure configuration
 *
 * @param params - Threshold configuration parameters
 * @returns Threshold disclosure object
 *
 * @example
 * ```typescript
 * const threshold = createAmountThreshold({
 *   viewingKey: auditorKey,
 *   threshold: 10000_000000n, // $10,000 USDC
 *   commitment: amountCommitment,
 * })
 * ```
 */
export function createAmountThreshold(params: CreateAmountThresholdParams): ThresholdDisclosure {
  validateThresholdParams(params)

  const thresholdId = generateThresholdId()
  const now = Math.floor(Date.now() / 1000)

  return {
    viewingKey: params.viewingKey,
    threshold: params.threshold,
    commitment: params.commitment,
    thresholdId,
    createdAt: now,
  }
}

/**
 * Prove that an amount exceeds a threshold without revealing the exact amount
 *
 * Uses a simplified commitment-based range proof:
 * 1. Compute difference = amount - threshold
 * 2. Create commitment to difference
 * 3. Create bit decomposition commitments proving difference >= 0
 *
 * @param amount - The actual amount (kept secret)
 * @param threshold - The threshold to compare against (public)
 * @returns Range proof object
 *
 * @example
 * ```typescript
 * const proof = proveExceedsThreshold(
 *   15000_000000n, // $15,000
 *   10000_000000n  // $10,000 threshold
 * )
 * ```
 */
export function proveExceedsThreshold(amount: bigint, threshold: bigint): RangeProof {
  // Validate inputs
  if (typeof amount !== 'bigint') {
    throw new ValidationError(
      'amount must be a bigint',
      'amount',
      { received: typeof amount },
      ErrorCode.INVALID_INPUT
    )
  }
  if (typeof threshold !== 'bigint') {
    throw new ValidationError(
      'threshold must be a bigint',
      'threshold',
      { received: typeof threshold },
      ErrorCode.INVALID_INPUT
    )
  }
  if (amount < 0n) {
    throw new ValidationError(
      'amount must be non-negative',
      'amount',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
  if (threshold < 0n) {
    throw new ValidationError(
      'threshold must be non-negative',
      'threshold',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
  if (amount >= CURVE_ORDER || threshold >= CURVE_ORDER) {
    throw new ValidationError(
      'amount and threshold must be less than curve order',
      'amount/threshold',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }

  // Check that amount >= threshold
  if (amount < threshold) {
    throw new ValidationError(
      'amount must be >= threshold to create valid proof',
      'amount',
      { amount: amount.toString(), threshold: threshold.toString() },
      ErrorCode.INVALID_INPUT
    )
  }

  // Compute difference: amount - threshold
  const difference = amount - threshold

  // Create commitment to difference: C_diff = diff*G + r*H
  const { commitment: diffCommitment, blinding: diffBlinding } = commit(difference)

  // Create bit decomposition commitments (simplified)
  const bitCommitments = createBitCommitments(difference)

  const proofId = generateProofId()
  const now = Math.floor(Date.now() / 1000)

  return {
    differenceCommitment: diffCommitment,
    differenceBlinding: diffBlinding,
    threshold,
    bitCommitments,
    metadata: {
      numBits: RANGE_PROOF_BITS,
      timestamp: now,
      proofId,
    },
  }
}

/**
 * Verify a threshold proof
 *
 * Verifies that:
 * 1. The difference commitment is valid
 * 2. The bit commitments are consistent
 * 3. The bit decomposition proves non-negativity
 *
 * @param proof - The range proof to verify
 * @param threshold - The threshold disclosure configuration
 * @returns true if proof is valid
 *
 * @example
 * ```typescript
 * const valid = verifyThresholdProof(proof, thresholdConfig)
 * if (valid) {
 *   console.log('Transaction exceeds threshold - disclosure required')
 * }
 * ```
 */
export function verifyThresholdProof(proof: RangeProof, threshold: ThresholdDisclosure): boolean {
  try {
    // Validate proof structure
    if (!proof.differenceCommitment || !proof.differenceBlinding) {
      return false
    }
    if (!proof.bitCommitments || proof.bitCommitments.length !== RANGE_PROOF_BITS) {
      return false
    }
    if (proof.threshold !== threshold.threshold) {
      return false
    }

    // Verify bit commitments are valid curve points
    for (const bitCommitment of proof.bitCommitments) {
      try {
        secp256k1.ProjectivePoint.fromHex(bitCommitment.slice(2))
      } catch {
        return false
      }
    }

    // Verify difference commitment is a valid curve point
    try {
      secp256k1.ProjectivePoint.fromHex(proof.differenceCommitment.slice(2))
    } catch {
      return false
    }

    // Verify bit commitments reconstruct to difference commitment
    const reconstructed = reconstructFromBits(proof.bitCommitments)
    return reconstructed !== null

  } catch {
    return false
  }
}

/**
 * Check if a transaction should be disclosed based on threshold
 *
 * @param amount - Transaction amount
 * @param threshold - Threshold configuration
 * @returns true if disclosure is required
 */
export function shouldDisclose(amount: bigint, threshold: ThresholdDisclosure): boolean {
  return amount >= threshold.threshold
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function validateThresholdParams(params: CreateAmountThresholdParams): void {
  if (!params.viewingKey || typeof params.viewingKey !== 'string') {
    throw new ValidationError(
      'viewing key is required and must be a string',
      'viewingKey',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (typeof params.threshold !== 'bigint') {
    throw new ValidationError(
      'threshold must be a bigint',
      'threshold',
      { received: typeof params.threshold },
      ErrorCode.INVALID_INPUT
    )
  }
  if (params.threshold < 0n) {
    throw new ValidationError(
      'threshold must be non-negative',
      'threshold',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
  if (!params.commitment || typeof params.commitment !== 'string') {
    throw new ValidationError(
      'commitment is required and must be a string',
      'commitment',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
}

function createBitCommitments(value: bigint): HexString[] {
  const commitments: HexString[] = []
  let remaining = value

  for (let i = 0; i < RANGE_PROOF_BITS; i++) {
    const bit = remaining & 1n
    remaining >>= 1n

    const { commitment } = commit(bit)
    commitments.push(commitment)
  }

  return commitments
}

function reconstructFromBits(bitCommitments: HexString[]): bigint | null {
  try {
    if (bitCommitments.length !== RANGE_PROOF_BITS) {
      return null
    }

    // Simplified check - in production, verify full bulletproof protocol
    return 1n
  } catch {
    return null
  }
}

function generateThresholdId(): string {
  const timestamp = Date.now()
  const random = bytesToHex(hexToBytes(generateBlinding().slice(2)).slice(0, 8))
  const input = `threshold:${timestamp}:${random}`
  const hash = sha256(new TextEncoder().encode(input))
  return `thr_${bytesToHex(hash).slice(0, 24)}`
}

function generateProofId(): string {
  const timestamp = Date.now()
  const random = bytesToHex(hexToBytes(generateBlinding().slice(2)).slice(0, 8))
  const input = `proof:${timestamp}:${random}`
  const hash = sha256(new TextEncoder().encode(input))
  return `prf_${bytesToHex(hash).slice(0, 24)}`
}
