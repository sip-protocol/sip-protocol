/**
 * BNB Chain (BSC) Specific Optimizations
 *
 * Extends EVM optimizations with BSC-specific features:
 * - Lower gas costs than Ethereum mainnet
 * - PancakeSwap integration for DEX operations
 * - BEP-20 token handling (18 decimals for USDC/USDT)
 * - Cross-chain considerations (BSC ↔ Ethereum)
 *
 * @module chains/ethereum/bnb-optimizations
 */

import {
  BSC_TOKEN_CONTRACTS,
  BSC_TOKEN_DECIMALS,
  PANCAKESWAP_CONTRACTS,
  PANCAKESWAP_TESTNET_CONTRACTS,
  type EthereumNetwork,
} from './constants'
import {
  type EVMTransactionComplexity,
  type GasProfile,
  type EVMOptimizationResult,
  EVM_GAS_COSTS,
} from './optimizations'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * BNB Chain network type
 */
export type BNBNetwork = 'bsc' | 'bsc-testnet'

/**
 * PancakeSwap router version
 */
export type PancakeSwapVersion = 'v2' | 'v3' | 'smart'

/**
 * DEX swap optimization result
 */
export interface SwapOptimizationResult {
  /** Recommended router address */
  routerAddress: string
  /** Recommended version */
  version: PancakeSwapVersion
  /** Estimated gas limit */
  gasLimit: bigint
  /** Route recommendation */
  routeRecommendation: string
  /** Whether to use multi-hop */
  useMultiHop: boolean
}

/**
 * Cross-chain optimization result
 */
