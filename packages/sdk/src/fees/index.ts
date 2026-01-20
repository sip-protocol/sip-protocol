/**
 * Fee Module for SIP Protocol
 *
 * Provides fee calculation, collection, and treasury management
 * for protocol revenue.
 *
 * @module fees
 *
 * @example
 * ```typescript
 * import {
 *   FeeCalculator,
 *   NEARFeeContract,
 *   estimateFee,
 * } from '@sip-protocol/sdk/fees'
 *
 * // Quick fee estimate
 * const feeUsd = estimateFee(100, 'near') // $100 swap on NEAR
 *
 * // Full calculation
 * const calculator = new FeeCalculator()
 * const result = calculator.calculate({
 *   amount: 1000000000000000000000000n,
 *   amountUsd: 5.00,
 *   sourceChain: 'near',
 *   destinationChain: 'ethereum',
 *   viewingKeyDisclosed: true,
 * })
 *
 * // With NEAR contract
 * const feeContract = new NEARFeeContract({ network: 'mainnet' })
 * const fee = await feeContract.calculateFee({
 *   amount: swapAmount,
 *   amountUsd: 100,
 *   sourceChain: 'near',
 *   destinationChain: 'solana',
 * })
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  FeeModel,
  FeeTier,
  ChainFeeConfig,
  FeeCalculationInput,
  FeeCalculationResult,
  FeeBreakdown,
  TreasuryConfig,
  FeeCollectionEvent,
  FeeStats,
  FeeContractState,
  FeeContractMethods,
  FeeWaiverType,
  FeeWaiver,
  FeeGovernanceProposal,
} from './types'

// ─── Calculator ──────────────────────────────────────────────────────────────

export {
  FeeCalculator,
  createFeeCalculator,
  estimateFee,
  formatFee,
  bpsToPercent,
  percentToBps,
  DEFAULT_FEE_TIERS,
  DEFAULT_CHAIN_FEES,
  type FeeCalculatorOptions,
} from './calculator'

// ─── NEAR Contract ───────────────────────────────────────────────────────────

export {
  NEARFeeContract,
  createNEARFeeContract,
  createMainnetFeeContract,
  createTestnetFeeContract,
  calculateFeeForSwap,
  NEAR_FEE_CONTRACTS,
  DEFAULT_TREASURY,
  type NEARFeeContractOptions,
  type FeeCollectionParams,
  type FeeCollectionResult,
} from './near-contract'
