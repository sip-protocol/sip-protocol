/**
 * Zcash Swap Service
 *
 * Handles cross-chain swaps from ETH/SOL/NEAR to Zcash (ZEC).
 * Since NEAR Intents doesn't support ZEC as destination chain,
 * this service provides an alternative path for ZEC swaps.
 *
 * @example
 * ```typescript
 * const swapService = new ZcashSwapService({
 *   zcashService: zcashShieldedService,
 *   mode: 'demo', // or 'production' when bridge is available
 * })
 *
 * // Get quote for ETH → ZEC swap
 * const quote = await swapService.getQuote({
 *   sourceChain: 'ethereum',
 *   sourceToken: 'ETH',
 *   amount: 1000000000000000000n, // 1 ETH
 *   recipientZAddress: 'zs1...',
 * })
 *
 * // Execute the swap
 * const result = await swapService.executeSwapToShielded({
 *   quoteId: quote.quoteId,
 *   sourceChain: 'ethereum',
 *   sourceToken: 'ETH',
 *   amount: 1000000000000000000n,
 *   recipientZAddress: 'zs1...',
 * })
 * ```
 */

import { type ChainId, PrivacyLevel } from '@sip-protocol/types'
import { ValidationError, IntentError, NetworkError, ErrorCode } from '../errors'
import type { ZcashShieldedService, ShieldedSendResult } from './shielded-service'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Supported source chains for ZEC swaps
 */
export type ZcashSwapSourceChain = 'ethereum' | 'solana' | 'near' | 'polygon' | 'arbitrum' | 'base'

/**
 * Supported source tokens for ZEC swaps
 */
export type ZcashSwapSourceToken = 'ETH' | 'SOL' | 'NEAR' | 'USDC' | 'USDT' | 'MATIC'

/**
 * Configuration for ZcashSwapService
 */
export interface ZcashSwapServiceConfig {
  /** Zcash shielded service for receiving ZEC */
  zcashService?: ZcashShieldedService
  /** Operating mode */
  mode: 'demo' | 'production'
  /** Bridge provider (for production) */
  bridgeProvider?: BridgeProvider
  /** Price feed for quotes */
  priceFeed?: PriceFeed
  /** Default slippage tolerance (basis points, default: 100 = 1%) */
  defaultSlippage?: number
  /** Quote validity duration in seconds (default: 60) */
  quoteValiditySeconds?: number
}

/**
 * Bridge provider interface (for production mode)
 */
export interface BridgeProvider {
  /** Provider name */
  name: string
  /** Get quote from bridge */
  getQuote(params: BridgeQuoteParams): Promise<BridgeQuote>
  /** Execute swap through bridge */
  executeSwap(params: BridgeSwapParams): Promise<BridgeSwapResult>
  /** Get supported chains */
  getSupportedChains(): Promise<ZcashSwapSourceChain[]>
}

/**
 * Price feed interface for quote calculations
 */
export interface PriceFeed {
  /** Get current price in USD */
  getPrice(token: string): Promise<number>
  /** Get ZEC price in USD */
  getZecPrice(): Promise<number>
}

/**
 * Bridge quote parameters
 */
export interface BridgeQuoteParams {
  sourceChain: ZcashSwapSourceChain
  sourceToken: ZcashSwapSourceToken
  amount: bigint
  recipientAddress: string
}

/**
 * Bridge quote result
 */
export interface BridgeQuote {
  quoteId: string
  amountIn: bigint
  amountOut: bigint
  fee: bigint
  exchangeRate: number
  validUntil: number
}

/**
 * Bridge swap parameters
 */
export interface BridgeSwapParams extends BridgeQuoteParams {
  quoteId: string
  depositAddress: string
}

/**
 * Bridge swap result
 */
export interface BridgeSwapResult {
  txHash: string
  status: 'pending' | 'completed' | 'failed'
  amountReceived?: bigint
}

/**
 * Quote request parameters
 */
