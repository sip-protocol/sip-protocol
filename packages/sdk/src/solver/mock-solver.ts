/**
 * Mock Solver Implementation
 *
 * Reference implementation of the SIPSolver interface for testing
 * and development. Demonstrates how solvers should interact with
 * shielded intents while preserving privacy.
 */

import {
  type SIPSolver,
  type Solver,
  type SolverCapabilities,
  type SolverVisibleIntent,
  type SolverQuote,
  type ShieldedIntent,
  type FulfillmentResult,
  type FulfillmentStatus,
  type ChainId,
  IntentStatus,
} from '@sip-protocol/types'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'

/**
 * Configuration for MockSolver
 */
export interface MockSolverConfig {
  /** Solver name */
  name?: string
  /** Supported chains */
  supportedChains?: ChainId[]
  /** Base fee percentage (0-1) */
  feePercent?: number
  /** Simulated execution time in ms */
  executionDelay?: number
  /** Failure rate for testing (0-1) */
  failureRate?: number
  /** Quote spread percentage (0-1) */
  spreadPercent?: number
}

/**
 * Mock implementation of SIPSolver for testing
 *
 * This solver demonstrates the privacy-preserving interaction pattern:
 * - Only accesses visible fields of intents
 * - Cannot see sender identity or exact input amounts
 * - Generates valid quotes based on output requirements
 *
 * @example
 * ```typescript
 * const solver = new MockSolver({ name: 'Test Solver' })
 *
 * // Check if solver can handle intent
 * if (await solver.canHandle(visibleIntent)) {
 *   const quote = await solver.generateQuote(visibleIntent)
 *   if (quote) {
 *     const result = await solver.fulfill(intent, quote)
 *   }
 * }
 * ```
 */
export class MockSolver implements SIPSolver {
  readonly info: Solver
  readonly capabilities: SolverCapabilities

  private readonly feePercent: number
  private readonly executionDelay: number
  private readonly failureRate: number
  private readonly spreadPercent: number
  private readonly pendingFulfillments: Map<string, FulfillmentStatus> = new Map()

  constructor(config: MockSolverConfig = {}) {
    const supportedChains = config.supportedChains ?? [
      'near', 'ethereum', 'solana', 'zcash', 'polygon', 'arbitrum', 'base'
    ] as ChainId[]

    this.info = {
      id: `mock-solver-${Date.now()}`,
      name: config.name ?? 'Mock SIP Solver',
      supportedChains,
      reputation: 95,
      totalVolume: 1000000n,
      successRate: 0.99,
      minOrderSize: 1n,
      maxOrderSize: 1000000000n,
    }

    // Build supported pairs (all combinations)
    const supportedPairs = new Map<string, string[]>()
    for (const inputChain of supportedChains) {
      const outputs = supportedChains.filter(c => c !== inputChain)
      supportedPairs.set(inputChain, outputs)
    }

    this.capabilities = {
      inputChains: supportedChains,
      outputChains: supportedChains,
      supportedPairs,
      supportsShielded: true,
      supportsCompliant: true,
      supportsPartialFill: false,
      avgFulfillmentTime: 30,
    }

    this.feePercent = config.feePercent ?? 0.005 // 0.5% default fee
    this.executionDelay = config.executionDelay ?? 1000
    this.failureRate = config.failureRate ?? 0
    this.spreadPercent = config.spreadPercent ?? 0.01 // 1% spread
  }

  /**
   * Check if this solver can handle the given intent
   *
   * Privacy-preserving: Only accesses visible fields
   */
  async canHandle(intent: SolverVisibleIntent): Promise<boolean> {
    // Check if output chain is supported
    const outputChain = intent.outputAsset.chain
    if (!this.capabilities.outputChains.includes(outputChain)) {
      return false
    }

    // Check expiry
    if (intent.expiry < Date.now() / 1000) {
      return false
    }

    // Check minimum amount (solver may have minimums)
    if (intent.minOutputAmount < (this.info.minOrderSize ?? 0n)) {
      return false
    }

    return true
  }

