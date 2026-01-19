/**
 * Multi-Wallet Privacy Adapter
 *
 * Unified privacy adapter supporting multiple Ethereum wallets including
 * Rabby, Rainbow, MetaMask, and any EIP-1193 compatible wallet.
 *
 * @module wallet/ethereum/multi-wallet
 */

import { PrivacyEthereumWalletAdapter } from './privacy-adapter'
import type { HexString } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Supported wallet types
 */
export type WalletType =
  | 'metamask'
  | 'rabby'
  | 'rainbow'
  | 'coinbase'
  | 'trust'
  | 'brave'
  | 'frame'
  | 'phantom'
  | 'okx'
  | 'unknown'

/**
 * Wallet detection result
 */
export interface DetectedWallet {
  /** Wallet type identifier */
  type: WalletType
  /** Display name */
  name: string
  /** Wallet icon URL (if available) */
  icon?: string
  /** EIP-1193 provider */
  provider: EIP1193Provider
  /** Whether this wallet is the default (window.ethereum) */
  isDefault: boolean
  /** Wallet version (if available) */
  version?: string
  /** Chain ID if already connected */
  chainId?: number
}

/**
 * EIP-1193 provider interface
 */
export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
  isRabby?: boolean
  isRainbow?: boolean
  isCoinbaseWallet?: boolean
  isTrust?: boolean
  isBraveWallet?: boolean
  isFrame?: boolean
  isPhantom?: boolean
  isOKExWallet?: boolean
  providers?: EIP1193Provider[]
}

/**
 * Multi-wallet configuration options
 */
export interface MultiWalletConfig {
  /** Preferred wallet type (if multiple detected) */
  preferredWallet?: WalletType
  /** Auto-connect to last used wallet */
  autoConnect?: boolean
  /** Chain ID to request */
  chainId?: number
  /** Storage key for persisting wallet preference */
  storageKey?: string
}

/**
 * Wallet connection options
 */
export interface WalletConnectionOptions {
  /** Target chain ID */
  chainId?: number
  /** Request specific permissions */
  permissions?: string[]
  /** Silent connection (no popup if already connected) */
  silent?: boolean
}

// ─── Wallet Detection ─────────────────────────────────────────────────────────

/**
 * Wallet metadata for display
 */
const WALLET_METADATA: Record<WalletType, { name: string; icon?: string }> = {
  metamask: {
    name: 'MetaMask',
    icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg',
  },
  rabby: {
    name: 'Rabby',
    icon: 'https://rabby.io/assets/images/logo-rabby.svg',
  },
  rainbow: {
    name: 'Rainbow',
    icon: 'https://rainbow.me/favicon.ico',
  },
  coinbase: {
    name: 'Coinbase Wallet',
    icon: 'https://www.coinbase.com/favicon.ico',
  },
  trust: {
    name: 'Trust Wallet',
    icon: 'https://trustwallet.com/favicon.ico',
  },
  brave: {
    name: 'Brave Wallet',
    icon: 'https://brave.com/static-assets/images/brave-favicon.png',
  },
  frame: {
    name: 'Frame',
    icon: 'https://frame.sh/favicon.ico',
  },
  phantom: {
    name: 'Phantom',
    icon: 'https://phantom.app/favicon.ico',
  },
  okx: {
    name: 'OKX Wallet',
    icon: 'https://www.okx.com/favicon.ico',
  },
  unknown: {
    name: 'Unknown Wallet',
  },
}

/**
 * Detect wallet type from provider
 */
function detectWalletType(provider: EIP1193Provider): WalletType {
  // Check specific wallet flags (order matters - some wallets set multiple flags)
  if (provider.isRabby) return 'rabby'
  if (provider.isRainbow) return 'rainbow'
  if (provider.isCoinbaseWallet) return 'coinbase'
  if (provider.isTrust) return 'trust'
  if (provider.isBraveWallet) return 'brave'
  if (provider.isFrame) return 'frame'
  if (provider.isPhantom) return 'phantom'
  if (provider.isOKExWallet) return 'okx'
  if (provider.isMetaMask) return 'metamask'

  return 'unknown'
}

/**
 * Get global window.ethereum provider
 */