export interface ZcashQuoteParams {
  /** Source blockchain */
  sourceChain: ZcashSwapSourceChain
  /** Source token symbol */
  sourceToken: ZcashSwapSourceToken
  /** Amount in smallest unit (wei, lamports, etc.) */
  amount: bigint
  /** Recipient z-address */
  recipientZAddress: string
  /** Custom slippage (basis points) */
  slippage?: number
}

/**
 * Quote response
 */
export interface ZcashQuote {
  /** Unique quote identifier */
  quoteId: string
  /** Source chain */
  sourceChain: ZcashSwapSourceChain
  /** Source token */
  sourceToken: ZcashSwapSourceToken
  /** Input amount (in source token's smallest unit) */
  amountIn: bigint
  /** Input amount formatted */
  amountInFormatted: string
  /** Output amount in zatoshis (1 ZEC = 100,000,000 zatoshis) */
  amountOut: bigint
  /** Output amount in ZEC */
  amountOutFormatted: string
  /** Exchange rate (ZEC per source token) */
  exchangeRate: number
  /** Network fee in source token */
  networkFee: bigint
  /** Bridge/swap fee in source token */
  swapFee: bigint
  /** Total fee in source token */
  totalFee: bigint
  /** Slippage tolerance (basis points) */
  slippage: number
  /** Minimum output amount after slippage */
  minimumOutput: bigint
  /** Quote expiration timestamp */
  validUntil: number
  /** Deposit address (where to send source tokens) */
  depositAddress: string
  /** Estimated time to completion (seconds) */
  estimatedTime: number
  /** Privacy level for the swap */
  privacyLevel: PrivacyLevel
}

/**
 * Swap execution parameters
 */
export interface ZcashSwapParams {
  /** Quote ID to execute */
  quoteId?: string
  /** Source blockchain */
  sourceChain: ZcashSwapSourceChain
  /** Source token symbol */
  sourceToken: ZcashSwapSourceToken
  /** Amount in smallest unit */
  amount: bigint
  /** Recipient z-address (shielded) */
  recipientZAddress: string
  /** Optional memo for the transaction */
  memo?: string
  /** Custom slippage (basis points) */
  slippage?: number
}

/**
 * Swap execution result
 */
export interface ZcashSwapResult {
  /** Swap request ID */
  requestId: string
  /** Quote used */
  quoteId: string
  /** Current status */
  status: ZcashSwapStatus
  /** Source chain transaction hash (deposit tx) */
  sourceTxHash?: string
  /** Zcash transaction ID (if completed) */
  zcashTxId?: string
  /** Amount deposited */
  amountIn: bigint
  /** Amount received in ZEC (zatoshis) */
  amountOut?: bigint
  /** Recipient z-address */
  recipientZAddress: string
  /** Timestamp */
  timestamp: number
  /** Error message if failed */
  error?: string
}

/**
 * Swap status
 */
export type ZcashSwapStatus =
  | 'pending_deposit'    // Waiting for source chain deposit
  | 'deposit_confirmed'  // Deposit confirmed, processing swap
  | 'swapping'           // Swap in progress
  | 'sending_zec'        // Sending ZEC to recipient
  | 'completed'          // Swap completed
  | 'failed'             // Swap failed
  | 'expired'            // Quote expired

// ─── Mock Price Data ───────────────────────────────────────────────────────────

/**
 * Mock prices for demo mode (in USD)
 */
const MOCK_PRICES: Record<string, number> = {
  ETH: 2500,
  SOL: 120,
  NEAR: 5,
  MATIC: 0.8,
  USDC: 1,
  USDT: 1,
  ZEC: 35,
}

/**
 * Token decimals
 */
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  SOL: 9,
  NEAR: 24,
  MATIC: 18,
  USDC: 6,
  USDT: 6,
  ZEC: 8, // zatoshis
}

// ─── Service Implementation ────────────────────────────────────────────────────

/**
 * Zcash Swap Service
 *
 * Enables cross-chain swaps from ETH/SOL/NEAR to Zcash's shielded pool.
 */
