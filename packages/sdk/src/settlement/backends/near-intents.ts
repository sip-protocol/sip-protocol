/**
 * NEAR Intents Settlement Backend
 *
 * Implements SettlementBackend interface for NEAR 1Click API.
 * Wraps existing NEARIntentsAdapter functionality with standardized interface.
 *
 * @module settlement/backends/near-intents
 */

import type {
  SettlementBackend,
  QuoteParams,
  Quote,
  SwapParams,
  SwapResult,
  SwapStatusResponse,
  BackendCapabilities,
} from '../interface'
import { SwapStatus } from '../interface'
import {
  NEARIntentsAdapter,
  type NEARIntentsAdapterConfig,
  type SwapRequest,
} from '../../adapters/near-intents'
import {
  type ChainId,
  type Asset,
  PrivacyLevel,
  OneClickSwapStatus,
} from '@sip-protocol/types'
import { ValidationError } from '../../errors'

/**
 * Map 1Click swap status to SIP SwapStatus
 */
function mapOneClickStatus(status: OneClickSwapStatus): SwapStatus {
  switch (status) {
    case OneClickSwapStatus.PENDING_DEPOSIT:
      return SwapStatus.PENDING_DEPOSIT
    case OneClickSwapStatus.PROCESSING:
      return SwapStatus.IN_PROGRESS
    case OneClickSwapStatus.SUCCESS:
      return SwapStatus.SUCCESS
    case OneClickSwapStatus.FAILED:
      return SwapStatus.FAILED
    case OneClickSwapStatus.INCOMPLETE_DEPOSIT:
      return SwapStatus.FAILED
    case OneClickSwapStatus.REFUNDED:
      return SwapStatus.REFUNDED
    default:
      return SwapStatus.PENDING_DEPOSIT
  }
}

/**
 * NEAR Intents Settlement Backend
 *
 * Provides privacy-preserving cross-chain swaps via NEAR 1Click API.
 *
 * @example
 * ```typescript
 * const backend = new NEARIntentsBackend({
 *   jwtToken: process.env.NEAR_INTENTS_JWT,
 * })
 *
 * // Get quote
 * const quote = await backend.getQuote({
 *   fromChain: 'ethereum',
 *   toChain: 'solana',
 *   fromToken: 'USDC',
 *   toToken: 'SOL',
 *   amount: 1000000n, // 1 USDC
 *   privacyLevel: PrivacyLevel.SHIELDED,
 *   recipientMetaAddress: 'sip:solana:0x...:0x...',
 *   senderAddress: '0xYourEthAddress',
 * })
 *
 * // Execute swap
 * const result = await backend.executeSwap({
 *   quoteId: quote.quoteId,
 * })
 *
 * // Check status
 * const status = await backend.getStatus(result.swapId)
 * ```
 */
export class NEARIntentsBackend implements SettlementBackend {
  readonly name = 'near-intents' as const
  readonly capabilities: BackendCapabilities

  private adapter: NEARIntentsAdapter
  private quoteCache: Map<string, QuoteParams>

  constructor(config: NEARIntentsAdapterConfig = {}) {
    this.adapter = new NEARIntentsAdapter(config)
    this.quoteCache = new Map()

    // Define backend capabilities
    this.capabilities = {
      supportedSourceChains: [
        'near',
        'ethereum',
        'solana',
        'polygon',
        'arbitrum',
        'optimism',
        'base',
        'bitcoin',
        'zcash',
      ],
      supportedDestinationChains: [
        'near',
        'ethereum',
        'solana',
        'polygon',
        'arbitrum',
        'optimism',
        'base',
        'bitcoin',
        'zcash',
      ],
      supportedPrivacyLevels: [
        PrivacyLevel.TRANSPARENT,
        PrivacyLevel.SHIELDED,
        PrivacyLevel.COMPLIANT,
      ],
      supportsCancellation: false,
      supportsRefunds: true,
      averageExecutionTime: 300, // 5 minutes
      features: ['stealth-addresses', 'cross-chain', 'near-intents'],
    }
  }

