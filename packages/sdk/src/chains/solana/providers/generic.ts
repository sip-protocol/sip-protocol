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
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token'
import type { SolanaRPCProvider, TokenAsset, GenericProviderConfig } from './interface'
import { NetworkError, ValidationError, ErrorCode } from '../../../errors'
import { sanitizeUrl } from '../constants'

/**
 * RPC endpoint URLs by cluster
 */
const CLUSTER_ENDPOINTS: Record<string, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
}

/**
 * Validate and parse a Solana address (base58)
 *
 * Attempts to create a PublicKey from the address string.
 *
 * @param address - Solana address in base58 format
 * @param paramName - Parameter name for error message context
 * @returns Validated PublicKey instance
 * @throws Error if address is invalid base58 or wrong length
 * @internal
 */
function validateSolanaAddress(address: string, paramName: string): PublicKey {
  try {
    return new PublicKey(address)
  } catch {
    throw new ValidationError('invalid Solana address format', paramName, undefined, ErrorCode.INVALID_ADDRESS)
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
  /**
   * Get token balance for a specific mint
   *
   * M1 FIX: Properly differentiate between missing accounts (return 0n)
   * and actual RPC errors (throw NetworkError)
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
      // M1 FIX: Only return 0n for "account not found" errors
      // Throw for actual RPC/network errors
      if (
        error instanceof TokenAccountNotFoundError ||
        error instanceof TokenInvalidAccountOwnerError
      ) {
        // Account doesn't exist - this is expected, return 0n
        return 0n
      }

      // Check for common RPC error patterns
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (
        errorMessage.includes('could not find account') ||
        errorMessage.includes('Account does not exist')
      ) {
        return 0n
      }

      // Actual RPC/network error - throw
      // H-2 FIX: Sanitize endpoint URL to prevent credential exposure
      throw new NetworkError(
        `Failed to get token balance: ${errorMessage}`,
        undefined,
        { endpoint: sanitizeUrl(this.connection.rpcEndpoint) }
      )
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