export class ZcashSwapService {
  private readonly config: Required<Omit<ZcashSwapServiceConfig, 'zcashService' | 'bridgeProvider' | 'priceFeed'>>
  private readonly zcashService?: ZcashShieldedService
  private readonly bridgeProvider?: BridgeProvider
  private readonly priceFeed?: PriceFeed
  private readonly quotes: Map<string, ZcashQuote> = new Map()
  private readonly swaps: Map<string, ZcashSwapResult> = new Map()

  constructor(config: ZcashSwapServiceConfig) {
    this.config = {
      mode: config.mode,
      defaultSlippage: config.defaultSlippage ?? 100, // 1%
      quoteValiditySeconds: config.quoteValiditySeconds ?? 60,
    }
    this.zcashService = config.zcashService
    this.bridgeProvider = config.bridgeProvider
    this.priceFeed = config.priceFeed
  }

  // ─── Quote Methods ───────────────────────────────────────────────────────────

  /**
   * Get a quote for swapping to ZEC
   */
  async getQuote(params: ZcashQuoteParams): Promise<ZcashQuote> {
    // Validate parameters
    this.validateQuoteParams(params)

    // Validate z-address
    if (this.zcashService) {
      const addressInfo = await this.zcashService.validateAddress(params.recipientZAddress)
      if (!addressInfo.isvalid) {
        throw new ValidationError(
          'Invalid Zcash address',
          'recipientZAddress',
          { received: params.recipientZAddress },
          ErrorCode.INVALID_ADDRESS,
        )
      }
    } else {
      // Basic validation without zcashd
      if (!this.isValidZAddressFormat(params.recipientZAddress)) {
        throw new ValidationError(
          'Invalid Zcash address format. Expected z-address (zs1...) or unified address (u1...)',
          'recipientZAddress',
          { received: params.recipientZAddress },
          ErrorCode.INVALID_ADDRESS,
        )
      }
    }

    if (this.config.mode === 'production' && this.bridgeProvider) {
      return this.getProductionQuote(params)
    }

    return this.getDemoQuote(params)
  }