function getWindowEthereum(): EIP1193Provider | undefined {
  if (typeof window !== 'undefined' && 'ethereum' in window) {
    return window.ethereum as EIP1193Provider
  }
  return undefined
}

/**
 * Detect all available wallets
 *
 * @returns Array of detected wallets
 *
 * @example
 * ```typescript
 * const wallets = detectWallets()
 * console.log(wallets.map(w => w.name)) // ['MetaMask', 'Rabby']
 * ```
 */
export function detectWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = []
  const ethereum = getWindowEthereum()

  if (!ethereum) {
    return wallets
  }

  // Check for multiple providers (some wallets expose array)
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    for (const provider of ethereum.providers) {
      const type = detectWalletType(provider)
      const metadata = WALLET_METADATA[type]

      wallets.push({
        type,
        name: metadata.name,
        icon: metadata.icon,
        provider,
        isDefault: false,
      })
    }

    // Mark the default provider
    const defaultType = detectWalletType(ethereum)
    const defaultWallet = wallets.find(w => w.type === defaultType)
    if (defaultWallet) {
      defaultWallet.isDefault = true
    }
  } else {
    // Single provider
    const type = detectWalletType(ethereum)
    const metadata = WALLET_METADATA[type]

    wallets.push({
      type,
      name: metadata.name,
      icon: metadata.icon,
      provider: ethereum,
      isDefault: true,
    })
  }

  return wallets
}

/**
 * Check if a specific wallet is installed
 *
 * @param walletType - Wallet type to check
 * @returns Whether the wallet is available
 */
export function isWalletInstalled(walletType: WalletType): boolean {
  const wallets = detectWallets()
  return wallets.some(w => w.type === walletType)
}

/**
 * Get a specific wallet provider
 *
 * @param walletType - Wallet type to get
 * @returns Wallet provider or undefined
 */
export function getWalletProvider(walletType: WalletType): EIP1193Provider | undefined {
  const wallets = detectWallets()
  const wallet = wallets.find(w => w.type === walletType)
  return wallet?.provider
}

// ─── Multi-Wallet Adapter ─────────────────────────────────────────────────────

/**
 * MultiWalletPrivacyAdapter - Unified privacy adapter for multiple wallets
 *
 * Extends PrivacyEthereumWalletAdapter with multi-wallet detection and
 * connection management.
 *
 * @example
 * ```typescript
 * // Create adapter
 * const adapter = new MultiWalletPrivacyAdapter()
 *
 * // Detect available wallets
 * const wallets = adapter.getAvailableWallets()
 * console.log(wallets.map(w => w.name)) // ['MetaMask', 'Rabby']
 *
 * // Connect to specific wallet
 * await adapter.connectWallet('rabby')
 *
 * // Use privacy features
 * const meta = await adapter.generateStealthMetaAddress()
 * ```
 */
export class MultiWalletPrivacyAdapter extends PrivacyEthereumWalletAdapter {
  private currentWallet: DetectedWallet | null = null
  private config: MultiWalletConfig
  private walletListeners: Map<string, (...args: unknown[]) => void> = new Map()

  /**
   * Create a new multi-wallet privacy adapter
   *
   * @param config - Configuration options
   */
  constructor(config: MultiWalletConfig = {}) {
    // Initialize with default/preferred provider
    const wallets = detectWallets()
    const preferred = config.preferredWallet
      ? wallets.find(w => w.type === config.preferredWallet)
      : wallets.find(w => w.isDefault)

    super({
      chainId: config.chainId ?? 1,
    })

    this.config = {
      storageKey: 'sip-preferred-wallet',
      ...config,
    }

    if (preferred) {
      this.currentWallet = preferred
    }

    // Auto-connect if configured
    if (config.autoConnect && preferred) {
      this.connectWallet(preferred.type, { silent: true }).catch(() => {
        // Silent connection failed, user will need to explicitly connect
      })
    }
  }

  /**
   * Get all available wallets
   *
   * @returns Array of detected wallets
   */
  getAvailableWallets(): DetectedWallet[] {
    return detectWallets()
  }

  /**
   * Get currently connected wallet
   *
   * @returns Current wallet or null
   */
  getCurrentWallet(): DetectedWallet | null {
    return this.currentWallet
  }

