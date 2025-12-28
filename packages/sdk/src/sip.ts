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
 * Configuration options for the SIP SDK client
 *
 * Controls network selection, privacy defaults, proof generation, and settlement backend.
 *
 * @example Basic configuration
 * ```typescript
 * const sip = new SIP({
 *   network: 'testnet',
 *   defaultPrivacy: PrivacyLevel.SHIELDED
 * })
 * ```
 *
 * @example Production configuration with NEAR Intents
 * ```typescript
 * const sip = new SIP({
 *   network: 'mainnet',
 *   mode: 'production',
 *   proofProvider: new MockProofProvider(),
 *   intentsAdapter: {
 *     jwtToken: process.env.NEAR_INTENTS_JWT
 *   }
 * })
 * ```
 */
export interface SIPConfig {
  /**
   * Network to operate on
   *
   * - `'mainnet'`: Production network with real assets
   * - `'testnet'`: Test network for development
   */
  network: 'mainnet' | 'testnet'

  /**
   * Operating mode for quote fetching and execution
   *
   * - `'demo'`: Returns mock quotes for testing (default)
   * - `'production'`: Uses real NEAR Intents 1Click API
   *
   * @default 'demo'
   */
  mode?: 'demo' | 'production'

  /**
   * Default privacy level for new intents
   *
   * Can be overridden per intent. See {@link PrivacyLevel} for options.
   *
   * @default PrivacyLevel.SHIELDED
   */
  defaultPrivacy?: PrivacyLevel

  /**
   * Custom RPC endpoints for blockchain connections
   *
   * Maps chain IDs to RPC URLs. Used for direct blockchain interactions
   * when not using settlement adapters.
   *
   * @example
   * ```typescript
   * {
   *   rpcEndpoints: {
   *     ethereum: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
   *     solana: 'https://api.mainnet-beta.solana.com'
   *   }
   * }
   * ```
   */
  rpcEndpoints?: Partial<Record<ChainId, string>>

  /**
   * Proof provider for zero-knowledge proof generation
   *
   * Required for SHIELDED and COMPLIANT privacy modes. If not provided,
   * intents will be created without proofs (must be attached later).
   *
   * **Available providers:**
   * - {@link MockProofProvider}: For testing and development
   * - `NoirProofProvider`: For production (import from '@sip-protocol/sdk/proofs/noir')
   * - `BrowserNoirProvider`: For browser environments (import from '@sip-protocol/sdk/browser')
   *
   * @example Testing with mock proofs
   * ```typescript
   * import { MockProofProvider } from '@sip-protocol/sdk'
   *
   * const sip = new SIP({
   *   network: 'testnet',
   *   proofProvider: new MockProofProvider()
   * })
   * ```
   *
   * @example Production with Noir proofs (Node.js)
   * ```typescript
   * import { NoirProofProvider } from '@sip-protocol/sdk/proofs/noir'
   *
   * const provider = new NoirProofProvider()
   * await provider.initialize()
   *
   * const sip = new SIP({
   *   network: 'mainnet',
   *   proofProvider: provider
   * })
   * ```
   */
  proofProvider?: ProofProvider

  /**
   * NEAR Intents adapter for production mode
   *
   * Required when `mode: 'production'`. Provides connection to the 1Click API
   * for real cross-chain swaps via NEAR Intents.
   *
   * Can be either:
   * - Configuration object ({@link NEARIntentsAdapterConfig})
   * - Pre-configured adapter instance ({@link NEARIntentsAdapter})
   *
   * @example With JWT token
   * ```typescript
   * const sip = new SIP({
   *   network: 'mainnet',
   *   mode: 'production',
   *   intentsAdapter: {
   *     jwtToken: process.env.NEAR_INTENTS_JWT
   *   }
   * })
   * ```
   *
   * @example With pre-configured adapter
   * ```typescript
   * import { createNEARIntentsAdapter } from '@sip-protocol/sdk'
   *
   * const adapter = createNEARIntentsAdapter({
   *   jwtToken: process.env.NEAR_INTENTS_JWT
   * })
   *
   * const sip = new SIP({
   *   network: 'mainnet',
   *   mode: 'production',
   *   intentsAdapter: adapter
   * })
   * ```
   */
  intentsAdapter?: NEARIntentsAdapterConfig | NEARIntentsAdapter
}

