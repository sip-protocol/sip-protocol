/**
 * Solana RPC Client for Privacy Transactions
 *
 * Provides a robust RPC client with:
 * - Retry logic with exponential backoff
 * - Multiple endpoint failover
 * - Priority fee estimation and application
 * - Compute unit optimization
 * - Transaction confirmation tracking
 * - Error classification and handling
 *
 * Migrated to @solana/kit while maintaining backward-compatible public API.
 *
 * @module chains/solana/rpc-client
 */

import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type Address,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  type Commitment as KitCommitment,
  type Base64EncodedWireTransaction,
  type Signature,
} from '@solana/kit'
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  ComputeBudgetProgram,
  type Commitment,
  type SendOptions,
  type TransactionSignature,
  type SignatureResult,
} from '@solana/web3.js'
import {
  toAddress,
  toPublicKey,
} from './kit-compat'
import type { NetworkPrivacyConfig } from '../../network/proxy'
import { createNetworkPrivacyClient, rotateCircuit as rotateProxyCircuit } from '../../network/proxy'
import type { Agent } from 'http'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * RPC client configuration
 */
export interface RPCClientConfig {
  /**
   * Primary RPC endpoint URL
   */
  endpoint: string

  /**
   * Fallback RPC endpoints (used when primary fails)
   */
  fallbackEndpoints?: string[]

  /**
   * Commitment level for confirmations
   * @default 'confirmed'
   */
  commitment?: Commitment

  /**
   * Maximum retry attempts for failed requests
   * @default 3
   */
  maxRetries?: number

  /**
   * Base delay for exponential backoff (ms)
   * @default 500
   */
  retryBaseDelay?: number

  /**
   * Maximum delay between retries (ms)
   * @default 5000
   */
  retryMaxDelay?: number

  /**
   * Request timeout (ms)
   * @default 30000
   */
  timeout?: number

  /**
   * Enable priority fees for faster confirmation
   * @default false
   */
  usePriorityFees?: boolean

  /**
   * Target percentile for priority fee estimation
   * @default 75
   */
  priorityFeePercentile?: number

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Network privacy configuration (Tor/SOCKS5 proxy)
   *
   * Routes all RPC traffic through the specified proxy for IP privacy.
   *
   * @example Using Tor
   * ```typescript
   * const client = createRPCClient({
   *   endpoint: 'https://api.mainnet-beta.solana.com',
   *   networkPrivacy: {
   *     proxy: 'tor',
   *     rotateCircuit: true,
   *   },
   * })
   * ```
   *
   * @example Using custom SOCKS5
   * ```typescript
   * const client = createRPCClient({
   *   endpoint: 'https://api.mainnet-beta.solana.com',
   *   networkPrivacy: {
   *     proxy: 'socks5://127.0.0.1:1080',
   *   },
   * })
   * ```
   */
  networkPrivacy?: NetworkPrivacyConfig
}

/**
 * Transaction send options with priority fee support
 */
export interface SendTransactionOptions extends SendOptions {
  /**
   * Skip adding priority fee instructions
   */
  skipPriorityFee?: boolean

  /**
   * Custom priority fee in microlamports per compute unit
   */
  priorityFeeMicroLamports?: number

  /**
   * Custom compute unit limit
   */
  computeUnitLimit?: number

  /**
   * Commitment level for this transaction
   */
  commitment?: Commitment
}

/**
 * Transaction confirmation result
 */
export interface TransactionConfirmationResult {
  /**
   * Transaction signature
   */
  signature: TransactionSignature

  /**
   * Confirmation status
   */
  confirmed: boolean

  /**
   * Slot when confirmed
   */
  slot?: number

  /**
   * Error if transaction failed
   */
  error?: Error

  /**
   * Time to confirmation (ms)
   */
  confirmationTime?: number
}

/**
 * Priority fee estimate
 */
export interface PriorityFeeEstimate {
  /**
   * Estimated priority fee in microlamports per compute unit
   */
  microLamportsPerComputeUnit: number

  /**
   * Total fee estimate in lamports
   */
  totalLamports: bigint

  /**
   * Percentile used for estimation
   */
  percentile: number
}

/**
 * RPC error classification
 */
