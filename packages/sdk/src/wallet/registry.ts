/**
 * Wallet Registry
 *
 * Manages wallet adapter registration and discovery.
 * Allows applications to register and detect available wallets.
 */

import type {
  ChainId,
  WalletAdapter,
  PrivateWalletAdapter,
  WalletInfo,
  WalletRegistryEntry,
  WalletAdapterFactory,
} from '@sip-protocol/types'

/**
 * Global wallet registry
 *
 * Manages available wallet adapters and provides discovery functionality.
 *
 * @example
 * ```typescript
 * // Register a wallet adapter
 * walletRegistry.register({
 *   info: {
 *     id: 'phantom',
 *     name: 'Phantom',
 *     chains: ['solana'],
 *     supportsPrivacy: false,
 *   },
 *   factory: () => new PhantomWalletAdapter(),
 *   detect: () => typeof window !== 'undefined' && 'phantom' in window,
 * })
 *
 * // Get available wallets for a chain
 * const solanaWallets = walletRegistry.getAvailableWallets('solana')
 *
 * // Create a wallet adapter
 * const wallet = walletRegistry.create('phantom')
 * ```
 */
class WalletRegistry {
  private entries: Map<string, WalletRegistryEntry> = new Map()

  /**
   * Register a wallet adapter
   *
   * @param entry - The wallet registry entry
   */
  register(entry: WalletRegistryEntry): void {
    this.entries.set(entry.info.id, entry)
  }

  /**
   * Unregister a wallet adapter
   *
   * @param id - The wallet identifier
   */
  unregister(id: string): void {
    this.entries.delete(id)
  }

  /**
   * Get wallet info by ID
   *
   * @param id - The wallet identifier
   * @returns The wallet info or undefined
   */
  getInfo(id: string): WalletInfo | undefined {
    return this.entries.get(id)?.info
  }

  /**
   * Get all registered wallet infos
   *
   * @returns Array of all wallet infos
   */
  getAllWallets(): WalletInfo[] {
    return Array.from(this.entries.values()).map((entry) => entry.info)
  }

  /**
   * Get wallets that support a specific chain
   *
   * @param chain - The chain to filter by
   * @returns Array of wallet infos that support the chain
   */
  getWalletsForChain(chain: ChainId): WalletInfo[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.info.chains.includes(chain))
      .map((entry) => entry.info)
  }

  /**
   * Get available (detected) wallets
   *
   * @param chain - Optional chain to filter by
   * @returns Array of wallet infos for detected wallets
   */
  getAvailableWallets(chain?: ChainId): WalletInfo[] {
    return Array.from(this.entries.values())
      .filter((entry) => {
        // Check if detected
        if (!entry.detect()) return false
        // Check chain if specified
        if (chain && !entry.info.chains.includes(chain)) return false
        return true
      })
      .map((entry) => entry.info)
  }

  /**
   * Get wallets that support privacy features
   *
   * @param chain - Optional chain to filter by
   * @returns Array of wallet infos with privacy support
   */
  getPrivacyWallets(chain?: ChainId): WalletInfo[] {
    return Array.from(this.entries.values())
      .filter((entry) => {
        if (!entry.info.supportsPrivacy) return false
        if (chain && !entry.info.chains.includes(chain)) return false
        return true
      })
      .map((entry) => entry.info)
  }

  /**
   * Check if a wallet is available (detected)
   *
   * @param id - The wallet identifier
   * @returns True if wallet is detected
   */
  isAvailable(id: string): boolean {
    const entry = this.entries.get(id)
    return entry ? entry.detect() : false
  }

  /**
   * Create a wallet adapter instance
   *
   * @param id - The wallet identifier
   * @returns A new wallet adapter instance
   * @throws If wallet is not registered
   */
  create(id: string): WalletAdapter | PrivateWalletAdapter {
    const entry = this.entries.get(id)
    if (!entry) {
      throw new Error(`Wallet '${id}' is not registered`)
    }
    return entry.factory()
  }

  /**
   * Create and connect a wallet adapter
   *
   * @param id - The wallet identifier
   * @returns A connected wallet adapter
   * @throws If wallet is not registered or connection fails
   */
  async connect(id: string): Promise<WalletAdapter | PrivateWalletAdapter> {
    const wallet = this.create(id)
    await wallet.connect()
    return wallet
  }

  /**
   * Clear all registered wallets
   */
  clear(): void {
    this.entries.clear()
  }
}

/**
 * Global wallet registry instance
 */
export const walletRegistry = new WalletRegistry()

/**
 * Helper to register a wallet adapter
 */
export function registerWallet(entry: WalletRegistryEntry): void {
  walletRegistry.register(entry)
}

/**
 * Helper to create a wallet adapter factory
 */
export function createWalletFactory<T extends WalletAdapter | PrivateWalletAdapter>(
  AdapterClass: new () => T
): WalletAdapterFactory {
  return () => new AdapterClass()
}

/**
 * Check if an adapter is a PrivateWalletAdapter
 */
export function isPrivateWalletAdapter(
  adapter: WalletAdapter | PrivateWalletAdapter
): adapter is PrivateWalletAdapter {
  return (
    'supportsStealthAddresses' in adapter &&
    typeof adapter.supportsStealthAddresses === 'function'
  )
}
