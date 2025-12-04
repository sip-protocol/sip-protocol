/**
 * Settlement Backend Interface for SIP Protocol
 *
 * Defines a pluggable settlement layer abstraction for executing cross-chain swaps.
 * Implementations can use NEAR Intents, Zcash, THORChain, or direct on-chain execution.
 *
 * @module settlement/interface
 */

import type {
  ChainId,
  PrivacyLevel,
  HexString,
  StealthMetaAddress,
  Asset,
} from '@sip-protocol/types'

/**
 * Settlement backend name type
 */
export type SettlementBackendName =
  | 'near-intents'
  | 'zcash'
  | 'thorchain'
  | 'direct-chain'
  | string // Allow custom backends

/**
 * Swap status enum
 */
export enum SwapStatus {
  /** Quote generated, awaiting deposit */
  PENDING_DEPOSIT = 'pending_deposit',
  /** Deposit confirmed, awaiting execution */
  DEPOSIT_CONFIRMED = 'deposit_confirmed',
  /** Swap in progress */
  IN_PROGRESS = 'in_progress',
  /** Swap completed successfully */
  SUCCESS = 'success',
  /** Swap failed */
  FAILED = 'failed',
  /** Swap cancelled or expired */
  CANCELLED = 'cancelled',
  /** Refund initiated */
  REFUNDING = 'refunding',
  /** Refund completed */
  REFUNDED = 'refunded',
}

/**
 * Parameters for requesting a quote
 */
export interface QuoteParams {
  /** Source chain */
  fromChain: ChainId
  /** Destination chain */
  toChain: ChainId
  /** Source token symbol */
  fromToken: string
  /** Destination token symbol */
  toToken: string
  /** Amount to swap (in smallest units) */
  amount: bigint
  /** Privacy level */
  privacyLevel: PrivacyLevel
  /** Recipient's stealth meta-address (for shielded/compliant modes) */
  recipientMetaAddress?: StealthMetaAddress | string
  /** Sender's address for refunds (for transparent mode or refunds) */
  senderAddress?: string
  /** Maximum acceptable slippage in basis points (100 = 1%) */
  slippageTolerance?: number
  /** Deadline for swap expiry (Unix timestamp in seconds) */
  deadline?: number
}

/**
 * Quote response
 */
export interface Quote {
  /** Unique quote identifier */
  quoteId: string
  /** Expected input amount (in smallest units) */
  amountIn: string
  /** Expected output amount (in smallest units) */
  amountOut: string
  /** Minimum output amount after slippage (in smallest units) */
  minAmountOut: string
  /** Estimated price impact in basis points */
  priceImpact?: number
  /** Estimated fees (network + protocol) */
  fees: {
    /** Network gas fees (in native token) */
    networkFee: string
    /** Protocol/solver fees (in output token) */
    protocolFee: string
    /** Total fees in USD (optional) */
    totalFeeUSD?: string
  }
  /** Deposit address for input tokens */
  depositAddress: string
  /** Recipient address (stealth address if privacy mode) */
  recipientAddress: string
  /** Refund address (if deposit fails or expires) */
  refundAddress?: string
  /** Quote expiration timestamp */
  expiresAt: number
  /** Expected execution time in seconds */
  estimatedTime?: number
  /** Swap route details (optional, for transparency) */
  route?: SwapRoute
  /** Backend-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Swap route details
 */
export interface SwapRoute {
  /** Route steps */
  steps: SwapRouteStep[]
  /** Total number of hops */
  hops: number
}

/**
 * Individual swap route step
 */
export interface SwapRouteStep {
  /** Protocol/DEX name */
  protocol: string
  /** Input token */
  tokenIn: Asset
  /** Output token */
  tokenOut: Asset
  /** Pool/pair identifier */
  poolId?: string
}

/**
 * Parameters for executing a swap
 */
export interface SwapParams {
  /** Quote identifier from getQuote() */
  quoteId: string
  /** Transaction hash of deposit (if already deposited) */
  depositTxHash?: string
  /** NEAR account (if depositing from NEAR) */
  nearAccount?: string
  /** Additional backend-specific parameters */
  metadata?: Record<string, unknown>
}

/**
 * Swap execution result
 */
export interface SwapResult {
  /** Unique swap identifier */
  swapId: string
  /** Current status */
  status: SwapStatus
  /** Quote ID */
  quoteId: string
  /** Deposit address */
  depositAddress: string
  /** Deposit transaction hash (after deposit) */
  depositTxHash?: string
  /** Settlement transaction hash (after completion) */
  settlementTxHash?: string
  /** Refund transaction hash (if refunded) */
  refundTxHash?: string
  /** Actual output amount (after completion) */
  actualAmountOut?: string
  /** Error message (if failed) */
  errorMessage?: string
  /** Backend-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Swap status response
 */
export interface SwapStatusResponse {
  /** Unique swap identifier */
  swapId: string
  /** Current status */
  status: SwapStatus
  /** Quote ID */
  quoteId: string
  /** Deposit address */
  depositAddress: string
  /** Expected input amount */
  amountIn: string
  /** Expected output amount */
  amountOut: string
  /** Deposit transaction hash (after deposit) */
  depositTxHash?: string
  /** Settlement transaction hash (after completion) */
  settlementTxHash?: string
  /** Refund transaction hash (if refunded) */
  refundTxHash?: string
  /** Actual output amount (after completion) */
  actualAmountOut?: string
  /** Error message (if failed) */
  errorMessage?: string
  /** Stealth address for recipient (if privacy mode) */
  stealthRecipient?: string
  /** Ephemeral public key (for recipient to derive stealth key) */
  ephemeralPublicKey?: string
  /** Last updated timestamp */
  updatedAt: number
  /** Backend-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Backend capabilities descriptor
 */
export interface BackendCapabilities {
  /** Supported source chains */
  supportedSourceChains: ChainId[]
  /** Supported destination chains */
  supportedDestinationChains: ChainId[]
  /** Supported privacy levels */
  supportedPrivacyLevels: PrivacyLevel[]
  /** Maximum swap amount (in USD, undefined = no limit) */
  maxSwapAmountUSD?: number
  /** Minimum swap amount (in USD, undefined = no limit) */
  minSwapAmountUSD?: number
  /** Supports cancellation */
  supportsCancellation: boolean
  /** Supports refunds */
  supportsRefunds: boolean
  /** Average execution time in seconds */
  averageExecutionTime?: number
  /** Additional backend-specific capabilities */
  features?: string[]
}

/**
 * Settlement Backend Interface
 *
 * All settlement backends must implement this interface.
 * This allows SIP to support multiple settlement layers (NEAR Intents, Zcash, THORChain, etc.)
 *
 * @example
 * ```typescript
 * class MySettlementBackend implements SettlementBackend {
 *   name = 'my-backend'
 *   supportedChains = ['ethereum', 'solana']
 *
 *   async getQuote(params: QuoteParams): Promise<Quote> {
 *     // Implementation
 *   }
 *
 *   async executeSwap(params: SwapParams): Promise<SwapResult> {
 *     // Implementation
 *   }
 *
 *   async getStatus(swapId: string): Promise<SwapStatusResponse> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface SettlementBackend {
  /**
   * Backend name (e.g., 'near-intents', 'zcash', 'thorchain')
   */
  readonly name: SettlementBackendName