  /**
   * Check if a specific wallet is available
   *
   * @param walletType - Wallet type to check
   * @returns Whether wallet is installed
   */
  isWalletAvailable(walletType: WalletType): boolean {
    return isWalletInstalled(walletType)
  }

  /**
   * Connect to a specific wallet
   *
   * @param walletType - Wallet type to connect
   * @param options - Connection options
   * @returns Connected address
   *
   * @example
   * ```typescript
   * // Connect to Rabby
   * const address = await adapter.connectWallet('rabby')
   *
   * // Connect to Rainbow with specific chain
   * const address = await adapter.connectWallet('rainbow', { chainId: 42161 })
   * ```
   */
  async connectWallet(
    walletType: WalletType,
    options: WalletConnectionOptions = {}
  ): Promise<HexString> {
    const wallets = detectWallets()
    const wallet = wallets.find(w => w.type === walletType)

    if (!wallet) {
      throw new Error(`Wallet ${walletType} is not installed`)
    }

    const provider = wallet.provider

    try {
      // Request accounts
      const accounts = options.silent
        ? await provider.request({ method: 'eth_accounts' })
        : await provider.request({ method: 'eth_requestAccounts' })

      const accountList = accounts as string[]
      if (!accountList || accountList.length === 0) {
        throw new Error('No accounts available')
      }

      // Switch chain if needed
      if (options.chainId) {
        await this.switchChainForProvider(provider, options.chainId)
      }

      // Update current wallet
      this.currentWallet = {
        ...wallet,
        chainId: options.chainId ?? this.config.chainId,
      }

      // Set up event listeners
      this.setupWalletListeners(provider)

      // Persist preference
      this.persistWalletPreference(walletType)

      return accountList[0] as HexString
    } catch (error) {
      // Handle user rejection
      if ((error as { code?: number }).code === 4001) {
        throw new Error('User rejected connection request')
      }
      throw error
    }
  }

  /**
   * Disconnect from current wallet
   */
  async disconnectWallet(): Promise<void> {
    if (this.currentWallet?.provider) {
      // Remove listeners
      this.removeWalletListeners(this.currentWallet.provider)
    }

    this.currentWallet = null
    this.clearWalletPreference()
  }

