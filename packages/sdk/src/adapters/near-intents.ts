/**
 * NEAR Intents Adapter for SIP Protocol
 *
 * Bridges SIP SDK with NEAR 1Click API, providing privacy-preserving
 * cross-chain swaps using stealth addresses.
 */

import {
  type StealthMetaAddress,
  type OneClickQuoteRequest,
  type OneClickQuoteResponse,
  type OneClickStatusResponse,
  type DefuseAssetId,
  type ChainType,
  type ChainId,
  type HexString,
  type Asset,
  PrivacyLevel,
  OneClickSwapType,
  OneClickSwapStatus,
} from '@sip-protocol/types'
import { OneClickClient } from './oneclick-client'
import { generateStealthAddress, decodeStealthMetaAddress } from '../stealth'
import { ValidationError } from '../errors'

/**
 * Swap request parameters (simplified interface for adapter)
 */
export interface SwapRequest {
  /** Unique request ID */
  requestId: string
  /** Privacy level for the swap */
  privacyLevel: PrivacyLevel
  /** Input asset */
  inputAsset: Asset
  /** Input amount in smallest units */
  inputAmount: bigint
  /** Output asset */
  outputAsset: Asset
  /** Minimum output amount */
  minOutputAmount?: bigint
}

/**
 * Result of preparing a swap with SIP privacy
 */
export interface PreparedSwap {
  /** Original swap request */
  request: SwapRequest
  /** 1Click quote request */
  quoteRequest: OneClickQuoteRequest
  /** Generated stealth address (for shielded/compliant modes) */
  stealthAddress?: {
    address: HexString
    ephemeralPublicKey: HexString
    viewTag: number
  }
  /** Shared secret for stealth address derivation (keep private!) */
  sharedSecret?: HexString
}

/**
 * Result of executing a swap
 */
export interface SwapResult {
  /** Request ID */
  requestId: string
  /** 1Click quote ID */
  quoteId: string
  /** Deposit address for input tokens */
  depositAddress: string
  /** Expected input amount */
  amountIn: string
  /** Expected output amount */
  amountOut: string
  /** Current status */
  status: OneClickSwapStatus
  /** Deposit transaction hash (after deposit) */
  depositTxHash?: string
  /** Settlement transaction hash (after success) */
  settlementTxHash?: string
  /** Stealth address for recipient (if privacy mode) */
  stealthRecipient?: string
  /** Ephemeral public key (for recipient to derive stealth key) */
  ephemeralPublicKey?: string
}

/**
 * Configuration for NEAR Intents adapter
 */
export interface NEARIntentsAdapterConfig {
  /** OneClickClient instance or config */
  client?: OneClickClient
  /** Base URL for 1Click API */
  baseUrl?: string
  /** JWT token for authentication */
  jwtToken?: string
  /** Default slippage tolerance in basis points (100 = 1%) */
  defaultSlippage?: number
  /** Default deadline offset in seconds */
  defaultDeadlineOffset?: number
}

/**
 * Asset mapping from SIP format to Defuse asset identifier
 */
const ASSET_MAPPINGS: Record<string, DefuseAssetId> = {
  // NEAR assets
  'near:NEAR': 'near:mainnet:native',
  'near:wNEAR': 'near:mainnet:wrap.near',

  // Ethereum assets
  'ethereum:ETH': 'eth:1:native',
  'ethereum:USDC': 'eth:1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  'ethereum:USDT': 'eth:1:0xdac17f958d2ee523a2206206994597c13d831ec7',

  // Solana assets
  'solana:SOL': 'sol:mainnet:native',

  // Zcash assets
  'zcash:ZEC': 'zcash:mainnet:native',

  // Arbitrum assets
  'arbitrum:ETH': 'arb:42161:native',

  // Base assets
  'base:ETH': 'base:8453:native',

  // Polygon assets
  'polygon:MATIC': 'polygon:137:native',
}

/**
 * Chain ID to ChainType mapping
 */
const CHAIN_TYPE_MAP: Record<ChainId, ChainType> = {
  near: 'near',
  ethereum: 'eth',
  solana: 'sol',
  zcash: 'zcash',
  polygon: 'polygon',
  arbitrum: 'arb',
  optimism: 'optimism',
  base: 'base',
}