  /**
   * Get quote for a cross-chain swap
   */
  async getQuote(params: QuoteParams): Promise<Quote> {
    // Validate parameters
    this.validateQuoteParams(params)

    // Build swap request for adapter
    const swapRequest: SwapRequest = {
      requestId: this.generateRequestId(),
      privacyLevel: params.privacyLevel,
      inputAsset: {
        chain: params.fromChain,
        symbol: params.fromToken,
        decimals: 0, // Will be inferred by adapter
      } as Asset,
      outputAsset: {
        chain: params.toChain,
        symbol: params.toToken,
        decimals: 0, // Will be inferred by adapter
      } as Asset,
      inputAmount: params.amount,
      minOutputAmount: params.slippageTolerance
        ? params.amount - (params.amount * BigInt(params.slippageTolerance) / BigInt(10000))
        : undefined,
    }

    // Prepare swap with adapter
    const prepared = await this.adapter.prepareSwap(
      swapRequest,
      params.recipientMetaAddress,
      params.senderAddress
    )

    // Get quote from 1Click API
    const oneClickQuote = await this.adapter.getQuote(prepared)

    // Cache quote params for executeSwap
    this.quoteCache.set(oneClickQuote.quoteId, params)

    // Convert to standardized Quote format
    const quote: Quote = {
      quoteId: oneClickQuote.quoteId,
      amountIn: oneClickQuote.amountIn,
      amountOut: oneClickQuote.amountOut,
      minAmountOut: oneClickQuote.amountOut, // 1Click doesn't provide separate minAmount
      fees: {
        networkFee: '0', // 1Click doesn't provide separate fee breakdown
        protocolFee: '0',
        totalFeeUSD: oneClickQuote.amountOutUsd,
      },
      depositAddress: oneClickQuote.depositAddress,
      recipientAddress: prepared.stealthAddress?.address ?? params.senderAddress ?? '',
      refundAddress: params.senderAddress,
      expiresAt: new Date(oneClickQuote.deadline).getTime() / 1000,
      estimatedTime: oneClickQuote.timeEstimate,
      metadata: {
        prepared,
        oneClickQuote,
        stealthAddress: prepared.stealthAddress,
        ephemeralPublicKey: prepared.stealthAddress?.ephemeralPublicKey,
        curve: prepared.curve,
      },
    }

    return quote
  }

  /**
   * Execute swap using a quote
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    // Validate parameters
    if (!params.quoteId) {
      throw new ValidationError('quoteId is required', 'quoteId')
    }

    // Retrieve cached quote params
    const quoteParams = this.quoteCache.get(params.quoteId)
    if (!quoteParams) {
      throw new ValidationError(
        'Quote not found. Please call getQuote() before executeSwap()',
        'quoteId'
      )
    }

    // Build swap request
    const swapRequest: SwapRequest = {
      requestId: this.generateRequestId(),
      privacyLevel: quoteParams.privacyLevel,
      inputAsset: {
        chain: quoteParams.fromChain,
        symbol: quoteParams.fromToken,
        decimals: 0,
      } as Asset,
      outputAsset: {
        chain: quoteParams.toChain,
        symbol: quoteParams.toToken,
        decimals: 0,
      } as Asset,
      inputAmount: quoteParams.amount,
    }

    // Execute swap via adapter
    const adapterResult = await this.adapter.initiateSwap(
      swapRequest,
      quoteParams.recipientMetaAddress,
      quoteParams.senderAddress
    )

    // If deposit tx provided, notify 1Click
    if (params.depositTxHash) {
      await this.adapter.notifyDeposit(
        adapterResult.depositAddress,
        params.depositTxHash,
        params.nearAccount
      )
    }

    // Convert to standardized SwapResult format
    const result: SwapResult = {
      swapId: adapterResult.depositAddress, // Use deposit address as swap ID
      status: mapOneClickStatus(adapterResult.status),
      quoteId: params.quoteId,
      depositAddress: adapterResult.depositAddress,
      depositTxHash: params.depositTxHash,
      settlementTxHash: adapterResult.settlementTxHash,
      actualAmountOut: adapterResult.amountOut,
      metadata: {
        adapterResult,
        stealthRecipient: adapterResult.stealthRecipient,
        ephemeralPublicKey: adapterResult.ephemeralPublicKey,
      },
    }

    return result
  }

  /**
   * Get current swap status
   */
  async getStatus(swapId: string): Promise<SwapStatusResponse> {
    // swapId is the deposit address
    const oneClickStatus = await this.adapter.getStatus(swapId)

    // Convert to standardized format
    const status: SwapStatusResponse = {
      swapId,
      status: mapOneClickStatus(oneClickStatus.status),
      quoteId: '', // 1Click status doesn't include quoteId
      depositAddress: swapId,
      amountIn: oneClickStatus.amountIn ?? '0',
      amountOut: oneClickStatus.amountOut ?? '0',
      depositTxHash: oneClickStatus.depositTxHash,
      settlementTxHash: oneClickStatus.settlementTxHash,
      errorMessage: oneClickStatus.error,
      updatedAt: Date.now() / 1000, // 1Click doesn't provide updatedAt
      metadata: {
        oneClickStatus,
      },
    }

    return status
  }

  /**
   * Wait for swap completion (optional)
   */
  async waitForCompletion(
    swapId: string,
    options?: {
      interval?: number
      timeout?: number
      onStatusChange?: (status: SwapStatusResponse) => void
    }
  ): Promise<SwapStatusResponse> {
    await this.adapter.waitForCompletion(swapId, {
      interval: options?.interval,
      timeout: options?.timeout,
      onStatus: options?.onStatusChange
        ? (oneClickStatus) => {
            const status: SwapStatusResponse = {
              swapId,
              status: mapOneClickStatus(oneClickStatus.status),
              quoteId: '',
              depositAddress: swapId,
              amountIn: oneClickStatus.amountIn ?? '0',
              amountOut: oneClickStatus.amountOut ?? '0',
              depositTxHash: oneClickStatus.depositTxHash,
              settlementTxHash: oneClickStatus.settlementTxHash,
              errorMessage: oneClickStatus.error,
              updatedAt: Date.now() / 1000,
              metadata: { oneClickStatus },
            }
            options.onStatusChange?.(status)
          }
        : undefined,
    })

    return this.getStatus(swapId)
  }