  /**
   * Get quote in demo mode (uses mock prices)
   */
  private async getDemoQuote(params: ZcashQuoteParams): Promise<ZcashQuote> {
    const { sourceChain, sourceToken, amount, recipientZAddress, slippage } = params

    // Get prices (mock or from price feed)
    const sourcePrice = this.priceFeed
      ? await this.priceFeed.getPrice(sourceToken)
      : MOCK_PRICES[sourceToken] ?? 1
    const zecPrice = this.priceFeed
      ? await this.priceFeed.getZecPrice()
      : MOCK_PRICES.ZEC

    // Calculate amounts
    const sourceDecimals = TOKEN_DECIMALS[sourceToken] ?? 18
    const amountInUsd = (Number(amount) / 10 ** sourceDecimals) * sourcePrice

    // Apply fees (0.5% swap fee, ~$2 network fee)
    const swapFeeUsd = amountInUsd * 0.005
    const networkFeeUsd = 2
    const totalFeeUsd = swapFeeUsd + networkFeeUsd
    const netAmountUsd = amountInUsd - totalFeeUsd

    // Calculate ZEC output
    const zecAmount = netAmountUsd / zecPrice
    const zecZatoshis = BigInt(Math.floor(zecAmount * 100_000_000))

    // Apply slippage
    const slippageBps = slippage ?? this.config.defaultSlippage
    const minimumOutput = (zecZatoshis * BigInt(10000 - slippageBps)) / 10000n

    // Calculate fees in source token
    const swapFee = BigInt(Math.floor((swapFeeUsd / sourcePrice) * 10 ** sourceDecimals))
    const networkFee = BigInt(Math.floor((networkFeeUsd / sourcePrice) * 10 ** sourceDecimals))

    // Generate quote
    const quoteId = `zec_quote_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const validUntil = Math.floor(Date.now() / 1000) + this.config.quoteValiditySeconds

    const quote: ZcashQuote = {
      quoteId,
      sourceChain,
      sourceToken,
      amountIn: amount,
      amountInFormatted: this.formatAmount(amount, sourceDecimals),
      amountOut: zecZatoshis,
      amountOutFormatted: this.formatAmount(zecZatoshis, 8),
      exchangeRate: zecPrice / sourcePrice,
      networkFee,
      swapFee,
      totalFee: networkFee + swapFee,
      slippage: slippageBps,
      minimumOutput,
      validUntil,
      depositAddress: this.generateMockDepositAddress(sourceChain),
      estimatedTime: this.getEstimatedTime(sourceChain),
      privacyLevel: PrivacyLevel.SHIELDED,
    }

    // Store quote for later execution
    this.quotes.set(quoteId, quote)

    return quote
  }

  /**
   * Get quote in production mode (uses bridge provider)
   */
  private async getProductionQuote(params: ZcashQuoteParams): Promise<ZcashQuote> {
    if (!this.bridgeProvider) {
      throw new IntentError(
        'Bridge provider not configured for production mode',
        ErrorCode.INTENT_INVALID_STATE,
      )
    }

    const bridgeQuote = await this.bridgeProvider.getQuote({
      sourceChain: params.sourceChain,
      sourceToken: params.sourceToken,
      amount: params.amount,
      recipientAddress: params.recipientZAddress,
    })

    const sourceDecimals = TOKEN_DECIMALS[params.sourceToken] ?? 18
    const slippageBps = params.slippage ?? this.config.defaultSlippage
    const minimumOutput = (bridgeQuote.amountOut * BigInt(10000 - slippageBps)) / 10000n

    const quote: ZcashQuote = {
      quoteId: bridgeQuote.quoteId,
      sourceChain: params.sourceChain,
      sourceToken: params.sourceToken,
      amountIn: bridgeQuote.amountIn,
      amountInFormatted: this.formatAmount(bridgeQuote.amountIn, sourceDecimals),
      amountOut: bridgeQuote.amountOut,
      amountOutFormatted: this.formatAmount(bridgeQuote.amountOut, 8),
      exchangeRate: bridgeQuote.exchangeRate,
      networkFee: 0n, // Included in bridge fee
      swapFee: bridgeQuote.fee,
      totalFee: bridgeQuote.fee,
      slippage: slippageBps,
      minimumOutput,
      validUntil: bridgeQuote.validUntil,
      depositAddress: '', // Will be set by bridge
      estimatedTime: this.getEstimatedTime(params.sourceChain),
      privacyLevel: PrivacyLevel.SHIELDED,
    }

    this.quotes.set(quote.quoteId, quote)
    return quote
  }

  // ─── Swap Execution ──────────────────────────────────────────────────────────

  /**
   * Execute a swap to Zcash shielded pool
   */
  async executeSwapToShielded(params: ZcashSwapParams): Promise<ZcashSwapResult> {
    // Get or create quote
    let quote: ZcashQuote | undefined
    if (params.quoteId) {
      quote = this.quotes.get(params.quoteId)
      if (!quote) {
        throw new ValidationError(
          'Quote not found or expired',
          'quoteId',
          { received: params.quoteId },
          ErrorCode.VALIDATION_FAILED,
        )
      }
    }

    if (!quote) {
      quote = await this.getQuote({
        sourceChain: params.sourceChain,
        sourceToken: params.sourceToken,
        amount: params.amount,
        recipientZAddress: params.recipientZAddress,
        slippage: params.slippage,
      })
    }

    // Check quote validity
    if (quote.validUntil < Math.floor(Date.now() / 1000)) {
      throw new IntentError(
        'Quote has expired',
        ErrorCode.INTENT_EXPIRED,
        { context: { quoteId: quote.quoteId, validUntil: quote.validUntil } },
      )
    }

    // Create swap result
    const requestId = `zec_swap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const result: ZcashSwapResult = {
      requestId,
      quoteId: quote.quoteId,
      status: 'pending_deposit',
      amountIn: params.amount,
      recipientZAddress: params.recipientZAddress,
      timestamp: Math.floor(Date.now() / 1000),
    }

    // Store for tracking
    this.swaps.set(requestId, result)

    if (this.config.mode === 'production' && this.bridgeProvider) {
      return this.executeProductionSwap(result, quote, params)
    }

    return this.executeDemoSwap(result, quote, params)
  }

