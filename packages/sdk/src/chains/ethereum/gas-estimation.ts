/**
 * Ethereum Gas Estimation for Privacy Transactions
 *
 * Provides accurate gas estimation for stealth transfers, announcements,
 * and claim operations with EIP-1559 support.
 *
 * @module chains/ethereum/gas-estimation
 */

import type { HexString } from '@sip-protocol/types'
import {
  DEFAULT_GAS_LIMITS,
  ONE_GWEI,
  ONE_ETH,
  type EthereumNetwork,
} from './constants'
import { fromWei } from './commitment'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * EIP-1559 gas price components
 */
export interface EIP1559GasPrice {
  /**
   * Base fee per gas (from network)
   */
  baseFeePerGas: bigint

  /**
   * Max priority fee (tip to validator)
   */
  maxPriorityFeePerGas: bigint

  /**
   * Max fee per gas (cap)
   */
  maxFeePerGas: bigint
}

/**
 * Gas estimate breakdown
 */
export interface GasEstimateBreakdown {
  /**
   * Transfer transaction gas
   */
  transferGas: bigint

  /**
   * Announcement transaction gas
   */
  announcementGas: bigint

  /**
   * Total gas limit
   */
  totalGas: bigint
}

/**
 * Detailed gas estimate with EIP-1559 support
 */
export interface DetailedGasEstimate {
  /**
   * Gas breakdown by operation
   */
  breakdown: GasEstimateBreakdown

  /**
   * EIP-1559 gas price (if available)
   */
  eip1559?: EIP1559GasPrice

  /**
   * Legacy gas price (fallback)
   */
  legacyGasPrice: bigint

  /**
   * Estimated cost in wei
   */
  estimatedCostWei: bigint

  /**
   * Estimated cost in ETH
   */
  estimatedCostEth: string

  /**
   * Estimated cost range (min/max)
   */
  costRange: {
    minWei: bigint
    maxWei: bigint
    minEth: string
    maxEth: string
  }

  /**
   * Timestamp of estimate
   */
  timestamp: number
}

/**
 * Options for gas estimation
 */
export interface GasEstimationOptions {
  /**
   * Include priority fee buffer percentage (default: 10)
   */
  priorityFeeBuffer?: number

  /**
   * Use legacy pricing (no EIP-1559)
   */
  legacyPricing?: boolean

  /**
   * Custom base fee override
   */
  customBaseFee?: bigint

  /**
   * Custom priority fee override
   */
  customPriorityFee?: bigint
}

/**
 * Cached gas price data
 */
