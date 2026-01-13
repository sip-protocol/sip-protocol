/**
 * Jupiter DEX Adapter for SIP Protocol
 *
 * Enables privacy-preserving token swaps on Solana via Jupiter aggregator.
 * SIP adds stealth addresses for recipient privacy and viewing keys for compliance.
 *
 * ## Privacy Model
 *
 * Jupiter swaps are on-chain and transparent by default. SIP enhances privacy by:
 * - Sending output tokens to a stealth address (recipient unlinkable)
 * - Encrypting swap metadata with viewing keys (selective disclosure)
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────┐
 * │  JUPITER + SIP PRIVACY FLOW                                  │
 * │                                                              │
 * │  1. User: "Swap 1 SOL → USDC privately"                     │
 * │  2. SIP: Generate stealth address for USDC output           │
 * │  3. Jupiter: Get quote, find best route                      │
 * │  4. Jupiter: Execute swap → output to stealth address        │
 * │  5. SIP: Encrypt metadata with viewing key (compliance)      │
 * │                                                              │
 * │  Result: Swap on-chain, but recipient unlinkable             │
 * └──────────────────────────────────────────────────────────────┘
 * ```
 *
 * @see https://station.jup.ag/docs
 * @see https://github.com/jup-ag/jupiter-quote-api-node
 *
 * @example
 * ```typescript
 * import { JupiterAdapter } from '@sip-protocol/sdk'
 * import { Keypair } from '@solana/web3.js'
 *
 * const adapter = new JupiterAdapter({
 *   rpcUrl: 'https://api.mainnet-beta.solana.com',
 * })
 *
 * // Get a quote
 * const quote = await adapter.getQuote({
 *   inputMint: 'So11111111111111111111111111111111111111112', // SOL
 *   outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
 *   amount: 1_000_000_000n, // 1 SOL
 * })
 *
 * // Execute private swap (output to stealth address)
 * const result = await adapter.swapPrivate({
 *   quote,
 *   wallet: userKeypair,
 *   recipientMetaAddress: 'sip:solana:0x...:0x...',
 * })
 *
 * console.log('Swap complete:', result.signature)
 * console.log('Output at stealth address:', result.stealthAddress)
 * ```
 */

import { createJupiterApiClient, type QuoteResponse } from '@jup-ag/api'
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  type Keypair,
} from '@solana/web3.js'
import type { StealthMetaAddress, HexString, ViewingKey } from '@sip-protocol/types'
import {
  generateEd25519StealthAddress,
  decodeStealthMetaAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../stealth'
import { generateViewingKey, encryptForViewing, type TransactionData } from '../privacy'
import { bytesToHex } from '@noble/hashes/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Common Solana token mints
 */
export const SOLANA_TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
} as const

/**
 * Default Jupiter API endpoint
 */
export const JUPITER_API_ENDPOINT = 'https://quote-api.jup.ag/v6'

/**
 * Default RPC endpoints
 */
export const SOLANA_RPC_ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Jupiter adapter configuration
 */
