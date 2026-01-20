/**
 * NEAR Fee Contract Interface
 *
 * Interface for interacting with the SIP Protocol fee contract on NEAR.
 * The fee contract collects protocol fees from private intents.
 *
 * @module fees/near-contract
 */

import type { ChainId } from '@sip-protocol/types'
import type {
  ChainFeeConfig,
  FeeCalculationInput,
  FeeCalculationResult,
  FeeContractState,
  FeeStats,
  TreasuryConfig,
} from './types'
import { FeeCalculator, DEFAULT_CHAIN_FEES } from './calculator'

// ─── Contract Configuration ──────────────────────────────────────────────────

/**
 * NEAR fee contract addresses
 */
export const NEAR_FEE_CONTRACTS = {
  /** Mainnet fee contract */
  mainnet: 'fee.sip-protocol.near',
  /** Testnet fee contract (for development) */
  testnet: 'fee.sip-protocol.testnet',
} as const

/**
 * Default treasury configuration
 */
export const DEFAULT_TREASURY: TreasuryConfig = {
  nearAccount: 'treasury.sip-protocol.near',
  evmAddress: '0x0000000000000000000000000000000000000000', // TBD
  solanaAddress: '11111111111111111111111111111111', // TBD
  multiSigThreshold: 2,
  multiSigSigners: [],
}

// ─── Contract Interface ──────────────────────────────────────────────────────

/**
 * NEAR fee contract client options
 */
export interface NEARFeeContractOptions {
  /** Contract account ID */
  contractId?: string
  /** Network (mainnet/testnet) */
  network?: 'mainnet' | 'testnet'
  /** NEAR RPC URL */
  rpcUrl?: string
  /** Fee calculator instance */
  calculator?: FeeCalculator
  /** Treasury configuration */
  treasury?: TreasuryConfig
}

/**
 * Fee collection parameters
 */
export interface FeeCollectionParams {
  /** Transaction amount */
  amount: bigint
  /** Amount in USD */
  amountUsd: number
  /** Source chain */
  sourceChain: ChainId
  /** Destination chain */
  destinationChain: ChainId
  /** Transaction hash (for reference) */
  txHash?: string
  /** Viewing key disclosed */
  viewingKeyDisclosed?: boolean
  /** Intent ID (for tracking) */
  intentId?: string
}

/**
 * Fee collection result
 */
export interface FeeCollectionResult {
  /** Fee amount collected */
  feeAmount: bigint
  /** Fee in USD */
  feeUsd: number
  /** Collection transaction hash */
  collectionTxHash?: string
  /** Treasury account */
  treasuryAccount: string
  /** Timestamp */
  timestamp: number
}

/**
 * NEAR Fee Contract Client
 *
 * Provides interface for fee calculation and collection on NEAR.
 *
 * @example
 * ```typescript
 * const feeContract = new NEARFeeContract({
 *   network: 'mainnet',
 * })
 *
 * // Calculate fee
 * const fee = await feeContract.calculateFee({
 *   amount: 1000000000000000000000000n, // 1 NEAR
 *   amountUsd: 5.00,
 *   sourceChain: 'near',
 *   destinationChain: 'ethereum',
 * })
 *
 * console.log(`Fee: ${fee.protocolFeeUsd} USD`)
 * ```
 */
export class NEARFeeContract {
  private readonly contractId: string
  private readonly network: 'mainnet' | 'testnet'
  private readonly rpcUrl: string
  private readonly calculator: FeeCalculator
  private readonly treasury: TreasuryConfig

  // Simulated state (would be on-chain in production)
  private state: FeeContractState

  constructor(options: NEARFeeContractOptions = {}) {
    this.network = options.network ?? 'mainnet'
    this.contractId =
      options.contractId ?? NEAR_FEE_CONTRACTS[this.network]
    this.rpcUrl =
      options.rpcUrl ??
      (this.network === 'mainnet'
        ? 'https://rpc.mainnet.near.org'
        : 'https://rpc.testnet.near.org')
    this.calculator = options.calculator ?? new FeeCalculator()
    this.treasury = options.treasury ?? DEFAULT_TREASURY

    // Initialize state
    this.state = {
      owner: this.treasury.nearAccount,
      treasury: this.treasury.nearAccount,
      config: DEFAULT_CHAIN_FEES.near,
      totalCollected: 0n,
      paused: false,
    }
  }

  // ─── Fee Calculation ─────────────────────────────────────────────────────────

  /**
   * Calculate fee for a transaction
   */
  async calculateFee(params: FeeCollectionParams): Promise<FeeCalculationResult> {
    if (this.state.paused) {
      // Return zero fee if paused
      return {
        protocolFee: 0n,
        protocolFeeUsd: 0,
        appliedBps: 0,
        discountBps: 0,
        originalFee: 0n,
        breakdown: {
          baseFee: 0n,
          networkFee: 0n,
          totalFee: 0n,
          components: [],
        },
      }
    }

    const input: FeeCalculationInput = {
      amount: params.amount,
      amountUsd: params.amountUsd,
      sourceChain: params.sourceChain,
      destinationChain: params.destinationChain,
      viewingKeyDisclosed: params.viewingKeyDisclosed ?? false,
    }

    return this.calculator.calculate(input)
  }

  /**
   * Get fee estimate for UI display
   */
  async estimateFee(
    amountUsd: number,
    sourceChain: ChainId = 'near'
  ): Promise<{ feeUsd: number; bps: number; tierName?: string }> {
    const result = await this.calculateFee({
      amount: BigInt(Math.floor(amountUsd * 1e24)), // NEAR decimals
      amountUsd,
      sourceChain,
      destinationChain: sourceChain,
    })

    return {
      feeUsd: result.protocolFeeUsd,
      bps: result.appliedBps,
      tierName: result.tierName,
    }
  }

