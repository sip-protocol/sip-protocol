/**
 * Triton RPC Provider
 *
 * Leverages Triton's high-performance Solana RPC for queries and
 * Dragon's Mouth gRPC (Yellowstone) for real-time streaming.
 *
 * Triton is known for ultra-low latency (~400ms advantage over WebSocket)
 * and multi-region failover for high availability.
 *
 * @see https://docs.triton.one/chains/solana
 * @see https://docs.triton.one/project-yellowstone/dragons-mouth-grpc-subscriptions
 *
 * @example
 * ```typescript
 * import { TritonProvider } from '@sip-protocol/sdk'
 *
 * const triton = new TritonProvider({
 *   xToken: process.env.TRITON_TOKEN!,
 *   cluster: 'mainnet-beta'
 * })
 *
 * // Query assets (standard RPC)
 * const assets = await triton.getAssetsByOwner('7xK9...')
 *
 * // Real-time subscriptions (Dragon's Mouth gRPC)
 * if (triton.supportsSubscriptions()) {
 *   const unsubscribe = await triton.subscribeToTransfers('7xK9...', (asset) => {
 *     console.log('Transfer received:', asset)
 *   })
 * }
 * ```
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
} from '@solana/spl-token'
import Client, {
  CommitmentLevel,
  type SubscribeRequest,
  type SubscribeUpdate,
} from '@triton-one/yellowstone-grpc'
import type { ClientDuplexStream } from '@grpc/grpc-js'
import { base58 } from '@scure/base'
import type { SolanaRPCProvider, TokenAsset, ProviderConfig } from './interface'

/**
 * Type alias for Yellowstone gRPC subscription stream
 */
type GrpcSubscriptionStream = ClientDuplexStream<SubscribeRequest, SubscribeUpdate>

import { ValidationError, ErrorCode } from '../../../errors'

/**
 * Triton provider configuration
 */
export interface TritonProviderConfig extends ProviderConfig {
  /**
   * Triton x-token for authentication
   */
  xToken: string
  /**
   * Custom RPC endpoint (optional)
   * Default: https://mainnet.rpcpool.com or https://devnet.rpcpool.com
   */
  endpoint?: string
  /**
   * Custom gRPC endpoint (optional)
   * Default: https://grpc.rpcpool.com:443
   */
  grpcEndpoint?: string
  /**
   * Solana cluster (default: mainnet-beta)
   */
  cluster?: 'mainnet-beta' | 'devnet'
  /**
   * Enable Dragon's Mouth gRPC for real-time subscriptions
   * @default true
   */
  enableGrpc?: boolean
}

/**
 * Default Triton endpoints by cluster
 */
const TRITON_RPC_ENDPOINTS: Record<string, string> = {
  'mainnet-beta': 'https://mainnet.rpcpool.com',
  devnet: 'https://devnet.rpcpool.com',
}

/**
 * Default Triton gRPC endpoints by cluster
 */
const TRITON_GRPC_ENDPOINTS: Record<string, string> = {
  'mainnet-beta': 'https://grpc.rpcpool.com:443',
  devnet: 'https://grpc-devnet.rpcpool.com:443',
}

/**
 * Validate a Solana address (base58)
 * @throws Error if address is invalid
 */
function validateSolanaAddress(address: string, paramName: string): PublicKey {
  try {
    return new PublicKey(address)
  } catch {
    throw new ValidationError('invalid Solana address format', paramName, undefined, ErrorCode.INVALID_ADDRESS)
  }
}

/**
 * Triton RPC Provider implementation
 *
 * Uses Triton's high-performance RPC for queries and Dragon's Mouth
 * gRPC for real-time subscriptions. Known for ultra-low latency and
 * high availability, ideal for DeFi and trading applications.
 */
