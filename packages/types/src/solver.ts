/**
 * Solver interface types for SIP Protocol
 *
 * Defines the interface for solvers to fulfill shielded intents
 * while preserving user privacy.
 */

import type { ShieldedIntent, Quote, FulfillmentResult } from './intent'
import type { ZKProof, HexString, Commitment } from './crypto'
import type { Asset } from './asset'
import type { ChainId } from './stealth'

// ─── Solver Information ────────────────────────────────────────────────────────

/**
 * Solver information and metadata
 */
export interface Solver {
  /** Unique solver identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Supported chains */
  supportedChains: ChainId[]
  /** Solver's reputation score (0-100) */
  reputation: number
  /** Total volume processed (in USD equivalent) */
  totalVolume: bigint
  /** Success rate (0-1) */
  successRate: number
  /** Minimum order size (in USD equivalent) */
  minOrderSize?: bigint
  /** Maximum order size (in USD equivalent) */
  maxOrderSize?: bigint
  /** Solver's public key for encrypted communication */
  publicKey?: HexString
}

/**
 * Solver capabilities
 */
export interface SolverCapabilities {
  /** Supported input chains */
  inputChains: ChainId[]
  /** Supported output chains */
  outputChains: ChainId[]
  /** Supported asset pairs (input -> output[]) */
  supportedPairs: Map<string, string[]>
  /** Supports shielded mode */
  supportsShielded: boolean
  /** Supports compliant mode (viewing keys) */
  supportsCompliant: boolean
  /** Supports streaming/partial fills */
  supportsPartialFill: boolean
  /** Average fulfillment time in seconds */
  avgFulfillmentTime: number
}

// ─── Intent Visibility ─────────────────────────────────────────────────────────

/**
 * What solvers can see from a ShieldedIntent
 *
 * This type represents the PUBLIC view of an intent that solvers
 * receive when evaluating whether to provide a quote.
 *
 * Privacy guarantees:
 * - Sender identity: HIDDEN (only commitment visible)
 * - Input amount: HIDDEN (only commitment visible)
 * - Recipient: ONE-TIME stealth address (unlinkable)
 * - Output requirements: VISIBLE (needed for quoting)
 */
export interface SolverVisibleIntent {
  /** Intent identifier */
  intentId: string
  /** Protocol version */
  version: string
  /** Privacy level (affects what proofs are required) */
  privacyLevel: string
  /** Intent creation timestamp */
  createdAt: number
  /** Intent expiry timestamp */
  expiry: number

  // ─── Public Output Requirements ───────────────────────────
  /** Desired output asset (VISIBLE) */
  outputAsset: Asset
  /** Minimum acceptable output amount (VISIBLE) */
  minOutputAmount: bigint
  /** Maximum acceptable slippage (VISIBLE) */
  maxSlippage: number

  // ─── Hidden Input (Commitments Only) ──────────────────────
  /** Commitment to input amount - solver cannot see actual amount */
  inputCommitment: Commitment
  /** Commitment to sender - solver cannot see sender identity */
  senderCommitment: Commitment

  // ─── Recipient (Stealth Address) ──────────────────────────
  /** One-time stealth address - unlinkable to recipient's identity */
  recipientStealthAddress: HexString
  /** Ephemeral public key for stealth derivation */
  ephemeralPublicKey: HexString

  // ─── Required Proofs ──────────────────────────────────────
  /** Funding proof (proves sufficient balance without revealing amount) */
  fundingProof: ZKProof
  /** Validity proof (proves intent is well-formed) */
  validityProof: ZKProof
}

// ─── Solver Quote ──────────────────────────────────────────────────────────────

/**
 * Extended quote with solver-specific details
 */
export interface SolverQuote extends Quote {
  /** Solver's signature on this quote */
  signature: HexString
  /** Quote validity period (Unix timestamp) */
  validUntil: number
  /** Gas estimation for fulfillment */
  estimatedGas?: bigint
  /** Route/path for the swap (if applicable) */
  route?: SwapRoute
}

/**
 * Swap route for multi-hop swaps
 */
export interface SwapRoute {
  /** Route steps */
  steps: SwapRouteStep[]
  /** Total estimated gas */
  totalGas: bigint
  /** Expected output after all steps */
  expectedOutput: bigint
}

/**
 * Single step in a swap route
 */
