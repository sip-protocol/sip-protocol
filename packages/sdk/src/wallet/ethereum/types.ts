/**
 * Ethereum Wallet Types
 *
 * Type definitions for Ethereum wallet integration.
 * Follows EIP-1193 (Provider API) and EIP-712 (Typed Data Signing).
 */

import type { HexString } from '@sip-protocol/types'

// ============================================================================
// EIP-1193 Provider Types
// ============================================================================

/**
 * EIP-1193 Provider interface
 * Standard interface for Ethereum providers (MetaMask, etc.)
 */
export interface EIP1193Provider {
  /** Make an Ethereum JSON-RPC request */
  request<T = unknown>(args: EIP1193RequestArguments): Promise<T>
  /** Event emitter for provider events */
  on(event: string, handler: (...args: unknown[]) => void): void
  removeListener(event: string, handler: (...args: unknown[]) => void): void
  /** Provider is MetaMask */
  isMetaMask?: boolean
  /** Provider is Coinbase Wallet */
  isCoinbaseWallet?: boolean
  /** Selected address (may be undefined before connection) */
  selectedAddress?: string | null
  /** Chain ID in hex format */
  chainId?: string
  /** Whether provider is connected */
  isConnected?(): boolean
}

/**
 * EIP-1193 Request arguments
 */
export interface EIP1193RequestArguments {
  method: string
  params?: unknown[] | Record<string, unknown>
}

/**
 * EIP-1193 Provider events
 */
export type EIP1193Event =
  | 'connect'
  | 'disconnect'
  | 'chainChanged'
  | 'accountsChanged'
  | 'message'

/**
 * EIP-1193 Connect info
 */
export interface EIP1193ConnectInfo {
  chainId: string
}

/**
 * EIP-1193 Provider RPC error
 */
export interface EIP1193ProviderRpcError extends Error {
  code: number
  data?: unknown
}

// ============================================================================
// EIP-712 Typed Data Types
// ============================================================================

/**
 * EIP-712 Typed data domain
 */
export interface EIP712Domain {
  name?: string
  version?: string
  chainId?: number
  verifyingContract?: string
  salt?: string
}

/**
 * EIP-712 Type definition
 */
export interface EIP712TypeDefinition {
  name: string
  type: string
}

/**
 * EIP-712 Types object
 */
export interface EIP712Types {
  EIP712Domain?: EIP712TypeDefinition[]
  [key: string]: EIP712TypeDefinition[] | undefined
}

/**
 * EIP-712 Typed data for signing
 */