export class TritonProvider implements SolanaRPCProvider {
  readonly name = 'triton'
  private connection: Connection
  private grpcEndpoint: string
  private xToken: string
  private grpcEnabled: boolean
  private grpcClient: Client | null = null
/** Active gRPC subscription streams */
  private activeStreams: Set<GrpcSubscriptionStream> = new Set()
  /** Cache for mint decimals to avoid repeated RPC calls */
  private mintDecimalsCache: Map<string, number> = new Map()

  constructor(config: TritonProviderConfig) {
    if (!config.xToken) {
      throw new ValidationError(
        'x-token is required. Get one at https://triton.one/',
        'xToken',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    const cluster = config.cluster ?? 'mainnet-beta'
    const rpcEndpoint = config.endpoint ?? TRITON_RPC_ENDPOINTS[cluster]

    // Append x-token to RPC endpoint
    const normalizedEndpoint = rpcEndpoint.replace(/\/$/, '') // Remove trailing slash
    const rpcUrl = normalizedEndpoint.includes('?')
      ? `${normalizedEndpoint}&x-token=${config.xToken}`
      : `${normalizedEndpoint}/${config.xToken}`

    this.connection = new Connection(rpcUrl, 'confirmed')
    this.grpcEndpoint = config.grpcEndpoint ?? TRITON_GRPC_ENDPOINTS[cluster]
    this.xToken = config.xToken
    this.grpcEnabled = config.enableGrpc !== false
  }

  /**
   * Get all token assets owned by an address using standard RPC
   *
   * Uses getParsedTokenAccountsByOwner for comprehensive asset information.
   */
  async getAssetsByOwner(owner: string): Promise<TokenAsset[]> {
    const ownerPubkey = validateSolanaAddress(owner, 'owner')

    const accounts = await this.connection.getParsedTokenAccountsByOwner(
      ownerPubkey,
      { programId: TOKEN_PROGRAM_ID }
    )

    const assets: TokenAsset[] = []

    for (const { account } of accounts.value) {
      const parsed = account.data.parsed
      if (parsed.type !== 'account') continue

      const info = parsed.info
      const amount = BigInt(info.tokenAmount.amount)

      // Skip zero balances
      if (amount === 0n) continue

      assets.push({
        mint: info.mint,
        amount,
        decimals: info.tokenAmount.decimals,
        // Standard RPC doesn't provide symbol/name, those need metadata lookup
        symbol: undefined,
        name: undefined,
        logoUri: undefined,
      })
    }

    return assets
  }

  /**
   * Get token balance for a specific mint
   *
   * Uses getAccount on the associated token address.
   */
  async getTokenBalance(owner: string, mint: string): Promise<bigint> {
    const ownerPubkey = validateSolanaAddress(owner, 'owner')
    const mintPubkey = validateSolanaAddress(mint, 'mint')

    try {
      const ata = await getAssociatedTokenAddress(
        mintPubkey,
        ownerPubkey,
        true // allowOwnerOffCurve for PDAs
      )

      const account = await getAccount(this.connection, ata)
      return account.amount
    } catch {
      // Account doesn't exist or other RPC error
      return 0n
    }
  }

  /**
   * Check if provider supports real-time subscriptions
   *
   * Triton supports Dragon's Mouth gRPC (Yellowstone) for
   * real-time streaming with ~400ms latency advantage.
   */
  supportsSubscriptions(): boolean {
    return this.grpcEnabled
  }

  /**
   * Get token decimals from mint metadata with caching
   *
   * @param mint - Token mint address (base58)
   * @returns Token decimals (0-18), defaults to 9 if fetch fails
   */
  private async getMintDecimals(mint: string): Promise<number> {
    // Check cache first
    const cached = this.mintDecimalsCache.get(mint)
    if (cached !== undefined) {
      return cached
    }

    try {
      const mintPubkey = new PublicKey(mint)
      const mintInfo = await getMint(this.connection, mintPubkey)
      const decimals = mintInfo.decimals
      this.mintDecimalsCache.set(mint, decimals)
      return decimals
    } catch {
      // Default to 9 (SOL decimals) if fetch fails
      // This is a safe fallback since most Solana tokens use 9 decimals
      return 9
    }
  }

  /**
   * Initialize gRPC client lazily
   */
  private async getGrpcClient(): Promise<Client> {
    if (!this.grpcEnabled) {
      throw new ValidationError(
        'gRPC subscriptions are disabled. Set enableGrpc: true in config',
        'enableGrpc',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (!this.grpcClient) {
      // Triton uses x-token for gRPC authentication
      this.grpcClient = new Client(this.grpcEndpoint, this.xToken, {})
    }

    return this.grpcClient
  }

  /**
   * Subscribe to token transfers for an address
   *
   * Uses Dragon's Mouth gRPC to receive real-time notifications when
   * tokens are transferred to the specified address.
   *
   * Dragon's Mouth provides ~400ms latency advantage over WebSocket,
   * making it ideal for DeFi and trading applications.
   *
   * @param address - Solana address to watch for incoming transfers
   * @param callback - Called when a transfer is detected
   * @returns Unsubscribe function
   */
  async subscribeToTransfers(
    address: string,
    callback: (asset: TokenAsset) => void
  ): Promise<() => void> {
    validateSolanaAddress(address, 'address')

    const client = await this.getGrpcClient()
    const stream = await client.subscribe()

    this.activeStreams.add(stream)

    // Handle incoming data
    stream.on('data', (update) => {
      // Check for account update
      if (update.account?.account) {
        const accountData = update.account.account

        // Only process token account updates
        if (accountData.owner?.toString() === TOKEN_PROGRAM_ID.toBase58()) {
          try {
            // Parse SPL Token account data
            // Token account structure: mint (32) + owner (32) + amount (8) + ...
            const data = accountData.data
            if (data && data.length >= 72) {
              const mint = new PublicKey(data.slice(0, 32)).toBase58()
              const amount = BigInt(
                '0x' + Buffer.from(data.slice(64, 72)).reverse().toString('hex')
              )

              if (amount > 0n) {
                // Fetch decimals asynchronously and invoke callback
                this.getMintDecimals(mint).then((decimals) => {
                  callback({
                    mint,
                    amount,
                    decimals,
                    symbol: undefined,
                    name: undefined,
                    logoUri: undefined,
                  })
                }).catch(() => {
                  // Still invoke callback with default decimals on error
                  callback({
                    mint,
                    amount,
                    decimals: 9,
                    symbol: undefined,
                    name: undefined,
                    logoUri: undefined,
                  })
                })
              }
            }
          } catch {
            // Skip malformed account data
          }
        }
      }
    })

    stream.on('error', (err) => {
      console.error('[TritonProvider] gRPC stream error:', err.message)
      this.activeStreams.delete(stream)
    })

    stream.on('end', () => {
      this.activeStreams.delete(stream)
    })

    // Create subscription request for token accounts owned by address
    const request: SubscribeRequest = {
      accounts: {
        stealth: {
          account: [],
          owner: [TOKEN_PROGRAM_ID.toBase58()],
          filters: [
            {
              memcmp: {
                offset: '32', // Owner field offset in token account
                bytes: new Uint8Array(base58.decode(address)),
              },
            },
          ],
        },
      },
      commitment: CommitmentLevel.CONFIRMED,
      accountsDataSlice: [],
      slots: {},
      transactions: {},
      transactionsStatus: {},
      blocks: {},
      blocksMeta: {},
      entry: {},
    }

    // Send subscription request
    await new Promise<void>((resolve, reject) => {
      stream.write(request, (err: Error | null | undefined) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // Return unsubscribe function
    return () => {
      stream.end()
      this.activeStreams.delete(stream)
    }
  }

  /**
   * Get the underlying Connection object
   *
   * Useful for advanced operations that need direct RPC access.
   */
  getConnection(): Connection {
    return this.connection
  }

  /**
   * Close all active subscriptions and cleanup resources
   */
  async close(): Promise<void> {
    for (const stream of this.activeStreams) {
      stream.end()
    }
    this.activeStreams.clear()
    this.grpcClient = null
  }
}