/**
 * Wallet adapter interface for blockchain interactions
 *
 * Provides a unified interface for signing messages and transactions
 * across different blockchain wallets (Ethereum, Solana, etc.).
 *
 * @example Implementing a wallet adapter
 * ```typescript
 * class MyWalletAdapter implements WalletAdapter {
 *   chain = 'ethereum' as const
 *   address = '0x...'
 *
 *   async signMessage(message: string): Promise<string> {
 *     return await wallet.signMessage(message)
 *   }
 *
 *   async signTransaction(tx: unknown): Promise<unknown> {
 *     return await wallet.signTransaction(tx)
 *   }
 * }
 * ```
 */
export interface WalletAdapter {
  /**
   * Blockchain network this wallet is connected to
   *
   * Must match one of the supported {@link ChainId} values.
   */
  chain: ChainId

  /**
   * Wallet address on the connected chain
   *
   * Format depends on the chain:
   * - Ethereum: `0x...` (checksummed)
   * - Solana: Base58-encoded public key
   * - NEAR: Account ID or implicit address
   */
  address: string

  /**
   * Sign a message with the wallet's private key
   *
   * @param message - UTF-8 string to sign
   * @returns Signature as hex string or base58 (chain-dependent)
   *
   * @example
   * ```typescript
   * const signature = await wallet.signMessage('Hello SIP!')
   * ```
   */
  signMessage(message: string): Promise<string>

  /**
   * Sign a transaction without broadcasting
   *
   * @param tx - Chain-specific transaction object
   * @returns Signed transaction ready for broadcast
   *
   * @example
   * ```typescript
   * const signedTx = await wallet.signTransaction(tx)
   * ```
   */
  signTransaction(tx: unknown): Promise<unknown>

  /**
   * Sign and broadcast a transaction (optional)
   *
   * If implemented, allows the wallet to handle both signing and sending.
   * If not implemented, caller must broadcast the signed transaction separately.
   *
   * @param tx - Chain-specific transaction object
   * @returns Transaction hash after broadcast
   *
   * @example
   * ```typescript
   * if (wallet.sendTransaction) {
   *   const txHash = await wallet.sendTransaction(tx)
   * }
   * ```
   */
  sendTransaction?(tx: unknown): Promise<string>
}

/**
 * Extended quote with production-specific metadata
 *
 * In production mode, quotes include deposit addresses and raw API responses
 * from the NEAR 1Click API for advanced use cases.
 */
export interface ProductionQuote extends Quote {
  /**
   * Deposit address for input tokens
   *
   * When using NEAR Intents in production mode, users deposit funds to this
   * address to initiate the swap.
   *
   * Only present in production mode quotes.
   */
  depositAddress?: string

  /**
   * Raw response from NEAR 1Click API
   *
   * Contains the complete quote data from the settlement backend.
   * Useful for debugging or accessing provider-specific metadata.
   *
   * Only present in production mode quotes.
   */
  rawQuote?: OneClickQuoteResponse
}