  /**
   * Generate a quote for the intent
   *
   * Privacy-preserving:
   * - Does NOT access sender identity (only senderCommitment visible)
   * - Does NOT know exact input amount (only inputCommitment visible)
   * - Quotes based solely on output requirements
   */
  async generateQuote(intent: SolverVisibleIntent): Promise<SolverQuote | null> {
    // First check if we can handle this
    if (!await this.canHandle(intent)) {
      return null
    }

    // Calculate output amount with spread
    // Real solvers would query liquidity pools, order books, etc.
    const baseOutput = intent.minOutputAmount
    const spreadAmount = (baseOutput * BigInt(Math.floor(this.spreadPercent * 10000))) / 10000n
    const outputAmount = baseOutput + spreadAmount

    // Calculate fee
    const feeAmount = (outputAmount * BigInt(Math.floor(this.feePercent * 10000))) / 10000n

    // Generate quote
    const quoteId = `quote-${bytesToHex(randomBytes(8))}`
    const now = Math.floor(Date.now() / 1000)

    const quote: SolverQuote = {
      quoteId,
      intentId: intent.intentId,
      solverId: this.info.id,
      outputAmount,
      estimatedTime: this.capabilities.avgFulfillmentTime,
      expiry: now + 60, // Quote valid for 1 minute
      fee: feeAmount,
      signature: `0x${bytesToHex(randomBytes(64))}`, // Mock signature
      validUntil: now + 60,
      estimatedGas: 200000n,
    }

    return quote
  }

  /**
   * Fulfill an intent with the given quote
   *
   * In production, this would:
   * 1. Lock collateral
   * 2. Execute the swap on destination chain
   * 3. Generate fulfillment proof
   * 4. Release collateral after verification
   *
   * Privacy preserved:
   * - Funds go to stealth address (unlinkable)
   * - Solver never learns recipient's real identity
   */
  async fulfill(
    intent: ShieldedIntent,
    quote: SolverQuote,
  ): Promise<FulfillmentResult> {
    // Track fulfillment status
    const status: FulfillmentStatus = {
      intentId: intent.intentId,
      status: 'executing',
    }
    this.pendingFulfillments.set(intent.intentId, status)

    // Simulate execution delay
    await this.delay(this.executionDelay)

    // Simulate random failures for testing
    if (Math.random() < this.failureRate) {
      status.status = 'failed'
      status.error = 'Simulated failure for testing'

      return {
        intentId: intent.intentId,
        status: IntentStatus.FAILED,
        fulfilledAt: Math.floor(Date.now() / 1000),
        error: status.error,
      }
    }

    // Generate mock transaction hash
    const txHash = `0x${bytesToHex(randomBytes(32))}`
    status.status = 'completed'
    status.txHash = txHash

    return {
      intentId: intent.intentId,
      status: IntentStatus.FULFILLED,
      outputAmount: quote.outputAmount,
      txHash: intent.privacyLevel === 'transparent' ? txHash : undefined,
      fulfillmentProof: {
        type: 'fulfillment',
        proof: `0x${bytesToHex(randomBytes(128))}` as const,
        publicInputs: [
          `0x${bytesToHex(new TextEncoder().encode(intent.intentId))}` as const,
          `0x${bytesToHex(new TextEncoder().encode(quote.quoteId))}` as const,
        ],
      },
      fulfilledAt: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Cancel a pending fulfillment
   */
  async cancel(intentId: string): Promise<boolean> {
    const status = this.pendingFulfillments.get(intentId)
    if (!status || status.status !== 'pending') {
      return false
    }

    status.status = 'cancelled'
    return true
  }

  /**
   * Get fulfillment status
   */
  async getStatus(intentId: string): Promise<FulfillmentStatus | null> {
    return this.pendingFulfillments.get(intentId) ?? null
  }

  /**
   * Reset solver state (for testing)
   */
  reset(): void {
    this.pendingFulfillments.clear()
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Create a mock solver with default configuration
 */
export function createMockSolver(config?: MockSolverConfig): MockSolver {
  return new MockSolver(config)
}