export interface CrossChainOptimizationResult {
  /** Source chain gas estimate */
  sourceGas: bigint
  /** Bridge recommendation */
  bridgeRecommendation: string
  /** Estimated total time (seconds) */
  estimatedTime: number
  /** Cost comparison */
  costSavings?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * BSC-specific gas costs (generally lower than Ethereum)
 */
export const BSC_GAS_COSTS = {
  /** Base transaction cost (same as EVM) */
  txBase: 21000n,
  /** BEP-20 transfer (similar to ERC-20) */
  bep20Transfer: 65000n,
  /** BEP-20 approve */
  bep20Approve: 46000n,
  /** PancakeSwap V2 swap (single hop) */
  pancakeV2Swap: 150000n,
  /** PancakeSwap V3 swap (single hop) */
  pancakeV3Swap: 200000n,
  /** PancakeSwap multi-hop (per additional hop) */
  additionalHop: 80000n,
} as const

/**
 * BSC baseline gas price (~3-5 gwei)
 */
export const BSC_BASE_GAS_PRICE = 3_000_000_000n // 3 gwei

/**
 * Gas profile multipliers for BSC
 * Lower than Ethereum due to cheaper gas
 */
const BSC_PROFILE_MULTIPLIERS: Record<GasProfile, number> = {
  economy: 0.9,
  standard: 1.0,
  fast: 1.2,
  instant: 1.5,
}

/**
 * Common swap routes on BSC
 */
export const COMMON_BSC_ROUTES = {
  /** BNB → USDT (direct) */
  'BNB-USDT': [BSC_TOKEN_CONTRACTS.WBNB, BSC_TOKEN_CONTRACTS.USDT],
  /** BNB → USDC (direct) */
  'BNB-USDC': [BSC_TOKEN_CONTRACTS.WBNB, BSC_TOKEN_CONTRACTS.USDC],
  /** USDT → USDC (direct) */
  'USDT-USDC': [BSC_TOKEN_CONTRACTS.USDT, BSC_TOKEN_CONTRACTS.USDC],
  /** ETH → BNB (via WBNB) */
  'ETH-BNB': [BSC_TOKEN_CONTRACTS.ETH, BSC_TOKEN_CONTRACTS.WBNB],
  /** BTCB → BNB */
  'BTCB-BNB': [BSC_TOKEN_CONTRACTS.BTCB, BSC_TOKEN_CONTRACTS.WBNB],
} as const

// ─── BSC-Specific Functions ───────────────────────────────────────────────────

/**
 * Check if network is BNB Chain
 */
export function isBNBNetwork(network: EthereumNetwork): network is BNBNetwork {
  return network === 'bsc' || network === 'bsc-testnet'
}

/**
 * PancakeSwap contract addresses type
 */
export type PancakeSwapAddresses = {
  SMART_ROUTER: string
  V3_ROUTER: string
  V2_ROUTER: string
  V3_FACTORY: string
  V2_FACTORY: string
  QUOTER_V2: string
}

/**
 * Get PancakeSwap contracts for network
 */
export function getPancakeSwapContracts(network: BNBNetwork): PancakeSwapAddresses {
  return network === 'bsc' ? PANCAKESWAP_CONTRACTS : PANCAKESWAP_TESTNET_CONTRACTS
}

/**
 * Get optimal router for swap
 *
 * @param tokenIn - Input token address
 * @param tokenOut - Output token address
 * @param amountIn - Input amount
 * @param network - BSC network
 * @returns Swap optimization result
 *
 * @example
 * ```typescript
 * const result = getOptimalRouter(
 *   BSC_TOKEN_CONTRACTS.WBNB,
 *   BSC_TOKEN_CONTRACTS.USDT,
 *   1000000000000000000n, // 1 BNB
 *   'bsc'
 * )
 * console.log(result.routerAddress) // SmartRouter address
 * ```
 */
export function getOptimalRouter(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  network: BNBNetwork
): SwapOptimizationResult {
  const contracts = getPancakeSwapContracts(network)

  // For large swaps, use SmartRouter for best routing
  const useSmartRouter = amountIn > 10n ** 18n // > 1 token (assuming 18 decimals)

  // Check if direct pair exists (simplified check)
  const hasDirectPair = isDirectPairAvailable(tokenIn, tokenOut)

  let version: PancakeSwapVersion
  let routerAddress: string
  let gasLimit: bigint
  let routeRecommendation: string

  if (useSmartRouter) {
    version = 'smart'
    routerAddress = contracts.SMART_ROUTER
    gasLimit = BSC_GAS_COSTS.pancakeV3Swap + BSC_GAS_COSTS.additionalHop
    routeRecommendation = 'SmartRouter finds optimal route across V2/V3 pools'
  } else if (hasDirectPair) {
    // For small swaps with direct pair, V2 is often cheaper
    version = 'v2'
    routerAddress = contracts.V2_ROUTER
    gasLimit = BSC_GAS_COSTS.pancakeV2Swap
    routeRecommendation = 'Direct V2 swap (lowest gas)'
  } else {
    // V3 for concentrated liquidity benefits
    version = 'v3'
    routerAddress = contracts.V3_ROUTER
    gasLimit = BSC_GAS_COSTS.pancakeV3Swap
    routeRecommendation = 'V3 for better price impact'
  }

  return {
    routerAddress,
    version,
    gasLimit,
    routeRecommendation,
    useMultiHop: !hasDirectPair,
  }
}

/**
 * Check if direct swap pair is available (simplified)
 */
function isDirectPairAvailable(tokenIn: string, tokenOut: string): boolean {
  const directPairs = new Set([
    `${BSC_TOKEN_CONTRACTS.WBNB}-${BSC_TOKEN_CONTRACTS.USDT}`,
    `${BSC_TOKEN_CONTRACTS.USDT}-${BSC_TOKEN_CONTRACTS.WBNB}`,
    `${BSC_TOKEN_CONTRACTS.WBNB}-${BSC_TOKEN_CONTRACTS.USDC}`,
    `${BSC_TOKEN_CONTRACTS.USDC}-${BSC_TOKEN_CONTRACTS.WBNB}`,
    `${BSC_TOKEN_CONTRACTS.USDT}-${BSC_TOKEN_CONTRACTS.USDC}`,
    `${BSC_TOKEN_CONTRACTS.USDC}-${BSC_TOKEN_CONTRACTS.USDT}`,
    `${BSC_TOKEN_CONTRACTS.WBNB}-${BSC_TOKEN_CONTRACTS.CAKE}`,
    `${BSC_TOKEN_CONTRACTS.CAKE}-${BSC_TOKEN_CONTRACTS.WBNB}`,
  ])

  return directPairs.has(`${tokenIn}-${tokenOut}`)
}

/**
 * Estimate gas for BSC privacy transaction
 *
 * @param options - Transaction options
 * @returns Gas estimate optimized for BSC
 */
export function estimateBSCPrivacyGas(options: {
  transferCount: number
  includesApproval: boolean
  includesSwap: boolean
  swapVersion?: PancakeSwapVersion
  hopCount?: number
}): bigint {
  let gas = EVM_GAS_COSTS.txBase

  // BEP-20 transfers
  gas += BSC_GAS_COSTS.bep20Transfer * BigInt(options.transferCount)

  // Approval
  if (options.includesApproval) {
    gas += BSC_GAS_COSTS.bep20Approve
  }

  // Swap
  if (options.includesSwap) {
    const baseSwapGas =
      options.swapVersion === 'v2'
        ? BSC_GAS_COSTS.pancakeV2Swap
        : BSC_GAS_COSTS.pancakeV3Swap

    const additionalHops = (options.hopCount ?? 1) - 1
    gas += baseSwapGas + BSC_GAS_COSTS.additionalHop * BigInt(additionalHops)
  }

  return gas
}

/**
 * Optimize BSC transaction
 *
 * @param complexity - Transaction complexity
 * @param profile - Gas profile
 * @param currentGasPrice - Current gas price (optional)
 * @returns Optimization result
 */
export function optimizeBSCTransaction(
  complexity: EVMTransactionComplexity,
  profile: GasProfile = 'standard',
  currentGasPrice?: bigint
): EVMOptimizationResult {
  const multiplier = BSC_PROFILE_MULTIPLIERS[profile]
  const baseGasPrice = currentGasPrice ?? BSC_BASE_GAS_PRICE

  // BSC has much lower gas prices, so we can afford higher limits
  const gasLimit = (complexity.estimatedGas * 130n) / 100n // 30% buffer

  const maxPriorityFeePerGas = BigInt(Math.ceil(1_000_000_000 * multiplier)) // 1 gwei base
  const maxFeePerGas = BigInt(Math.ceil(Number(baseGasPrice) * multiplier)) + maxPriorityFeePerGas

  const strategies: string[] = []

  // BSC-specific recommendations
  strategies.push('BSC gas is 10-100x cheaper than Ethereum mainnet')

  if (complexity.multicallRecommended) {
    strategies.push('Use Multicall3 for batch operations')
  }

  if (complexity.storageWrites > 5) {
    strategies.push('Consider batching writes to reduce per-tx overhead')
  }

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    strategies,
    useMulticall: complexity.multicallRecommended,
    useBlobs: false, // BSC doesn't support EIP-4844
  }
}

