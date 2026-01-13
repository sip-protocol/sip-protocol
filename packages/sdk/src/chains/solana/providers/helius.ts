/**
 * Helius RPC Provider
 *
 * Leverages Helius DAS (Digital Asset Standard) API for efficient
 * token balance queries and asset metadata.
 *
 * @see https://docs.helius.dev/solana-apis/digital-asset-standard-das-api
 *
 * @example
 * ```typescript
 * import { HeliusProvider } from '@sip-protocol/sdk'
 *
 * const helius = new HeliusProvider({
 *   apiKey: process.env.HELIUS_API_KEY!,
 *   cluster: 'devnet'
 * })
 *
 * const assets = await helius.getAssetsByOwner('7xK9...')
 * console.log(assets) // [{ mint: '...', amount: 1000000n, decimals: 6, symbol: 'USDC' }]
 * ```
 */

import type { SolanaRPCProvider, TokenAsset, ProviderConfig } from './interface'
import { ValidationError, NetworkError } from '../../../errors'
import {
  SOLANA_ADDRESS_MIN_LENGTH,
  SOLANA_ADDRESS_MAX_LENGTH,
  HELIUS_API_KEY_MIN_LENGTH,
  HELIUS_DAS_PAGE_LIMIT,
  HELIUS_MAX_PAGES,
  sanitizeUrl,
} from '../constants'

/** Default fetch timeout in milliseconds */
const DEFAULT_FETCH_TIMEOUT_MS = 30000

/**
 * Mask API key for safe logging/error messages
 *
 * Shows only first 4 and last 4 characters to prevent key exposure.
 *
 * @param apiKey - Helius API key to mask
 * @returns Masked key (e.g., 'abcd...wxyz') or '***' if too short
 * @internal
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= HELIUS_API_KEY_MIN_LENGTH) return '***'
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
}

/**
 * Fetch with configurable timeout using AbortController
 *
 * Wraps fetch with a timeout to prevent hanging requests.
 *
 * @param url - URL to fetch
 * @param options - Fetch options (method, headers, body, etc.)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Fetch response
 * @throws NetworkError if request times out
 * @internal
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // H-2 FIX: Sanitize URL to prevent credential exposure
      throw new NetworkError(
        `Request timeout after ${timeoutMs}ms`,
        undefined,
        { endpoint: sanitizeUrl(url) }
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Helius API response types
 */
interface HeliusDASAsset {
  id: string
  interface: string
  content?: {
    metadata?: {
      name?: string
      symbol?: string
    }
    links?: {
      image?: string
    }
  }
  token_info?: {
    /** Balance as string to preserve precision for large values */
    balance?: string | number
    decimals?: number
    symbol?: string
    token_program?: string
    mint_authority?: string
    freeze_authority?: string
  }
  ownership?: {
    owner: string
  }
}

interface HeliusDASResponse {
  jsonrpc: string
  result?: {
    items: HeliusDASAsset[]
    total: number
    limit: number
    page: number
    cursor?: string
  }
  error?: {
    code: number
    message: string
  }
  id: string
}

interface HeliusBalancesResponse {
  tokens: Array<{
    mint: string
    amount: number
    decimals: number
    tokenAccount: string
  }>
  nativeBalance: number
}

/**
 * Helius provider configuration
 *
 * @security API keys should be treated as sensitive credentials.
 */
export interface HeliusProviderConfig extends ProviderConfig {
  /**
   * Helius API key (required)
   *
   * @security Treat as sensitive credential. Use environment variables.
   * Never commit to source control or log in error messages.
   * The SDK masks this key in error messages automatically.
   */
  apiKey: string
  /** Solana cluster (default: mainnet-beta) */
  cluster?: 'mainnet-beta' | 'devnet'
}

/**
 * Helius RPC Provider implementation
 *
 * Uses Helius DAS API for efficient token queries.
 * Recommended for production deployments.
 */
export class HeliusProvider implements SolanaRPCProvider {
  readonly name = 'helius'
  private readonly apiKey: string
  private readonly cluster: 'mainnet-beta' | 'devnet'
  private readonly rpcUrl: string
  private readonly restUrl: string

  constructor(config: HeliusProviderConfig) {
    // Validate API key
    if (!config.apiKey) {
      throw new ValidationError(
        'Helius API key is required. Get one at https://dev.helius.xyz',
        'apiKey'
      )
    }

    // Validate API key format (basic check - Helius keys are UUIDs or alphanumeric)
    if (typeof config.apiKey !== 'string' || config.apiKey.length < HELIUS_API_KEY_MIN_LENGTH) {
      throw new ValidationError(
        'Invalid Helius API key format',
        'apiKey'
      )
    }

    this.apiKey = config.apiKey
    this.cluster = config.cluster ?? 'mainnet-beta'

    // RPC endpoint for DAS API (no API key in URL - use header instead)
    // H-1 FIX: API key moved from URL query parameter to Authorization header
    this.rpcUrl = this.cluster === 'devnet'
      ? 'https://devnet.helius-rpc.com'
      : 'https://mainnet.helius-rpc.com'

    // REST endpoint for balances API
    this.restUrl = this.cluster === 'devnet'
      ? 'https://api-devnet.helius.xyz/v0'
      : 'https://api.helius.xyz/v0'
  }

