/**
 * Triton RPC Provider
 *
 * Leverages Triton's Dragon's Mouth gRPC (Yellowstone) for real-time
 * subscriptions with up to 400ms latency advantage over standard RPC.
 *
 * ## Key Features
 *
 * - **gRPC Subscriptions**: Real-time account updates via Yellowstone
 * - **Standard RPC Compatible**: Full Solana JSON-RPC support
 * - **High Throughput**: Built for heavy indexing workloads
 *
 * @see https://docs.triton.one/chains/solana
 * @see https://docs.triton.one/project-yellowstone/dragons-mouth-grpc-subscriptions
 *
 * @example
 * ```typescript
 * import { TritonProvider } from '@sip-protocol/sdk'
 *
 * const triton = new TritonProvider({
 *   endpoint: 'https://sip-XXX.mainnet.rpcpool.com',
 *   xToken: process.env.TRITON_X_TOKEN,
 * })
 *
 * // Standard queries
 * const assets = await triton.getAssetsByOwner('7xK9...')
 *
 * // Real-time subscriptions (Triton's moat!)
 * const unsubscribe = await triton.subscribeToTransfers('7xK9...', (asset) => {
 *   console.log('New transfer:', asset)
 * })
 * ```
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token'
import type { SolanaRPCProvider, TokenAsset, ProviderConfig } from './interface'

/**
 * Triton provider configuration
 */
export interface TritonProviderConfig extends ProviderConfig {
  /**
   * Triton RPC endpoint
   * @example 'https://sip-protocol-XXX.mainnet.rpcpool.com'
   */
  endpoint: string
  /**
   * X-Token for authentication (optional for public endpoints)
   */
  xToken?: string
  /**
   * gRPC endpoint for Dragon's Mouth subscriptions
   * If not provided, derived from RPC endpoint
   * @example 'https://sip-protocol-XXX.mainnet.rpcpool.com'
   */
  grpcEndpoint?: string
  /**
   * Solana cluster (for endpoint validation)
   * @default 'mainnet-beta'
   */
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}

/**
 * gRPC subscription state
 */
interface SubscriptionState {
  /** Active stream */
  stream: AsyncIterable<unknown> | null
  /** Abort controller for cleanup */
  abortController: AbortController
  /** Whether subscription is active */
  active: boolean
}

/**
 * Triton RPC Provider implementation
 *
 * Uses standard Solana RPC for queries and Dragon's Mouth gRPC
 * for real-time subscriptions.
 */
export class TritonProvider implements SolanaRPCProvider {
  readonly name = 'triton'
  private connection: Connection
  private endpoint: string
  private grpcEndpoint: string
  private xToken?: string
  private subscriptions: Map<string, SubscriptionState> = new Map()
  private grpcClient: unknown | null = null

  constructor(config: TritonProviderConfig) {
    if (!config.endpoint) {
      throw new Error(
        'Triton endpoint is required. Get one at https://triton.one'
      )
    }

    this.endpoint = config.endpoint
    this.xToken = config.xToken
    this.grpcEndpoint = config.grpcEndpoint ?? config.endpoint

    // Create connection with optional auth header
    const connectionConfig = this.xToken
      ? {
          httpHeaders: { 'x-token': this.xToken },
          commitment: 'confirmed' as const,
        }
      : { commitment: 'confirmed' as const }

    this.connection = new Connection(this.endpoint, connectionConfig)
  }

  /**
   * Get all token assets owned by an address
   *
   * Uses standard Solana RPC for compatibility.
   * For enhanced metadata, consider using Triton's DAS API separately.
   */
  async getAssetsByOwner(owner: string): Promise<TokenAsset[]> {
    const ownerPubkey = this.validateAddress(owner, 'owner')

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      ownerPubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    )

    const assets: TokenAsset[] = []

    for (const { account } of tokenAccounts.value) {
      const parsed = account.data.parsed
      if (parsed?.type !== 'account') continue

      const info = parsed.info
      const amount = BigInt(info.tokenAmount?.amount ?? '0')

      // Skip zero balances
      if (amount === 0n) continue

      assets.push({
        mint: info.mint,
        amount,
        decimals: info.tokenAmount?.decimals ?? 0,
        // Note: Symbol/name/logo require separate metadata lookup
      })
    }