  // ─── Fee Collection ──────────────────────────────────────────────────────────

  /**
   * Collect fee for a transaction
   *
   * In production, this would create a NEAR transaction to transfer
   * the fee to the treasury. For now, it simulates the collection.
   */
  async collectFee(params: FeeCollectionParams): Promise<FeeCollectionResult> {
    if (this.state.paused) {
      throw new Error('Fee collection is paused')
    }

    // Calculate fee
    const feeResult = await this.calculateFee(params)

    // Simulate collection (would be on-chain in production)
    this.state.totalCollected += feeResult.protocolFee

    return {
      feeAmount: feeResult.protocolFee,
      feeUsd: feeResult.protocolFeeUsd,
      collectionTxHash: undefined, // Would be set after on-chain tx
      treasuryAccount: this.treasury.nearAccount,
      timestamp: Date.now(),
    }
  }

  /**
   * Batch collect fees for multiple transactions
   */
  async batchCollectFees(
    params: FeeCollectionParams[]
  ): Promise<FeeCollectionResult[]> {
    const results: FeeCollectionResult[] = []

    for (const p of params) {
      const result = await this.collectFee(p)
      results.push(result)
    }

    return results
  }

  // ─── State Management ────────────────────────────────────────────────────────

  /**
   * Get contract state
   */
  async getState(): Promise<FeeContractState> {
    return { ...this.state }
  }

  /**
   * Get fee configuration
   */
  async getConfig(): Promise<ChainFeeConfig> {
    return { ...this.state.config }
  }

  /**
   * Update fee configuration (owner only)
   */
  async updateConfig(config: Partial<ChainFeeConfig>): Promise<void> {
    this.state.config = { ...this.state.config, ...config }
    this.calculator.updateChainConfig('near', config)
  }

  /**
   * Get treasury configuration
   */
  async getTreasury(): Promise<TreasuryConfig> {
    return { ...this.treasury }
  }

  /**
   * Get fee statistics
   */
  async getStats(
    startTime?: number,
    endTime?: number
  ): Promise<FeeStats> {
    // In production, this would query historical data
    const now = Date.now()
    return {
      totalCollectedUsd: Number(this.state.totalCollected) / 1e24 * 5, // Assume $5/NEAR
      byChain: {
        near: this.state.totalCollected,
      } as Record<ChainId, bigint>,
      totalTransactions: 0, // Would be tracked
      avgFeeUsd: 0,
      periodStart: startTime ?? now - 86400000,
      periodEnd: endTime ?? now,
    }
  }

  // ─── Admin Functions ─────────────────────────────────────────────────────────

  /**
   * Pause fee collection (emergency)
   */
  async pause(): Promise<void> {
    this.state.paused = true
  }

  /**
   * Resume fee collection
   */
  async resume(): Promise<void> {
    this.state.paused = false
  }

  /**
   * Check if fee collection is paused
   */
  async isPaused(): Promise<boolean> {
    return this.state.paused
  }

  /**
   * Withdraw fees to treasury
   *
   * In production, this would create a NEAR transaction.
   */
  async withdrawToTreasury(amount?: bigint): Promise<string> {
    const withdrawAmount = amount ?? this.state.totalCollected

    if (withdrawAmount > this.state.totalCollected) {
      throw new Error('Insufficient balance')
    }

    // Simulate withdrawal
    this.state.totalCollected -= withdrawAmount

    // Return mock transaction hash
    return `withdraw_${Date.now()}_${withdrawAmount.toString()}`
  }

  // ─── Contract Info ───────────────────────────────────────────────────────────

  /**
   * Get contract ID
   */
  getContractId(): string {
    return this.contractId
  }

  /**
   * Get network
   */
  getNetwork(): 'mainnet' | 'testnet' {
    return this.network
  }

  /**
   * Get RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl
  }
}

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Create NEAR fee contract client
 */
export function createNEARFeeContract(
  options?: NEARFeeContractOptions
): NEARFeeContract {
  return new NEARFeeContract(options)
}

/**
 * Create mainnet fee contract client
 */
export function createMainnetFeeContract(): NEARFeeContract {
  return new NEARFeeContract({ network: 'mainnet' })
}

/**
 * Create testnet fee contract client
 */
export function createTestnetFeeContract(): NEARFeeContract {
  return new NEARFeeContract({ network: 'testnet' })
}

// ─── Integration Helpers ─────────────────────────────────────────────────────

/**
 * Calculate fee and add to transaction
 *
 * Helper for integrating fee collection into swap flows.
 */
export async function calculateFeeForSwap(
  contract: NEARFeeContract,
  swapAmount: bigint,
  swapAmountUsd: number,
  sourceChain: ChainId,
  destChain: ChainId,
  viewingKeyDisclosed = false
): Promise<{
  fee: FeeCalculationResult
  netAmount: bigint
  netAmountUsd: number
}> {
  const fee = await contract.calculateFee({
    amount: swapAmount,
    amountUsd: swapAmountUsd,
    sourceChain,
    destinationChain: destChain,
    viewingKeyDisclosed,
  })

  const netAmount = swapAmount - fee.protocolFee
  const netAmountUsd = swapAmountUsd - fee.protocolFeeUsd

  return {
    fee,
    netAmount,
    netAmountUsd,
  }
}
