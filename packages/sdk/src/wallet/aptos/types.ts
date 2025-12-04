/**
 * Aptos Wallet Types
 *
 * Type definitions for Aptos wallet adapters.
 * Supports Petra, Martian, Pontem, and other Aptos wallets.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Supported Aptos wallet names
 */
export type AptosWalletName = 'petra' | 'martian' | 'pontem' | 'generic'

/**
 * Aptos network configuration
 */
export interface AptosNetwork {
  name: string
  chainId: string
  url?: string
}

/**
 * Aptos account information
 */
export interface AptosAccountInfo {
  /** Account address (0x-prefixed hex, 64 characters) */
  address: string
  /** Public key (0x-prefixed hex) */
  publicKey: string
  /** Authentication key (optional) */
  authKey?: string
}

/**
 * Aptos transaction payload
 */
export interface AptosTransactionPayload {
  /** Transaction type */
  type: 'entry_function_payload' | 'script_payload' | 'module_bundle_payload'
  /** Function identifier (e.g., "0x1::coin::transfer") */
  function?: string
  /** Type arguments */
  type_arguments?: string[]
  /** Function arguments */
  arguments?: any[]
}

/**
 * Aptos transaction options
 */
export interface AptosTransactionOptions {
  /** Maximum gas amount */
  max_gas_amount?: string
  /** Gas unit price */
  gas_unit_price?: string
  /** Expiration timestamp (seconds) */
  expiration_timestamp_secs?: string
  /** Sequence number */
  sequence_number?: string
}

/**
 * Aptos transaction object
 */
export interface AptosTransaction {
  /** Transaction payload */
  payload: AptosTransactionPayload
  /** Transaction options */
  options?: AptosTransactionOptions
}

/**
 * Signed Aptos transaction
 */
export interface SignedAptosTransaction {
  /** Transaction hash */
  hash: string
  /** Signed transaction bytes (hex) */
  signature: string
}

/**
 * Aptos sign message payload
 */
export interface AptosSignMessagePayload {
  /** Message to sign */
  message: string
  /** Nonce for replay protection */
  nonce: string
  /** Include address in response */
  address?: boolean
  /** Include application info */
  application?: boolean
  /** Include chain ID */
  chainId?: boolean
}

/**
 * Aptos sign message response
 */
export interface AptosSignMessageResponse {
  /** Signature (hex) */
  signature: string
  /** Full message that was signed */
  fullMessage: string
  /** Message prefix (if any) */
  prefix?: string
  /** Address that signed (if requested) */
  address?: string
  /** Application info (if requested) */
  application?: string
  /** Chain ID (if requested) */
  chainId?: number
}

/**
 * Petra wallet API interface
 *
 * @see https://petra.app/docs/api
 */
export interface PetraAPI {
  /**
   * Connect to the wallet
   */
  connect(): Promise<AptosAccountInfo>

  /**
   * Disconnect from the wallet
   */
  disconnect(): Promise<void>

  /**
   * Get current account
   */
  account(): Promise<AptosAccountInfo>

  /**
   * Get current network
   */
  network(): Promise<string>

  /**
   * Sign a transaction
   */
  signTransaction(transaction: AptosTransaction): Promise<Uint8Array>

  /**
   * Sign and submit a transaction
   */
  signAndSubmitTransaction(transaction: AptosTransaction): Promise<{ hash: string }>

  /**
   * Sign a message
   */
  signMessage(payload: AptosSignMessagePayload): Promise<AptosSignMessageResponse>

  /**
   * Check if wallet is connected
   */
  isConnected(): Promise<boolean>

  /**
   * Event listeners
   */
  onAccountChange?: (handler: (account: AptosAccountInfo) => void) => void
  onNetworkChange?: (handler: (network: { networkName: string }) => void) => void
  onDisconnect?: (handler: () => void) => void
}

/**
 * Martian wallet API interface
 *
 * Similar to Petra with slight variations
 */
export interface MartianAPI extends PetraAPI {
  // Martian-specific methods can be added here
}

/**
 * Generic Aptos wallet provider interface
 */
export interface AptosWalletProvider {
  connect(): Promise<AptosAccountInfo>
  disconnect(): Promise<void>
  account(): Promise<AptosAccountInfo>
  network(): Promise<string>
  signTransaction(transaction: AptosTransaction): Promise<Uint8Array>
  signAndSubmitTransaction(transaction: AptosTransaction): Promise<{ hash: string }>
  signMessage(payload: AptosSignMessagePayload): Promise<AptosSignMessageResponse>
  isConnected(): Promise<boolean>

  // Event handling
  onAccountChange?: (handler: (account: AptosAccountInfo) => void) => void
  onNetworkChange?: (handler: (network: { networkName: string }) => void) => void
  onDisconnect?: (handler: () => void) => void
}

/**
 * Window interface for Aptos wallets
 */
declare global {
  interface Window {
    petra?: PetraAPI
    martian?: MartianAPI
    pontem?: AptosWalletProvider
    aptos?: AptosWalletProvider
  }
}

/**
 * Aptos wallet adapter configuration
 */
export interface AptosAdapterConfig {
  /** Wallet name (default: 'petra') */
  wallet?: AptosWalletName
  /** Custom provider (for testing) */
  provider?: AptosWalletProvider
  /** Network name (default: 'mainnet') */
  network?: string
  /** RPC endpoint (optional) */
  rpcEndpoint?: string
}

/**
 * Get Aptos wallet provider from window
 */
export function getAptosProvider(walletName: AptosWalletName): AptosWalletProvider | undefined {
  if (typeof window === 'undefined') return undefined

  switch (walletName) {
    case 'petra':
      return window.petra as AptosWalletProvider | undefined
    case 'martian':
      return window.martian as AptosWalletProvider | undefined
    case 'pontem':
      return window.pontem
    case 'generic':
      return window.aptos
    default:
      return undefined
  }
}

/**
 * Convert Aptos public key to hex format
 *
 * Ensures proper 0x prefix and formatting
 */
export function aptosPublicKeyToHex(publicKey: string | Uint8Array): HexString {
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
 * Default RPC endpoints for Aptos networks
 */
export const DEFAULT_APTOS_RPC_ENDPOINTS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.aptoslabs.com/v1',
  testnet: 'https://fullnode.testnet.aptoslabs.com/v1',
  devnet: 'https://fullnode.devnet.aptoslabs.com/v1',
}

/**
 * Get default RPC endpoint for network
 */
export function getDefaultAptosRpcEndpoint(network: string): string {
  return DEFAULT_APTOS_RPC_ENDPOINTS[network.toLowerCase()] ?? DEFAULT_APTOS_RPC_ENDPOINTS.mainnet
}