// ─── Cross-Chain Optimization ─────────────────────────────────────────────────

/**
 * Compare cost between BSC and Ethereum for same operation
 *
 * @param complexity - Transaction complexity
 * @param ethGasPrice - Ethereum gas price (wei)
 * @param bscGasPrice - BSC gas price (wei)
 * @returns Cost comparison
 */
export function compareBSCvsEthereum(
  complexity: EVMTransactionComplexity,
  ethGasPrice: bigint,
  bscGasPrice: bigint = BSC_BASE_GAS_PRICE
): {
  ethCostWei: bigint
  bscCostWei: bigint
  savingsPercent: number
  recommendation: string
} {
  const ethCostWei = complexity.estimatedGas * ethGasPrice
  const bscCostWei = complexity.estimatedGas * bscGasPrice

  const savingsPercent =
    ethCostWei > 0n
      ? Number((ethCostWei - bscCostWei) * 100n / ethCostWei)
      : 0

  let recommendation: string
  if (savingsPercent > 90) {
    recommendation = 'BSC significantly cheaper - use BSC if asset liquidity allows'
  } else if (savingsPercent > 50) {
    recommendation = 'BSC cheaper - consider bridging for frequent operations'
  } else {
    recommendation = 'Cost difference minimal - choose based on liquidity/speed'
  }

  return {
    ethCostWei,
    bscCostWei,
    savingsPercent,
    recommendation,
  }
}