    return assets
  }

  /**
   * Get token balance for a specific mint
   */
  async getTokenBalance(owner: string, mint: string): Promise<bigint> {
    const ownerPubkey = this.validateAddress(owner, 'owner')
    const mintPubkey = this.validateAddress(mint, 'mint')

    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey)
      const account = await getAccount(this.connection, ata)
      return account.amount
    } catch (error) {
      // Check by error name for better compatibility with mocks and different module versions
      if (
        error instanceof TokenAccountNotFoundError ||
        (error instanceof Error && error.name === 'TokenAccountNotFoundError')
      ) {
        return 0n
      }
      throw error
    }
  }

  /**
   * Check if provider supports real-time subscriptions
   *
   * Triton supports gRPC subscriptions via Dragon's Mouth - this is
   * the key differentiator from other providers.
   */
  supportsSubscriptions(): boolean {
    return true
  }

  /**
   * Subscribe to token transfers for an address
   *
   * Uses Dragon's Mouth gRPC for real-time updates with up to
   * 400ms latency advantage over standard WebSocket.
   *
   * @param address - Solana address to watch
   * @param callback - Called when a transfer is detected
   * @returns Unsubscribe function
   */
  async subscribeToTransfers(
    address: string,
    callback: (asset: TokenAsset) => void
  ): Promise<() => void> {
    const addressPubkey = this.validateAddress(address, 'address')
    const subscriptionId = `transfer-${address}-${Date.now()}`

    // Initialize gRPC client if needed
    await this.ensureGrpcClient()

    const abortController = new AbortController()
    const state: SubscriptionState = {
      stream: null,
      abortController,
      active: true,
    }
    this.subscriptions.set(subscriptionId, state)

    // Start subscription in background
    this.startSubscription(addressPubkey, callback, state).catch((error) => {
      if (state.active) {
        console.error('[TritonProvider] Subscription error:', error)
      }
    })

    // Return unsubscribe function
    return () => {
      state.active = false
      state.abortController.abort()
      this.subscriptions.delete(subscriptionId)
    }
  }

  /**
   * Initialize gRPC client lazily
   */
  private async ensureGrpcClient(): Promise<void> {
    if (this.grpcClient) return

    try {
      // Dynamic import to avoid bundling gRPC when not used
      const { default: Client } = await import('@triton-one/yellowstone-grpc')

      // Initialize with endpoint, optional auth token, and undefined channel options
      this.grpcClient = new Client(this.grpcEndpoint, this.xToken, undefined)
    } catch (error) {
      throw new Error(
        `Failed to initialize Triton gRPC client. ` +
        `Ensure @triton-one/yellowstone-grpc is installed: ${error}`
      )
    }
  }

  /**
   * Start gRPC subscription for account updates
   */
  private async startSubscription(
    address: PublicKey,
    callback: (asset: TokenAsset) => void,
    state: SubscriptionState
  ): Promise<void> {
    if (!this.grpcClient) {
      throw new Error('gRPC client not initialized')
    }

    // Type assertion for the client
    const client = this.grpcClient as {
      subscribe(): {
        on(event: 'data', handler: (data: GrpcAccountUpdate) => void): void
        on(event: 'error', handler: (error: Error) => void): void
        on(event: 'end', handler: () => void): void
        write(request: GrpcSubscribeRequest): void
        end(): void
      }
    }

    const stream = client.subscribe()
    state.stream = stream as unknown as AsyncIterable<unknown>

    // Set up event handlers
    stream.on('data', (data: GrpcAccountUpdate) => {
      if (!state.active) return

      // Process account update
      const asset = this.parseAccountUpdate(data, address.toBase58())
      if (asset) {
        callback(asset)
      }
    })

    stream.on('error', (error: Error) => {
      if (state.active) {
        console.error('[TritonProvider] gRPC stream error:', error)
      }
    })

    stream.on('end', () => {
      state.active = false
    })

    // Send subscription request
    const request: GrpcSubscribeRequest = {
      accounts: {
        tokenTransfers: {
          owner: [address.toBase58()],
          account: [],
          filters: [],
        },
      },
      commitment: 2, // CONFIRMED
      accountsDataSlice: [],
      ping: { id: 1 },
    }

    stream.write(request)

    // Handle abort
    state.abortController.signal.addEventListener('abort', () => {
      stream.end()
    })
  }

  /**
   * Parse gRPC account update into TokenAsset
   */
  private parseAccountUpdate(
    data: GrpcAccountUpdate,
    _watchedAddress: string
  ): TokenAsset | null {
    // Check if this is an account update
    if (!data.account?.account) {
      return null
    }

    const accountData = data.account.account

    // Parse token account data
    try {
      // Token account data layout: mint (32) + owner (32) + amount (8) + ...
      const dataBuffer = Buffer.from(accountData.data)
      if (dataBuffer.length < 72) return null

      const mint = new PublicKey(dataBuffer.subarray(0, 32)).toBase58()
      const amount = dataBuffer.readBigUInt64LE(64)

      return {
        mint,
        amount,
        decimals: 0, // Would need metadata lookup for decimals
      }
    } catch {
      return null
    }
  }

  /**
   * Validate Solana address
   */
  private validateAddress(address: string, paramName: string): PublicKey {
    try {
      return new PublicKey(address)
    } catch {
      throw new Error(`Invalid Solana address for ${paramName}: ${address}`)
    }
  }

  /**
   * Get the underlying Connection for advanced use cases
   */
  getConnection(): Connection {
    return this.connection
  }

  /**
   * Check if gRPC client is initialized
   */
  isGrpcReady(): boolean {
    return this.grpcClient !== null
  }

  /**
   * Clean up all subscriptions
   */
  async dispose(): Promise<void> {
    for (const [id, state] of this.subscriptions) {
      state.active = false
      state.abortController.abort()
      this.subscriptions.delete(id)
    }
    this.grpcClient = null
  }
}

// ─── gRPC Types ─────────────────────────────────────────────────────────────

/**
 * gRPC subscription request
 */
interface GrpcSubscribeRequest {
  accounts?: {
    [key: string]: {
      owner?: string[]
      account?: string[]
      filters?: Array<{
        memcmp?: { offset: number; data: { bytes: string } }
        datasize?: number
      }>
    }
  }
  commitment?: number
  accountsDataSlice?: Array<{ offset: number; length: number }>
  ping?: { id: number }
}

/**
 * gRPC account update message
 */
interface GrpcAccountUpdate {
  account?: {
    account?: {
      pubkey: Uint8Array
      lamports: bigint
      owner: Uint8Array
      executable: boolean
      rentEpoch: bigint
      data: Uint8Array
      writeVersion: bigint
      slot: bigint
    }
    slot: bigint
    isStartup: boolean
  }
  slot?: {
    slot: bigint
    parent?: bigint
    status: number
  }
  ping?: {
    id: number
  }
}
