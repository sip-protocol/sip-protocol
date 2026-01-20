/**
 * Chain-Specific Optimizations - Auto-Selection Module
 *
 * Provides intelligent chain detection and optimization selection:
 * - Detects chain from context (chain ID, RPC, etc.)
 * - Selects optimal configuration automatically
 * - Unifies optimization APIs across chains
 *
 * @module optimizations
 */

import type { ChainId } from '@sip-protocol/types'

// Re-export chain-specific modules with namespaces to avoid conflicts
export * as solanaOptimizations from '../chains/solana/optimizations'
export * as evmOptimizations from '../chains/ethereum/optimizations'
export * as bnbOptimizations from '../chains/ethereum/bnb-optimizations'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Chain family for optimization selection
 */
export type ChainFamily = 'solana' | 'evm' | 'near' | 'bitcoin' | 'cosmos'

/**
 * Unified optimization profile (cross-chain)
 */
export type UnifiedOptimizationProfile =
  | 'economy'
  | 'standard'
  | 'fast'
  | 'urgent'

/**
 * Chain characteristics for optimization decisions
 */
export interface ChainCharacteristics {
  /** Chain family */
  family: ChainFamily
  /** Average block time in seconds */
  blockTime: number
  /** Whether chain has EIP-1559 style gas */
  hasEIP1559: boolean
  /** Whether chain is L2/rollup */
  isL2: boolean
  /** Relative cost tier (1=cheapest, 5=most expensive) */
  costTier: 1 | 2 | 3 | 4 | 5
  /** Whether chain supports blob transactions */
  supportsBlobs: boolean
  /** Native token symbol */
  nativeToken: string
}

/**
 * Unified transaction optimization result
 */
export interface UnifiedOptimizationResult {
  /** Chain being optimized for */
  chain: ChainId
  /** Chain family */
  family: ChainFamily
  /** Recommended fee configuration */
  fees: {
    /** For Solana: microlamports per CU, For EVM: wei */
    priorityFee: bigint
    /** For Solana: total lamports, For EVM: max fee per gas (wei) */
    maxFee: bigint
  }
  /** Resource limits */
  limits: {
    /** For Solana: compute units, For EVM: gas limit */
    computeLimit: bigint
  }
  /** Cross-chain recommendations */
  recommendations: string[]
  /** Chain-specific data */
  chainSpecific: Record<string, unknown>
}

// ─── Chain Detection ──────────────────────────────────────────────────────────

/**
 * Chain ID to family mapping
 */
const CHAIN_FAMILIES: Record<string, ChainFamily> = {
  // Solana
  solana: 'solana',
  'solana-mainnet': 'solana',
  'solana-devnet': 'solana',
  'solana-testnet': 'solana',

  // EVM
  ethereum: 'evm',
  arbitrum: 'evm',
  optimism: 'evm',
  base: 'evm',
  polygon: 'evm',
  bsc: 'evm',
  zksync: 'evm',
  scroll: 'evm',
  linea: 'evm',
  mantle: 'evm',
  blast: 'evm',

  // NEAR
  near: 'near',
  'near-mainnet': 'near',
  'near-testnet': 'near',

  // Bitcoin
  bitcoin: 'bitcoin',
  'bitcoin-mainnet': 'bitcoin',
  'bitcoin-testnet': 'bitcoin',

  // Cosmos
  cosmos: 'cosmos',
  osmosis: 'cosmos',
  celestia: 'cosmos',
}

/**
 * Chain characteristics database
 */