  /**
   * Backend capabilities
   */
  readonly capabilities: BackendCapabilities

  /**
   * Get a quote for a cross-chain swap
   *
   * @param params - Quote parameters
   * @returns Quote with pricing, fees, and deposit address
   * @throws {ValidationError} If parameters are invalid
   * @throws {NetworkError} If backend API is unavailable
   */
  getQuote(params: QuoteParams): Promise<Quote>

  /**
   * Execute a swap using a quote
   *
   * For most backends, this returns a deposit address and waits for user deposit.
   * Some backends may require additional signing or approval.
   *
   * @param params - Swap execution parameters
   * @returns Swap result with status and transaction details
   * @throws {ValidationError} If quote is invalid or expired
   * @throws {NetworkError} If backend API is unavailable
   */
  executeSwap(params: SwapParams): Promise<SwapResult>

  /**
   * Get current swap status
   *
   * @param swapId - Swap identifier (typically the deposit address)
   * @returns Current swap status
   * @throws {ValidationError} If swap ID is invalid
   * @throws {NetworkError} If backend API is unavailable
   */
  getStatus(swapId: string): Promise<SwapStatusResponse>

  /**
   * Cancel a pending swap (optional)
   *
   * Only supported by backends with cancellation capabilities.
   * Check `capabilities.supportsCancellation` before calling.
   *
   * @param swapId - Swap identifier to cancel
   * @throws {ValidationError} If swap cannot be cancelled (already executed, etc.)
   * @throws {NetworkError} If backend API is unavailable
   * @throws {ProofError} If cancellation is not supported
   */
  cancel?(swapId: string): Promise<void>

  /**
   * Wait for swap completion (optional)
   *
   * Polls swap status until completion or timeout.
   * Backends may provide more efficient implementations (webhooks, subscriptions).
   *
   * @param swapId - Swap identifier to monitor
   * @param options - Polling options
   * @returns Final swap status
   * @throws {ValidationError} If swap ID is invalid
   * @throws {NetworkError} If backend API is unavailable
   */
  waitForCompletion?(
    swapId: string,
    options?: {
      /** Polling interval in milliseconds (default: 5000) */
      interval?: number
      /** Maximum wait time in milliseconds (default: 600000 = 10 minutes) */
      timeout?: number
      /** Status change callback */
      onStatusChange?: (status: SwapStatusResponse) => void
    }
  ): Promise<SwapStatusResponse>

  /**
   * Get a dry quote (preview without creating deposit address)
   *
   * Useful for showing estimates without committing to a swap.
   * Not all backends support this (return same as getQuote if not).
   *
   * @param params - Quote parameters
   * @returns Quote preview
   */
  getDryQuote?(params: QuoteParams): Promise<Quote>

  /**
   * Notify backend of deposit transaction (optional)
   *
   * Some backends require explicit notification after user deposits.
   * Check backend documentation for requirements.
   *
   * @param swapId - Swap identifier (typically deposit address)
   * @param txHash - Deposit transaction hash
   * @param metadata - Additional backend-specific data
   */
  notifyDeposit?(
    swapId: string,
    txHash: string,
    metadata?: Record<string, unknown>
  ): Promise<void>
}

/**
 * Settlement backend factory function type
 */
export type SettlementBackendFactory<TConfig = unknown> = (
  config: TConfig
) => SettlementBackend

/**
 * Settlement backend registry entry
 */
export interface SettlementBackendRegistry {
  /** Backend name */
  name: SettlementBackendName
  /** Factory function */
  factory: SettlementBackendFactory
  /** Human-readable display name */
  displayName: string
  /** Description */
  description: string
  /** Homepage URL */
  homepage?: string
  /** Documentation URL */
  docs?: string
}
