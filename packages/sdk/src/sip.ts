/**
 * SIP SDK Main Client
 *
 * High-level interface for interacting with the Shielded Intents Protocol.
 */

import {
  PrivacyLevel,
  IntentStatus,
  OneClickSwapStatus,
  type ShieldedIntent,
  type CreateIntentParams,
  type TrackedIntent,
  type Quote,
  type FulfillmentResult,
  type StealthMetaAddress,
  type ViewingKey,
  type OneClickQuoteResponse,
  type Asset,
} from '@sip-protocol/types'
import { IntentBuilder, createShieldedIntent, trackIntent, hasRequiredProofs } from './intent'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from './stealth'
import { generateViewingKey, deriveViewingKey } from './privacy'
import type { ChainId, HexString } from '@sip-protocol/types'
import type { ProofProvider } from './proofs'
import { ValidationError, IntentError, ErrorCode } from './errors'
import { isValidChainId } from './validation'
import { NEARIntentsAdapter, type NEARIntentsAdapterConfig, type SwapRequest } from './adapters'

/**
 * SIP SDK configuration
 */
export interface SIPConfig {
  /** Network: mainnet or testnet */
  network: 'mainnet' | 'testnet'
  /**
   * Mode: 'demo' for mock data, 'production' for real NEAR Intents
   * @default 'demo'
   */
  mode?: 'demo' | 'production'
  /** Default privacy level */
  defaultPrivacy?: PrivacyLevel
  /** RPC endpoints for chains */
  rpcEndpoints?: Partial<Record<ChainId, string>>
  /**
   * Proof provider for ZK proof generation
   *
   * If not provided, proof generation will not be available.
   * Use MockProofProvider for testing, NoirProofProvider for production.
   *
   * @example
   * ```typescript
   * import { MockProofProvider } from '@sip-protocol/sdk'
   *
   * const sip = new SIP({
   *   network: 'testnet',
   *   proofProvider: new MockProofProvider(),
   * })
   * ```
   */
  proofProvider?: ProofProvider
  /**
   * NEAR Intents adapter configuration
   *
   * Required for production mode. Provides connection to 1Click API.
   *
   * @example
   * ```typescript
   * const sip = new SIP({
   *   network: 'mainnet',
   *   mode: 'production',
   *   intentsAdapter: {
   *     jwtToken: process.env.NEAR_INTENTS_JWT,
   *   },
   * })
   * ```
   */
  intentsAdapter?: NEARIntentsAdapterConfig | NEARIntentsAdapter
}

/**
 * Wallet adapter interface
 */
export interface WalletAdapter {
  /** Connected chain */
  chain: ChainId
  /** Wallet address */
  address: string
  /** Sign a message */
  signMessage(message: string): Promise<string>
  /** Sign a transaction */
  signTransaction(tx: unknown): Promise<unknown>
  /** Send a transaction (optional) */
  sendTransaction?(tx: unknown): Promise<string>
}

/**
 * Extended quote with deposit info for production mode
 */
export interface ProductionQuote extends Quote {
  /** Deposit address for input tokens (production mode only) */
  depositAddress?: string
  /** Raw 1Click quote response (production mode only) */
  rawQuote?: OneClickQuoteResponse
}

/**
 * Main SIP SDK class
 */
export class SIP {
  private config: SIPConfig & { mode: 'demo' | 'production' }
  private wallet?: WalletAdapter
  private stealthKeys?: {
    metaAddress: StealthMetaAddress
    spendingPrivateKey: HexString
    viewingPrivateKey: HexString
  }
  private proofProvider?: ProofProvider
  private intentsAdapter?: NEARIntentsAdapter
  /** Cache of pending swaps by intent ID */
  private pendingSwaps: Map<string, { depositAddress: string; quote: OneClickQuoteResponse }> = new Map()

