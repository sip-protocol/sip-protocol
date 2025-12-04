/**
 * Sui Wallet Types
 *
 * Type definitions for Sui wallet adapters.
 * Supports Sui Wallet, Ethos, Suiet, and other Sui wallets.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Supported Sui wallet names
 */
export type SuiWalletName = 'sui-wallet' | 'ethos' | 'suiet' | 'generic'

/**
 * Sui account information
 */
export interface SuiAccountInfo {
  /** Account address (0x-prefixed hex, 64 characters) */
  address: string
  /** Public key (0x-prefixed hex) */
  publicKey: string
}

/**
 * Sui transaction block
 */
export interface SuiTransactionBlock {
  /** Transaction kind */
  kind: 'moveCall' | 'transferObjects' | 'splitCoins' | 'mergeCoins' | 'publish'
  /** Transaction data */
  data: any
  /** Sender address */
  sender?: string
  /** Gas budget */
  gasBudget?: string
  /** Gas price */
  gasPrice?: string
}

/**
 * Signed Sui transaction
 */
export interface SignedSuiTransaction {
  /** Transaction signature */
  signature: string
  /** Signed transaction bytes */
  transactionBlockBytes: string
}

/**
 * Sui sign message input
 */
export interface SuiSignMessageInput {
  /** Message bytes to sign */
  message: Uint8Array
  /** Account to sign with */
  account?: SuiAccountInfo
}

/**
 * Sui sign message response
 */
export interface SuiSignMessageResponse {
  /** Signature (base64 or hex) */
  signature: string
  /** Message bytes (base64) */
  messageBytes: string
}

/**
 * Sui Wallet API interface
 *
 * @see https://docs.sui.io/standards/wallet-standard
 */
export interface SuiWalletAPI {
  /**
   * Check if wallet has permissions
   */
  hasPermissions(permissions?: string[]): Promise<boolean>

  /**
   * Request wallet permissions
   */
  requestPermissions(permissions?: string[]): Promise<boolean>

  /**
   * Get connected accounts
   */
  getAccounts(): Promise<SuiAccountInfo[]>

  /**
   * Sign a transaction block
   */
  signTransactionBlock(input: {
    transactionBlock: SuiTransactionBlock | any
    account?: SuiAccountInfo
    chain?: string
  }): Promise<SignedSuiTransaction>

  /**
   * Sign and execute a transaction block
   */
  signAndExecuteTransactionBlock(input: {
    transactionBlock: SuiTransactionBlock | any
    account?: SuiAccountInfo
    chain?: string
    options?: {
      showEffects?: boolean
      showEvents?: boolean
      showObjectChanges?: boolean
      showBalanceChanges?: boolean
    }
  }): Promise<{
    digest: string
    effects?: any
    events?: any[]
    objectChanges?: any[]
    balanceChanges?: any[]
  }>

  /**
   * Sign a message
   */
  signMessage(input: SuiSignMessageInput): Promise<SuiSignMessageResponse>

  /**
   * Event listeners
   */
  on?: (event: string, handler: (...args: any[]) => void) => void
  off?: (event: string, handler: (...args: any[]) => void) => void
}

/**
 * Ethos wallet API interface
 */
export interface EthosAPI extends SuiWalletAPI {
  // Ethos-specific methods can be added here
}

/**
 * Generic Sui wallet provider interface
 */
export interface SuiWalletProvider {
  hasPermissions(permissions?: string[]): Promise<boolean>
  requestPermissions(permissions?: string[]): Promise<boolean>
  getAccounts(): Promise<SuiAccountInfo[]>
  signTransactionBlock(input: {
    transactionBlock: SuiTransactionBlock | any
    account?: SuiAccountInfo
    chain?: string
  }): Promise<SignedSuiTransaction>
  signAndExecuteTransactionBlock(input: {
    transactionBlock: SuiTransactionBlock | any
    account?: SuiAccountInfo
    chain?: string
    options?: any
  }): Promise<{ digest: string; [key: string]: any }>
  signMessage(input: SuiSignMessageInput): Promise<SuiSignMessageResponse>

  // Event handling
  on?: (event: string, handler: (...args: any[]) => void) => void
  off?: (event: string, handler: (...args: any[]) => void) => void
}

/**
 * Window interface for Sui wallets
 */
declare global {
  interface Window {
    suiWallet?: SuiWalletAPI
    ethos?: EthosAPI
    suiet?: SuiWalletProvider
    sui?: SuiWalletProvider
  }
}

/**
 * Sui wallet adapter configuration
 */
export interface SuiAdapterConfig {
  /** Wallet name (default: 'sui-wallet') */
  wallet?: SuiWalletName
  /** Custom provider (for testing) */
  provider?: SuiWalletProvider
  /** Network name (default: 'mainnet') */
  network?: string
  /** RPC endpoint (optional) */
  rpcEndpoint?: string
}

/**
 * Get Sui wallet provider from window
 */
export function getSuiProvider(walletName: SuiWalletName): SuiWalletProvider | undefined {
  if (typeof window === 'undefined') return undefined

  switch (walletName) {
    case 'sui-wallet':
      return window.suiWallet as SuiWalletProvider | undefined
    case 'ethos':
      return window.ethos as SuiWalletProvider | undefined
    case 'suiet':
      return window.suiet
    case 'generic':
      return window.sui
    default:
      return undefined
  }
}

/**
 * Convert Sui public key to hex format
 *
 * Ensures proper 0x prefix and formatting
 */
export function suiPublicKeyToHex(publicKey: string | Uint8Array): HexString {
  if (typeof publicKey === 'string') {
    // Already a string, ensure 0x prefix
    return (publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`) as HexString
  }

  // Convert Uint8Array to hex
  const hex = Array.from(publicKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}` as HexString
}

/**
 * Default RPC endpoints for Sui networks
 */
export const DEFAULT_SUI_RPC_ENDPOINTS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  localnet: 'http://localhost:9000',
}

/**
 * Get default RPC endpoint for network
 */
export function getDefaultSuiRpcEndpoint(network: string): string {
  return DEFAULT_SUI_RPC_ENDPOINTS[network.toLowerCase()] ?? DEFAULT_SUI_RPC_ENDPOINTS.mainnet
}