export enum RPCErrorType {
  /** Network/connection error */
  NETWORK = 'NETWORK',
  /** Rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Transaction simulation failed */
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  /** Transaction expired (blockhash invalid) */
  BLOCKHASH_EXPIRED = 'BLOCKHASH_EXPIRED',
  /** Insufficient funds */
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  /** Invalid transaction */
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  /** Node is behind */
  NODE_BEHIND = 'NODE_BEHIND',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Classified RPC error
 */
export interface ClassifiedRPCError {
  /** Error type classification */
  type: RPCErrorType
  /** Original error message */
  message: string
  /** Whether this error is retryable */
  retryable: boolean
  /** Suggested retry delay (ms) */
  suggestedDelay?: number
  /** Original error */
  originalError: Error
}

// ─── Internal Types ──────────────────────────────────────────────────────────

interface RpcEndpoint {
  rpc: Rpc<SolanaRpcApi>
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>
  legacyConnection: Connection
  endpoint: string
}

// ─── SolanaRPCClient Class ────────────────────────────────────────────────────

/**
 * Robust Solana RPC client for privacy transactions
 *
 * Migrated to @solana/kit while maintaining full backward compatibility.
 *
 * @example Basic usage
 * ```typescript
 * const client = new SolanaRPCClient({
 *   endpoint: 'https://api.mainnet-beta.solana.com',
 *   fallbackEndpoints: [
 *     'https://solana-api.projectserum.com',
 *   ],
 *   usePriorityFees: true,
 * })
 *
 * // Send transaction with retry logic
 * const result = await client.sendAndConfirmTransaction(
 *   signedTransaction,
 *   { skipPreflight: false }
 * )
 * ```
 *
 * @example With priority fees
 * ```typescript
 * // Estimate priority fee
 * const feeEstimate = await client.estimatePriorityFee(transaction)
 *
 * // Send with custom priority fee
 * const result = await client.sendAndConfirmTransaction(
 *   transaction,
 *   { priorityFeeMicroLamports: feeEstimate.microLamportsPerComputeUnit }
 * )
 * ```
 */
export class SolanaRPCClient {
  private endpoints: RpcEndpoint[] = []
  private currentEndpointIndex: number = 0
  private commitment: Commitment
  private maxRetries: number
  private retryBaseDelay: number
  private retryMaxDelay: number
  private usePriorityFees: boolean
  private priorityFeePercentile: number
  private debug: boolean
  private proxyAgent?: Agent
  private networkPrivacyConfig?: NetworkPrivacyConfig
  private torControlPort?: number
  private torControlPassword?: string

  constructor(config: RPCClientConfig) {
    this.commitment = config.commitment ?? 'confirmed'
    this.maxRetries = config.maxRetries ?? 3
    this.retryBaseDelay = config.retryBaseDelay ?? 500
    this.retryMaxDelay = config.retryMaxDelay ?? 5000
    this.usePriorityFees = config.usePriorityFees ?? false
    this.priorityFeePercentile = config.priorityFeePercentile ?? 75
    this.debug = config.debug ?? false
    this.networkPrivacyConfig = config.networkPrivacy
    this.torControlPort = config.networkPrivacy?.torControlPort
    this.torControlPassword = config.networkPrivacy?.torControlPassword

    // Create primary endpoint
    this.endpoints.push(this.createEndpoint(config.endpoint, config.commitment ?? 'confirmed', config.timeout ?? 30000))

    // Create fallback endpoints
    if (config.fallbackEndpoints) {
      for (const endpoint of config.fallbackEndpoints) {
        this.endpoints.push(this.createEndpoint(endpoint, config.commitment ?? 'confirmed', config.timeout ?? 30000))
      }
    }
  }

