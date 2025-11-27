/**
 * Shielded Intent types for SIP Protocol
 */

import type { PrivacyLevel } from './privacy'
import type { Commitment, ZKProof, Hash, HexString } from './crypto'
import type { StealthAddress } from './stealth'
import type { Asset, IntentInput, IntentOutput } from './asset'

/**
 * SIP Protocol version
 */
export const SIP_VERSION = 'sip-v1' as const

/**
 * Shielded Intent - core data structure
 *
 * Public fields are visible to solvers for quoting.
 * Private fields are hidden and verified via ZK proofs.
 */
export interface ShieldedIntent {
  // ─── Metadata ───────────────────────────────────────────────────
  /** Unique intent identifier */
  intentId: string
  /** Protocol version */
  version: typeof SIP_VERSION
  /** Privacy level for this intent */
  privacyLevel: PrivacyLevel
  /** Intent creation timestamp */
  createdAt: number
  /** Intent expiry timestamp */
  expiry: number

  // ─── Public Fields (visible to solvers) ──────────────────────────
  /** Desired output asset */
  outputAsset: Asset
  /** Minimum acceptable output amount */
  minOutputAmount: bigint
  /** Maximum acceptable slippage */
  maxSlippage: number

  // ─── Private Fields (hidden, verified via proofs) ────────────────
  /** Commitment to input amount (Pedersen commitment) */
  inputCommitment: Commitment
  /** Commitment to sender identity */
  senderCommitment: Commitment
  /** Stealth address for receiving output */
  recipientStealth: StealthAddress

  // ─── Proofs ──────────────────────────────────────────────────────
  /** Proof of sufficient funds */
  fundingProof: ZKProof
  /** Proof of intent validity */
  validityProof: ZKProof

  // ─── Optional (for compliant mode) ───────────────────────────────
  /** Hash of viewing key (if compliant mode) */
  viewingKeyHash?: Hash
}

/**
 * Parameters for creating a new shielded intent
 */
export interface CreateIntentParams {
  /** Input specification */
  input: IntentInput
  /** Output specification */
  output: IntentOutput
  /** Privacy level */
  privacy: PrivacyLevel
  /** Recipient's stealth meta-address (for shielded modes) */
  recipientMetaAddress?: string
  /** Viewing key (for compliant mode) */
  viewingKey?: HexString
  /** Time-to-live in seconds (default: 300) */
  ttl?: number
}

/**
 * Intent status
 */
export enum IntentStatus {
  /** Intent created, awaiting quotes */
  PENDING = 'pending',
  /** Quotes received, awaiting user selection */
  QUOTED = 'quoted',
  /** User accepted a quote, execution in progress */
  EXECUTING = 'executing',
  /** Intent successfully fulfilled */
  FULFILLED = 'fulfilled',
  /** Intent expired without fulfillment */
  EXPIRED = 'expired',
  /** Intent cancelled by user */
  CANCELLED = 'cancelled',
  /** Intent failed during execution */
  FAILED = 'failed',
}

/**
 * Quote from a solver
 */
export interface Quote {
  /** Quote identifier */
  quoteId: string
  /** Intent this quote is for */
  intentId: string
  /** Solver identifier */
  solverId: string
  /** Offered output amount */
  outputAmount: bigint
  /** Estimated execution time (seconds) */
  estimatedTime: number
  /** Quote expiry timestamp */
  expiry: number
  /** Solver's fee (in output asset) */
  fee: bigint
}

/**
 * Result of intent fulfillment
 */
export interface FulfillmentResult {
  /** Intent that was fulfilled */
  intentId: string
  /** Final status */
  status: IntentStatus.FULFILLED | IntentStatus.FAILED
  /** Actual output amount received */
  outputAmount?: bigint
  /** Transaction hash (only for transparent mode) */
  txHash?: string
  /** ZK proof of fulfillment (for shielded modes) */
  fulfillmentProof?: ZKProof
  /** Timestamp of fulfillment */
  fulfilledAt: number
  /** Error message (if failed) */
  error?: string
}

/**
 * Full intent with status tracking
 */
export interface TrackedIntent extends ShieldedIntent {
  /** Current status */
  status: IntentStatus
  /** Received quotes */
  quotes: Quote[]
  /** Selected quote (if any) */
  selectedQuote?: Quote
  /** Fulfillment result (if completed) */
  result?: FulfillmentResult
}
