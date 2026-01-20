/**
 * Fee Calculator for SIP Protocol
 *
 * Calculates protocol fees based on volume, tier, and configuration.
 *
 * @module fees/calculator
 */

import type { ChainId } from '@sip-protocol/types'
import type {
  ChainFeeConfig,
  FeeCalculationInput,
  FeeCalculationResult,
  FeeBreakdown,
  FeeTier,
  FeeWaiver,
} from './types'

// ─── Default Configuration ───────────────────────────────────────────────────

/**
 * Default fee tiers (volume-based discounts)
 */
export const DEFAULT_FEE_TIERS: FeeTier[] = [
  {
    name: 'Standard',
    minVolume: 0,
    maxVolume: 1000,
    basisPoints: 10, // 0.10%
  },
  {
    name: 'Silver',
    minVolume: 1000,
    maxVolume: 10000,
    basisPoints: 8, // 0.08%
  },
  {
    name: 'Gold',
    minVolume: 10000,
    maxVolume: 100000,
    basisPoints: 5, // 0.05%
  },
  {
    name: 'Platinum',
    minVolume: 100000,
    maxVolume: Infinity,
    basisPoints: 3, // 0.03%
  },
]

/**
 * Default chain fee configurations
 */
export const DEFAULT_CHAIN_FEES: Record<string, ChainFeeConfig> = {
  near: {
    chain: 'near',
    model: 'tiered',
    baseBps: 10, // 0.10% base
    tiers: DEFAULT_FEE_TIERS,
    minFeeUsd: 0.01, // $0.01 minimum
    maxFeeUsd: 100, // $100 cap
    viewingKeyDiscountBps: 5, // 50% discount with viewing key
  },
  ethereum: {
    chain: 'ethereum',
    model: 'tiered',
    baseBps: 10,
    tiers: DEFAULT_FEE_TIERS,
    minFeeUsd: 0.10, // Higher minimum for Ethereum
    maxFeeUsd: 100,
    viewingKeyDiscountBps: 5,
  },
  solana: {
    chain: 'solana',
    model: 'tiered',
    baseBps: 10,
    tiers: DEFAULT_FEE_TIERS,
    minFeeUsd: 0.01,
    maxFeeUsd: 100,
    viewingKeyDiscountBps: 5,
  },
  arbitrum: {
    chain: 'arbitrum',
    model: 'tiered',
    baseBps: 10,
    tiers: DEFAULT_FEE_TIERS,
    minFeeUsd: 0.01,
    maxFeeUsd: 100,
    viewingKeyDiscountBps: 5,
  },
  bsc: {
    chain: 'bsc',
    model: 'tiered',
    baseBps: 10,
    tiers: DEFAULT_FEE_TIERS,
    minFeeUsd: 0.01,
    maxFeeUsd: 100,
    viewingKeyDiscountBps: 5,
  },
}

// ─── Fee Calculator ──────────────────────────────────────────────────────────

/**
 * Fee calculator options
 */
export interface FeeCalculatorOptions {
  /** Custom chain configurations */
  chainConfigs?: Record<string, ChainFeeConfig>
  /** Active waivers */
  waivers?: FeeWaiver[]
  /** Override minimum fee (USD) */
  minFeeUsd?: number
  /** Override maximum fee (USD) */
  maxFeeUsd?: number
}

/**
 * Fee Calculator
 *
 * Calculates protocol fees based on transaction parameters.
 *
 * @example
 * ```typescript
 * const calculator = new FeeCalculator()
 *
 * const result = calculator.calculate({
 *   amount: 1000000000n, // 1 token
 *   amountUsd: 100, // $100
 *   sourceChain: 'near',
 *   destinationChain: 'ethereum',
 *   viewingKeyDisclosed: true,
 * })
 *
 * console.log(`Fee: ${result.protocolFeeUsd} USD (${result.appliedBps} bps)`)
 * ```
 */
export class FeeCalculator {
  private readonly chainConfigs: Record<string, ChainFeeConfig>
  private readonly waivers: FeeWaiver[]
  private readonly minFeeUsd: number
  private readonly maxFeeUsd: number

  constructor(options: FeeCalculatorOptions = {}) {
    this.chainConfigs = {
      ...DEFAULT_CHAIN_FEES,
      ...options.chainConfigs,
    }
    this.waivers = options.waivers ?? []
    this.minFeeUsd = options.minFeeUsd ?? 0.01
    this.maxFeeUsd = options.maxFeeUsd ?? 100
  }