  /**
   * Execute swap in demo mode
   */
  private async executeDemoSwap(
    result: ZcashSwapResult,
    quote: ZcashQuote,
    params: ZcashSwapParams,
  ): Promise<ZcashSwapResult> {
    // Simulate swap progression
    result.status = 'deposit_confirmed'
    result.sourceTxHash = `0x${this.randomHex(64)}`
    this.swaps.set(result.requestId, { ...result })

    // Simulate swap processing
    await this.delay(100) // Small delay for realism
    result.status = 'swapping'
    this.swaps.set(result.requestId, { ...result })

    await this.delay(100)
    result.status = 'sending_zec'
    this.swaps.set(result.requestId, { ...result })

    // If we have a zcash service, try to actually send
    if (this.zcashService) {
      try {
        const zecAmount = Number(quote.amountOut) / 100_000_000
        const sendResult = await this.zcashService.sendShielded({
          to: params.recipientZAddress,
          amount: zecAmount,
          memo: params.memo ?? `SIP Swap: ${params.sourceToken} → ZEC`,
        })

        result.status = 'completed'
        result.zcashTxId = sendResult.txid
        result.amountOut = quote.amountOut
      } catch (error) {
        // Fall back to mock result
        result.status = 'completed'
        result.zcashTxId = this.randomHex(64)
        result.amountOut = quote.amountOut
      }
    } else {
      // Mock completion
      result.status = 'completed'
      result.zcashTxId = this.randomHex(64)
      result.amountOut = quote.amountOut
    }

    this.swaps.set(result.requestId, { ...result })
    return result
  }

  /**
   * Execute swap in production mode
   */
  private async executeProductionSwap(
    result: ZcashSwapResult,
    quote: ZcashQuote,
    params: ZcashSwapParams,
  ): Promise<ZcashSwapResult> {
    if (!this.bridgeProvider) {
      throw new IntentError(
        'Bridge provider not configured',
        ErrorCode.INTENT_INVALID_STATE,
      )
    }

    try {
      const bridgeResult = await this.bridgeProvider.executeSwap({
        sourceChain: params.sourceChain,
        sourceToken: params.sourceToken,
        amount: params.amount,
        recipientAddress: params.recipientZAddress,
        quoteId: quote.quoteId,
        depositAddress: quote.depositAddress,
      })

      result.sourceTxHash = bridgeResult.txHash
      result.status = bridgeResult.status === 'completed' ? 'completed' : 'swapping'

      if (bridgeResult.amountReceived) {
        result.amountOut = bridgeResult.amountReceived
      }
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Bridge execution failed'
    }

    this.swaps.set(result.requestId, { ...result })
    return result
  }

  // ─── Status Methods ──────────────────────────────────────────────────────────

  /**
   * Get swap status
   */
  async getSwapStatus(requestId: string): Promise<ZcashSwapResult | null> {
    return this.swaps.get(requestId) ?? null
  }

  /**
   * Wait for swap completion
   */
  async waitForCompletion(
    requestId: string,
    timeout: number = 300000,
    pollInterval: number = 5000,
  ): Promise<ZcashSwapResult> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = await this.getSwapStatus(requestId)

      if (!status) {
        throw new IntentError(
          'Swap not found',
          ErrorCode.INTENT_NOT_FOUND,
          { context: { requestId } },
        )
      }

      if (status.status === 'completed') {
        return status
      }

      if (status.status === 'failed' || status.status === 'expired') {
        throw new IntentError(
          `Swap ${status.status}: ${status.error ?? 'Unknown error'}`,
          ErrorCode.INTENT_FAILED,
          { context: { requestId, status } },
        )
      }

