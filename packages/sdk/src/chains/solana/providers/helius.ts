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
    balance?: number
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
  result: {
    items: HeliusDASAsset[]
    total: number
    limit: number
    page: number
    cursor?: string
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
 */
export interface HeliusProviderConfig extends ProviderConfig {
  /** Helius API key (required) */
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
  private apiKey: string
  private cluster: 'mainnet-beta' | 'devnet'
  private rpcUrl: string
  private restUrl: string

  constructor(config: HeliusProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Helius API key is required. Get one at https://dev.helius.xyz')
    }

    this.apiKey = config.apiKey
    this.cluster = config.cluster ?? 'mainnet-beta'

    // RPC endpoint for DAS API
    this.rpcUrl = this.cluster === 'devnet'
      ? `https://devnet.helius-rpc.com/?api-key=${this.apiKey}`
      : `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`

    // REST endpoint for balances API
    this.restUrl = this.cluster === 'devnet'
      ? `https://api-devnet.helius.xyz/v0`
      : `https://api.helius.xyz/v0`
  }

  /**
   * Get all token assets owned by an address using DAS API
   *
   * Uses getAssetsByOwner for comprehensive asset information including
   * NFTs and fungible tokens with metadata.
   */
  async getAssetsByOwner(owner: string): Promise<TokenAsset[]> {
    const assets: TokenAsset[] = []
    let page = 1
    const limit = 1000
    let hasMore = true

    while (hasMore) {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(`Helius API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as HeliusDASResponse

      if (data.result?.items) {
        for (const item of data.result.items) {
          // Skip NFTs (interface !== 'FungibleToken' and 'FungibleAsset')
          if (item.interface !== 'FungibleToken' && item.interface !== 'FungibleAsset') {
            continue
          }

          // Extract token info
          const tokenInfo = item.token_info
          if (!tokenInfo?.balance) continue

          assets.push({
            mint: item.id,
            amount: BigInt(tokenInfo.balance),
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
      if (page > 100) {
        console.warn('[HeliusProvider] Reached page limit (100), stopping pagination')
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
    try {
      const url = `${this.restUrl}/addresses/${owner}/balances?api-key=${this.apiKey}`

      const response = await fetch(url)

      if (!response.ok) {
        // Fallback to DAS if balances API fails
        const assets = await this.getAssetsByOwner(owner)
        const asset = assets.find((a) => a.mint === mint)
        return asset?.amount ?? 0n
      }

      const data = (await response.json()) as HeliusBalancesResponse

      const token = data.tokens?.find((t) => t.mint === mint)
      return token ? BigInt(token.amount) : 0n
    } catch (error) {
      console.warn('[HeliusProvider] getTokenBalance error, falling back to DAS:', error)
      const assets = await this.getAssetsByOwner(owner)
      const asset = assets.find((a) => a.mint === mint)
      return asset?.amount ?? 0n
    }
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