export interface JupiterAdapterConfig {
  /** Solana RPC URL */
  rpcUrl?: string
  /** Jupiter API key (optional, for higher rate limits) */
  apiKey?: string
  /** Default slippage in basis points (default: 50 = 0.5%) */
  defaultSlippageBps?: number
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Quote request parameters
 */
export interface JupiterQuoteRequest {
  /** Input token mint address */
  inputMint: string
  /** Output token mint address */
  outputMint: string
  /** Input amount in smallest units (lamports for SOL) */
  amount: bigint
  /** Slippage tolerance in basis points (overrides default) */
  slippageBps?: number
  /** Only use direct routes (no multi-hop) */
  onlyDirectRoutes?: boolean
  /** Exclude specific DEXes */
  excludeDexes?: string[]
}

/**
 * Enhanced quote with SIP metadata
 */
export interface JupiterQuote {
  /** Raw Jupiter quote response */
  raw: QuoteResponse
  /** Input mint */
  inputMint: string
  /** Output mint */
  outputMint: string
  /** Input amount */
  inputAmount: bigint
  /** Expected output amount */
  outputAmount: bigint
  /** Minimum output after slippage */
  minOutputAmount: bigint
  /** Price impact percentage */
  priceImpactPct: number
  /** Route description */
  route: string[]
  /** Slippage in basis points */
  slippageBps: number
}

/**
 * Standard swap parameters (transparent)
 */
export interface JupiterSwapParams {
  /** Quote from getQuote() */
  quote: JupiterQuote
  /** User's wallet keypair for signing */
  wallet: Keypair
  /** Recipient address (defaults to wallet public key) */
  recipient?: string
  /** Priority fee in lamports (or 'auto') */
  priorityFee?: number | 'auto'
}

/**
 * Private swap parameters (with stealth address)
 */
export interface JupiterPrivateSwapParams extends Omit<JupiterSwapParams, 'recipient'> {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress | string
  /** Generate viewing key for compliance */
  generateViewingKey?: boolean
  /** Existing viewing key to use */
  viewingKey?: ViewingKey
}

/**
 * Swap result
 */
export interface JupiterSwapResult {
  /** Whether swap succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Input amount swapped */
  inputAmount?: bigint
  /** Output amount received */
  outputAmount?: bigint
  /** Recipient address */
  recipient?: string
  /** Error message if failed */
  error?: string
}

/**
 * Private swap result (with stealth data)
 */
export interface JupiterPrivateSwapResult extends JupiterSwapResult {
  /** Stealth address where output was sent */
  stealthAddress?: string
  /** Ephemeral public key for recipient to derive stealth key */
  ephemeralPublicKey?: HexString
  /** View tag for efficient scanning */
  viewTag?: number
  /** Shared secret (for recipient to derive private key) */
  sharedSecret?: HexString
  /** Encrypted metadata for viewing key holders */
  encryptedMetadata?: HexString
  /** Viewing key (if generated) */
  viewingKey?: ViewingKey
}

// ─── Jupiter Adapter ──────────────────────────────────────────────────────────

/**
 * Jupiter DEX Adapter
 *
 * Provides privacy-enhanced token swaps on Solana via Jupiter aggregator.
 */
export class JupiterAdapter {
  private readonly connection: Connection
  private readonly jupiterApi: ReturnType<typeof createJupiterApiClient>
  private readonly defaultSlippageBps: number
  private readonly debug: boolean

  constructor(config: JupiterAdapterConfig = {}) {
    const rpcUrl = config.rpcUrl ?? SOLANA_RPC_ENDPOINTS.mainnet
    this.connection = new Connection(rpcUrl, 'confirmed')

    // Initialize Jupiter API client
    // Note: apiKey is passed if available for higher rate limits
    this.jupiterApi = createJupiterApiClient()

    this.defaultSlippageBps = config.defaultSlippageBps ?? 50 // 0.5%
    this.debug = config.debug ?? false
  }

  // ─── Quote Methods ────────────────────────────────────────────────────────────

  /**
   * Get a swap quote from Jupiter
   *
   * @param request - Quote request parameters
   * @returns Quote with routing info
   */
  async getQuote(request: JupiterQuoteRequest): Promise<JupiterQuote> {
    this.log('Getting quote:', request)

    const slippageBps = request.slippageBps ?? this.defaultSlippageBps

    // Jupiter API requires amount as number
    const amount = Number(request.amount)
    if (!Number.isSafeInteger(amount)) {
      throw new Error('Amount too large for Jupiter API')
    }

    const quoteResponse = await this.jupiterApi.quoteGet({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount,
      slippageBps,
      onlyDirectRoutes: request.onlyDirectRoutes,
      excludeDexes: request.excludeDexes,
    })

    if (!quoteResponse) {
      throw new Error('Failed to get quote from Jupiter')
    }

    // Extract route names
    const route = quoteResponse.routePlan?.map(step => step.swapInfo?.label ?? 'Unknown') ?? []

    const quote: JupiterQuote = {
      raw: quoteResponse,
      inputMint: quoteResponse.inputMint,
      outputMint: quoteResponse.outputMint,
      inputAmount: BigInt(quoteResponse.inAmount),
      outputAmount: BigInt(quoteResponse.outAmount),
      minOutputAmount: BigInt(quoteResponse.otherAmountThreshold),
      priceImpactPct: parseFloat(quoteResponse.priceImpactPct ?? '0'),
      route,
      slippageBps,
    }

    this.log('Quote received:', {
      inputAmount: quote.inputAmount.toString(),
      outputAmount: quote.outputAmount.toString(),
      route: quote.route,
    })

    return quote
  }