const CHAIN_CHARACTERISTICS: Record<string, ChainCharacteristics> = {
  solana: {
    family: 'solana',
    blockTime: 0.4,
    hasEIP1559: false,
    isL2: false,
    costTier: 1,
    supportsBlobs: false,
    nativeToken: 'SOL',
  },
  ethereum: {
    family: 'evm',
    blockTime: 12,
    hasEIP1559: true,
    isL2: false,
    costTier: 5,
    supportsBlobs: true,
    nativeToken: 'ETH',
  },
  arbitrum: {
    family: 'evm',
    blockTime: 0.25,
    hasEIP1559: true,
    isL2: true,
    costTier: 2,
    supportsBlobs: true,
    nativeToken: 'ETH',
  },
  optimism: {
    family: 'evm',
    blockTime: 2,
    hasEIP1559: true,
    isL2: true,
    costTier: 2,
    supportsBlobs: true,
    nativeToken: 'ETH',
  },
  base: {
    family: 'evm',
    blockTime: 2,
    hasEIP1559: true,
    isL2: true,
    costTier: 2,
    supportsBlobs: true,
    nativeToken: 'ETH',
  },
  polygon: {
    family: 'evm',
    blockTime: 2,
    hasEIP1559: true,
    isL2: true,
    costTier: 2,
    supportsBlobs: false,
    nativeToken: 'MATIC',
  },
  bsc: {
    family: 'evm',
    blockTime: 3,
    hasEIP1559: false,
    isL2: false,
    costTier: 1,
    supportsBlobs: false,
    nativeToken: 'BNB',
  },
  near: {
    family: 'near',
    blockTime: 1,
    hasEIP1559: false,
    isL2: false,
    costTier: 1,
    supportsBlobs: false,
    nativeToken: 'NEAR',
  },
  bitcoin: {
    family: 'bitcoin',
    blockTime: 600,
    hasEIP1559: false,
    isL2: false,
    costTier: 4,
    supportsBlobs: false,
    nativeToken: 'BTC',
  },
}

/**
 * Detect chain family from chain ID
 */
export function detectChainFamily(chainId: ChainId): ChainFamily {
  const normalized = chainId.toLowerCase().replace(/[-_]/g, '-')
  return CHAIN_FAMILIES[normalized] ?? 'evm' // Default to EVM
}

/**
 * Get chain characteristics
 */
export function getChainCharacteristics(chainId: ChainId): ChainCharacteristics {
  const normalized = chainId.toLowerCase().replace(/[-_]/g, '-')
  const base = normalized.split('-')[0]

  return (
    CHAIN_CHARACTERISTICS[normalized] ??
    CHAIN_CHARACTERISTICS[base] ?? {
      family: detectChainFamily(chainId),
      blockTime: 12,
      hasEIP1559: true,
      isL2: false,
      costTier: 3,
      supportsBlobs: false,
      nativeToken: 'ETH',
    }
  )
}

// ─── Auto-Selection Logic ─────────────────────────────────────────────────────

/**
 * Select optimal configuration based on chain
 *
 * @param chainId - Target chain identifier
 * @param profile - Optimization profile
 * @param options - Additional options
 * @returns Unified optimization result
 *
 * @example
 * ```typescript
 * // Automatically select optimal settings for Solana
 * const config = selectOptimalConfig('solana', 'standard')
 *
 * // For EVM chain
 * const ethConfig = selectOptimalConfig('ethereum', 'fast', {
 *   baseFee: 30_000_000_000n // 30 gwei
 * })
 * ```
 */
