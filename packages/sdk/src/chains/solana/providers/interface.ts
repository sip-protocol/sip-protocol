/**
 * Solana RPC Provider Interface
 *
 * SIP is RPC-provider-agnostic — developers choose their preferred provider.
 * Each provider has unique moats we leverage through this unified interface.
 *
 * @example
 * ```typescript
 * import { createProvider, scanForPayments } from '@sip-protocol/sdk'
 *
 * // Helius — efficient DAS queries (recommended for production)
 * const helius = createProvider('helius', { apiKey: process.env.HELIUS_API_KEY })
 *
 * // Generic — standard RPC, no API key needed
 * const generic = createProvider('generic', { connection })
 *
 * // Same API, different backends
 * const payments = await scanForPayments({
 *   provider: helius,
 *   viewingPrivateKey,
 *   spendingPublicKey,
 * })
 * ```
 *
 * @packageDocumentation
 */

import { HeliusProvider, type HeliusProviderConfig } from './helius'
import { GenericProvider } from './generic'
import { ValidationError } from '../../../errors'

/**
 * Token asset information returned by providers
 */
export interface TokenAsset {
  /** SPL token mint address */
  mint: string
  /** Token amount in smallest units */
  amount: bigint
  /** Token decimals */
  decimals: number
  /** Token symbol (e.g., 'USDC') */
  symbol?: string
  /** Token name (e.g., 'USD Coin') */
  name?: string
  /** Token logo URI */
  logoUri?: string
}

/**
 * Configuration for RPC providers
 */
export interface ProviderConfig {
  /** API key for premium providers (Helius, QuickNode) */
  apiKey?: string
  /** Custom RPC endpoint */
  endpoint?: string
  /** Solana cluster */
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}

/**
 * Unified interface for Solana RPC providers
 *
 * All provider adapters must implement this interface to ensure
 * consistent behavior across different RPC backends.
 */
export interface SolanaRPCProvider {
  /** Provider name for logging/debugging */
  readonly name: string

  /**
   * Get all token assets owned by an address
   *
   * @param owner - Solana address (base58)
   * @returns Array of token assets with balances
   */
  getAssetsByOwner(owner: string): Promise<TokenAsset[]>

  /**
   * Get token balance for a specific mint
   *
   * @param owner - Solana address (base58)
   * @param mint - SPL token mint address (base58)
   * @returns Token balance in smallest units, 0n if no balance
   */
  getTokenBalance(owner: string, mint: string): Promise<bigint>

  /**
   * Check if provider supports real-time subscriptions
   *
   * @returns true if subscribeToTransfers is available
   */
  supportsSubscriptions(): boolean

  /**
   * Subscribe to token transfers for an address (optional)
   *
   * Only available if supportsSubscriptions() returns true.
   *
   * @param address - Solana address to watch
   * @param callback - Called when a transfer is detected
   * @returns Unsubscribe function
   */
  subscribeToTransfers?(
    address: string,
    callback: (asset: TokenAsset) => void
  ): Promise<() => void>
}

/**
 * Provider type for factory function
 */
export type ProviderType = 'helius' | 'quicknode' | 'triton' | 'generic'

/**
 * Extended config for generic provider that accepts a Connection
 */
export interface GenericProviderConfig extends ProviderConfig {
  /** Existing Solana Connection object */
  connection?: unknown // Typed as unknown to avoid @solana/web3.js dependency in interface
}

/**
 * Create an RPC provider instance
 *
 * @param type - Provider type ('helius', 'quicknode', 'triton', 'generic')
 * @param config - Provider configuration
 * @returns Configured provider instance
 *
 * @example
 * ```typescript
 * // Helius with API key
 * const helius = createProvider('helius', {
 *   apiKey: process.env.HELIUS_API_KEY,
 *   cluster: 'devnet'
 * })
 *
 * // Generic with existing connection
 * const generic = createProvider('generic', { connection })
 *
 * // Generic with endpoint
 * const devnet = createProvider('generic', {
 *   endpoint: 'https://api.devnet.solana.com'
 * })
 * ```
 */
export function createProvider(
  type: 'helius',
  config: ProviderConfig & { apiKey: string }
): SolanaRPCProvider
export function createProvider(
  type: 'generic',
  config: GenericProviderConfig
): SolanaRPCProvider
export function createProvider(
  type: ProviderType,
  config: ProviderConfig | GenericProviderConfig
): SolanaRPCProvider
export function createProvider(
  type: ProviderType,
  config: ProviderConfig | GenericProviderConfig
): SolanaRPCProvider {
  // Validate config before type casting
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Provider config is required', 'config')
  }

  switch (type) {
    case 'helius': {
      // Validate required fields for HeliusProvider
      const heliusConfig = config as HeliusProviderConfig
      if (!heliusConfig.apiKey || typeof heliusConfig.apiKey !== 'string') {
        throw new ValidationError(
          'Helius provider requires an API key',
          'apiKey'
        )
      }
      if (heliusConfig.cluster && !['mainnet-beta', 'devnet'].includes(heliusConfig.cluster)) {
        throw new ValidationError(
          'Invalid cluster. Must be "mainnet-beta" or "devnet"',
          'cluster'
        )
      }
      return new HeliusProvider(heliusConfig)
    }
    case 'generic': {
      // Validate GenericProvider config
      const genericConfig = config as GenericProviderConfig
      // Must have either connection, endpoint, or cluster
      if (!genericConfig.connection && !genericConfig.endpoint && !genericConfig.cluster) {
        throw new ValidationError(
          'Generic provider requires either connection, endpoint, or cluster',
          'config'
        )
      }
      return new GenericProvider(genericConfig)
    }
    case 'quicknode':
    case 'triton':
      throw new Error(
        `Provider '${type}' is not yet implemented. ` +
        `Use 'helius' or 'generic' for now. ` +
        `See https://github.com/sip-protocol/sip-protocol/issues/${type === 'quicknode' ? '494' : '495'}`
      )
    default:
      throw new Error(`Unknown provider type: ${type}`)
  }
}