interface GasPriceCache {
  baseFee: bigint
  priorityFee: bigint
  timestamp: number
  network: EthereumNetwork
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Cache duration for gas prices (30 seconds)
 */
const GAS_PRICE_CACHE_DURATION = 30_000

/**
 * Default priority fee (2 gwei)
 */
const DEFAULT_PRIORITY_FEE = 2n * ONE_GWEI

/**
 * Default base fee assumption (30 gwei)
 */
const DEFAULT_BASE_FEE = 30n * ONE_GWEI

/**
 * Multiplier for max fee (2x base fee)
 */
const MAX_FEE_MULTIPLIER = 2n

/**
 * Gas price by network (approximate baselines)
 */
const NETWORK_GAS_PRICES: Record<EthereumNetwork, bigint> = {
  mainnet: 30n * ONE_GWEI,
  sepolia: 1n * ONE_GWEI,
  goerli: 1n * ONE_GWEI,
  arbitrum: ONE_GWEI / 10n, // 0.1 gwei
  'arbitrum-sepolia': ONE_GWEI / 10n,
  optimism: ONE_GWEI / 10n,
  'optimism-sepolia': ONE_GWEI / 10n,
  base: ONE_GWEI / 10n,
  'base-sepolia': ONE_GWEI / 10n,
  polygon: 30n * ONE_GWEI,
  'polygon-mumbai': 1n * ONE_GWEI,
  zksync: ONE_GWEI / 10n,
  scroll: ONE_GWEI / 10n,
  linea: ONE_GWEI / 10n,
  mantle: ONE_GWEI / 10n,
  blast: ONE_GWEI / 10n,
  bsc: 3n * ONE_GWEI, // BSC mainnet ~3-5 gwei
  'bsc-testnet': 1n * ONE_GWEI,
  localhost: 1n * ONE_GWEI,
}

// ─── Gas Price Cache ─────────────────────────────────────────────────────────

let gasPriceCache: GasPriceCache | null = null

/**
 * Clear the gas price cache
 */
export function clearGasPriceCache(): void {
  gasPriceCache = null
}

/**
 * Check if cache is valid
 */
function isCacheValid(network: EthereumNetwork): boolean {
  if (!gasPriceCache) return false
  if (gasPriceCache.network !== network) return false
  return Date.now() - gasPriceCache.timestamp < GAS_PRICE_CACHE_DURATION
}

/**
 * Get cached or default gas prices
 */
function getCachedOrDefaultGasPrice(network: EthereumNetwork): {
  baseFee: bigint
  priorityFee: bigint
} {
  if (isCacheValid(network)) {
    return {
      baseFee: gasPriceCache!.baseFee,
      priorityFee: gasPriceCache!.priorityFee,
    }
  }

  return {
    baseFee: NETWORK_GAS_PRICES[network] ?? DEFAULT_BASE_FEE,
    priorityFee: DEFAULT_PRIORITY_FEE,
  }
}

/**
 * Update gas price cache
 */
export function updateGasPriceCache(
  network: EthereumNetwork,
  baseFee: bigint,
  priorityFee: bigint
): void {
  gasPriceCache = {
    baseFee,
    priorityFee,
    timestamp: Date.now(),
    network,
  }
}

// ─── Gas Estimation Functions ────────────────────────────────────────────────

/**
 * Estimate gas for ETH stealth transfer
 *
 * Includes transfer to stealth address + announcement
 *
 * @param network - Target network
 * @param options - Estimation options
 * @returns Detailed gas estimate
 *
 * @example
 * ```typescript
 * const estimate = estimateEthTransferGas('mainnet')
 * console.log(estimate.estimatedCostEth) // '0.003'
 * console.log(estimate.breakdown.transferGas) // 21000n
 * ```
 */
export function estimateEthTransferGas(
  network: EthereumNetwork = 'mainnet',
  options: GasEstimationOptions = {}
): DetailedGasEstimate {
  const breakdown: GasEstimateBreakdown = {
    transferGas: DEFAULT_GAS_LIMITS.ethTransfer,
    announcementGas: DEFAULT_GAS_LIMITS.announcement,
    totalGas: DEFAULT_GAS_LIMITS.ethTransfer + DEFAULT_GAS_LIMITS.announcement,
  }

  return buildDetailedEstimate(network, breakdown, options)
}

/**
 * Estimate gas for ERC-20 stealth transfer
 *
 * Includes token transfer to stealth address + announcement
 *
 * @param network - Target network
 * @param includeApproval - Whether to include approval gas
 * @param options - Estimation options
 * @returns Detailed gas estimate
 *
 * @example
 * ```typescript
 * const estimate = estimateTokenTransferGas('mainnet', true)
 * console.log(estimate.breakdown.transferGas) // includes approval
 * ```
 */
export function estimateTokenTransferGas(
  network: EthereumNetwork = 'mainnet',
  includeApproval: boolean = false,
  options: GasEstimationOptions = {}
): DetailedGasEstimate {
  let transferGas = DEFAULT_GAS_LIMITS.erc20Transfer
  if (includeApproval) {
    transferGas += DEFAULT_GAS_LIMITS.erc20Approve
  }

  const breakdown: GasEstimateBreakdown = {
    transferGas,
    announcementGas: DEFAULT_GAS_LIMITS.announcement,
    totalGas: transferGas + DEFAULT_GAS_LIMITS.announcement,
  }

  return buildDetailedEstimate(network, breakdown, options)
}

/**
 * Estimate gas for claiming from stealth address
 *
 * @param network - Target network
 * @param isTokenClaim - Whether claiming tokens (vs ETH)
 * @param options - Estimation options
 * @returns Detailed gas estimate
 */
export function estimateClaimGas(
  network: EthereumNetwork = 'mainnet',
  isTokenClaim: boolean = false,
  options: GasEstimationOptions = {}
): DetailedGasEstimate {
  const claimGas = isTokenClaim
    ? DEFAULT_GAS_LIMITS.erc20Transfer
    : DEFAULT_GAS_LIMITS.ethTransfer

  const breakdown: GasEstimateBreakdown = {
    transferGas: claimGas,
    announcementGas: 0n,
    totalGas: claimGas,
  }

  return buildDetailedEstimate(network, breakdown, options)
}

/**
 * Estimate gas for registry operations
 *
 * @param network - Target network
 * @param operation - Registry operation type
 * @param options - Estimation options
 * @returns Detailed gas estimate
 */
export function estimateRegistryGas(
  network: EthereumNetwork = 'mainnet',
  operation: 'register' | 'update' | 'query' = 'register',
  options: GasEstimationOptions = {}
): DetailedGasEstimate {
  let operationGas: bigint

  switch (operation) {
    case 'register':
      operationGas = DEFAULT_GAS_LIMITS.registryRegister
      break
    case 'update':
      operationGas = DEFAULT_GAS_LIMITS.registryUpdate
      break
    case 'query':
      operationGas = 0n // View call, no gas
      break
  }

  const breakdown: GasEstimateBreakdown = {
    transferGas: operationGas,
    announcementGas: 0n,
    totalGas: operationGas,
  }

  return buildDetailedEstimate(network, breakdown, options)
}

/**
 * Build detailed gas estimate from breakdown
 */
function buildDetailedEstimate(
  network: EthereumNetwork,
  breakdown: GasEstimateBreakdown,
  options: GasEstimationOptions
): DetailedGasEstimate {
  const { baseFee, priorityFee } = getCachedOrDefaultGasPrice(network)

  const effectiveBaseFee = options.customBaseFee ?? baseFee
  const effectivePriorityFee = options.customPriorityFee ?? priorityFee

  // Apply priority fee buffer
  const bufferMultiplier = 100n + BigInt(options.priorityFeeBuffer ?? 10)
  const bufferedPriorityFee = (effectivePriorityFee * bufferMultiplier) / 100n

  // EIP-1559 pricing
  const maxPriorityFeePerGas = bufferedPriorityFee
  const maxFeePerGas = effectiveBaseFee * MAX_FEE_MULTIPLIER + maxPriorityFeePerGas

  // Legacy pricing (effectiveGasPrice = baseFee + priorityFee)
  const legacyGasPrice = effectiveBaseFee + bufferedPriorityFee

  // Cost calculation
  const estimatedCostWei = breakdown.totalGas * (effectiveBaseFee + bufferedPriorityFee)
  const minCostWei = breakdown.totalGas * effectiveBaseFee
  const maxCostWei = breakdown.totalGas * maxFeePerGas

  return {
    breakdown,
    eip1559: options.legacyPricing
      ? undefined
      : {
          baseFeePerGas: effectiveBaseFee,
          maxPriorityFeePerGas,
          maxFeePerGas,
        },
    legacyGasPrice,
    estimatedCostWei,
    estimatedCostEth: fromWei(estimatedCostWei),
    costRange: {
      minWei: minCostWei,
      maxWei: maxCostWei,
      minEth: fromWei(minCostWei),
      maxEth: fromWei(maxCostWei),
    },
    timestamp: Date.now(),
  }
}

// ─── Gas Price Fetching Helpers ──────────────────────────────────────────────

/**
 * Parse gas price from RPC response
 *
 * @param response - eth_gasPrice response (hex string)
 * @returns Gas price in wei
 */
export function parseGasPriceResponse(response: HexString): bigint {
  return BigInt(response)
}

/**
 * Parse fee history from RPC response
 *
 * @param baseFeePerGas - Array of base fees from eth_feeHistory
 * @param reward - Array of priority fees from eth_feeHistory
 * @returns Parsed gas prices
 */
export function parseFeeHistoryResponse(
  baseFeePerGas: HexString[],
  reward: HexString[][]
): { baseFee: bigint; priorityFee: bigint } {
  // Use most recent base fee (last in array is pending block)
  const latestBaseFee = baseFeePerGas.length > 1
    ? BigInt(baseFeePerGas[baseFeePerGas.length - 2])
    : BigInt(baseFeePerGas[0] ?? '0x0')

  // Use median priority fee from most recent block
  const latestRewards = reward[reward.length - 1] ?? []
  const priorityFees = latestRewards.map(r => BigInt(r))

  const medianPriorityFee = priorityFees.length > 0
    ? priorityFees.sort((a, b) => (a < b ? -1 : 1))[Math.floor(priorityFees.length / 2)]
    : DEFAULT_PRIORITY_FEE

  return {
    baseFee: latestBaseFee,
    priorityFee: medianPriorityFee,
  }
}

/**
 * Calculate effective gas price for EIP-1559 transaction
 *
 * @param baseFee - Current base fee
 * @param maxPriorityFee - Max priority fee from user
 * @param maxFee - Max fee cap from user
 * @returns Effective gas price
 */
export function calculateEffectiveGasPrice(
  baseFee: bigint,
  maxPriorityFee: bigint,
  maxFee: bigint
): bigint {
  const effectivePriorityFee = maxPriorityFee < maxFee - baseFee
    ? maxPriorityFee
    : maxFee - baseFee

  return baseFee + (effectivePriorityFee > 0n ? effectivePriorityFee : 0n)
}

// ─── Cost Formatting ─────────────────────────────────────────────────────────

/**
 * Format gas cost for display
 *
 * @param costWei - Cost in wei
 * @param ethPriceUsd - Optional ETH price in USD
 * @returns Formatted cost string
 */
export function formatGasCost(
  costWei: bigint,
  ethPriceUsd?: number
): { eth: string; usd?: string } {
  const eth = fromWei(costWei)

  if (ethPriceUsd === undefined) {
    return { eth }
  }

  const ethValue = Number(costWei) / Number(ONE_ETH)
  const usdValue = ethValue * ethPriceUsd

  return {
    eth,
    usd: usdValue.toFixed(2),
  }
}

/**
 * Get gas price suggestion by speed
 *
 * @param baseFee - Current base fee
 * @param speed - Transaction speed
 * @returns Suggested gas price settings
 */
export function getGasPriceSuggestion(
  baseFee: bigint,
  speed: 'slow' | 'standard' | 'fast'
): EIP1559GasPrice {
  const priorityFees: Record<typeof speed, bigint> = {
    slow: ONE_GWEI,
    standard: 2n * ONE_GWEI,
    fast: 5n * ONE_GWEI,
  }

  const priorityFee = priorityFees[speed]
  const maxFee = baseFee * 2n + priorityFee

  return {
    baseFeePerGas: baseFee,
    maxPriorityFeePerGas: priorityFee,
    maxFeePerGas: maxFee,
  }
}