  /**
   * Get all token assets owned by an address using DAS API
   *
   * Uses getAssetsByOwner for comprehensive asset information including
   * NFTs and fungible tokens with metadata.
   */
  async getAssetsByOwner(owner: string): Promise<TokenAsset[]> {
    // Validate owner address
    if (!owner || typeof owner !== 'string') {
      throw new ValidationError('owner address is required', 'owner')
    }
    // Basic Solana address validation (32-44 chars, base58)
    if (owner.length < SOLANA_ADDRESS_MIN_LENGTH || owner.length > SOLANA_ADDRESS_MAX_LENGTH) {
      throw new ValidationError('invalid Solana address format', 'owner')
    }

    const assets: TokenAsset[] = []
    let page = 1
    const limit = HELIUS_DAS_PAGE_LIMIT
    let hasMore = true

    while (hasMore) {
      const response = await fetchWithTimeout(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // H-1 FIX: Use Authorization header instead of URL query parameter
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `sip-${Date.now()}`,
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: owner,
            page,
            limit,
            displayOptions: {
              showFungible: true,
              showNativeBalance: false,
            },
          },
        }),
      })

      if (!response.ok) {
        // H-2 FIX: Never include API key in error messages, sanitize URLs
        throw new NetworkError(
          `Helius API error: ${response.status} ${response.statusText} (key: ${maskApiKey(this.apiKey)})`,
          undefined,
          { endpoint: sanitizeUrl(this.rpcUrl), statusCode: response.status }
        )
      }

      const data = (await response.json()) as HeliusDASResponse

      // Handle JSON-RPC errors
      if (data.error) {
        throw new NetworkError(
          `Helius RPC error: ${data.error.message} (code: ${data.error.code})`,
          undefined,
          { endpoint: sanitizeUrl(this.rpcUrl) }
        )
      }

      if (data.result?.items) {
        for (const item of data.result.items) {
          // Skip NFTs (interface !== 'FungibleToken' and 'FungibleAsset')
          if (item.interface !== 'FungibleToken' && item.interface !== 'FungibleAsset') {
            continue
          }

          // Extract token info
          const tokenInfo = item.token_info
          if (!tokenInfo?.balance) continue

          // Convert balance to BigInt, handling both string and number types
          // Always use string parsing for BigInt to avoid precision loss
          let balanceValue: bigint
          if (typeof tokenInfo.balance === 'string') {
            balanceValue = BigInt(tokenInfo.balance)
          } else {
            // For numbers, convert to string first to avoid precision loss
            balanceValue = BigInt(Math.floor(tokenInfo.balance).toString())
          }

          assets.push({
            mint: item.id,
            amount: balanceValue,
            decimals: tokenInfo.decimals ?? 0,
            symbol: tokenInfo.symbol ?? item.content?.metadata?.symbol,
            name: item.content?.metadata?.name,
            logoUri: item.content?.links?.image,
          })
        }
      }

      // Check if there are more pages
      hasMore = data.result?.items?.length === limit
      page++

      // Safety limit to prevent infinite loops
      if (page > HELIUS_MAX_PAGES) {
        break
      }
    }

    return assets
  }

  /**
   * Get token balance for a specific mint using Balances API
   *
   * More efficient than getAssetsByOwner when you only need one token's balance.
   */
  async getTokenBalance(owner: string, mint: string): Promise<bigint> {
    // Validate inputs
    if (!owner || typeof owner !== 'string') {
      throw new ValidationError('owner address is required', 'owner')
    }
    if (!mint || typeof mint !== 'string') {
      throw new ValidationError('mint address is required', 'mint')
    }
    // Validate address format
    if (owner.length < SOLANA_ADDRESS_MIN_LENGTH || owner.length > SOLANA_ADDRESS_MAX_LENGTH) {
      throw new ValidationError('invalid owner address format', 'owner')
    }
    if (mint.length < SOLANA_ADDRESS_MIN_LENGTH || mint.length > SOLANA_ADDRESS_MAX_LENGTH) {
      throw new ValidationError('invalid mint address format', 'mint')
    }

    const url = `${this.restUrl}/addresses/${owner}/balances`

    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        // Only fallback for specific recoverable errors (404, 503)
        // Don't fallback for auth errors (401, 403) or client errors (400)
        if (response.status === 404 || response.status === 503) {
          return this.getTokenBalanceFallback(owner, mint)
        }
        // For other errors, throw rather than silently fallback
        // H-2 FIX: Sanitize URL to prevent credential exposure
        throw new NetworkError(
          `Helius Balances API error: ${response.status}`,
          undefined,
          { endpoint: sanitizeUrl(url), statusCode: response.status }
        )
      }

      const data = (await response.json()) as HeliusBalancesResponse

      const token = data.tokens?.find((t) => t.mint === mint)
      return token ? BigInt(token.amount) : 0n
    } catch (error) {
      // Only fallback for network/timeout errors, not all errors
      if (error instanceof NetworkError && error.message.includes('timeout')) {
        return this.getTokenBalanceFallback(owner, mint)
      }
      // Re-throw validation and other errors
      throw error
    }
  }

  /**
   * Fallback method to DAS API for token balance
   * Only called for specific recoverable errors
   * @internal
   */
  private async getTokenBalanceFallback(owner: string, mint: string): Promise<bigint> {
    const assets = await this.getAssetsByOwner(owner)
    const asset = assets.find((a) => a.mint === mint)
    return asset?.amount ?? 0n
  }

  /**
   * Check if provider supports real-time subscriptions
   *
   * Helius supports webhooks for real-time notifications,
   * but that requires server-side setup. Client-side subscriptions
   * are not directly supported.
   */
  supportsSubscriptions(): boolean {
    // Helius has webhooks but not client-side subscriptions
    // Return false for now, can be enhanced with webhook integration later
    return false
  }
}