export function selectOptimalConfig(
  chainId: ChainId,
  profile: UnifiedOptimizationProfile = 'standard',
  options: {
    /** Current base fee (for EVM chains) */
    baseFee?: bigint
    /** Current priority fee percentiles (for Solana) */
    priorityFeePercentiles?: { p50: number; p75: number; p90: number }
    /** Transaction complexity hint */
    complexityHint?: 'simple' | 'medium' | 'complex'
  } = {}
): UnifiedOptimizationResult {
  const characteristics = getChainCharacteristics(chainId)
  const recommendations: string[] = []

  let priorityFee: bigint
  let maxFee: bigint
  let computeLimit: bigint
  const chainSpecific: Record<string, unknown> = {}

  switch (characteristics.family) {
    case 'solana': {
      // Solana optimization
      const cuMultipliers = { simple: 100000, medium: 200000, complex: 400000 }
      const baseLimit = cuMultipliers[options.complexityHint ?? 'medium']

      // Profile-based priority fee (microlamports per CU)
      const profileFees = { economy: 500, standard: 1000, fast: 5000, urgent: 20000 }
      const basePriorityFee = options.priorityFeePercentiles?.p50 ?? profileFees[profile]

      priorityFee = BigInt(basePriorityFee)
      computeLimit = BigInt(baseLimit)
      maxFee = (computeLimit * priorityFee) / 1_000_000n // Convert to lamports

      chainSpecific.useVersionedTx = options.complexityHint === 'complex'
      chainSpecific.useALT = options.complexityHint === 'complex'

      recommendations.push('Solana: Use versioned transactions for complex operations')
      if (characteristics.costTier === 1) {
        recommendations.push('Solana: Very low cost - prioritize speed over savings')
      }
      break
    }

    case 'evm': {
      // EVM optimization
      const baseFee = options.baseFee ?? 30_000_000_000n // 30 gwei default

      // Profile-based priority fee (wei)
      const profilePriorityFees = {
        economy: 1_000_000_000n, // 1 gwei
        standard: 2_000_000_000n, // 2 gwei
        fast: 5_000_000_000n, // 5 gwei
        urgent: 10_000_000_000n, // 10 gwei
      }

      priorityFee = profilePriorityFees[profile]
      maxFee = baseFee * 2n + priorityFee

      // Gas limit based on complexity
      const gasMultipliers = { simple: 50000n, medium: 150000n, complex: 500000n }
      computeLimit = gasMultipliers[options.complexityHint ?? 'medium']

      if (characteristics.isL2) {
        recommendations.push('L2: Lower fees, optimize calldata for L1 data costs')
        chainSpecific.isL2 = true
      }

      if (characteristics.supportsBlobs) {
        recommendations.push('EIP-4844: Use blobs for large data payloads')
        chainSpecific.supportsBlobs = true
      }

      if (chainId.toLowerCase() === 'bsc') {
        // BSC-specific: much lower base fee
        maxFee = 5_000_000_000n // 5 gwei typical for BSC
        priorityFee = 1_000_000_000n
        recommendations.push('BSC: Very low gas costs - use standard profile')
      }
      break
    }

    case 'near': {
      // NEAR uses storage staking, not gas in the same way
      const gasMultipliers = { simple: 5n, medium: 30n, complex: 100n }
      const baseGas = gasMultipliers[options.complexityHint ?? 'medium']

      computeLimit = baseGas * 10n ** 12n // TGas
      priorityFee = 0n // NEAR doesn't have priority fees
      maxFee = computeLimit // Gas attached

      chainSpecific.storageDeposit = true
      recommendations.push('NEAR: Attach storage deposit for new accounts/data')
      break
    }

    case 'bitcoin': {
      // Bitcoin uses sat/vB
      const profileFees = { economy: 5n, standard: 20n, fast: 50n, urgent: 100n }
      priorityFee = profileFees[profile] // sat/vB

      // Typical privacy tx is ~300 vBytes
      const vSize = options.complexityHint === 'complex' ? 500n : 300n
      computeLimit = vSize
      maxFee = priorityFee * vSize

      recommendations.push('Bitcoin: Use batching for multiple outputs')
      recommendations.push('Bitcoin: Wait for low fee periods for economy')
      break
    }

    default: {
      // Fallback to EVM-like
      priorityFee = 2_000_000_000n
      maxFee = 100_000_000_000n
      computeLimit = 100000n
    }
  }

  // Cross-chain cost comparison recommendation
  if (characteristics.costTier >= 4) {
    recommendations.push(
      `High cost chain (tier ${characteristics.costTier}) - consider L2 alternatives`
    )
  }

  return {
    chain: chainId,
    family: characteristics.family,
    fees: {
      priorityFee,
      maxFee,
    },
    limits: {
      computeLimit,
    },
    recommendations,
    chainSpecific,
  }
}