  constructor(config: SIPConfig) {
    // Validate config
    if (!config || typeof config !== 'object') {
      throw new ValidationError('config must be an object')
    }

    if (config.network !== 'mainnet' && config.network !== 'testnet') {
      throw new ValidationError(
        `network must be 'mainnet' or 'testnet'`,
        'config.network',
        { received: config.network }
      )
    }

    if (config.mode !== undefined && config.mode !== 'demo' && config.mode !== 'production') {
      throw new ValidationError(
        `mode must be 'demo' or 'production'`,
        'config.mode',
        { received: config.mode }
      )
    }

    if (config.defaultPrivacy !== undefined) {
      const validLevels = ['transparent', 'shielded', 'compliant']
      if (!validLevels.includes(config.defaultPrivacy)) {
        throw new ValidationError(
          `defaultPrivacy must be one of: ${validLevels.join(', ')}`,
          'config.defaultPrivacy',
          { received: config.defaultPrivacy }
        )
      }
    }

    this.config = {
      ...config,
      mode: config.mode ?? 'demo',
      defaultPrivacy: config.defaultPrivacy ?? PrivacyLevel.SHIELDED,
    }
    this.proofProvider = config.proofProvider

    // Initialize intents adapter if provided
    if (config.intentsAdapter) {
      if (config.intentsAdapter instanceof NEARIntentsAdapter) {
        this.intentsAdapter = config.intentsAdapter
      } else {
        this.intentsAdapter = new NEARIntentsAdapter(config.intentsAdapter)
      }
    }
  }

  /**
   * Get the current mode
   */
  getMode(): 'demo' | 'production' {
    return this.config.mode
  }

  /**
   * Check if running in production mode with real NEAR Intents
   */
  isProductionMode(): boolean {
    return this.config.mode === 'production' && !!this.intentsAdapter
  }

  /**
   * Get the NEAR Intents adapter
   */
  getIntentsAdapter(): NEARIntentsAdapter | undefined {
    return this.intentsAdapter
  }

  /**
   * Set the NEAR Intents adapter
   */
  setIntentsAdapter(adapter: NEARIntentsAdapter | NEARIntentsAdapterConfig): void {
    if (adapter instanceof NEARIntentsAdapter) {
      this.intentsAdapter = adapter
    } else {
      this.intentsAdapter = new NEARIntentsAdapter(adapter)
    }
  }

  /**
   * Get the configured proof provider
   */
  getProofProvider(): ProofProvider | undefined {
    return this.proofProvider
  }

  /**
   * Set or update the proof provider
   */
  setProofProvider(provider: ProofProvider): void {
    this.proofProvider = provider
  }

  /**
   * Check if proof provider is available and ready
   */
  hasProofProvider(): boolean {
    return !!(this.proofProvider && this.proofProvider.isReady)
  }

  /**
   * Connect a wallet
   */
  connect(wallet: WalletAdapter): void {
    this.wallet = wallet
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.wallet = undefined
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return !!this.wallet
  }

  /**
   * Get connected wallet
   */
  getWallet(): WalletAdapter | undefined {
    return this.wallet
  }

  /**
   * Generate and store stealth keys for this session
   *
   * @throws {ValidationError} If chain is invalid
   */
  generateStealthKeys(chain: ChainId, label?: string): StealthMetaAddress {
    // Validation delegated to generateStealthMetaAddress
    const keys = generateStealthMetaAddress(chain, label)
    this.stealthKeys = keys
    return keys.metaAddress
  }

  /**
   * Get the encoded stealth meta-address for receiving
   */
  getStealthAddress(): string | undefined {
    if (!this.stealthKeys) return undefined
    return encodeStealthMetaAddress(this.stealthKeys.metaAddress)
  }

