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
  type ChainId,
  type HexString,
  type Asset,
  PrivacyLevel,
  OneClickSwapType,
  OneClickSwapStatus,
  OneClickDepositType,
  OneClickRefundType,
  OneClickRecipientType,
} from '@sip-protocol/types'
import { OneClickClient } from './oneclick-client'
import { generateStealthAddress, decodeStealthMetaAddress, publicKeyToEthAddress } from '../stealth'
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
  /** Custom asset mappings (merged with defaults) */
  assetMappings?: Record<string, DefuseAssetId>
}

/**
 * Default asset mapping from SIP format to Defuse asset identifier (NEP-141 format)
 *
 * These are the actual asset IDs used by the 1Click API.
 * Format: nep141:<token-contract>.near
 *
 * @see https://1click.chaindefuser.com/v0/tokens
 */
const DEFAULT_ASSET_MAPPINGS: Record<string, DefuseAssetId> = {
  // NEAR assets
  'near:NEAR': 'nep141:wrap.near',
  'near:wNEAR': 'nep141:wrap.near',

  // Ethereum assets (via OMFT bridge)
  'ethereum:ETH': 'nep141:eth.omft.near',
  'ethereum:USDC': 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  'ethereum:USDT': 'nep141:usdt.tether-token.near',

  // Solana assets (via OMFT bridge)
  'solana:SOL': 'nep141:sol.omft.near',

  // Zcash assets
  'zcash:ZEC': 'nep141:zec.omft.near',

  // Arbitrum assets
  'arbitrum:ETH': 'nep141:arb.omft.near',

  // Base assets
  'base:ETH': 'nep141:base.omft.near',

  // Polygon assets
  'polygon:MATIC': 'nep141:matic.omft.near',
}

/**
 * Chain ID to blockchain name mapping (for address format validation)
 */
const CHAIN_BLOCKCHAIN_MAP: Record<ChainId, string> = {
  near: 'near',
  ethereum: 'evm',
  solana: 'solana',
  zcash: 'zcash',
  polygon: 'evm',
  arbitrum: 'evm',
  optimism: 'evm',
  base: 'evm',
  bitcoin: 'bitcoin',
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
 * // Or with custom asset mappings (e.g., testnet)
 * const testnetAdapter = new NEARIntentsAdapter({
 *   jwtToken: process.env.NEAR_INTENTS_JWT,
 *   assetMappings: {
 *     'near:testUSDC': 'near:testnet:usdc.test',
 *   },
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
  private readonly assetMappings: Record<string, DefuseAssetId>

  constructor(config: NEARIntentsAdapterConfig = {}) {
    this.client = config.client ?? new OneClickClient({
      baseUrl: config.baseUrl,
      jwtToken: config.jwtToken,
    })
    this.defaultSlippage = config.defaultSlippage ?? 100 // 1%
    this.defaultDeadlineOffset = config.defaultDeadlineOffset ?? 3600 // 1 hour
    this.assetMappings = {
      ...DEFAULT_ASSET_MAPPINGS,
      ...config.assetMappings,
    }
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
    let refundAddress: string | undefined = senderAddress
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

      // Generate stealth address for recipient (output chain)
      const { stealthAddress, sharedSecret: secret } = generateStealthAddress(metaAddr)

      // For EVM chains, convert stealth public key to ETH address format
      // The 1Click API expects 20-byte Ethereum addresses, not 33-byte secp256k1 public keys
      const outputChainType = CHAIN_BLOCKCHAIN_MAP[request.outputAsset.chain]
      if (outputChainType === 'evm') {
        recipientAddress = publicKeyToEthAddress(stealthAddress.address)
      } else {
        recipientAddress = stealthAddress.address
      }
      stealthData = stealthAddress
      sharedSecret = secret

      // Generate refund address for input chain (if no sender address provided)
      if (!senderAddress) {
        const inputChainType = CHAIN_BLOCKCHAIN_MAP[request.inputAsset.chain]
        if (inputChainType === 'evm') {
          // For EVM input chains, generate a stealth address and convert to ETH address
          const refundStealth = generateStealthAddress(metaAddr)
          refundAddress = publicKeyToEthAddress(refundStealth.stealthAddress.address)
        } else {
          // For non-EVM input chains (Solana, Bitcoin, etc.), we cannot generate
          // valid stealth addresses because they use different cryptographic schemes.
          // Require sender address for refunds on these chains.
          throw new ValidationError(
            `senderAddress is required for refunds on ${request.inputAsset.chain}. ` +
            `Stealth addresses are only supported for EVM-compatible chains. ` +
            `Please connect a wallet or provide a sender address.`,
            'senderAddress',
            { inputChain: request.inputAsset.chain, inputChainType }
          )
        }
      }
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
    const quoteRequest = this.buildQuoteRequest(request, recipientAddress, refundAddress)

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
    const mapped = this.assetMappings[key]

    if (!mapped) {
      throw new ValidationError(
        `Unknown asset mapping for ${key}. Supported: ${Object.keys(this.assetMappings).join(', ')}`,
        'asset',
        { chain, symbol }
      )
    }

    return mapped
  }

  /**
   * Convert SIP chain ID to blockchain type
   * @deprecated Use getBlockchainType() instead. The 1Click API now uses ORIGIN_CHAIN/DESTINATION_CHAIN types.
   */
  mapChainType(chain: ChainId): string {
    const mapped = CHAIN_BLOCKCHAIN_MAP[chain]

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
    // Map assets to NEP-141 format
    const originAsset = this.mapAsset(
      request.inputAsset.chain,
      request.inputAsset.symbol
    )
    const destinationAsset = this.mapAsset(
      request.outputAsset.chain,
      request.outputAsset.symbol
    )

    // Calculate deadline (ISO 8601 format required)
    const deadline = new Date(Date.now() + this.defaultDeadlineOffset * 1000).toISOString()

    // Use ORIGIN_CHAIN for deposits from external chains
    // Use DESTINATION_CHAIN for sending to external chains
    return {
      dry: false, // Explicitly set to false for real quotes (1Click API requires boolean)
      swapType: OneClickSwapType.EXACT_INPUT,
      originAsset,
      destinationAsset,
      amount: request.inputAmount.toString(),
      recipient,
      refundTo: refundTo ?? recipient,
      depositType: OneClickDepositType.ORIGIN_CHAIN,
      recipientType: OneClickRecipientType.DESTINATION_CHAIN,
      refundType: OneClickRefundType.ORIGIN_CHAIN,
      slippageTolerance: this.defaultSlippage,
      deadline,
    }
  }

  /**
   * Get blockchain type for a chain (for address format validation)
   */
  getBlockchainType(chain: ChainId): string {
    return CHAIN_BLOCKCHAIN_MAP[chain] ?? chain
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