  /**
   * Get dry quote (preview without creating deposit address)
   */
  async getDryQuote(params: QuoteParams): Promise<Quote> {
    // Validate parameters
    this.validateQuoteParams(params)

    // Build swap request for adapter
    const swapRequest: SwapRequest = {
      requestId: this.generateRequestId(),
      privacyLevel: params.privacyLevel,
      inputAsset: {
        chain: params.fromChain,
        symbol: params.fromToken,
        decimals: 0,
      } as Asset,
      outputAsset: {
        chain: params.toChain,
        symbol: params.toToken,
        decimals: 0,
      } as Asset,
      inputAmount: params.amount,
    }

    // Prepare swap with adapter
    const prepared = await this.adapter.prepareSwap(
      swapRequest,
      params.recipientMetaAddress,
      params.senderAddress
    )

    // Get dry quote from 1Click API
    const oneClickQuote = await this.adapter.getDryQuote(prepared)

    // Convert to standardized Quote format
    const quote: Quote = {
      quoteId: oneClickQuote.quoteId,
      amountIn: oneClickQuote.amountIn,
      amountOut: oneClickQuote.amountOut,
      minAmountOut: oneClickQuote.amountOut,
      fees: {
        networkFee: '0',
        protocolFee: '0',
        totalFeeUSD: oneClickQuote.amountOutUsd,
      },
      depositAddress: oneClickQuote.depositAddress,
      recipientAddress: prepared.stealthAddress?.address ?? params.senderAddress ?? '',
      refundAddress: params.senderAddress,
      expiresAt: new Date(oneClickQuote.deadline).getTime() / 1000,
      estimatedTime: oneClickQuote.timeEstimate,
      metadata: {
        prepared,
        oneClickQuote,
        stealthAddress: prepared.stealthAddress,
        ephemeralPublicKey: prepared.stealthAddress?.ephemeralPublicKey,
        curve: prepared.curve,
        isDryQuote: true,
      },
    }

    return quote
  }

  /**
   * Notify backend of deposit transaction
   */
  async notifyDeposit(
    swapId: string,
    txHash: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.adapter.notifyDeposit(
      swapId, // swapId is deposit address
      txHash,
      metadata?.nearAccount as string | undefined
    )
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  private validateQuoteParams(params: QuoteParams): void {
    if (!params.fromChain) {
      throw new ValidationError('fromChain is required', 'fromChain')
    }
    if (!params.toChain) {
      throw new ValidationError('toChain is required', 'toChain')
    }
    if (!params.fromToken) {
      throw new ValidationError('fromToken is required', 'fromToken')
    }
    if (!params.toToken) {
      throw new ValidationError('toToken is required', 'toToken')
    }
    if (!params.amount || params.amount <= BigInt(0)) {
      throw new ValidationError('amount must be greater than 0', 'amount')
    }
    if (!params.privacyLevel) {
      throw new ValidationError('privacyLevel is required', 'privacyLevel')
    }

    // Validate privacy level requirements
    if (params.privacyLevel !== PrivacyLevel.TRANSPARENT && !params.recipientMetaAddress) {
      throw new ValidationError(
        'recipientMetaAddress is required for shielded/compliant privacy modes',
        'recipientMetaAddress'
      )
    }

    if (params.privacyLevel === PrivacyLevel.TRANSPARENT && !params.senderAddress) {
      throw new ValidationError(
        'senderAddress is required for transparent mode',
        'senderAddress'
      )
    }

    // Validate slippageTolerance bounds (0-10000 basis points = 0-100%)
    if (params.slippageTolerance !== undefined) {
      if (params.slippageTolerance < 0 || params.slippageTolerance > 10000) {
        throw new ValidationError(
          'slippageTolerance must be between 0-10000 basis points (0-100%)',
          'slippageTolerance',
          { provided: params.slippageTolerance, validRange: '0-10000' }
        )
      }
    }

    // Validate supported chains
    if (!this.capabilities.supportedSourceChains.includes(params.fromChain)) {
      throw new ValidationError(
        `Source chain ${params.fromChain} is not supported`,
        'fromChain',
        { supportedChains: this.capabilities.supportedSourceChains }
      )
    }
    if (!this.capabilities.supportedDestinationChains.includes(params.toChain)) {
      throw new ValidationError(
        `Destination chain ${params.toChain} is not supported`,
        'toChain',
        { supportedChains: this.capabilities.supportedDestinationChains }
      )
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

/**
 * Create a new NEAR Intents settlement backend
 */
export function createNEARIntentsBackend(
  config?: NEARIntentsAdapterConfig
): NEARIntentsBackend {
  return new NEARIntentsBackend(config)
}