  /**
   * Create a new intent builder
   *
   * The builder is automatically configured with the SIP client's proof provider
   * (if one is set), so proofs will be generated automatically when `.build()` is called.
   *
   * @example
   * ```typescript
   * const intent = await sip.intent()
   *   .input('near', 'NEAR', 100n)
   *   .output('zcash', 'ZEC', 95n)
   *   .privacy(PrivacyLevel.SHIELDED)
   *   .build()
   * ```
   */
  intent(): IntentBuilder {
    const builder = new IntentBuilder()
    if (this.proofProvider) {
      builder.withProvider(this.proofProvider)
    }
    return builder
  }

  /**
   * Create a shielded intent directly
   *
   * Uses the SIP client's configured proof provider (if any) to generate proofs
   * automatically for SHIELDED and COMPLIANT privacy levels.
   */
  async createIntent(params: CreateIntentParams): Promise<TrackedIntent> {
    const intent = await createShieldedIntent(params, {
      senderAddress: this.wallet?.address,
      proofProvider: this.proofProvider,
    })
    return trackIntent(intent)
  }

  /**
   * Get quotes for an intent
   *
   * In production mode: fetches real quotes from NEAR 1Click API
   * In demo mode: returns mock quotes for testing
   *
   * @param params - Intent parameters (CreateIntentParams for production, ShieldedIntent/CreateIntentParams for demo)
   * @param recipientMetaAddress - Optional stealth meta-address for privacy modes
   * @returns Array of quotes (with deposit info in production mode)
   */
  async getQuotes(
    params: CreateIntentParams | ShieldedIntent,
    recipientMetaAddress?: StealthMetaAddress | string,
  ): Promise<ProductionQuote[]> {
    // Production mode - use real NEAR Intents
    if (this.isProductionMode()) {
      // Production mode requires CreateIntentParams with raw values
      if (!('input' in params)) {
        throw new ValidationError(
          'Production mode requires CreateIntentParams with raw input/output values. ShieldedIntent does not expose raw values.',
          'params'
        )
      }
      return this.getQuotesProduction(params, recipientMetaAddress)
    }

    // Demo mode - return mock quotes
    return this.getQuotesDemo(params)
  }

  /**
   * Execute an intent with a selected quote
   *
   * In production mode: initiates real swap via NEAR 1Click API
   * In demo mode: returns mock result
   *
   * @param intent - The intent to execute
   * @param quote - Selected quote from getQuotes()
   * @param options - Execution options
   * @returns Fulfillment result with transaction hash (when available)
   */
  async execute(
    intent: TrackedIntent,
    quote: Quote | ProductionQuote,
    options?: {
      /** Callback when deposit is required */
      onDepositRequired?: (depositAddress: string, amount: string) => Promise<string>
      /** Callback for status updates */
      onStatusUpdate?: (status: OneClickSwapStatus) => void
      /** Timeout for waiting (ms) */
      timeout?: number
    },
  ): Promise<FulfillmentResult> {
    // Production mode - use real NEAR Intents
    if (this.isProductionMode()) {
      return this.executeProduction(intent, quote as ProductionQuote, options)
    }

    // Demo mode - return mock result
    return this.executeDemo(intent, quote)
  }

  /**
   * Generate a viewing key for compliant mode
   */
  generateViewingKey(path?: string): ViewingKey {
    return generateViewingKey(path)
  }

  /**
   * Derive a child viewing key
   */
  deriveViewingKey(masterKey: ViewingKey, childPath: string): ViewingKey {
    return deriveViewingKey(masterKey, childPath)
  }

  /**
   * Get network configuration
   */
  getNetwork(): 'mainnet' | 'testnet' {
    return this.config.network
  }

  // ─── Production Mode Implementation ─────────────────────────────────────────