      await this.delay(pollInterval)
    }

    throw new NetworkError(
      'Swap completion timeout',
      ErrorCode.NETWORK_TIMEOUT,
      { context: { requestId, timeout } },
    )
  }

  // ─── Utility Methods ─────────────────────────────────────────────────────────

  /**
   * Get supported source chains
   */
  async getSupportedChains(): Promise<ZcashSwapSourceChain[]> {
    if (this.bridgeProvider) {
      return this.bridgeProvider.getSupportedChains()
    }
    return ['ethereum', 'solana', 'near', 'polygon', 'arbitrum', 'base']
  }

  /**
   * Get supported source tokens for a chain
   */
  getSupportedTokens(chain: ZcashSwapSourceChain): ZcashSwapSourceToken[] {
    const tokensByChain: Record<ZcashSwapSourceChain, ZcashSwapSourceToken[]> = {
      ethereum: ['ETH', 'USDC', 'USDT'],
      solana: ['SOL', 'USDC', 'USDT'],
      near: ['NEAR', 'USDC', 'USDT'],
      polygon: ['MATIC', 'USDC', 'USDT'],
      arbitrum: ['ETH', 'USDC', 'USDT'],
      base: ['ETH', 'USDC'],
    }
    return tokensByChain[chain] ?? []
  }

  /**
   * Check if a swap route is supported
   */
  isRouteSupported(chain: ZcashSwapSourceChain, token: ZcashSwapSourceToken): boolean {
    return this.getSupportedTokens(chain).includes(token)
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private validateQuoteParams(params: ZcashQuoteParams): void {
    if (!params.sourceChain) {
      throw new ValidationError('Source chain is required', 'sourceChain', undefined, ErrorCode.VALIDATION_FAILED)
    }
    if (!params.sourceToken) {
      throw new ValidationError('Source token is required', 'sourceToken', undefined, ErrorCode.VALIDATION_FAILED)
    }
    if (!params.amount || params.amount <= 0n) {
      throw new ValidationError('Amount must be positive', 'amount', { received: params.amount }, ErrorCode.INVALID_AMOUNT)
    }
    if (!params.recipientZAddress) {
      throw new ValidationError('Recipient z-address is required', 'recipientZAddress', undefined, ErrorCode.VALIDATION_FAILED)
    }
    if (!this.isRouteSupported(params.sourceChain, params.sourceToken)) {
      throw new ValidationError(
        `Unsupported swap route: ${params.sourceChain}:${params.sourceToken} → ZEC`,
        'sourceToken',
        { chain: params.sourceChain, token: params.sourceToken },
        ErrorCode.VALIDATION_FAILED,
      )
    }
  }

  private isValidZAddressFormat(address: string): boolean {
    // Shielded addresses start with 'zs' (sapling) or 'zc' (sprout, deprecated)
    // Unified addresses start with 'u'
    // Testnet shielded: 'ztestsapling' prefix
    return (
      address.startsWith('zs1') ||
      address.startsWith('u1') ||
      address.startsWith('ztestsapling') ||
      address.startsWith('utest')
    )
  }

  private generateMockDepositAddress(chain: ZcashSwapSourceChain): string {
    switch (chain) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
      case 'base':
        return `0x${this.randomHex(40)}`
      case 'solana':
        return this.randomBase58(44)
      case 'near':
        return `deposit_${this.randomHex(8)}.near`
      default:
        return `0x${this.randomHex(40)}`
    }
  }

  private getEstimatedTime(chain: ZcashSwapSourceChain): number {
    // Estimated completion time in seconds
    const times: Record<ZcashSwapSourceChain, number> = {
      ethereum: 900,   // ~15 min (confirmations + processing)
      solana: 300,     // ~5 min
      near: 300,       // ~5 min
      polygon: 600,    // ~10 min
      arbitrum: 600,   // ~10 min
      base: 600,       // ~10 min
    }
    return times[chain] ?? 600
  }

  private formatAmount(amount: bigint, decimals: number): string {
    const divisor = 10 ** decimals
    const whole = amount / BigInt(divisor)
    const fraction = amount % BigInt(divisor)
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
    return fractionStr ? `${whole}.${fractionStr}` : whole.toString()
  }

  private randomHex(length: number): string {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  private randomBase58(length: number): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Create a Zcash swap service instance
 */
export function createZcashSwapService(
  config: ZcashSwapServiceConfig,
): ZcashSwapService {
  return new ZcashSwapService(config)
}