  /**
   * Switch chain for a specific provider
   *
   * Unlike the base class switchChain(), this works with any EIP-1193 provider.
   * Useful when working with multiple wallets or dynamically detected providers.
   *
   * @param provider - EIP-1193 provider to switch chain on
   * @param chainId - Target chain ID
   */
  async switchChainForProvider(provider: EIP1193Provider, chainId: number): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch (error) {
      // Chain not added, try to add it
      if ((error as { code?: number }).code === 4902) {
        await this.addChain(provider, chainId)
      } else {
        throw error
      }
    }
  }

  /**
   * Add a chain to the wallet
   */
  private async addChain(provider: EIP1193Provider, chainId: number): Promise<void> {
    const chainConfigs: Record<number, { name: string; rpcUrl: string; symbol: string; explorer: string }> = {
      1: { name: 'Ethereum', rpcUrl: 'https://eth.llamarpc.com', symbol: 'ETH', explorer: 'https://etherscan.io' },
      42161: { name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc', symbol: 'ETH', explorer: 'https://arbiscan.io' },
      10: { name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io', symbol: 'ETH', explorer: 'https://optimistic.etherscan.io' },
      8453: { name: 'Base', rpcUrl: 'https://mainnet.base.org', symbol: 'ETH', explorer: 'https://basescan.org' },
      137: { name: 'Polygon', rpcUrl: 'https://polygon-rpc.com', symbol: 'MATIC', explorer: 'https://polygonscan.com' },
    }

    const config = chainConfigs[chainId]
    if (!config) {
      throw new Error(`Unknown chain ID: ${chainId}`)
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${chainId.toString(16)}`,
        chainName: config.name,
        nativeCurrency: { name: config.symbol, symbol: config.symbol, decimals: 18 },
        rpcUrls: [config.rpcUrl],
        blockExplorerUrls: [config.explorer],
      }],
    })
  }

  /**
   * Sign a personal message with the connected wallet
   *
   * Convenience method that accepts a string message directly.
   * For Uint8Array messages, use the inherited signMessage() method.
   *
   * @param message - Message string to sign
   * @returns Signature as hex string
   */
  async signPersonalMessage(message: string): Promise<HexString> {
    if (!this.currentWallet) {
      throw new Error('No wallet connected')
    }

    const accounts = await this.currentWallet.provider.request({
      method: 'eth_accounts',
    }) as string[]

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available')
    }

    const signature = await this.currentWallet.provider.request({
      method: 'personal_sign',
      params: [message, accounts[0]],
    })

    return signature as HexString
  }

  /**
   * Sign typed data (EIP-712 v4) with the connected wallet
   *
   * Convenience method that accepts a generic typed data object.
   * For strict EIP712TypedData, use the inherited signTypedData() method.
   *
   * @param typedData - Typed data object to sign
   * @returns Signature as hex string
   */
  async signTypedDataV4(typedData: Record<string, unknown>): Promise<HexString> {
    if (!this.currentWallet) {
      throw new Error('No wallet connected')
    }

    const accounts = await this.currentWallet.provider.request({
      method: 'eth_accounts',
    }) as string[]

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available')
    }

    const signature = await this.currentWallet.provider.request({
      method: 'eth_signTypedData_v4',
      params: [accounts[0], JSON.stringify(typedData)],
    })

    return signature as HexString
  }

  /**
   * Set up wallet event listeners
   */
  private setupWalletListeners(provider: EIP1193Provider): void {
    if (!provider.on) return

    const accountsHandler = (accounts: unknown) => {
      const accountList = accounts as string[]
      if (accountList.length === 0) {
        // Disconnected
        this.disconnectWallet()
      }
    }

    const chainHandler = (chainId: unknown) => {
      if (this.currentWallet) {
        this.currentWallet.chainId = parseInt(chainId as string, 16)
      }
    }

    provider.on('accountsChanged', accountsHandler)
    provider.on('chainChanged', chainHandler)

    this.walletListeners.set('accountsChanged', accountsHandler)
    this.walletListeners.set('chainChanged', chainHandler)
  }

  /**
   * Remove wallet event listeners
   */
  private removeWalletListeners(provider: EIP1193Provider): void {
    if (!provider.removeListener) return

    for (const [event, handler] of this.walletListeners) {
      provider.removeListener(event, handler)
    }

    this.walletListeners.clear()
  }

  /**
   * Persist wallet preference to storage
   */
  private persistWalletPreference(walletType: WalletType): void {
    if (typeof localStorage !== 'undefined' && this.config.storageKey) {
      localStorage.setItem(this.config.storageKey, walletType)
    }
  }

  /**
   * Clear wallet preference from storage
   */
  private clearWalletPreference(): void {
    if (typeof localStorage !== 'undefined' && this.config.storageKey) {
      localStorage.removeItem(this.config.storageKey)
    }
  }

  /**
   * Load persisted wallet preference
   *
   * @returns Preferred wallet type or undefined
   */
  getPersistedWalletPreference(): WalletType | undefined {
    if (typeof localStorage !== 'undefined' && this.config.storageKey) {
      const stored = localStorage.getItem(this.config.storageKey)
      return stored as WalletType | undefined
    }
    return undefined
  }
}

/**
 * Create a multi-wallet privacy adapter
 *
 * @param config - Configuration options
 * @returns MultiWalletPrivacyAdapter instance
 *
 * @example
 * ```typescript
 * // Basic usage
 * const adapter = createMultiWalletAdapter()
 *
 * // With preferred wallet
 * const adapter = createMultiWalletAdapter({
 *   preferredWallet: 'rabby',
 *   autoConnect: true,
 * })
 * ```
 */
export function createMultiWalletAdapter(
  config: MultiWalletConfig = {}
): MultiWalletPrivacyAdapter {
  return new MultiWalletPrivacyAdapter(config)
}

/**
 * Create adapter for Rabby wallet
 */
export function createRabbyPrivacyAdapter(): MultiWalletPrivacyAdapter {
  return new MultiWalletPrivacyAdapter({ preferredWallet: 'rabby' })
}

/**
 * Create adapter for Rainbow wallet
 */
export function createRainbowPrivacyAdapter(): MultiWalletPrivacyAdapter {
  return new MultiWalletPrivacyAdapter({ preferredWallet: 'rainbow' })
}

export default MultiWalletPrivacyAdapter