export interface EIP712TypedData {
  domain: EIP712Domain
  types: EIP712Types
  primaryType: string
  message: Record<string, unknown>
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Ethereum transaction request
 */
export interface EthereumTransactionRequest {
  /** Sender address */
  from?: string
  /** Recipient address */
  to?: string
  /** Value in wei (hex) */
  value?: string
  /** Transaction data (hex) */
  data?: string
  /** Gas limit (hex) */
  gas?: string
  /** Gas price (hex) - legacy */
  gasPrice?: string
  /** Max fee per gas (hex) - EIP-1559 */
  maxFeePerGas?: string
  /** Max priority fee per gas (hex) - EIP-1559 */
  maxPriorityFeePerGas?: string
  /** Nonce (hex) */
  nonce?: string
  /** Chain ID */
  chainId?: number
}

/**
 * Ethereum transaction receipt
 */
export interface EthereumTransactionReceipt {
  /** Transaction hash */
  transactionHash: string
  /** Block number */
  blockNumber: string
  /** Block hash */
  blockHash: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string | null
  /** Gas used */
  gasUsed: string
  /** Effective gas price */
  effectiveGasPrice: string
  /** Status (1 = success, 0 = failure) */
  status: string
  /** Contract address (if deployment) */
  contractAddress: string | null
}

// ============================================================================
// Token Types (ERC-20)
// ============================================================================

/**
 * Token metadata for wallet_watchAsset
 */
export interface EthereumTokenMetadata {
  /** Token contract address */
  address: string
  /** Token symbol */
  symbol: string
  /** Token decimals */
  decimals: number
  /** Token image URL (optional) */
  image?: string
}

// ============================================================================
// Chain Types
// ============================================================================

/**
 * Common Ethereum chain IDs
 */
export const EthereumChainId = {
  MAINNET: 1,
  GOERLI: 5,
  SEPOLIA: 11155111,
  POLYGON: 137,
  POLYGON_MUMBAI: 80001,
  ARBITRUM: 42161,
  ARBITRUM_GOERLI: 421613,
  OPTIMISM: 10,
  OPTIMISM_GOERLI: 420,
  BASE: 8453,
  BASE_GOERLI: 84531,
  LOCALHOST: 1337,
} as const

export type EthereumChainIdType = (typeof EthereumChainId)[keyof typeof EthereumChainId]

/**
 * Chain metadata for wallet_addEthereumChain
 */
export interface EthereumChainMetadata {
  chainId: string // hex
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls?: string[]
  iconUrls?: string[]
}

/**
 * Ethereum wallet name/type
 */
export type EthereumWalletName = 'metamask' | 'coinbase' | 'walletconnect' | 'generic'

// ============================================================================
// Adapter Configuration
// ============================================================================

/**
 * Ethereum adapter configuration
 */
export interface EthereumAdapterConfig {
  /** Wallet to connect to */
  wallet?: EthereumWalletName
  /** Target chain ID */
  chainId?: number
  /** RPC endpoint URL (for balance queries) */
  rpcEndpoint?: string
  /** Custom provider (for testing) */
  provider?: EIP1193Provider
}

// ============================================================================
// Provider Detection & Utilities
// ============================================================================

/**
 * Get the injected Ethereum provider
 */
export function getEthereumProvider(
  wallet: EthereumWalletName = 'metamask'
): EIP1193Provider | undefined {
  if (typeof window === 'undefined') return undefined

  const win = window as unknown as {
    ethereum?: EIP1193Provider & {
      providers?: EIP1193Provider[]
    }
    coinbaseWalletExtension?: EIP1193Provider
  }

  // Handle multiple injected providers
  if (win.ethereum?.providers?.length) {
    switch (wallet) {
      case 'metamask':
        return win.ethereum.providers.find((p) => p.isMetaMask)
      case 'coinbase':
        return win.ethereum.providers.find((p) => p.isCoinbaseWallet)
      default:
        return win.ethereum.providers[0]
    }
  }

  switch (wallet) {
    case 'metamask':
      return win.ethereum?.isMetaMask ? win.ethereum : undefined
    case 'coinbase':
      return win.coinbaseWalletExtension ?? (win.ethereum?.isCoinbaseWallet ? win.ethereum : undefined)
    case 'generic':
    default:
      return win.ethereum
  }
}

/**
 * Detect which Ethereum wallets are installed
 */
export function detectEthereumWallets(): EthereumWalletName[] {
  if (typeof window === 'undefined') return []

  const detected: EthereumWalletName[] = []
  const win = window as unknown as {
    ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] }
    coinbaseWalletExtension?: EIP1193Provider
  }

  if (win.ethereum?.providers?.length) {
    if (win.ethereum.providers.some((p) => p.isMetaMask)) detected.push('metamask')
    if (win.ethereum.providers.some((p) => p.isCoinbaseWallet)) detected.push('coinbase')
  } else {
    if (win.ethereum?.isMetaMask) detected.push('metamask')
    if (win.ethereum?.isCoinbaseWallet || win.coinbaseWalletExtension) detected.push('coinbase')
  }

  if (win.ethereum && detected.length === 0) {
    detected.push('generic')
  }

  return detected
}

/**
 * Convert number to hex string with 0x prefix
 */
export function toHex(value: number | bigint): HexString {
  return `0x${value.toString(16)}` as HexString
}

/**
 * Convert hex string to bigint
 */
export function fromHex(hex: string): bigint {
  return BigInt(hex)
}

/**
 * Convert hex string to number
 */
export function hexToNumber(hex: string): number {
  return Number(BigInt(hex))
}

/**
 * Pad address to checksum format
 */
export function normalizeAddress(address: string): HexString {
  return address.toLowerCase() as HexString
}

/**
 * Get default RPC endpoint for chain
 */
export function getDefaultRpcEndpoint(chainId: number): string {
  switch (chainId) {
    case EthereumChainId.MAINNET:
      return 'https://eth.llamarpc.com'
    case EthereumChainId.GOERLI:
      return 'https://rpc.ankr.com/eth_goerli'
    case EthereumChainId.SEPOLIA:
      return 'https://rpc.sepolia.org'
    case EthereumChainId.POLYGON:
      return 'https://polygon-rpc.com'
    case EthereumChainId.ARBITRUM:
      return 'https://arb1.arbitrum.io/rpc'
    case EthereumChainId.OPTIMISM:
      return 'https://mainnet.optimism.io'
    case EthereumChainId.BASE:
      return 'https://mainnet.base.org'
    default:
      return 'http://localhost:8545'
  }
}