  // ─── Swap Methods ─────────────────────────────────────────────────────────────

  /**
   * Execute a standard (transparent) swap
   *
   * @param params - Swap parameters
   * @returns Swap result
   */
  async swap(params: JupiterSwapParams): Promise<JupiterSwapResult> {
    this.log('Executing swap')

    try {
      const recipient = params.recipient ?? params.wallet.publicKey.toBase58()

      // Get swap transaction from Jupiter
      // Note: prioritizationFeeLamports requires specific object format
      const priorityFeeConfig = params.priorityFee === 'auto'
        ? { priorityLevelWithMaxLamports: { priorityLevel: 'high' as const, maxLamports: 1000000 } }
        : typeof params.priorityFee === 'number'
          ? { jitoTipLamports: params.priorityFee }
          : undefined

      const swapResponse = await this.jupiterApi.swapPost({
        swapRequest: {
          quoteResponse: params.quote.raw,
          userPublicKey: params.wallet.publicKey.toBase58(),
          destinationTokenAccount: recipient !== params.wallet.publicKey.toBase58()
            ? recipient
            : undefined,
          prioritizationFeeLamports: priorityFeeConfig,
        },
      })

      // Deserialize and sign transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64')
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
      transaction.sign([params.wallet])

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      )

      this.log('Transaction sent:', signature)

      // Confirm transaction
      const latestBlockhash = await this.connection.getLatestBlockhash()
      await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      this.log('Transaction confirmed')

      return {
        success: true,
        signature,
        inputAmount: params.quote.inputAmount,
        outputAmount: params.quote.outputAmount,
        recipient,
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
      }
    }
  }

