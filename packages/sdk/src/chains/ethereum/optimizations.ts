/**
 * Ethereum/EVM Chain-Specific Optimizations
 *
 * Provides optimized configurations for EVM transactions:
 * - Gas optimization strategies
 * - Storage packing recommendations
 * - L2-specific optimizations (Arbitrum, Optimism, Base)
 * - EIP-4844 blob transaction support
 * - Batch transaction strategies
 *
 * @module chains/ethereum/optimizations
 */

import {
  DEFAULT_GAS_LIMITS,
  ONE_GWEI,
  ONE_ETH,
  type EthereumNetwork,
  isL2Network,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Gas optimization profile
 */
export type GasProfile =
  | 'economy' // Wait for lower gas, may take longer
  | 'standard' // Balanced cost/speed
  | 'fast' // Higher gas, faster confirmation
  | 'instant' // Maximum priority, immediate confirmation

/**
 * L2 optimization strategy
 */
export type L2Strategy =
  | 'calldata' // Optimize calldata encoding
  | 'blob' // Use EIP-4844 blobs (where supported)
  | 'compressed' // Use compression for calldata
  | 'batched' // Batch multiple operations

/**
 * Transaction complexity estimate for EVM
 */
export interface EVMTransactionComplexity {
  /** Estimated gas limit */
  estimatedGas: bigint
  /** Calldata size in bytes */
  calldataSize: number
  /** Number of storage slots written */
  storageWrites: number
  /** Number of storage slots read */
  storageReads: number
  /** Number of external calls */
  externalCalls: number
  /** Whether multicall is recommended */
  multicallRecommended: boolean
}

/**
 * Gas estimate with L2 considerations
 */
export interface L2GasEstimate {
  /** L2 execution gas */
  l2Gas: bigint
  /** L1 data/security gas (for rollups) */
  l1DataGas: bigint
  /** Total gas */
  totalGas: bigint
  /** L1 data cost in wei (for rollups) */
  l1DataCostWei: bigint
  /** Total estimated cost in wei */
  totalCostWei: bigint
}

/**
 * EVM optimization result
 */
export interface EVMOptimizationResult {
  /** Recommended gas limit */
  gasLimit: bigint
  /** Recommended max fee per gas */
  maxFeePerGas: bigint
  /** Recommended max priority fee */
  maxPriorityFeePerGas: bigint
  /** L2-specific estimate (if applicable) */
  l2Estimate?: L2GasEstimate
  /** Recommended strategies */
  strategies: string[]
  /** Whether to use multicall */
  useMulticall: boolean
  /** Whether to use EIP-4844 blobs */
  useBlobs: boolean
}

/**
 * Storage packing recommendation
 */
export interface StoragePackingAdvice {
  /** Current storage slots used */
  currentSlots: number
  /** Optimized slots (after packing) */
  optimizedSlots: number
  /** Gas savings estimate */
  gasSavings: bigint
  /** Recommendations */
  recommendations: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Gas costs for common EVM operations
 */
export const EVM_GAS_COSTS = {
  /** Base transaction cost */
  txBase: 21000n,
  /** Zero byte in calldata */
  calldataZeroByte: 4n,
  /** Non-zero byte in calldata */
  calldataNonZeroByte: 16n,
  /** Storage read (cold) */
  sloadCold: 2100n,
  /** Storage read (warm) */
  sloadWarm: 100n,
  /** Storage write (zero to non-zero) */
  sstoreSet: 20000n,
  /** Storage write (non-zero to non-zero) */
  sstoreUpdate: 5000n,
  /** Storage write (non-zero to zero, refund) */
  sstoreClear: -15000n, // Refund
  /** External call (cold address) */
  callCold: 2600n,
  /** External call (warm address) */
  callWarm: 100n,
  /** Log (base) */
  logBase: 375n,
  /** Log per topic */
  logTopic: 375n,
  /** Log per byte */
  logByte: 8n,
  /** keccak256 per word */
  keccak256Word: 6n,
  /** Memory expansion per word */
  memoryWord: 3n,
} as const

/**
 * Profile multipliers for gas price
 */
const GAS_PROFILE_MULTIPLIERS: Record<GasProfile, number> = {
  economy: 0.8,
  standard: 1.0,
  fast: 1.5,
  instant: 2.5,
}

/**
 * L2 data gas multipliers (approximate)
 * L2s charge for L1 data posting differently
 */
const L2_DATA_MULTIPLIERS: Partial<Record<EthereumNetwork, number>> = {
  arbitrum: 16, // ~16x L1 calldata cost
  'arbitrum-sepolia': 16,
  optimism: 16,
  'optimism-sepolia': 16,
  base: 16,
  'base-sepolia': 16,
  zksync: 1, // Different model
  scroll: 16,
  linea: 16,
  mantle: 4, // Lower data costs
  blast: 16,
}


// ─── Gas Estimation ───────────────────────────────────────────────────────────

/**
 * Estimate gas for privacy transaction
 *
 * @param options - Transaction options
 * @returns Transaction complexity estimate
 */
export function estimatePrivacyTxComplexity(options: {
  /** Number of transfers */
  transferCount: number
  /** Whether includes ERC-20 approval */
  includesApproval: boolean
  /** Whether includes announcement */
  includesAnnouncement: boolean
  /** Custom calldata size */
  customCalldataSize?: number
}): EVMTransactionComplexity {
  let estimatedGas = EVM_GAS_COSTS.txBase

  // Transfer gas
  if (options.transferCount > 0) {
    // ERC-20 transfer: storage read + storage write + emit event
    const perTransfer =
      EVM_GAS_COSTS.sloadCold + // Balance read
      EVM_GAS_COSTS.sstoreUpdate + // Balance update sender
      EVM_GAS_COSTS.sstoreUpdate + // Balance update receiver
      EVM_GAS_COSTS.logBase +
      EVM_GAS_COSTS.logTopic * 3n + // Transfer event
      EVM_GAS_COSTS.callCold // External call to token

    estimatedGas += perTransfer * BigInt(options.transferCount)
  }

  // Approval gas
  if (options.includesApproval) {
    estimatedGas +=
      EVM_GAS_COSTS.sstoreSet + // Allowance storage
      EVM_GAS_COSTS.logBase +
      EVM_GAS_COSTS.logTopic * 3n // Approval event
  }

  // Announcement gas
  if (options.includesAnnouncement) {
    estimatedGas += DEFAULT_GAS_LIMITS.announcement
  }

  // Calldata estimation
  const baseCalldata = 4 + 32 * 3 // Function selector + 3 params
  const perTransferCalldata = 32 * 2 // Address + amount
  const calldataSize =
    options.customCalldataSize ??
    baseCalldata + perTransferCalldata * options.transferCount

  return {
    estimatedGas,
    calldataSize,
    storageWrites: options.transferCount * 2 + (options.includesApproval ? 1 : 0),
    storageReads: options.transferCount * 2,
    externalCalls: options.transferCount + (options.includesApproval ? 1 : 0),
    multicallRecommended: options.transferCount > 2,
  }
}

/**
 * Calculate L2 gas estimate with L1 data costs
 *
 * @param network - Target L2 network
 * @param complexity - Transaction complexity
 * @param l2GasPrice - L2 gas price in wei
 * @param l1BaseFee - L1 base fee in wei (for data cost calculation)
 * @returns L2 gas estimate
 */
export function calculateL2GasEstimate(
  network: EthereumNetwork,
  complexity: EVMTransactionComplexity,
  l2GasPrice: bigint,
  l1BaseFee: bigint
): L2GasEstimate {
  const multiplier = L2_DATA_MULTIPLIERS[network] ?? 1

  // L2 execution gas
  const l2Gas = complexity.estimatedGas

  // L1 data gas (calldata posted to L1)
  // Approximate: each non-zero byte costs 16 L1 gas, zero byte costs 4
  // Assume 70% non-zero bytes for typical transactions
  const nonZeroBytes = Math.ceil(complexity.calldataSize * 0.7)
  const zeroBytes = complexity.calldataSize - nonZeroBytes
  const l1CalldataGas =
    BigInt(nonZeroBytes) * EVM_GAS_COSTS.calldataNonZeroByte +
    BigInt(zeroBytes) * EVM_GAS_COSTS.calldataZeroByte

  // L1 data gas scaled by multiplier
  const l1DataGas = l1CalldataGas * BigInt(multiplier)

  // Total gas
  const totalGas = l2Gas + l1DataGas

  // Cost calculation
  const l2Cost = l2Gas * l2GasPrice
  const l1DataCostWei = l1DataGas * l1BaseFee
  const totalCostWei = l2Cost + l1DataCostWei

  return {
    l2Gas,
    l1DataGas,
    totalGas,
    l1DataCostWei,
    totalCostWei,
  }
}

// ─── Optimization Functions ───────────────────────────────────────────────────

/**
 * Get full optimization result for a transaction
 *
 * @param network - Target network
 * @param complexity - Transaction complexity
 * @param profile - Gas profile
 * @param baseFee - Current base fee
 * @param l1BaseFee - L1 base fee (for L2 networks)
 * @returns Optimization result
 *
 * @example
 * ```typescript
 * const complexity = estimatePrivacyTxComplexity({
 *   transferCount: 1,
 *   includesApproval: true,
 *   includesAnnouncement: true
 * })
 *
 * const result = optimizeTransaction('arbitrum', complexity, 'standard', baseFee)
 * console.log(result.gasLimit) // Recommended gas limit
 * ```
 */
export function optimizeTransaction(
  network: EthereumNetwork,
  complexity: EVMTransactionComplexity,
  profile: GasProfile = 'standard',
  baseFee: bigint,
  l1BaseFee?: bigint
): EVMOptimizationResult {
  const multiplier = GAS_PROFILE_MULTIPLIERS[profile]

  // Add 20% buffer to gas estimate
  const gasLimit = (complexity.estimatedGas * 120n) / 100n

  // Priority fee based on profile
  const basePriorityFee = ONE_GWEI * 2n // 2 gwei base
  const maxPriorityFeePerGas = BigInt(
    Math.ceil(Number(basePriorityFee) * multiplier)
  )

  // Max fee = base fee * 2 + priority (for price stability)
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

  const strategies: string[] = []
  let l2Estimate: L2GasEstimate | undefined

  // L2-specific optimizations
  if (isL2Network(network)) {
    if (l1BaseFee) {
      l2Estimate = calculateL2GasEstimate(
        network,
        complexity,
        maxFeePerGas,
        l1BaseFee
      )
    }

    strategies.push('Compress calldata for lower L1 data costs')

    if (complexity.calldataSize > 500) {
      strategies.push('Consider batching to amortize L1 data overhead')
    }
  }

  // Multicall recommendation
  if (complexity.multicallRecommended) {
    strategies.push('Use multicall to batch operations in single transaction')
  }

  // Storage optimization
  if (complexity.storageWrites > 3) {
    strategies.push(
      'Minimize storage writes - each write costs 5000+ gas'
    )
  }

  // EIP-4844 blob consideration (for large data)
  const useBlobs =
    complexity.calldataSize > 10000 && supportsEIP4844(network)

  if (useBlobs) {
    strategies.push('Use EIP-4844 blobs for cheaper large data posting')
  }

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    l2Estimate,
    strategies,
    useMulticall: complexity.multicallRecommended,
    useBlobs,
  }
}

/**
 * Check if network supports EIP-4844 blobs
 */
export function supportsEIP4844(network: EthereumNetwork): boolean {
  // EIP-4844 (Dencun) is live on mainnet and major L2s
  const supported: EthereumNetwork[] = [
    'mainnet',
    'sepolia',
    'arbitrum',
    'arbitrum-sepolia',
    'optimism',
    'optimism-sepolia',
    'base',
    'base-sepolia',
  ]
  return supported.includes(network)
}

// ─── Batch Optimization ───────────────────────────────────────────────────────

/**
 * Calculate optimal batch size for multiple operations
 *
 * @param operationCount - Total operations
 * @param network - Target network
 * @param options - Batch options
 * @returns Array of batch sizes
 */
export function calculateOptimalBatches(
  operationCount: number,
  network: EthereumNetwork,
  options: {
    /** Max gas per transaction */
    maxGasPerTx?: bigint
    /** Gas per operation */
    gasPerOperation?: bigint
  } = {}
): number[] {
  const {
    maxGasPerTx = isL2Network(network) ? 3_000_000n : 15_000_000n,
    gasPerOperation = DEFAULT_GAS_LIMITS.erc20Transfer,
  } = options

  // Account for base gas
  const availableGas = maxGasPerTx - EVM_GAS_COSTS.txBase
  const maxOpsPerBatch = Number(availableGas / gasPerOperation)

  const batches: number[] = []
  let remaining = operationCount

  while (remaining > 0) {
    const batchSize = Math.min(remaining, maxOpsPerBatch)
    batches.push(batchSize)
    remaining -= batchSize
  }

  return batches
}

// ─── Storage Packing ──────────────────────────────────────────────────────────

/**
 * Analyze storage packing opportunities
 *
 * Ethereum storage is organized in 32-byte slots.
 * Packing multiple values into single slots saves gas.
 *
 * @param variables - Array of variable sizes in bytes
 * @returns Storage packing advice
 */
export function analyzeStoragePacking(
  variables: Array<{ name: string; size: number }>
): StoragePackingAdvice {
  // Current: each variable gets its own slot
  const currentSlots = variables.length

  // Optimized: pack variables into slots
  const SLOT_SIZE = 32
  let optimizedSlots = 0
  let currentSlotRemaining = SLOT_SIZE

  // Sort by size (largest first) for better packing
  const sorted = [...variables].sort((a, b) => b.size - a.size)

  for (const variable of sorted) {
    if (variable.size > currentSlotRemaining) {
      optimizedSlots++
      currentSlotRemaining = SLOT_SIZE
    }
    currentSlotRemaining -= variable.size
  }

  if (currentSlotRemaining < SLOT_SIZE) {
    optimizedSlots++
  }

  // Calculate gas savings
  // SSTORE for new slot: 20000 gas
  // Reading additional slots: 2100 gas each (cold)
  const slotsSaved = currentSlots - optimizedSlots
  const gasSavings = BigInt(slotsSaved) * EVM_GAS_COSTS.sstoreSet

  const recommendations: string[] = []

  if (slotsSaved > 0) {
    recommendations.push(
      `Pack variables to save ${slotsSaved} storage slots (~${gasSavings} gas on writes)`
    )

    // Specific packing recommendations
    const smallVars = variables.filter((v) => v.size <= 16)
    if (smallVars.length >= 2) {
      recommendations.push(
        `Pack small variables (${smallVars.map((v) => v.name).join(', ')}) into single slot`
      )
    }
  }

  return {
    currentSlots,
    optimizedSlots,
    gasSavings,
    recommendations,
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert wei to ETH
 */
export function weiToEth(wei: bigint): string {
  const eth = Number(wei) / Number(ONE_ETH)
  return eth.toFixed(6)
}

/**
 * Convert gwei to wei
 */
export function gweiToWei(gwei: number): bigint {
  return BigInt(Math.floor(gwei * 1e9))
}

/**
 * Format gas price for display
 */
export function formatGasPrice(wei: bigint): string {
  const gwei = Number(wei) / 1e9
  if (gwei < 0.01) {
    return `${(gwei * 1000).toFixed(2)} mGwei`
  }
  return `${gwei.toFixed(2)} Gwei`
}

/**
 * Get gas profile from user-friendly name
 */
export function parseGasProfile(name: string): GasProfile {
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
    case 'instant':
    case 'max':
    case 'urgent':
    case 'turbo':
      return 'instant'
    default:
      return 'standard'
  }
}

/**
 * Estimate calldata cost
 *
 * @param data - Calldata bytes
 * @returns Gas cost for calldata
 */
export function estimateCalldataCost(data: Uint8Array | string): bigint {
  const bytes =
    typeof data === 'string'
      ? Uint8Array.from(Buffer.from(data.replace('0x', ''), 'hex'))
      : data

  let cost = 0n
  for (const byte of bytes) {
    cost += byte === 0 ? EVM_GAS_COSTS.calldataZeroByte : EVM_GAS_COSTS.calldataNonZeroByte
  }
  return cost
}

/**
 * Compare gas costs between networks
 *
 * @param complexity - Transaction complexity
 * @param networks - Networks to compare
 * @param gasPrices - Gas prices per network (wei)
 * @returns Cost comparison
 */
export function compareNetworkCosts(
  complexity: EVMTransactionComplexity,
  networks: EthereumNetwork[],
  gasPrices: Record<EthereumNetwork, bigint>
): Array<{ network: EthereumNetwork; costWei: bigint; costEth: string }> {
  return networks
    .map((network) => {
      const gasPrice = gasPrices[network] ?? ONE_GWEI * 10n
      const costWei = complexity.estimatedGas * gasPrice
      return {
        network,
        costWei,
        costEth: weiToEth(costWei),
      }
    })
    .sort((a, b) => (a.costWei < b.costWei ? -1 : 1))
}
