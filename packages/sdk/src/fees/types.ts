/**
 * Fee Types for SIP Protocol
 *
 * Defines fee structure, tiers, and configuration for protocol revenue.
 *
 * @module fees/types
 */

import type { ChainId, HexString } from '@sip-protocol/types'

// ─── Fee Models ──────────────────────────────────────────────────────────────

/**
 * Fee model type
 */
export type FeeModel =
  | 'flat' // Fixed fee per transaction
  | 'percentage' // Percentage of volume (basis points)
  | 'tiered' // Tiered based on volume
  | 'dynamic' // Dynamic based on network conditions

/**
 * Fee tier configuration
 */
export interface FeeTier {
  /** Tier name for display */
  name: string
  /** Minimum volume (USD) for this tier */
  minVolume: number
  /** Maximum volume (USD) for this tier (Infinity for unlimited) */
  maxVolume: number
  /** Fee rate in basis points (100 = 1%) */
  basisPoints: number
}

/**
 * Fee configuration for a chain
 */
export interface ChainFeeConfig {
  /** Chain identifier */
  chain: ChainId
  /** Fee model */
  model: FeeModel
  /** Base fee in basis points (for percentage model) */
  baseBps: number
  /** Flat fee in native token smallest unit (for flat model) */
  flatFee?: bigint
  /** Fee tiers (for tiered model) */
  tiers?: FeeTier[]
  /** Minimum fee in USD */
  minFeeUsd: number
  /** Maximum fee in USD (cap) */
  maxFeeUsd: number
  /** Fee discount for viewing key disclosure (basis points reduction) */
  viewingKeyDiscountBps: number
}

// ─── Fee Calculation ─────────────────────────────────────────────────────────

/**
 * Fee calculation input
 */
export interface FeeCalculationInput {
  /** Transaction amount in smallest units */
  amount: bigint
  /** Amount in USD for tier calculation */
  amountUsd: number
  /** Source chain */
  sourceChain: ChainId
  /** Destination chain */
  destinationChain: ChainId
  /** Whether viewing key is disclosed */
  viewingKeyDisclosed: boolean
  /** Custom fee override (for governance) */
  customBps?: number
}

/**
 * Fee calculation result
 */
export interface FeeCalculationResult {
  /** Protocol fee in source token smallest units */
  protocolFee: bigint
  /** Protocol fee in USD */
  protocolFeeUsd: number
  /** Fee rate applied (basis points) */
  appliedBps: number
  /** Fee tier used (if tiered model) */
  tierName?: string
  /** Discount applied (if viewing key disclosed) */
  discountBps: number
  /** Original fee before discount */
  originalFee: bigint
  /** Fee breakdown for display */
  breakdown: FeeBreakdown
}

/**
 * Fee breakdown for transparency
 */
export interface FeeBreakdown {
  /** Base protocol fee */
  baseFee: bigint
  /** Network/gas fee estimate */
  networkFee: bigint
  /** Total fee */
  totalFee: bigint
  /** Fee components */
  components: Array<{
    name: string
    amount: bigint
    description: string
  }>
}

// ─── Treasury Management ─────────────────────────────────────────────────────

/**
 * Treasury address configuration
 */
export interface TreasuryConfig {
  /** NEAR treasury account */
  nearAccount: string
  /** Ethereum treasury address */
  evmAddress: HexString
  /** Solana treasury address */
  solanaAddress: string
  /** Multi-sig threshold (if applicable) */
  multiSigThreshold?: number
  /** Multi-sig signers */
  multiSigSigners?: string[]
}

/**
 * Fee collection event
 */
export interface FeeCollectionEvent {
  /** Event ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Chain where fee was collected */
  chain: ChainId
  /** Transaction hash */
  txHash: string
  /** Fee amount in native token */
  amount: bigint
  /** Fee amount in USD */
  amountUsd: number
  /** Source transaction (swap/intent) */
  sourceTransaction?: string
  /** Treasury account that received fee */
  treasuryAccount: string
}

/**
 * Fee statistics
 */
export interface FeeStats {
  /** Total fees collected (USD) */
  totalCollectedUsd: number
  /** Total fees collected by chain */
  byChain: Record<ChainId, bigint>
  /** Total transactions */
  totalTransactions: number
  /** Average fee per transaction (USD) */
  avgFeeUsd: number
  /** Period start */
  periodStart: number
  /** Period end */
  periodEnd: number
}

// ─── Fee Contract Interface ──────────────────────────────────────────────────

/**
 * Fee contract state
 */
export interface FeeContractState {
  /** Contract owner (can update config) */
  owner: string
  /** Treasury account */
  treasury: string
  /** Current fee configuration */
  config: ChainFeeConfig
  /** Total fees collected */
  totalCollected: bigint
  /** Paused state */
  paused: boolean
  /** Governance contract (if applicable) */
  governanceContract?: string
}

/**
 * Fee contract methods
 */
export interface FeeContractMethods {
  /** Calculate fee for a transaction */
  calculateFee(input: FeeCalculationInput): Promise<FeeCalculationResult>
  /** Collect fee (called during swap) */
  collectFee(amount: bigint, txHash: string): Promise<string>
  /** Update fee configuration (owner only) */
  updateConfig(config: Partial<ChainFeeConfig>): Promise<void>
  /** Withdraw fees to treasury (owner only) */
  withdrawToTreasury(amount?: bigint): Promise<string>
  /** Get contract state */
  getState(): Promise<FeeContractState>
  /** Pause fee collection (emergency) */
  pause(): Promise<void>
  /** Resume fee collection */
  resume(): Promise<void>
}

// ─── Fee Waiver ──────────────────────────────────────────────────────────────

/**
 * Fee waiver type
 */
export type FeeWaiverType =
  | 'viewing_key' // Viewing key disclosure
  | 'governance' // Governance holder
  | 'volume' // High volume tier
  | 'promotional' // Promotional period
  | 'partner' // Partner integration

/**
 * Fee waiver configuration
 */
export interface FeeWaiver {
  /** Waiver type */
  type: FeeWaiverType
  /** Discount in basis points (100 = 1% off) */
  discountBps: number
  /** Waiver expiry (0 for permanent) */
  expiresAt?: number
  /** Maximum uses (0 for unlimited) */
  maxUses?: number
  /** Current uses */
  currentUses: number
  /** Waiver code (for promotional) */
  code?: string
}

// ─── Governance ──────────────────────────────────────────────────────────────

/**
 * Fee governance proposal
 */
export interface FeeGovernanceProposal {
  /** Proposal ID */
  id: string
  /** Proposal type */
  type: 'update_config' | 'update_treasury' | 'pause' | 'resume'
  /** Proposed changes */
  changes: Partial<ChainFeeConfig> | Partial<TreasuryConfig>
  /** Proposer */
  proposer: string
  /** Votes for */
  votesFor: bigint
  /** Votes against */
  votesAgainst: bigint
  /** Voting end time */
  votingEndsAt: number
  /** Execution time (after voting) */
  executionTime: number
  /** Status */
  status: 'pending' | 'passed' | 'rejected' | 'executed'
}