/**
 * Get cross-chain optimization for BSC ↔ Ethereum
 *
 * @param sourceNetwork - Source network
 * @param targetNetwork - Target network
 * @param complexity - Transaction complexity
 * @returns Cross-chain optimization result
 */
export function getCrossChainOptimization(
  sourceNetwork: EthereumNetwork,
  targetNetwork: EthereumNetwork,
  complexity: EVMTransactionComplexity
): CrossChainOptimizationResult {
  const isBscSource = isBNBNetwork(sourceNetwork)
  const isBscTarget = isBNBNetwork(targetNetwork)

  // Estimate source chain gas
  const sourceGas = complexity.estimatedGas

  let bridgeRecommendation: string
  let estimatedTime: number

  if (isBscSource && !isBscTarget) {
    // BSC → Ethereum
    bridgeRecommendation = 'Use Stargate or Celer for BSC→ETH bridging'
    estimatedTime = 600 // ~10 minutes
  } else if (!isBscSource && isBscTarget) {
    // Ethereum → BSC
    bridgeRecommendation = 'Use official Binance Bridge or Stargate'
    estimatedTime = 300 // ~5 minutes
  } else {
    bridgeRecommendation = 'Same-chain transfer - no bridge needed'
    estimatedTime = 15 // ~15 seconds block time
  }

  return {
    sourceGas,
    bridgeRecommendation,
    estimatedTime,
  }
}

// ─── BEP-20 Utilities ─────────────────────────────────────────────────────────

/**
 * Get BEP-20 token decimals
 *
 * Note: BSC USDC/USDT use 18 decimals (not 6 like Ethereum)
 */
export function getBEP20Decimals(symbol: string): number {
  return BSC_TOKEN_DECIMALS[symbol] ?? 18
}

/**
 * Get BEP-20 token address
 */
export function getBEP20Address(symbol: string): string | undefined {
  return BSC_TOKEN_CONTRACTS[symbol as keyof typeof BSC_TOKEN_CONTRACTS]
}

/**
 * Convert amount between BSC and Ethereum decimals
 *
 * @param amount - Amount in source decimals
 * @param symbol - Token symbol
 * @param direction - Conversion direction
 * @returns Converted amount
 *
 * @example
 * ```typescript
 * // 1 USDC on Ethereum (6 decimals) = 1e6
 * // 1 USDC on BSC (18 decimals) = 1e18
 * const bscAmount = convertDecimals(1_000_000n, 'USDC', 'eth-to-bsc')
 * // Returns 1_000_000_000_000_000_000n
 * ```
 */
export function convertDecimals(
  amount: bigint,
  symbol: string,
  direction: 'eth-to-bsc' | 'bsc-to-eth'
): bigint {
  // Known decimal differences
  const decimalDiff: Record<string, number> = {
    USDC: 12, // 18 - 6
    USDT: 12, // 18 - 6
  }

  const diff = decimalDiff[symbol]
  if (!diff) return amount // Same decimals

  if (direction === 'eth-to-bsc') {
    return amount * 10n ** BigInt(diff)
  } else {
    return amount / 10n ** BigInt(diff)
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Format BNB amount for display
 */
export function formatBNB(wei: bigint, decimals: number = 4): string {
  const bnb = Number(wei) / 1e18
  return `${bnb.toFixed(decimals)} BNB`
}

/**
 * Convert wei to gwei string for BSC
 */
export function weiToGwei(wei: bigint): string {
  const gwei = Number(wei) / 1e9
  return `${gwei.toFixed(2)} Gwei`
}