// ─── Cost Comparison ──────────────────────────────────────────────────────────

/**
 * Compare costs across multiple chains
 *
 * @param chains - Chains to compare
 * @param _complexityHint - Transaction complexity (reserved for future use)
 * @returns Cost comparison sorted by cost (cheapest first)
 */
export function compareCrossChainCosts(
  chains: ChainId[],
  _complexityHint: 'simple' | 'medium' | 'complex' = 'medium'
): Array<{
  chain: ChainId
  costTier: number
  nativeToken: string
  recommendation: string
}> {
  return chains
    .map((chain) => {
      const chars = getChainCharacteristics(chain)
      let recommendation: string

      switch (chars.costTier) {
        case 1:
          recommendation = 'Excellent - very low costs'
          break
        case 2:
          recommendation = 'Good - affordable for frequent use'
          break
        case 3:
          recommendation = 'Moderate - suitable for medium value txs'
          break
        case 4:
          recommendation = 'Expensive - use for high value only'
          break
        case 5:
          recommendation = 'Very expensive - consider alternatives'
          break
      }

      return {
        chain,
        costTier: chars.costTier,
        nativeToken: chars.nativeToken,
        recommendation,
      }
    })
    .sort((a, b) => a.costTier - b.costTier)
}

/**
 * Recommend cheapest chain for operation
 *
 * @param chains - Available chains
 * @param requirements - Operation requirements
 * @returns Recommended chain
 */
export function recommendCheapestChain(
  chains: ChainId[],
  requirements: {
    /** Required block time (seconds) */
    maxBlockTime?: number
    /** Requires blob support */
    needsBlobs?: boolean
    /** Preferred chain family */
    preferredFamily?: ChainFamily
  } = {}
): ChainId | undefined {
  const viable = chains.filter((chain) => {
    const chars = getChainCharacteristics(chain)

    if (requirements.maxBlockTime && chars.blockTime > requirements.maxBlockTime) {
      return false
    }

    if (requirements.needsBlobs && !chars.supportsBlobs) {
      return false
    }

    if (requirements.preferredFamily && chars.family !== requirements.preferredFamily) {
      return false
    }

    return true
  })

  if (viable.length === 0) return undefined

  // Sort by cost tier, then block time
  return viable.sort((a, b) => {
    const charsA = getChainCharacteristics(a)
    const charsB = getChainCharacteristics(b)

    if (charsA.costTier !== charsB.costTier) {
      return charsA.costTier - charsB.costTier
    }

    return charsA.blockTime - charsB.blockTime
  })[0]
}

// ─── Profile Selection ────────────────────────────────────────────────────────

/**
 * Recommend optimization profile based on urgency and value
 *
 * @param options - Profile selection options
 * @returns Recommended profile
 */
export function recommendProfile(options: {
  /** Transaction value in USD */
  valueUsd?: number
  /** Urgency level 1-10 */
  urgency?: number
  /** Chain being used */
  chain?: ChainId
}): UnifiedOptimizationProfile {
  const { valueUsd = 100, urgency = 5, chain } = options

  // For cheap chains, always use standard
  if (chain) {
    const chars = getChainCharacteristics(chain)
    if (chars.costTier <= 2) {
      return urgency > 7 ? 'fast' : 'standard'
    }
  }

  // Value-based selection
  if (valueUsd > 10000) {
    // High value: prioritize speed
    return urgency > 5 ? 'urgent' : 'fast'
  }

  if (valueUsd > 1000) {
    // Medium value: balance cost/speed
    return urgency > 7 ? 'fast' : 'standard'
  }

  // Low value: prioritize cost
  return urgency > 8 ? 'standard' : 'economy'
}
