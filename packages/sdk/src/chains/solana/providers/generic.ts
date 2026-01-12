/**
 * Generic Solana RPC Provider
 *
 * Uses standard Solana RPC methods, works with any RPC endpoint
 * including self-hosted nodes. No API key required.
 *
 * @example
 * ```typescript
 * import { GenericProvider } from '@sip-protocol/sdk'
 * import { Connection } from '@solana/web3.js'
 *
 * // With existing connection
 * const connection = new Connection('https://api.devnet.solana.com')
 * const generic = new GenericProvider({ connection })
 *
 * // With endpoint string
 * const devnet = new GenericProvider({
 *   endpoint: 'https://api.devnet.solana.com'
 * })
 *
 * const assets = await generic.getAssetsByOwner('7xK9...')
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
  TokenAccountNotFoundError,
} from '@solana/spl-token'
import type { SolanaRPCProvider, TokenAsset, GenericProviderConfig } from './interface'

/**
 * RPC endpoint URLs by cluster
 */
const CLUSTER_ENDPOINTS: Record<string, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
}

/**
 * Validate a Solana address (base58)
 * @throws Error if address is invalid
 */
function validateSolanaAddress(address: string, paramName: string): PublicKey {
  try {
    return new PublicKey(address)
  } catch {
    throw new Error(`Invalid Solana address for ${paramName}: ${address}`)
  }
}

/**
 * Generic RPC Provider implementation
 *
 * Uses standard Solana RPC methods. Works with any RPC endpoint.
 * Recommended for development, testing, or self-hosted nodes.
 */
export class GenericProvider implements SolanaRPCProvider {
  readonly name = 'generic'
  private connection: Connection

  constructor(config: GenericProviderConfig) {
    // Use provided connection or create one
    if (config.connection) {
      this.connection = config.connection as Connection
    } else {
      const endpoint = config.endpoint ?? CLUSTER_ENDPOINTS[config.cluster ?? 'mainnet-beta']
      this.connection = new Connection(endpoint, 'confirmed')
    }
  }

  /**
   * Get all token assets owned by an address using getParsedTokenAccountsByOwner
   *
   * Note: This is less efficient than Helius DAS API for large wallets,
   * but works with any RPC endpoint.
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
        // Generic RPC doesn't provide symbol/name, those need metadata lookup
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
    // Validate addresses before trying to fetch (these errors should propagate)
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
    } catch (error) {
      // M1 FIX: Distinguish "account not found" from RPC errors
      // TokenAccountNotFoundError means no balance - return 0n silently
      if (error instanceof TokenAccountNotFoundError) {
        return 0n
      }
      // Other errors (RPC failure, network issues) - log warning for debugging
      // but still return 0n for resilience
      console.warn('[GenericProvider] getTokenBalance RPC error:', error)
      return 0n
    }
  }

  /**
   * Check if provider supports real-time subscriptions
   *
   * Generic RPC supports WebSocket subscriptions but they're not
   * efficient for monitoring token transfers. Returns false.
   */
  supportsSubscriptions(): boolean {
    return false
  }

  /**
   * Get the underlying Connection object
   *
   * Useful for advanced operations that need direct RPC access.
   */
  getConnection(): Connection {
    return this.connection
  }
}