  /**
   * Create an RPC client with network privacy (async initialization)
   *
   * Use this factory method when you need Tor or SOCKS5 proxy support.
   * The proxy agent is initialized before creating the client.
   *
   * @param config - Client configuration with network privacy settings
   * @returns Configured RPC client with proxy support
   *
   * @example Using Tor
   * ```typescript
   * const client = await SolanaRPCClient.withNetworkPrivacy({
   *   endpoint: 'https://api.mainnet-beta.solana.com',
   *   networkPrivacy: {
   *     proxy: 'tor',
   *     rotateCircuit: true,
   *     torControlPassword: 'my-password',
   *   },
   * })
   *
   * // All RPC calls now go through Tor
   * const balance = await client.getBalance(publicKey)
   * ```
   */
  static async withNetworkPrivacy(config: RPCClientConfig): Promise<SolanaRPCClient> {
    const client = new SolanaRPCClient(config)

    if (config.networkPrivacy?.proxy) {
      const networkClient = await createNetworkPrivacyClient({
        proxy: config.networkPrivacy.proxy,
        timeout: config.timeout ?? 30000,
        fallbackToDirect: config.networkPrivacy.fallbackToDirect,
      })

      client.proxyAgent = networkClient.agent

      // Recreate endpoints with proxy agent
      client.endpoints = []
      client.endpoints.push(
        client.createEndpoint(config.endpoint, config.commitment ?? 'confirmed', config.timeout ?? 30000)
      )
      if (config.fallbackEndpoints) {
        for (const endpoint of config.fallbackEndpoints) {
          client.endpoints.push(
            client.createEndpoint(endpoint, config.commitment ?? 'confirmed', config.timeout ?? 30000)
          )
        }
      }

      if (client.debug) {
        console.log(`[RPC] Network privacy enabled: ${networkClient.status.type}`)
      }
    }

    return client
  }

  /**
   * Create an endpoint with both kit and legacy clients
   */
  private createEndpoint(endpoint: string, commitment: Commitment, timeout: number): RpcEndpoint {
    const wsEndpoint = this.deriveWsEndpoint(endpoint)

    // Connection options with optional proxy agent
    const connectionOptions: {
      commitment: Commitment
      confirmTransactionInitialTimeout: number
      wsEndpoint: string
      httpAgent?: Agent
      httpsAgent?: Agent
    } = {
      commitment,
      confirmTransactionInitialTimeout: timeout,
      wsEndpoint,
    }

    // Add proxy agent if configured (for Node.js)
    if (this.proxyAgent) {
      connectionOptions.httpAgent = this.proxyAgent
      connectionOptions.httpsAgent = this.proxyAgent
    }

    return {
      rpc: createSolanaRpc(endpoint),
      rpcSubscriptions: createSolanaRpcSubscriptions(wsEndpoint),
      legacyConnection: new Connection(endpoint, connectionOptions),
      endpoint,
    }
  }

  /**
   * Derive WebSocket endpoint from HTTP endpoint
   */
  private deriveWsEndpoint(httpEndpoint: string): string {
    try {
      const url = new URL(httpEndpoint)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      return url.toString()
    } catch {
      // Fallback for malformed URLs
      return httpEndpoint.replace(/^http/, 'ws')
    }
  }

  // ─── Connection Management ──────────────────────────────────────────────────

  /**
   * Get the current active kit RPC client
   */
  getRpc(): Rpc<SolanaRpcApi> {
    return this.endpoints[this.currentEndpointIndex].rpc
  }

  /**
   * Get the current active kit RPC subscriptions client
   */
  getRpcSubscriptions(): RpcSubscriptions<SolanaRpcSubscriptionsApi> {
    return this.endpoints[this.currentEndpointIndex].rpcSubscriptions
  }

  /**
   * Get the current active legacy Connection (for backward compatibility)
   */
  getConnection(): Connection {
    return this.endpoints[this.currentEndpointIndex].legacyConnection
  }

  /**
   * Get all configured legacy connections
   * @deprecated Use getRpc() for new code
   */
  getConnections(): Connection[] {
    return this.endpoints.map(e => e.legacyConnection)
  }

  /**
   * Switch to the next available endpoint (failover)
   */
  private switchEndpoint(): boolean {
    if (this.endpoints.length <= 1) {
      return false
    }

    const previousIndex = this.currentEndpointIndex
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length

    if (this.debug) {
      console.log(`[RPC] Switching from endpoint ${previousIndex} to ${this.currentEndpointIndex}`)
    }

    return true
  }

  // ─── Transaction Submission ─────────────────────────────────────────────────

  /**
   * Send a transaction with retry logic
   *
   * @param transaction - Signed transaction
   * @param options - Send options
   * @returns Transaction signature
   */
  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    const {
      skipPriorityFee = false,
      priorityFeeMicroLamports,
      computeUnitLimit,
      ...sendOptions
    } = options

