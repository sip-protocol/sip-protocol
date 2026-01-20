/**
 * Solana Chain-Specific Optimizations
 *
 * Provides optimized configurations and utilities for Solana transactions:
 * - Compute unit optimization (CU budgeting)
 * - Priority fee strategies
 * - Address Lookup Tables (ALT) for tx size reduction
 * - Parallel batching strategies
 * - Account rent optimization
 *
 * @module chains/solana/optimizations
 */

// ─── Compute Unit Constants ───────────────────────────────────────────────────

/**
 * Default compute units for a transaction
 */
export const DEFAULT_COMPUTE_UNITS = 200_000

/**
 * Maximum compute units allowed per transaction
 */
export const MAX_COMPUTE_UNITS = 1_400_000

/**
 * Default priority fee in microlamports per compute unit
 */
export const DEFAULT_PRIORITY_FEE = 1000

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Compute unit budget configuration
 */
export interface ComputeBudgetConfig {
  /** Compute units to request */
  units: number
  /** Priority fee in microlamports per CU */
  microLamportsPerCU: number
  /** Total priority fee in lamports */
  totalPriorityFeeLamports: number
}

/**
 * Transaction optimization profile
 */
export type OptimizationProfile =
  | 'economy' // Lowest fees, may be slower
  | 'standard' // Balanced cost/speed
  | 'fast' // Higher fees, faster confirmation
  | 'urgent' // Maximum priority

/**
 * Network congestion level
 */
export type CongestionLevel = 'low' | 'medium' | 'high' | 'extreme'

/**
 * Transaction complexity estimate
 */
export interface TransactionComplexity {
  /** Estimated compute units needed */
  estimatedCU: number
  /** Number of accounts involved */
  accountCount: number
  /** Number of instructions */
  instructionCount: number
  /** Whether ALT is recommended */
  altRecommended: boolean
  /** Estimated transaction size in bytes */
  estimatedSizeBytes: number
}

/**
 * Optimization result with recommendations
 */
export interface OptimizationResult {
  /** Computed budget configuration */
  budget: ComputeBudgetConfig
  /** Network congestion assessment */
  congestion: CongestionLevel
  /** Recommendations for the transaction */
  recommendations: string[]
  /** Whether to use versioned transactions */
  useVersionedTx: boolean
  /** Whether to use Address Lookup Tables */
  useALT: boolean
}

/**
 * Priority fee percentiles from recent blocks
 */