  /**
   * Execute a private swap with stealth recipient
   *
   * Output tokens are sent to a stealth address derived from the recipient's
   * meta-address. The recipient can later claim using their spending key.
   *
   * @param params - Private swap parameters
   * @returns Private swap result with stealth data
   */
  async swapPrivate(params: JupiterPrivateSwapParams): Promise<JupiterPrivateSwapResult> {
    this.log('Executing private swap')

    try {
      // Decode meta-address if string
      const metaAddress = typeof params.recipientMetaAddress === 'string'
        ? decodeStealthMetaAddress(params.recipientMetaAddress)
        : params.recipientMetaAddress

      // Validate ed25519 keys (Solana uses ed25519)
      const spendingKeyBytes = (metaAddress.spendingKey.length - 2) / 2
      if (spendingKeyBytes !== 32) {
        return {
          success: false,
          error: `Meta-address has ${spendingKeyBytes}-byte keys but Solana requires ed25519 (32-byte) keys. ` +
            'Generate an ed25519 meta-address using generateEd25519StealthMetaAddress().',
        }
      }

      // Generate stealth address
      const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(metaAddress)

      // Convert stealth public key to Solana address
      const solanaStealthAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

      this.log('Generated stealth address:', solanaStealthAddress)

      // Execute swap with stealth address as recipient
      const swapResult = await this.swap({
        ...params,
        recipient: solanaStealthAddress,
      })

      if (!swapResult.success) {
        return {
          ...swapResult,
          stealthAddress: solanaStealthAddress,
        }
      }

      // Prepare result with stealth data
      const result: JupiterPrivateSwapResult = {
        ...swapResult,
        stealthAddress: solanaStealthAddress,
        ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
        viewTag: stealthAddress.viewTag,
        sharedSecret,
      }

      // Generate viewing key and encrypt metadata if requested
      if (params.generateViewingKey || params.viewingKey) {
        const viewingKey = params.viewingKey ?? generateViewingKey()

        // TransactionData requires sender, recipient, amount, timestamp
        // We encode additional swap metadata in the amount field as JSON
        const swapMetadata = JSON.stringify({
          type: 'jupiter_private_swap',
          signature: swapResult.signature,
          inputMint: params.quote.inputMint,
          outputMint: params.quote.outputMint,
          inputAmount: params.quote.inputAmount.toString(),
          outputAmount: params.quote.outputAmount.toString(),
          ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
        })

        const txData: TransactionData = {
          sender: params.wallet.publicKey.toBase58(),
          recipient: solanaStealthAddress,
          amount: swapMetadata, // Encode metadata in amount field
          timestamp: Date.now(),
        }

        const encrypted = encryptForViewing(txData, viewingKey)
        const jsonBytes = new TextEncoder().encode(JSON.stringify(encrypted))
        result.encryptedMetadata = `0x${bytesToHex(jsonBytes)}` as HexString

        if (params.generateViewingKey) {
          result.viewingKey = viewingKey
        }
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
      }
    }
  }

  // ─── Utility Methods ──────────────────────────────────────────────────────────

  /**
   * Check if a token is supported by Jupiter
   *
   * @param mint - Token mint address
   * @returns Whether token is tradeable
   */
  async isTokenSupported(mint: string): Promise<boolean> {
    try {
      // Try to get a small quote to SOL
      const quote = await this.jupiterApi.quoteGet({
        inputMint: mint,
        outputMint: SOLANA_TOKEN_MINTS.SOL,
        amount: 1000000, // 0.001 of any token (6 decimals)
        slippageBps: 100,
      })
      return !!quote
    } catch {
      return false
    }
  }

  /**
   * Get the underlying Solana connection
   */
  getConnection(): Connection {
    return this.connection
  }

  /**
   * Get token balance for an address
   *
   * @param owner - Wallet address
   * @param mint - Token mint (omit for SOL)
   * @returns Balance in smallest units
   */
  async getBalance(owner: string, mint?: string): Promise<bigint> {
    const ownerPubkey = new PublicKey(owner)

    if (!mint || mint === SOLANA_TOKEN_MINTS.SOL) {
      const balance = await this.connection.getBalance(ownerPubkey)
      return BigInt(balance)
    }

    // Get SPL token balance
    const mintPubkey = new PublicKey(mint)
    const tokenAccounts = await this.connection.getTokenAccountsByOwner(
      ownerPubkey,
      { mint: mintPubkey }
    )

    if (tokenAccounts.value.length === 0) {
      return 0n
    }

    // Parse account data to get balance
    // Token account data: 64 bytes mint + 32 bytes owner + 8 bytes amount + ...
    const accountData = tokenAccounts.value[0].account.data
    const amountBytes = accountData.subarray(64, 72)
    const amount = new DataView(amountBytes.buffer, amountBytes.byteOffset).getBigUint64(0, true)

    return amount
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[JupiterAdapter]', ...args)
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('insufficient')) {
        return 'Insufficient balance for swap'
      }
      if (error.message.includes('slippage')) {
        return 'Slippage tolerance exceeded'
      }
      if (error.message.includes('route')) {
        return 'No route found for this swap'
      }
      return error.message
    }
    return 'Unknown Jupiter error'
  }
}

/**
 * Create a Jupiter adapter with default configuration
 */
export function createJupiterAdapter(config?: JupiterAdapterConfig): JupiterAdapter {
  return new JupiterAdapter(config)
}