export interface SwapRouteStep {
  /** Protocol/DEX name */
  protocol: string
  /** Input asset for this step */
  inputAsset: Asset
  /** Output asset for this step */
  outputAsset: Asset
  /** Pool/pair address */
  poolAddress?: string
  /** Estimated output for this step */
  estimatedOutput: bigint
}

// ─── Solver Interface ──────────────────────────────────────────────────────────

/**
 * SIP Solver interface - what solvers must implement
 *
 * Solvers receive intents with hidden sender/amount information
 * and must fulfill output requirements based only on public data.
 */
export interface SIPSolver {
  /** Solver information */
  readonly info: Solver

  /** Solver capabilities */
  readonly capabilities: SolverCapabilities

  /**
   * Evaluate if solver can fulfill an intent
   *
   * @param intent - Visible portion of the shielded intent
   * @returns true if solver can potentially fulfill, false otherwise
   */
  canHandle(intent: SolverVisibleIntent): Promise<boolean>

  /**
   * Generate a quote for fulfilling an intent
   *
   * Solvers only see public fields - they cannot determine:
   * - Who is sending
   * - Exact input amount
   * - Recipient's real identity
   *
   * @param intent - Visible portion of the shielded intent
   * @returns Quote if solver can fulfill, null otherwise
   */
  generateQuote(intent: SolverVisibleIntent): Promise<SolverQuote | null>

  /**
   * Fulfill an intent after user accepts quote
   *
   * @param intent - Full shielded intent (still privacy-preserving)
   * @param quote - The accepted quote
   * @returns Fulfillment result with proof
   */
  fulfill(
    intent: ShieldedIntent,
    quote: SolverQuote,
  ): Promise<FulfillmentResult>

  /**
   * Cancel a pending fulfillment
   *
   * @param intentId - Intent to cancel
   * @returns true if cancelled, false if already fulfilled
   */
  cancel?(intentId: string): Promise<boolean>

  /**
   * Get status of a fulfillment
   *
   * @param intentId - Intent to check
   * @returns Current status or null if not found
   */
  getStatus?(intentId: string): Promise<FulfillmentStatus | null>
}

/**
 * Fulfillment status
 */
export interface FulfillmentStatus {
  /** Intent ID */
  intentId: string
  /** Current status */
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'
  /** Transaction hash (if submitted) */
  txHash?: string
  /** Estimated completion time */
  estimatedCompletion?: number
  /** Error message (if failed) */
  error?: string
}

// ─── Fulfillment Types ─────────────────────────────────────────────────────────

/**
 * Request to fulfill an intent
 */
export interface FulfillmentRequest {
  /** The intent to fulfill */
  intent: ShieldedIntent
  /** The accepted quote */
  quote: SolverQuote
  /** Solver's signature on the quote */
  solverSignature: HexString
  /** User's signature accepting the quote */
  userSignature: HexString
}

/**
 * Solver's fulfillment commitment (for escrow/collateral)
 */
export interface FulfillmentCommitment {
  /** Quote being committed to */
  quoteId: string
  /** Solver's collateral (locked until fulfillment) */
  collateral: bigint
  /** Deadline for fulfillment */
  deadline: number
  /** Proof of collateral lock */
  collateralProof: ZKProof
}

/**
 * Fulfillment proof for verification
 */
export interface FulfillmentProof {
  /** Intent that was fulfilled */
  intentId: string
  /** Quote that was used */
  quoteId: string
  /** Actual output amount delivered */
  outputAmount: bigint
  /** Destination transaction hash */
  txHash: string
  /** Block number of fulfillment */
  blockNumber: number
  /** ZK proof of correct fulfillment */
  proof: ZKProof
  /** Timestamp of fulfillment */
  timestamp: number
}

// ─── Solver Events ─────────────────────────────────────────────────────────────

/**
 * Events emitted by solvers
 */
export type SolverEvent =
  | { type: 'quote_generated'; data: { intentId: string; quote: SolverQuote } }
  | { type: 'fulfillment_started'; data: { intentId: string; txHash: string } }
  | { type: 'fulfillment_completed'; data: { intentId: string; proof: FulfillmentProof } }
  | { type: 'fulfillment_failed'; data: { intentId: string; error: string } }

/**
 * Solver event listener
 */
export type SolverEventListener = (event: SolverEvent) => void