  private async getQuotesProduction(
    params: CreateIntentParams,
    recipientMetaAddress?: StealthMetaAddress | string,
  ): Promise<ProductionQuote[]> {
    if (!this.intentsAdapter) {
      throw new ValidationError(
        'NEAR Intents adapter not configured. Set intentsAdapter in config for production mode.',
        'intentsAdapter'
      )
    }

    // For privacy modes, require stealth meta-address
    const metaAddr = recipientMetaAddress ?? (
      params.privacy !== PrivacyLevel.TRANSPARENT
        ? this.stealthKeys?.metaAddress
        : undefined
    )

    if (params.privacy !== PrivacyLevel.TRANSPARENT && !metaAddr) {
      throw new ValidationError(
        'Stealth meta-address required for privacy modes. Call generateStealthKeys() or provide recipientMetaAddress.',
        'recipientMetaAddress'
      )
    }

    // Generate a request ID for tracking
    const requestId = `quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Build swap request from CreateIntentParams
    const swapRequest: SwapRequest = {
      requestId,
      privacyLevel: params.privacy,
      inputAsset: params.input.asset,
      outputAsset: params.output.asset,
      inputAmount: params.input.amount,
      minOutputAmount: params.output.minAmount,
    }

    try {
      // Get quote from 1Click API
      const prepared = await this.intentsAdapter.prepareSwap(
        swapRequest,
        metaAddr,
        this.wallet?.address,
      )
      const rawQuote = await this.intentsAdapter.getQuote(prepared)

      // Cache for execute()
      this.pendingSwaps.set(requestId, {
        depositAddress: rawQuote.depositAddress,
        quote: rawQuote,
      })

      // Convert to SIP Quote format
      const quote: ProductionQuote = {
        quoteId: rawQuote.quoteId,
        intentId: requestId,
        solverId: 'near-1click',
        outputAmount: BigInt(rawQuote.amountOut),
        estimatedTime: rawQuote.timeEstimate,
        expiry: Math.floor(new Date(rawQuote.deadline).getTime() / 1000),
        fee: this.calculateFee(params.input.amount, BigInt(rawQuote.amountIn)),
        depositAddress: rawQuote.depositAddress,
        rawQuote,
      }

      return [quote]
    } catch (error) {
      // If production fails, don't fall back to demo - let the error propagate
      throw error
    }
  }

  private async executeProduction(
    intent: TrackedIntent,
    quote: ProductionQuote,
    options?: {
      onDepositRequired?: (depositAddress: string, amount: string) => Promise<string>
      onStatusUpdate?: (status: OneClickSwapStatus) => void
      timeout?: number
    },
  ): Promise<FulfillmentResult> {
    if (!this.intentsAdapter) {
      throw new ValidationError(
        'NEAR Intents adapter not configured',
        'intentsAdapter'
      )
    }

    // Get deposit info from quote or cache
    const pendingSwap = this.pendingSwaps.get(quote.intentId)
    const depositAddress = quote.depositAddress ?? pendingSwap?.depositAddress
    const rawQuote = quote.rawQuote ?? pendingSwap?.quote

    if (!depositAddress || !rawQuote) {
      throw new IntentError(
        'No deposit address found. Call getQuotes() first.',
        ErrorCode.INTENT_NOT_FOUND,
        { intentId: intent.intentId }
      )
    }

    // If wallet can send transactions and callback provided, handle deposit
    let depositTxHash: string | undefined
    if (options?.onDepositRequired) {
      depositTxHash = await options.onDepositRequired(depositAddress, rawQuote.amountIn)

      // Validate txHash format before proceeding
      if (!depositTxHash || !this.isValidTxHash(depositTxHash)) {
        throw new ValidationError(
          'Invalid deposit transaction hash. Expected 0x-prefixed hex string (32-66 bytes).',
          'depositTxHash',
          { received: depositTxHash }
        )
      }

      // Notify 1Click of deposit
      await this.intentsAdapter.notifyDeposit(
        depositAddress,
        depositTxHash,
      )
    }

    // Wait for completion
    const finalStatus = await this.intentsAdapter.waitForCompletion(
      depositAddress,
      {
        timeout: options?.timeout ?? 300000, // 5 minutes default
        onStatus: (status) => options?.onStatusUpdate?.(status.status),
      },
    )

    // Clean up cache
    this.pendingSwaps.delete(quote.intentId)

    // Convert to FulfillmentResult
    const isSuccess = finalStatus.status === OneClickSwapStatus.SUCCESS
    return {
      intentId: intent.intentId,
      status: isSuccess ? IntentStatus.FULFILLED : IntentStatus.FAILED,
      outputAmount: quote.outputAmount,
      txHash: finalStatus.settlementTxHash ?? depositTxHash,
      fulfilledAt: Math.floor(Date.now() / 1000),
      error: finalStatus.error,
    }
  }

  private calculateFee(inputAmount: bigint, quotedInput: bigint): bigint {
    // Fee is the difference between what we sent and what was quoted
    if (quotedInput > inputAmount) {
      return quotedInput - inputAmount
    }
    // Estimate 0.5% fee if we can't calculate
    return inputAmount / 200n
  }

  /**
   * Validate transaction hash format
   *
   * Accepts:
   * - Ethereum-style: 0x + 64 hex chars (32 bytes)
   * - Solana-style: base58 encoded (44-88 chars)
   * - NEAR-style: base58 or hex with varying lengths
   */
  private isValidTxHash(txHash: string): boolean {
    if (!txHash || typeof txHash !== 'string') {
      return false
    }

    // Check for 0x-prefixed hex (Ethereum, etc.)
    if (txHash.startsWith('0x')) {
      const hex = txHash.slice(2)
      // Valid hex, 32-66 bytes (64-132 chars)
      return /^[0-9a-fA-F]{64,132}$/.test(hex)
    }

    // Base58 (Solana, NEAR)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(txHash)) {
      return true
    }

    return false
  }

  // ─── Demo Mode Implementation ───────────────────────────────────────────────

  private async getQuotesDemo(params: CreateIntentParams | ShieldedIntent): Promise<ProductionQuote[]> {
    // Extract base amount depending on type
    const baseAmount = 'input' in params
      ? params.output.minAmount  // CreateIntentParams
      : params.minOutputAmount   // ShieldedIntent

    // Generate intentId if not present
    const intentId = 'intentId' in params
      ? params.intentId
      : `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    return [
      {
        quoteId: `quote-${Date.now()}-1`,
        intentId,
        solverId: 'demo-solver-1',
        outputAmount: baseAmount + (baseAmount * 2n) / 100n, // +2%
        estimatedTime: 30,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: baseAmount / 200n, // 0.5%
      },
      {
        quoteId: `quote-${Date.now()}-2`,
        intentId,
        solverId: 'demo-solver-2',
        outputAmount: baseAmount + (baseAmount * 1n) / 100n, // +1%
        estimatedTime: 15,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: baseAmount / 100n, // 1%
      },
    ]
  }

  private async executeDemo(
    intent: TrackedIntent,
    quote: Quote,
  ): Promise<FulfillmentResult> {
    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return {
      intentId: intent.intentId,
      status: IntentStatus.FULFILLED,
      outputAmount: quote.outputAmount,
      txHash: intent.privacyLevel === PrivacyLevel.TRANSPARENT
        ? `0x${Date.now().toString(16)}`
        : undefined,
      fulfilledAt: Math.floor(Date.now() / 1000),
    }
  }
}

/**
 * Create a new SIP instance with default testnet config
 */
export function createSIP(network: 'mainnet' | 'testnet' = 'testnet'): SIP {
  return new SIP({ network })
}

/**
 * Create a new SIP instance configured for production
 */
export function createProductionSIP(config: {
  network: 'mainnet' | 'testnet'
  jwtToken?: string
  proofProvider?: ProofProvider
}): SIP {
  return new SIP({
    network: config.network,
    mode: 'production',
    proofProvider: config.proofProvider,
    intentsAdapter: {
      jwtToken: config.jwtToken,
    },
  })
}