/**
 * NEAR Intents Adapter
 *
 * Provides privacy-preserving cross-chain swaps via NEAR 1Click API.
 *
 * @example
 * ```typescript
 * const adapter = new NEARIntentsAdapter({
 *   jwtToken: process.env.NEAR_INTENTS_JWT,
 * })
 *
 * // Prepare a swap with stealth recipient
 * const prepared = await adapter.prepareSwap(intent, recipientMetaAddress)
 *
 * // Get quote
 * const quote = await adapter.getQuote(prepared)
 *
 * // Execute (after depositing to depositAddress)
 * const result = await adapter.trackSwap(quote.depositAddress)
 * ```
 */
export class NEARIntentsAdapter {
  private readonly client: OneClickClient
  private readonly defaultSlippage: number
  private readonly defaultDeadlineOffset: number

  constructor(config: NEARIntentsAdapterConfig = {}) {
    this.client = config.client ?? new OneClickClient({
      baseUrl: config.baseUrl,
      jwtToken: config.jwtToken,
    })
    this.defaultSlippage = config.defaultSlippage ?? 100 // 1%
    this.defaultDeadlineOffset = config.defaultDeadlineOffset ?? 3600 // 1 hour
  }

  /**
   * Get the underlying OneClick client
   */
  getClient(): OneClickClient {
    return this.client
  }

  /**
   * Prepare a swap request
   *
   * For shielded/compliant modes, generates a stealth address for the recipient.
   *
   * @param request - Swap request parameters
   * @param recipientMetaAddress - Recipient's stealth meta-address (for privacy modes)
   * @param senderAddress - Sender's address for refunds
   * @returns Prepared swap with quote request
   */
  async prepareSwap(
    request: SwapRequest,
    recipientMetaAddress?: StealthMetaAddress | string,
    senderAddress?: string,
  ): Promise<PreparedSwap> {
    // Validate request
    this.validateRequest(request)

    // Determine recipient address
    let recipientAddress: string
    let stealthData: PreparedSwap['stealthAddress']
    let sharedSecret: HexString | undefined

    if (request.privacyLevel !== PrivacyLevel.TRANSPARENT) {
      // Privacy mode requires stealth address
      if (!recipientMetaAddress) {
        throw new ValidationError(
          'recipientMetaAddress is required for shielded/compliant privacy modes',
          'recipientMetaAddress'
        )
      }

      // Decode if string
      const metaAddr = typeof recipientMetaAddress === 'string'
        ? decodeStealthMetaAddress(recipientMetaAddress)
        : recipientMetaAddress

      // Generate stealth address
      const { stealthAddress, sharedSecret: secret } = generateStealthAddress(metaAddr)

      recipientAddress = stealthAddress.address
      stealthData = stealthAddress
      sharedSecret = secret
    } else {
      // Transparent mode uses direct address
      if (!senderAddress) {
        throw new ValidationError(
          'senderAddress is required for transparent mode (or use stealth address)',
          'senderAddress'
        )
      }
      recipientAddress = senderAddress
    }

    // Build quote request
    const quoteRequest = this.buildQuoteRequest(request, recipientAddress, senderAddress)

    return {
      request,
      quoteRequest,
      stealthAddress: stealthData,
      sharedSecret,
    }
  }

  /**
   * Get a quote for a prepared swap
   *
   * @param prepared - Prepared swap from prepareSwap()
   * @returns Quote response with deposit address
   */
  async getQuote(prepared: PreparedSwap): Promise<OneClickQuoteResponse> {
    return this.client.quote(prepared.quoteRequest)
  }

  /**
   * Get a dry quote (preview without deposit address)
   *
   * @param prepared - Prepared swap
   * @returns Quote preview
   */
  async getDryQuote(prepared: PreparedSwap): Promise<OneClickQuoteResponse> {
    return this.client.dryQuote(prepared.quoteRequest)
  }

  /**
   * Notify 1Click of deposit transaction
   *
   * @param depositAddress - Deposit address from quote
   * @param txHash - Deposit transaction hash
   * @param nearAccount - NEAR account (if depositing from NEAR)
   */
  async notifyDeposit(
    depositAddress: string,
    txHash: string,
    nearAccount?: string,
  ): Promise<void> {
    await this.client.submitDeposit({
      depositAddress,
      txHash,
      nearSenderAccount: nearAccount,
    })
  }

  /**
   * Get current swap status
   *
   * @param depositAddress - Deposit address from quote
   * @returns Current status
   */
  async getStatus(depositAddress: string): Promise<OneClickStatusResponse> {
    return this.client.getStatus(depositAddress)
  }