  /**
   * Calculate fee for a transaction
   */
  calculate(input: FeeCalculationInput): FeeCalculationResult {
    // Get config for source chain (fees collected on source)
    const config = this.getChainConfig(input.sourceChain)

    // Determine base fee rate
    let baseBps = config.baseBps
    let tierName: string | undefined

    // Apply tiered pricing if available
    if (config.model === 'tiered' && config.tiers) {
      const tier = this.getTierForVolume(config.tiers, input.amountUsd)
      baseBps = tier.basisPoints
      tierName = tier.name
    }

    // Apply custom override if provided
    if (input.customBps !== undefined) {
      baseBps = input.customBps
    }

    // Calculate discount
    let discountBps = 0

    // Viewing key discount
    if (input.viewingKeyDisclosed) {
      discountBps += config.viewingKeyDiscountBps
    }

    // Apply waivers
    for (const waiver of this.waivers) {
      if (this.isWaiverValid(waiver)) {
        discountBps += waiver.discountBps
      }
    }

    // Cap discount at base rate (can't go negative)
    discountBps = Math.min(discountBps, baseBps)

    // Final rate
    const appliedBps = baseBps - discountBps

    // Calculate fee amount
    const originalFee = this.calculateFeeAmount(input.amount, baseBps)
    const protocolFee = this.calculateFeeAmount(input.amount, appliedBps)

    // Calculate USD values
    const feeRatio = Number(protocolFee) / Number(input.amount)
    let protocolFeeUsd = input.amountUsd * feeRatio

    // Apply min/max caps
    const minFee = Math.max(config.minFeeUsd, this.minFeeUsd)
    const maxFee = Math.min(config.maxFeeUsd, this.maxFeeUsd)

    if (protocolFeeUsd < minFee) {
      protocolFeeUsd = minFee
    } else if (protocolFeeUsd > maxFee) {
      protocolFeeUsd = maxFee
    }

    // Build breakdown
    const breakdown = this.buildBreakdown(protocolFee, input)

    return {
      protocolFee,
      protocolFeeUsd,
      appliedBps,
      tierName,
      discountBps,
      originalFee,
      breakdown,
    }
  }

  /**
   * Get estimated fee for display (quick calculation)
   */
  estimateFee(amountUsd: number, chain: ChainId): number {
    const config = this.getChainConfig(chain)
    let bps = config.baseBps

    if (config.model === 'tiered' && config.tiers) {
      bps = this.getTierForVolume(config.tiers, amountUsd).basisPoints
    }

    const fee = amountUsd * (bps / 10000)
    return Math.max(fee, config.minFeeUsd)
  }

  /**
   * Get fee tier for a volume
   */
  getTierForVolume(tiers: FeeTier[], volumeUsd: number): FeeTier {
    for (const tier of tiers) {
      if (volumeUsd >= tier.minVolume && volumeUsd < tier.maxVolume) {
        return tier
      }
    }
    // Default to first tier
    return tiers[0]
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chain: ChainId): ChainFeeConfig {
    const config = this.chainConfigs[chain]
    if (config) {
      return config
    }

    // Return default config for unknown chains
    return {
      chain,
      model: 'percentage',
      baseBps: 10,
      minFeeUsd: 0.01,
      maxFeeUsd: 100,
      viewingKeyDiscountBps: 5,
    }
  }

  /**
   * Update chain configuration
   */
  updateChainConfig(chain: ChainId, config: Partial<ChainFeeConfig>): void {
    const existing = this.chainConfigs[chain] ?? this.getChainConfig(chain)
    this.chainConfigs[chain] = { ...existing, ...config }
  }

  /**
   * Add a waiver
   */
  addWaiver(waiver: FeeWaiver): void {
    this.waivers.push(waiver)
  }

  /**
   * Remove a waiver by type
   */
  removeWaiver(type: FeeWaiver['type']): void {
    const index = this.waivers.findIndex((w) => w.type === type)
    if (index >= 0) {
      this.waivers.splice(index, 1)
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private calculateFeeAmount(amount: bigint, bps: number): bigint {
    // fee = amount * bps / 10000
    return (amount * BigInt(bps)) / 10000n
  }

  private isWaiverValid(waiver: FeeWaiver): boolean {
    // Check expiry
    if (waiver.expiresAt && waiver.expiresAt < Date.now()) {
      return false
    }

    // Check max uses
    if (waiver.maxUses && waiver.currentUses >= waiver.maxUses) {
      return false
    }

    return true
  }

  private buildBreakdown(
    protocolFee: bigint,
    _input: FeeCalculationInput
  ): FeeBreakdown {
    // Network fee is estimated separately (not calculated here)
    const networkFee = 0n

    return {
      baseFee: protocolFee,
      networkFee,
      totalFee: protocolFee + networkFee,
      components: [
        {
          name: 'Protocol Fee',
          amount: protocolFee,
          description: 'SIP Protocol privacy service fee',
        },
      ],
    }
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Create a fee calculator with default configuration
 */
export function createFeeCalculator(
  options?: FeeCalculatorOptions
): FeeCalculator {
  return new FeeCalculator(options)
}

/**
 * Quick fee estimate (stateless)
 */
export function estimateFee(
  amountUsd: number,
  chain: ChainId,
  viewingKeyDisclosed = false
): number {
  const calculator = new FeeCalculator()
  const result = calculator.calculate({
    amount: BigInt(Math.floor(amountUsd * 1e6)), // Assume 6 decimals
    amountUsd,
    sourceChain: chain,
    destinationChain: chain,
    viewingKeyDisclosed,
  })
  return result.protocolFeeUsd
}

/**
 * Format fee for display
 */
export function formatFee(feeUsd: number, bps: number): string {
  const percent = (bps / 100).toFixed(2)
  return `$${feeUsd.toFixed(2)} (${percent}%)`
}

/**
 * Format basis points as percentage
 */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

/**
 * Convert percentage to basis points
 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100)
}
