/**
 * Surveillance Analysis Types
 *
 * Type definitions for privacy scoring and wallet surveillance detection.
 *
 * @packageDocumentation
 */

/**
 * Risk level classification
 */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

/**
 * Privacy score breakdown by category
 */
export interface PrivacyScoreBreakdown {
  /** Address reuse score (0-25 points) */
  addressReuse: number
  /** Cluster exposure score (0-25 points) */
  clusterExposure: number
  /** Exchange exposure score (0-20 points) */
  exchangeExposure: number
  /** Temporal pattern score (0-15 points) */
  temporalPatterns: number
  /** Social linking score (0-15 points) */
  socialLinks: number
}

/**
 * Recommendation for improving privacy
 */
export interface PrivacyRecommendation {
  /** Unique identifier */
  id: string
  /** Severity of the issue */
  severity: RiskLevel
  /** Category this recommendation addresses */
  category: keyof PrivacyScoreBreakdown
  /** Human-readable title */
  title: string
  /** Detailed description of the issue */
  description: string
  /** Suggested action to improve */
  action: string
  /** Points that would be gained by fixing */
  potentialGain: number
}

/**
 * Complete privacy analysis result
 */
export interface PrivacyScore {
  /** Overall privacy score (0-100) */
  overall: number
  /** Score breakdown by category */
  breakdown: PrivacyScoreBreakdown
  /** Risk classification */
  risk: RiskLevel
  /** Actionable recommendations sorted by impact */
  recommendations: PrivacyRecommendation[]
  /** Analysis timestamp */
  analyzedAt: number
  /** Wallet address analyzed */
  walletAddress: string
}

/**
 * Address reuse detection result
 */
export interface AddressReuseResult {
  /** Number of times address was reused for receiving */
  receiveReuseCount: number
  /** Number of times address was reused for sending */
  sendReuseCount: number
  /** Total reuse instances */
  totalReuseCount: number
  /** Score deduction (0-25) */
  scoreDeduction: number
  /** Specific addresses that were reused */
  reusedAddresses: Array<{
    address: string
    useCount: number
    type: 'receive' | 'send' | 'both'
  }>
}

/**
 * Cluster detection result (Common Input Ownership Heuristic)
 */
export interface ClusterResult {
  /** Number of linked addresses detected */
  linkedAddressCount: number
  /** Confidence score (0-1) */
  confidence: number
  /** Score deduction (0-25) */
  scoreDeduction: number
  /** Detected address clusters */
  clusters: Array<{
    addresses: string[]
    linkType: 'common-input' | 'change-address' | 'consolidation'
    transactionCount: number
  }>
}

/**
 * Known exchange information
 */
export interface KnownExchange {
  name: string
  addresses: string[]
  type: 'cex' | 'dex'
  kycRequired: boolean
}

/**
 * Exchange exposure detection result
 */
export interface ExchangeExposureResult {
  /** Number of unique exchanges interacted with */
  exchangeCount: number
  /** Total deposits to exchanges */
  depositCount: number
  /** Total withdrawals from exchanges */
  withdrawalCount: number
  /** Score deduction (0-20) */
  scoreDeduction: number
  /** Detected exchange interactions */
  exchanges: Array<{
    name: string
    type: 'cex' | 'dex'
    kycRequired: boolean
    deposits: number
    withdrawals: number
    firstInteraction: number
    lastInteraction: number
  }>
}

/**
 * Temporal pattern detection result
 */
export interface TemporalPatternResult {
  /** Patterns detected */
  patterns: Array<{
    type: 'regular-schedule' | 'timezone-inference' | 'activity-burst'
    description: string
    confidence: number
    evidence: {
      dayOfWeek?: number[]
      hourOfDay?: number[]
      frequency?: string
    }
  }>
  /** Inferred timezone (if detectable) */
  inferredTimezone?: string
  /** Score deduction (0-15) */
  scoreDeduction: number
}

/**
 * Social profile linking result
 */
export interface SocialLinkResult {
  /** Whether wallet is doxxed (publicly linked to identity) */
  isDoxxed: boolean
  /** Partial identity exposure */
  partialExposure: boolean
  /** Score deduction (0-15) */
  scoreDeduction: number
  /** Detected links */
  links: Array<{
    platform: 'sns' | 'ens' | 'twitter' | 'arkham' | 'other'
    identifier: string
    confidence: number
  }>
}

/**
 * Transaction for analysis
 */
export interface AnalyzableTransaction {
  /** Transaction signature/hash */
  signature: string
  /** Block slot/number */
  slot: number
  /** Unix timestamp */
  timestamp: number
  /** Sender address (null if contract call) */
  sender: string | null
  /** Recipient address (null if contract call) */
  recipient: string | null
  /** Amount transferred (in smallest unit) */
  amount: bigint
  /** Token mint (null for native) */
  mint: string | null
  /** Fee paid */
  fee: bigint
  /** All addresses involved in transaction */
  involvedAddresses: string[]
  /** Transaction type */
  type: 'transfer' | 'swap' | 'stake' | 'other'
  /** Whether this was successful */
  success: boolean
}

/**
 * SIP protection comparison
 */
export interface SIPProtectionComparison {
  /** Current score without SIP */
  currentScore: number
  /** Projected score with SIP */
  projectedScore: number
  /** Improvement points */
  improvement: number
  /** Specific improvements by category */
  improvements: Array<{
    category: keyof PrivacyScoreBreakdown
    currentScore: number
    projectedScore: number
    reason: string
  }>
}

/**
 * Full analysis result with all details
 */
export interface FullAnalysisResult {
  /** Privacy score summary */
  privacyScore: PrivacyScore
  /** Address reuse details */
  addressReuse: AddressReuseResult
  /** Cluster detection details */
  cluster: ClusterResult
  /** Exchange exposure details */
  exchangeExposure: ExchangeExposureResult
  /** Temporal patterns details */
  temporalPatterns: TemporalPatternResult
  /** Social links details */
  socialLinks: SocialLinkResult
  /** SIP protection comparison */
  sipComparison: SIPProtectionComparison
  /** Raw transaction data analyzed */
  transactionCount: number
  /** Analysis duration in ms */
  analysisDurationMs: number
}

/**
 * Analyzer configuration
 */
export interface SurveillanceAnalyzerConfig {
  /** Helius API key */
  heliusApiKey: string
  /** Solana cluster */
  cluster?: 'mainnet-beta' | 'devnet'
  /** Maximum transactions to analyze (default: 1000) */
  maxTransactions?: number
  /** Include social link detection (requires external APIs) */
  includeSocialLinks?: boolean
  /** Custom exchange address list */
  customExchangeAddresses?: KnownExchange[]
}