/**
 * Main SIP SDK client for privacy-preserving cross-chain transactions
 *
 * The SIP class is the primary interface for interacting with the Shielded Intents Protocol.
 * It provides methods for:
 *
 * - Creating shielded intents with privacy guarantees
 * - Fetching quotes from solvers/market makers
 * - Executing cross-chain swaps via settlement backends
 * - Managing stealth addresses and viewing keys
 * - Generating zero-knowledge proofs
 *
 * **Key Concepts:**
 *
 * - **Intent**: A declaration of desired output (e.g., "I want 95+ ZEC on Zcash")
 * - **Privacy Levels**: transparent (public), shielded (private), compliant (private + auditable)
 * - **Stealth Address**: One-time recipient address for unlinkable transactions
 * - **Commitment**: Cryptographic hiding of amounts using Pedersen commitments
 * - **Viewing Key**: Selective disclosure key for compliance/auditing
 *
 * @example Basic usage (demo mode)
 * ```typescript
 * import { SIP, PrivacyLevel } from '@sip-protocol/sdk'
 *
 * // Initialize client
 * const sip = new SIP({ network: 'testnet' })
 *
 * // Create a shielded intent
 * const intent = await sip.createIntent({
 *   input: {
 *     asset: { chain: 'solana', symbol: 'SOL', address: null, decimals: 9 },
 *     amount: 10n * 10n**9n, // 10 SOL
 *   },
 *   output: {
 *     asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
 *     minAmount: 0n, // Accept any amount
 *     maxSlippage: 0.01, // 1%
 *   },
 *   privacy: PrivacyLevel.SHIELDED,
 * })
 *
 * // Get quotes from solvers
 * const quotes = await sip.getQuotes(intent)
 *
 * // Execute with best quote
 * const result = await sip.execute(intent, quotes[0])
 * console.log('Swap completed:', result.txHash)
 * ```
 *
 * @example Production mode with NEAR Intents
 * ```typescript
 * import { SIP, PrivacyLevel, MockProofProvider } from '@sip-protocol/sdk'
 *
 * // Initialize with production backend
 * const sip = new SIP({
 *   network: 'mainnet',
 *   mode: 'production',
 *   proofProvider: new MockProofProvider(), // Use NoirProofProvider in prod
 *   intentsAdapter: {
 *     jwtToken: process.env.NEAR_INTENTS_JWT,
 *   },
 * })
 *
 * // Connect wallet
 * sip.connect(myWalletAdapter)
 *
 * // Generate stealth keys for receiving
 * const stealthMetaAddress = sip.generateStealthKeys('ethereum', 'My Privacy Wallet')
 *
 * // Create intent with stealth recipient
 * const intent = await sip.createIntent({
 *   input: { asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 }, amount: 100n },
 *   output: { asset: { chain: 'zcash', symbol: 'ZEC', address: null, decimals: 8 }, minAmount: 0n, maxSlippage: 0.01 },
 *   privacy: PrivacyLevel.SHIELDED,
 *   recipientMetaAddress: sip.getStealthAddress(),
 * })
 *
 * // Get real quotes
 * const quotes = await sip.getQuotes(intent)
 *
 * // Execute with deposit callback
 * const result = await sip.execute(intent, quotes[0], {
 *   onDepositRequired: async (depositAddr, amount) => {
 *     console.log(`Deposit ${amount} to ${depositAddr}`)
 *     const tx = await wallet.transfer(depositAddr, amount)
 *     return tx.hash
 *   },
 *   onStatusUpdate: (status) => console.log('Status:', status),
 * })
 * ```
 *
 * @see {@link SIPConfig} for configuration options
 * @see {@link createShieldedIntent} for intent creation
 * @see {@link PrivacyLevel} for privacy modes
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

  /**
   * Create a new SIP SDK client
   *
   * @param config - Configuration options for the client
   * @throws {ValidationError} If configuration is invalid
   *
   * @example Minimal configuration
   * ```typescript
   * const sip = new SIP({ network: 'testnet' })
   * ```
   *
   * @example Full configuration
   * ```typescript
   * const sip = new SIP({
   *   network: 'mainnet',
   *   mode: 'production',
   *   defaultPrivacy: PrivacyLevel.COMPLIANT,
   *   proofProvider: await NoirProofProvider.create(),
   *   intentsAdapter: { jwtToken: process.env.JWT },
   *   rpcEndpoints: {
   *     ethereum: 'https://eth-mainnet.g.alchemy.com/v2/KEY',
   *   },
   * })
   * ```
   */
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
  async createIntent(
    params: CreateIntentParams,
    options?: {
      /** Allow placeholder signatures for proof generation (demo/testing only) */
      allowPlaceholders?: boolean
      /** Ownership signature proving wallet control */
      ownershipSignature?: Uint8Array
      /** Sender secret for nullifier derivation */
      senderSecret?: Uint8Array
      /** Authorization signature for this intent */
      authorizationSignature?: Uint8Array
    }
  ): Promise<TrackedIntent> {
    // Allow placeholders if explicitly set, or in demo mode
    const allowPlaceholders = options?.allowPlaceholders ?? this.config.mode === 'demo'

    const intent = await createShieldedIntent(params, {
      senderAddress: this.wallet?.address,
      proofProvider: this.proofProvider,
      allowPlaceholders,
      ownershipSignature: options?.ownershipSignature,
      senderSecret: options?.senderSecret,
      authorizationSignature: options?.authorizationSignature,
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
   * @param senderAddress - Optional sender wallet address for cross-curve refunds
   * @param transparentRecipient - Optional explicit recipient address for transparent mode (defaults to senderAddress)
   * @returns Array of quotes (with deposit info in production mode)
   */
  async getQuotes(
    params: CreateIntentParams | ShieldedIntent,
    recipientMetaAddress?: StealthMetaAddress | string,
    senderAddress?: string,
    transparentRecipient?: string,
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
      return this.getQuotesProduction(params, recipientMetaAddress, senderAddress, transparentRecipient)
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
    senderAddress?: string,
    transparentRecipient?: string,
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
      // Use provided senderAddress or fallback to connected wallet address (for cross-curve refunds)
      const prepared = await this.intentsAdapter.prepareSwap(
        swapRequest,
        metaAddr,
        senderAddress ?? this.wallet?.address,
        transparentRecipient,
      )
      const rawQuote = await this.intentsAdapter.getQuote(prepared)

      // Validate quote response has required fields
      if (!rawQuote.amountOut || !rawQuote.amountIn) {
        throw new ValidationError(
          `Invalid quote response from 1Click API: missing ${!rawQuote.amountOut ? 'amountOut' : 'amountIn'}. ` +
          `This may indicate the trading pair is not supported or the amount is too small.`,
          'quote',
          { rawQuote }
        )
      }

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
          'Invalid deposit transaction hash. Expected 0x-prefixed hex (64-132 chars) or base58 (32-88 chars).',
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

  // ─── Same-Chain Privacy ───────────────────────────────────────────────────

  /**
   * Execute a same-chain private transfer
   *
   * Bypasses cross-chain settlement for direct on-chain privacy transfers.
   * Currently supports Solana only.
   *
   * @param chain - Chain to execute on (must be 'solana')
   * @param params - Transfer parameters
   * @returns Transfer result with stealth address
   *
   * @example
   * ```typescript
   * const result = await sip.executeSameChain('solana', {
   *   recipientMetaAddress: {
   *     chain: 'solana',
   *     spendingKey: '0x...',
   *     viewingKey: '0x...',
   *   },
   *   amount: 5_000_000n,  // 5 USDC
   *   token: 'USDC',
   *   connection,
   *   sender: wallet.publicKey,
   *   signTransaction: wallet.signTransaction,
   * })
   *
   * console.log('Sent to stealth:', result.stealthAddress)
   * ```
   */
  async executeSameChain(
    chain: ChainId,
    params: SameChainExecuteParams
  ): Promise<SameChainExecuteResult> {
    // Validate chain support
    if (chain !== 'solana') {
      throw new ValidationError(
        `Same-chain privacy only supported for 'solana', got '${chain}'`,
        'chain'
      )
    }

    // Import Solana execution dynamically to avoid bundling issues
    const { sendPrivateSPLTransfer } = await import('./chains/solana')
    const { PublicKey: SolanaPublicKey } = await import('@solana/web3.js')
    const { getAssociatedTokenAddress } = await import('@solana/spl-token')
    const { SOLANA_TOKEN_MINTS } = await import('./chains/solana/constants')

    // Resolve token mint
    let mint: InstanceType<typeof SolanaPublicKey>
    if (params.token in SOLANA_TOKEN_MINTS) {
      mint = new SolanaPublicKey(SOLANA_TOKEN_MINTS[params.token as keyof typeof SOLANA_TOKEN_MINTS])
    } else {
      // Assume it's a mint address
      mint = new SolanaPublicKey(params.token)
    }

    // Get sender's token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      mint,
      params.sender
    )

    // Execute private transfer
    const result = await sendPrivateSPLTransfer({
      connection: params.connection,
      sender: params.sender,
      senderTokenAccount,
      recipientMetaAddress: params.recipientMetaAddress,
      mint,
      amount: params.amount,
      signTransaction: params.signTransaction,
    })

    return {
      txHash: result.txSignature,
      stealthAddress: result.stealthAddress,
      ephemeralPublicKey: result.ephemeralPublicKey,
      viewTag: result.viewTag,
      explorerUrl: result.explorerUrl,
      chain: 'solana',
    }
  }

  /**
   * Check if same-chain privacy is supported for a chain
   */
  isSameChainSupported(chain: ChainId): boolean {
    return chain === 'solana'
  }
}

/**
 * Parameters for same-chain private transfer execution
 */
export interface SameChainExecuteParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount to transfer (in token's smallest unit) */
  amount: bigint
  /** Token symbol (e.g., 'USDC') or mint address */
  token: string
  /** Solana RPC connection */
  connection: import('@solana/web3.js').Connection
  /** Sender's public key */
  sender: import('@solana/web3.js').PublicKey
  /** Transaction signer */
  signTransaction: <T extends import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction>(tx: T) => Promise<T>
}

/**
 * Result of same-chain private transfer
 */
export interface SameChainExecuteResult {
  /** Transaction hash */
  txHash: string
  /** Stealth address that received the funds */
  stealthAddress: string
  /** Ephemeral public key for recipient scanning */
  ephemeralPublicKey: string
  /** View tag for efficient scanning */
  viewTag: string
  /** Explorer URL */
  explorerUrl: string
  /** Chain the transfer was executed on */
  chain: ChainId
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