export interface PriorityFeePercentiles {
  p25: number
  p50: number
  p75: number
  p90: number
  p99: number
  timestamp: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Base compute units for common operations
 */
export const OPERATION_CU_COSTS = {
  /** Base transaction overhead */
  base: 5000,
  /** SOL transfer */
  solTransfer: 3000,
  /** SPL token transfer (existing ATA) */
  splTransfer: 10000,
  /** SPL token transfer (new ATA creation) */
  splTransferWithATA: 35000,
  /** Memo program write */
  memo: 500,
  /** Compute budget instruction */
  computeBudget: 150,
  /** System program create account */
  createAccount: 5000,
  /** Ephemeral key derivation */
  keyDerivation: 2000,
  /** Signature verification */
  signatureVerify: 1000,
} as const

/**
 * Priority fee multipliers by profile
 */
const PROFILE_MULTIPLIERS: Record<OptimizationProfile, number> = {
  economy: 0.5,
  standard: 1.0,
  fast: 2.0,
  urgent: 5.0,
}

/**
 * Congestion thresholds (microlamports per CU)
 */
const CONGESTION_THRESHOLDS = {
  low: 1000, // < 1000 microlamports/CU
  medium: 5000, // 1000-5000
  high: 20000, // 5000-20000
  // > 20000 = extreme
}

/**
 * Max accounts before ALT is recommended
 */
const ALT_THRESHOLD_ACCOUNTS = 15

/**
 * Max transaction size before ALT is required (bytes)
 */
const MAX_TX_SIZE_WITHOUT_ALT = 1232

// ─── Compute Budget Functions ─────────────────────────────────────────────────

/**
 * Calculate optimal compute budget based on transaction complexity
 *
 * @param complexity - Transaction complexity estimate
 * @param profile - Optimization profile
 * @param currentFees - Current priority fee percentiles (optional)
 * @returns Compute budget configuration
 *
 * @example
 * ```typescript
 * const budget = calculateComputeBudget(
 *   { estimatedCU: 50000, accountCount: 5, instructionCount: 3 },
 *   'standard'
 * )
 * console.log(budget.units) // 60000 (with buffer)
 * console.log(budget.microLamportsPerCU) // 1000
 * ```
 */
export function calculateComputeBudget(
  complexity: Pick<TransactionComplexity, 'estimatedCU'>,
  profile: OptimizationProfile = 'standard',
  currentFees?: PriorityFeePercentiles
): ComputeBudgetConfig {
  // Add 20% buffer to estimated CU
  const bufferMultiplier = 1.2
  const requestedUnits = Math.min(
    Math.ceil(complexity.estimatedCU * bufferMultiplier),
    MAX_COMPUTE_UNITS
  )

  // Base priority fee selection based on percentile
  let baseFee: number
  if (currentFees) {
    // Use percentile based on profile
    switch (profile) {
      case 'economy':
        baseFee = currentFees.p25
        break
      case 'standard':
        baseFee = currentFees.p50
        break
      case 'fast':
        baseFee = currentFees.p75
        break
      case 'urgent':
        baseFee = currentFees.p99
        break
    }
  } else {
    // Use default with multiplier
    baseFee = DEFAULT_PRIORITY_FEE * PROFILE_MULTIPLIERS[profile]
  }

  // Ensure minimum fee
  const microLamportsPerCU = Math.max(baseFee, 100)

  // Calculate total fee
  const totalPriorityFeeLamports = Math.ceil(
    (requestedUnits * microLamportsPerCU) / 1_000_000
  )

  return {
    units: requestedUnits,
    microLamportsPerCU,
    totalPriorityFeeLamports,
  }
}

/**
 * Estimate compute units for a privacy transaction
 *
 * @param options - Transaction options
 * @returns Transaction complexity estimate
 */
export function estimatePrivacyTxComplexity(options: {
  /** Number of transfers in batch */
  transferCount: number
  /** Whether creating new ATAs */
  createsATAs: boolean
  /** Number of new ATAs to create */
  newATACount?: number
  /** Whether includes memo */
  includesMemo: boolean
  /** Custom instruction count */
  customInstructionCount?: number
}): TransactionComplexity {
  let estimatedCU = OPERATION_CU_COSTS.base

  // Add compute budget instruction cost
  estimatedCU += OPERATION_CU_COSTS.computeBudget * 2 // SetUnits + SetPriorityFee

  // Add transfer costs
  if (options.createsATAs) {
    const ataCount = options.newATACount ?? options.transferCount
    estimatedCU += OPERATION_CU_COSTS.splTransferWithATA * ataCount
    estimatedCU +=
      OPERATION_CU_COSTS.splTransfer * (options.transferCount - ataCount)
  } else {
    estimatedCU += OPERATION_CU_COSTS.splTransfer * options.transferCount
  }

  // Add memo cost
  if (options.includesMemo) {
    estimatedCU += OPERATION_CU_COSTS.memo
  }

  // Add ephemeral key derivation
  estimatedCU += OPERATION_CU_COSTS.keyDerivation

  // Estimate account count
  // Base: fee payer (1) + token program (1) + system program (1)
  // Per transfer: sender ATA (1) + receiver ATA (1) + mint (1)
  const baseAccounts = 3
  const accountsPerTransfer = options.createsATAs ? 5 : 3 // ATA program + rent sysvar for creation
  const accountCount = baseAccounts + accountsPerTransfer * options.transferCount

  // Instruction count
  const instructionCount =
    2 + // Compute budget
    options.transferCount + // Transfers
    (options.includesMemo ? 1 : 0) +
    (options.customInstructionCount ?? 0)

  // Estimate size (rough approximation)
  const baseSize = 100 // Signatures, header
  const perAccountSize = 32 // Pubkey
  const perInstructionSize = 50 // Average instruction data
  const estimatedSizeBytes =
    baseSize + accountCount * perAccountSize + instructionCount * perInstructionSize

  return {
    estimatedCU,
    accountCount,
    instructionCount,
    altRecommended:
      accountCount > ALT_THRESHOLD_ACCOUNTS ||
      estimatedSizeBytes > MAX_TX_SIZE_WITHOUT_ALT,
    estimatedSizeBytes,
  }
}

// ─── Congestion Assessment ────────────────────────────────────────────────────

/**
 * Assess network congestion level from priority fees
 *
 * @param medianFee - Median priority fee (microlamports per CU)
 * @returns Congestion level
 */
export function assessCongestion(medianFee: number): CongestionLevel {
  if (medianFee < CONGESTION_THRESHOLDS.low) return 'low'
  if (medianFee < CONGESTION_THRESHOLDS.medium) return 'medium'
  if (medianFee < CONGESTION_THRESHOLDS.high) return 'high'
  return 'extreme'
}

/**
 * Get recommended profile based on congestion
 *
 * @param congestion - Current congestion level
 * @param userPreference - User's preferred profile
 * @returns Recommended profile (may differ from preference in extreme congestion)
 */
export function getRecommendedProfile(
  congestion: CongestionLevel,
  userPreference: OptimizationProfile = 'standard'
): OptimizationProfile {
  // In extreme congestion, don't let users underpay
  if (congestion === 'extreme' && userPreference === 'economy') {
    return 'standard'
  }

  // In low congestion, economy is fine even for fast preference
  if (congestion === 'low' && userPreference === 'fast') {
    return 'standard'
  }

  return userPreference
}

// ─── Full Optimization ────────────────────────────────────────────────────────

/**
 * Get full optimization result for a transaction
 *
 * @param complexity - Transaction complexity
 * @param profile - Optimization profile
 * @param currentFees - Current priority fee percentiles
 * @returns Full optimization result with recommendations
 *
 * @example
 * ```typescript
 * const complexity = estimatePrivacyTxComplexity({
 *   transferCount: 1,
 *   createsATAs: true,
 *   includesMemo: true
 * })
 *
 * const result = optimizeTransaction(complexity, 'standard', feePercentiles)
 *
 * // Apply to transaction builder
 * builder.setComputeUnits(result.budget.units)
 * builder.setPriorityFee(result.budget.microLamportsPerCU)
 * ```
 */
export function optimizeTransaction(
  complexity: TransactionComplexity,
  profile: OptimizationProfile = 'standard',
  currentFees?: PriorityFeePercentiles
): OptimizationResult {
  const congestion = currentFees
    ? assessCongestion(currentFees.p50)
    : 'medium'

  const adjustedProfile = getRecommendedProfile(congestion, profile)
  const budget = calculateComputeBudget(complexity, adjustedProfile, currentFees)

  const recommendations: string[] = []

  // ALT recommendations
  if (complexity.altRecommended) {
    recommendations.push(
      'Use Address Lookup Tables (ALT) to reduce transaction size'
    )
  }

  // Congestion-based recommendations
  if (congestion === 'extreme') {
    recommendations.push(
      'Network is extremely congested - consider waiting or using urgent priority'
    )
  } else if (congestion === 'high') {
    recommendations.push(
      'High network congestion - fast or urgent profile recommended'
    )
  }

  // CU recommendations
  if (complexity.estimatedCU > 200000) {
    recommendations.push(
      'High compute usage - ensure sufficient CU budget to avoid failures'
    )
  }

  // Versioned tx recommendation
  const useVersionedTx = complexity.accountCount > 10 || complexity.altRecommended

  if (useVersionedTx) {
    recommendations.push('Use versioned transactions for better compatibility')
  }

  return {
    budget,
    congestion,
    recommendations,
    useVersionedTx,
    useALT: complexity.altRecommended,
  }
}

// ─── Batch Optimization ───────────────────────────────────────────────────────

/**
 * Split transfers into optimal batches
 *
 * Solana has limits on transaction size and compute units.
 * This function splits a large batch into optimal sub-batches.
 *
 * @param transferCount - Total number of transfers
 * @param options - Batch options
 * @returns Array of batch sizes
 *
 * @example
 * ```typescript
 * const batches = calculateOptimalBatches(10, { maxCUPerTx: 400000 })
 * // Returns [3, 3, 3, 1] - 4 transactions
 * ```
 */
export function calculateOptimalBatches(
  transferCount: number,
  options: {
    /** Max compute units per transaction */
    maxCUPerTx?: number
    /** Max accounts per transaction */
    maxAccountsPerTx?: number
    /** Whether transfers create ATAs */
    createsATAs?: boolean
  } = {}
): number[] {
  const { maxCUPerTx = 400000, maxAccountsPerTx = 30, createsATAs = false } = options

  // Calculate max transfers per batch
  const cuPerTransfer = createsATAs
    ? OPERATION_CU_COSTS.splTransferWithATA
    : OPERATION_CU_COSTS.splTransfer
  const baseCU = OPERATION_CU_COSTS.base + OPERATION_CU_COSTS.computeBudget * 2
  const maxTransfersByCU = Math.floor((maxCUPerTx - baseCU) / cuPerTransfer)

  const accountsPerTransfer = createsATAs ? 5 : 3
  const baseAccounts = 3
  const maxTransfersByAccounts = Math.floor(
    (maxAccountsPerTx - baseAccounts) / accountsPerTransfer
  )

  const maxTransfersPerBatch = Math.min(maxTransfersByCU, maxTransfersByAccounts)

  // Split into batches
  const batches: number[] = []
  let remaining = transferCount

  while (remaining > 0) {
    const batchSize = Math.min(remaining, maxTransfersPerBatch)
    batches.push(batchSize)
    remaining -= batchSize
  }

  return batches
}

// ─── Rent Optimization ────────────────────────────────────────────────────────

/**
 * Calculate minimum rent for account data
 *
 * @param dataSize - Account data size in bytes
 * @returns Minimum rent in lamports
 */
export function calculateMinimumRent(dataSize: number): number {
  // Rent is based on data size plus 128 bytes for account header
  const accountSize = dataSize + 128
  // Rent-exempt minimum is ~6.96 lamports per byte for 2 years
  const rentPerByte = 6.96
  return Math.ceil(accountSize * rentPerByte)
}

/**
 * Token account rent (165 bytes data)
 */
export const TOKEN_ACCOUNT_RENT = calculateMinimumRent(165) // ~2039 lamports

/**
 * Mint account rent (82 bytes data)
 */
export const MINT_ACCOUNT_RENT = calculateMinimumRent(82) // ~1461 lamports

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000)
}

/**
 * Format priority fee for display
 */
export function formatPriorityFee(microLamportsPerCU: number): string {
  if (microLamportsPerCU < 1000) {
    return `${microLamportsPerCU} µL/CU`
  }
  return `${(microLamportsPerCU / 1000).toFixed(2)} mL/CU`
}

/**
 * Get optimization profile from user-friendly name
 */
export function parseOptimizationProfile(name: string): OptimizationProfile {
  const normalized = name.toLowerCase().trim()
  switch (normalized) {
    case 'economy':
    case 'eco':
    case 'low':
    case 'slow':
      return 'economy'
    case 'standard':
    case 'normal':
    case 'default':
    case 'medium':
      return 'standard'
    case 'fast':
    case 'high':
    case 'quick':
      return 'fast'
    case 'urgent':
    case 'max':
    case 'turbo':
    case 'instant':
      return 'urgent'
    default:
      return 'standard'
  }
}