  /**
   * Wait for swap to complete
   *
   * @param depositAddress - Deposit address from quote
   * @param options - Polling options
   * @returns Final status
   */
  async waitForCompletion(
    depositAddress: string,
    options?: {
      interval?: number
      timeout?: number
      onStatus?: (status: OneClickStatusResponse) => void
    },
  ): Promise<OneClickStatusResponse> {
    return this.client.waitForStatus(depositAddress, options)
  }

  /**
   * Execute a full swap flow
   *
   * This is a convenience method that:
   * 1. Prepares the swap with stealth address
   * 2. Gets a quote
   * 3. Returns all info needed for the user to deposit
   *
   * @param request - Swap request parameters
   * @param recipientMetaAddress - Recipient's stealth meta-address
   * @param senderAddress - Sender's address for refunds
   * @returns Swap result with deposit instructions
   */
  async initiateSwap(
    request: SwapRequest,
    recipientMetaAddress?: StealthMetaAddress | string,
    senderAddress?: string,
  ): Promise<SwapResult> {
    // Prepare swap
    const prepared = await this.prepareSwap(request, recipientMetaAddress, senderAddress)

    // Get quote
    const quote = await this.getQuote(prepared)

    return {
      requestId: request.requestId,
      quoteId: quote.quoteId,
      depositAddress: quote.depositAddress,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
      status: OneClickSwapStatus.PENDING_DEPOSIT,
      stealthRecipient: prepared.stealthAddress?.address,
      ephemeralPublicKey: prepared.stealthAddress?.ephemeralPublicKey,
    }
  }

  // ─── Asset Mapping ────────────────────────────────────────────────────────────

  /**
   * Convert SIP asset to Defuse asset identifier
   */
  mapAsset(chain: ChainId, symbol: string): DefuseAssetId {
    const key = `${chain}:${symbol}`
    const mapped = ASSET_MAPPINGS[key]

    if (!mapped) {
      throw new ValidationError(
        `Unknown asset mapping for ${key}. Supported: ${Object.keys(ASSET_MAPPINGS).join(', ')}`,
        'asset',
        { chain, symbol }
      )
    }

    return mapped
  }

  /**
   * Convert SIP chain ID to 1Click chain type
   */
  mapChainType(chain: ChainId): ChainType {
    const mapped = CHAIN_TYPE_MAP[chain]

    if (!mapped) {
      throw new ValidationError(
        `Unknown chain mapping for ${chain}`,
        'chain',
        { chain }
      )
    }

    return mapped
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  private validateRequest(request: SwapRequest): void {
    if (!request) {
      throw new ValidationError('request is required', 'request')
    }
    if (!request.requestId) {
      throw new ValidationError('requestId is required', 'request.requestId')
    }
    if (!request.inputAsset) {
      throw new ValidationError('inputAsset is required', 'request.inputAsset')
    }
    if (!request.outputAsset) {
      throw new ValidationError('outputAsset is required', 'request.outputAsset')
    }
    if (request.inputAmount === undefined || request.inputAmount === null) {
      throw new ValidationError('inputAmount is required', 'request.inputAmount')
    }
  }

  private buildQuoteRequest(
    request: SwapRequest,
    recipient: string,
    refundTo?: string,
  ): OneClickQuoteRequest {
    // Map assets
    const originAsset = this.mapAsset(
      request.inputAsset.chain,
      request.inputAsset.symbol
    )
    const destinationAsset = this.mapAsset(
      request.outputAsset.chain,
      request.outputAsset.symbol
    )

    // Map chain types
    const depositType = this.mapChainType(request.inputAsset.chain)
    const recipientType = this.mapChainType(request.outputAsset.chain)
    const refundType = depositType // Refund to same chain as deposit

    // Calculate deadline
    const deadline = new Date(Date.now() + this.defaultDeadlineOffset * 1000).toISOString()

    return {
      swapType: OneClickSwapType.EXACT_INPUT,
      originAsset,
      destinationAsset,
      amount: request.inputAmount.toString(),
      recipient,
      refundTo: refundTo ?? recipient,
      depositType,
      recipientType,
      refundType,
      slippageTolerance: this.defaultSlippage,
      deadline,
    }
  }
}

/**
 * Create a new NEAR Intents adapter
 */
export function createNEARIntentsAdapter(
  config?: NEARIntentsAdapterConfig
): NEARIntentsAdapter {
  return new NEARIntentsAdapter(config)
}