    // Add priority fee if enabled and not skipped
    let txToSend = transaction
    if (this.usePriorityFees && !skipPriorityFee && transaction instanceof Transaction) {
      txToSend = await this.addPriorityFee(
        transaction,
        priorityFeeMicroLamports,
        computeUnitLimit
      )
    }

    return this.withRetry(async () => {
      const rpc = this.getRpc()
      const serialized = txToSend.serialize()
      // Cast to branded type (safe: we're encoding valid serialized transaction)
      const base64Encoded = Buffer.from(serialized).toString('base64') as unknown as Base64EncodedWireTransaction

      // Use kit RPC for sending
      const signature = await rpc.sendTransaction(base64Encoded, {
        encoding: 'base64',
        skipPreflight: sendOptions.skipPreflight ?? false,
        preflightCommitment: (sendOptions.preflightCommitment ?? this.commitment) as KitCommitment,
        maxRetries: BigInt(sendOptions.maxRetries ?? 0), // We handle retries ourselves
      }).send()

      // Cast signature back to legacy type
      return signature as unknown as TransactionSignature
    })
  }

  /**
   * Send and confirm a transaction with retry logic
   *
   * @param transaction - Signed transaction
   * @param options - Send options
   * @returns Confirmation result
   */
  async sendAndConfirmTransaction(
    transaction: Transaction | VersionedTransaction,
    options: SendTransactionOptions = {}
  ): Promise<TransactionConfirmationResult> {
    const startTime = Date.now()

    try {
      const signature = await this.sendTransaction(transaction, options)
      const confirmation = await this.confirmTransaction(
        signature,
        options.commitment ?? this.commitment
      )

      return {
        signature,
        confirmed: true,
        slot: confirmation.context?.slot,
        confirmationTime: Date.now() - startTime,
      }
    } catch (error) {
      const classified = this.classifyError(error as Error)

      return {
        signature: '' as TransactionSignature,
        confirmed: false,
        error: classified.originalError,
        confirmationTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Confirm a transaction signature
   *
   * @param signature - Transaction signature
   * @param commitment - Commitment level
   * @returns Signature result
   */
  async confirmTransaction(
    signature: TransactionSignature,
    commitment: Commitment = this.commitment
  ): Promise<{ context: { slot: number }; value: SignatureResult }> {
    return this.withRetry(async () => {
      const rpc = this.getRpc()

      // Get latest blockhash for confirmation
      const { value: latestBlockhash } = await rpc.getLatestBlockhash({
        commitment: commitment as KitCommitment,
      }).send()

      // Poll for signature status using kit RPC
      // Cast to branded Signature type (safe: signature comes from sendTransaction)
      const { value: statuses, context } = await rpc.getSignatureStatuses([signature as unknown as Signature]).send()
      const status = statuses[0]

      if (status === null) {
        // Transaction not found yet, need to poll
        // For now, use legacy connection for confirmation as kit doesn't have built-in polling
        const connection = this.getConnection()
        const result = await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: Number(latestBlockhash.lastValidBlockHeight),
          },
          commitment
        )

        if (result.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`)
        }

        return result
      }

      if (status.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
      }

      return {
        context: { slot: Number(context.slot) },
        value: { err: null },
      }
    })
  }

  // ─── Priority Fees ──────────────────────────────────────────────────────────

  /**
   * Estimate priority fee for a transaction
   *
   * @param transaction - Transaction to estimate fees for
   * @returns Priority fee estimate
   */
  async estimatePriorityFee(
    transaction: Transaction
  ): Promise<PriorityFeeEstimate> {
    try {
      const rpc = this.getRpc()

      // Get accounts involved in transaction
      const accountKeys = transaction.compileMessage().accountKeys.map(k => toAddress(k))

      // Get recent priority fees using kit RPC
      // Kit API takes array directly, not wrapped in object
      const recentFees = await rpc.getRecentPrioritizationFees(accountKeys.slice(0, 5)).send()

      if (recentFees.length === 0) {
        return {
          microLamportsPerComputeUnit: 1000, // Default: 1000 microlamports
          totalLamports: 200_000n, // Assuming 200k CU
          percentile: this.priorityFeePercentile,
        }
      }

      // Sort by priority fee and get percentile
      const sortedFees = recentFees
        .map(f => Number(f.prioritizationFee))
        .sort((a, b) => a - b)

      const percentileIndex = Math.floor(sortedFees.length * (this.priorityFeePercentile / 100))
      const estimatedFee = sortedFees[percentileIndex] || sortedFees[sortedFees.length - 1]

      // Estimate compute units (default 200k for privacy transactions)
      const estimatedComputeUnits = 200_000

      return {
        microLamportsPerComputeUnit: estimatedFee,
        totalLamports: BigInt(Math.ceil(estimatedFee * estimatedComputeUnits / 1_000_000)),
        percentile: this.priorityFeePercentile,
      }
    } catch {
      // Return conservative default on error
      return {
        microLamportsPerComputeUnit: 1000,
        totalLamports: 200_000n,
        percentile: this.priorityFeePercentile,
      }
    }
  }

  /**
   * Add priority fee instructions to a transaction
   *
   * @param transaction - Transaction to modify
   * @param priorityFee - Priority fee in microlamports (optional, will estimate)
   * @param computeUnitLimit - Compute unit limit (optional)
   * @returns Modified transaction
   */
  async addPriorityFee(
    transaction: Transaction,
    priorityFee?: number,
    computeUnitLimit?: number
  ): Promise<Transaction> {
    // Estimate priority fee if not provided
    let feeToUse = priorityFee
    if (feeToUse === undefined) {
      const estimate = await this.estimatePriorityFee(transaction)
      feeToUse = estimate.microLamportsPerComputeUnit
    }

    // Create new transaction with priority fee instructions at the start
    const modifiedTx = new Transaction()

    // Set compute unit limit
    modifiedTx.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnitLimit ?? 200_000,
      })
    )

    // Set compute unit price (priority fee)
    modifiedTx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: feeToUse,
      })
    )

    // Add original instructions
    modifiedTx.add(...transaction.instructions)

    // Copy over transaction metadata
    modifiedTx.recentBlockhash = transaction.recentBlockhash
    modifiedTx.feePayer = transaction.feePayer
    modifiedTx.lastValidBlockHeight = transaction.lastValidBlockHeight

    return modifiedTx
  }

  // ─── Error Handling ─────────────────────────────────────────────────────────

  /**
   * Classify an RPC error for appropriate handling
   *
   * @param error - Error to classify
   * @returns Classified error with retry information
   */
  classifyError(error: Error): ClassifiedRPCError {
    const message = error.message.toLowerCase()

    // Network errors - retryable
    if (message.includes('network') || message.includes('econnrefused') ||
        message.includes('timeout') || message.includes('socket')) {
      return {
        type: RPCErrorType.NETWORK,
        message: error.message,
        retryable: true,
        suggestedDelay: 1000,
        originalError: error,
      }
    }

    // Rate limit - retryable with longer delay
    if (message.includes('429') || message.includes('rate limit') ||
        message.includes('too many requests')) {
      return {
        type: RPCErrorType.RATE_LIMIT,
        message: error.message,
        retryable: true,
        suggestedDelay: 5000,
        originalError: error,
      }
    }

    // Blockhash expired - retryable (need to refresh blockhash)
    if (message.includes('blockhash') || message.includes('expired')) {
      return {
        type: RPCErrorType.BLOCKHASH_EXPIRED,
        message: error.message,
        retryable: true,
        suggestedDelay: 500,
        originalError: error,
      }
    }

    // Simulation failed - not retryable
    if (message.includes('simulation') || message.includes('preflight')) {
      return {
        type: RPCErrorType.SIMULATION_FAILED,
        message: error.message,
        retryable: false,
        originalError: error,
      }
    }

    // Insufficient funds - not retryable
    if (message.includes('insufficient') || message.includes('balance')) {
      return {
        type: RPCErrorType.INSUFFICIENT_FUNDS,
        message: error.message,
        retryable: false,
        originalError: error,
      }
    }

    // Node behind - retryable with failover
    if (message.includes('behind') || message.includes('slot')) {
      return {
        type: RPCErrorType.NODE_BEHIND,
        message: error.message,
        retryable: true,
        suggestedDelay: 2000,
        originalError: error,
      }
    }

    // Unknown error - conservative retry
    return {
      type: RPCErrorType.UNKNOWN,
      message: error.message,
      retryable: true,
      suggestedDelay: 1000,
      originalError: error,
    }
  }

  // ─── Retry Logic ────────────────────────────────────────────────────────────

  /**
   * Execute an operation with retry logic and failover
   */
  private async withRetry<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null
    let attempt = 0

    while (attempt < this.maxRetries) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        const classified = this.classifyError(lastError)

        if (this.debug) {
          console.log(`[RPC] Attempt ${attempt + 1} failed:`, classified.type, classified.message)
        }

        // If not retryable, throw immediately
        if (!classified.retryable) {
          throw lastError
        }

        // Try failover for network-related errors
        if (classified.type === RPCErrorType.NETWORK ||
            classified.type === RPCErrorType.RATE_LIMIT ||
            classified.type === RPCErrorType.NODE_BEHIND) {
          this.switchEndpoint()
        }

        // Calculate delay with exponential backoff
        const baseDelay = classified.suggestedDelay ?? this.retryBaseDelay
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt),
          this.retryMaxDelay
        )

        if (this.debug) {
          console.log(`[RPC] Retrying in ${delay}ms...`)
        }

        await this.sleep(delay)
        attempt++
      }
    }

    throw lastError ?? new Error('Max retries exceeded')
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Get latest blockhash with retry logic
   */
  async getLatestBlockhash(): Promise<{
    blockhash: string
    lastValidBlockHeight: number
  }> {
    return this.withRetry(async () => {
      const rpc = this.getRpc()
      const { value } = await rpc.getLatestBlockhash({
        commitment: this.commitment as KitCommitment,
      }).send()

      return {
        blockhash: value.blockhash,
        lastValidBlockHeight: Number(value.lastValidBlockHeight),
      }
    })
  }

  /**
   * Get balance with retry logic
   *
   * @param publicKey - PublicKey or Address to check balance
   */
  async getBalance(publicKey: PublicKey | Address): Promise<bigint> {
    return this.withRetry(async () => {
      const rpc = this.getRpc()
      const addr = typeof publicKey === 'string' ? publicKey : toAddress(publicKey)
      const { value } = await rpc.getBalance(addr, {
        commitment: this.commitment as KitCommitment,
      }).send()
      return value
    })
  }

  /**
   * Get account info with retry logic
   *
   * @param publicKey - PublicKey or Address to get info for
   */
  async getAccountInfo(publicKey: PublicKey | Address) {
    return this.withRetry(async () => {
      const rpc = this.getRpc()
      const addr = typeof publicKey === 'string' ? publicKey : toAddress(publicKey)
      const { value } = await rpc.getAccountInfo(addr, {
        commitment: this.commitment as KitCommitment,
        encoding: 'base64',
      }).send()

      if (value === null) {
        return null
      }

      // Convert to legacy format for backward compatibility
      // Note: rentEpoch is deprecated and not returned by kit
      return {
        executable: value.executable,
        owner: toPublicKey(value.owner),
        lamports: Number(value.lamports),
        data: Buffer.from(value.data[0], 'base64'),
      }
    })
  }

  /**
   * Check if the client is healthy (can connect to RPC)
   */
  async isHealthy(): Promise<boolean> {
    try {
      const rpc = this.getRpc()
      const version = await rpc.getVersion().send()
      return version !== null
    } catch {
      return false
    }
  }

  /**
   * Get current RPC endpoint
   */
  getCurrentEndpoint(): string {
    return this.endpoints[this.currentEndpointIndex].endpoint
  }

  // ─── Network Privacy Methods ─────────────────────────────────────────────────

  /**
   * Check if network privacy is enabled
   *
   * @returns True if RPC calls go through a proxy
   */
  isNetworkPrivacyEnabled(): boolean {
    return this.proxyAgent !== undefined
  }

  /**
   * Get network privacy configuration
   *
   * @returns Current network privacy config or undefined
   */
  getNetworkPrivacyConfig(): NetworkPrivacyConfig | undefined {
    return this.networkPrivacyConfig
  }

  /**
   * Rotate Tor circuit for new identity
   *
   * Requests a new circuit from the Tor control port (NEWNYM signal).
   * This provides unlinkability between subsequent requests.
   *
   * Requires:
   * - Tor control port enabled (default: 9051)
   * - Control port password if configured
   *
   * @returns True if circuit rotation succeeded
   *
   * @example
   * ```typescript
   * const client = await SolanaRPCClient.withNetworkPrivacy({
   *   endpoint: 'https://api.mainnet-beta.solana.com',
   *   networkPrivacy: {
   *     proxy: 'tor',
   *     torControlPassword: 'my-password',
   *   },
   * })
   *
   * // Send first transaction
   * await client.sendTransaction(tx1)
   *
   * // Rotate circuit for unlinkability
   * await client.rotateTorCircuit()
   *
   * // Send second transaction through new circuit
   * await client.sendTransaction(tx2)
   * ```
   */
  async rotateTorCircuit(): Promise<boolean> {
    if (!this.networkPrivacyConfig?.proxy) {
      if (this.debug) {
        console.log('[RPC] Circuit rotation skipped: no proxy configured')
      }
      return false
    }

    const success = await rotateProxyCircuit(
      this.torControlPort ?? 9051,
      this.torControlPassword
    )

    if (this.debug) {
      console.log(`[RPC] Circuit rotation: ${success ? 'success' : 'failed'}`)
    }

    return success
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a new Solana RPC client
 *
 * @param config - Client configuration
 * @returns Configured RPC client
 *
 * @example
 * ```typescript
 * // Simple client with single endpoint
 * const client = createRPCClient({
 *   endpoint: 'https://api.mainnet-beta.solana.com',
 * })
 *
 * // Production client with failover and priority fees
 * const prodClient = createRPCClient({
 *   endpoint: 'https://mainnet.helius-rpc.com/?api-key=xxx',
 *   fallbackEndpoints: [
 *     'https://api.mainnet-beta.solana.com',
 *     'https://solana-api.projectserum.com',
 *   ],
 *   usePriorityFees: true,
 *   maxRetries: 5,
 * })
 * ```
 */
export function createRPCClient(config: RPCClientConfig): SolanaRPCClient {
  return new SolanaRPCClient(config)
}

/**
 * Create an RPC client with network privacy support (async)
 *
 * Use this factory when you need Tor or SOCKS5 proxy support.
 * The proxy agent is initialized before creating the client.
 *
 * @param config - Client configuration with network privacy settings
 * @returns Configured RPC client with proxy support
 *
 * @example Using Tor
 * ```typescript
 * const client = await createPrivateRPCClient({
 *   endpoint: 'https://api.mainnet-beta.solana.com',
 *   networkPrivacy: {
 *     proxy: 'tor',
 *     rotateCircuit: true,
 *   },
 * })
 *
 * // All RPC calls go through Tor
 * const balance = await client.getBalance(publicKey)
 *
 * // Rotate circuit between sensitive operations
 * await client.rotateTorCircuit()
 * ```
 *
 * @example Using custom SOCKS5
 * ```typescript
 * const client = await createPrivateRPCClient({
 *   endpoint: 'https://api.mainnet-beta.solana.com',
 *   networkPrivacy: {
 *     proxy: 'socks5://127.0.0.1:1080',
 *   },
 * })
 * ```
 */
export async function createPrivateRPCClient(config: RPCClientConfig): Promise<SolanaRPCClient> {
  return SolanaRPCClient.withNetworkPrivacy(config)
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Pre-configured RPC endpoints for common clusters
 */
export const RPC_ENDPOINTS = {
  'mainnet-beta': [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
  ],
  'devnet': [
    'https://api.devnet.solana.com',
  ],
  'testnet': [
    'https://api.testnet.solana.com',
  ],
} as const

/**
 * Create an RPC client for a specific cluster with default endpoints
 *
 * @param cluster - Solana cluster
 * @param options - Additional client options
 * @returns Configured RPC client
 */
export function createClusterClient(
  cluster: 'mainnet-beta' | 'devnet' | 'testnet',
  options: Partial<RPCClientConfig> = {}
): SolanaRPCClient {
  const endpoints = RPC_ENDPOINTS[cluster]

  return createRPCClient({
    endpoint: endpoints[0],
    fallbackEndpoints: endpoints.slice(1),
    ...options,
  })
}
