/**
 * Wallet Adapter Types for SIP Protocol
 *
 * Chain-agnostic wallet interface that allows SIP SDK to work with any blockchain wallet.
 * Supports both basic wallet operations and privacy-enhanced features.
 */

import type { ChainId } from './stealth'
import type { HexString, ViewingKey } from './crypto'
import type { StealthMetaAddress, StealthAddress } from './stealth'
import type { Asset } from './asset'

// ============================================================================
// Core Types
// ============================================================================

/**
 * Wallet connection state
 */
export type WalletConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

/**
 * Signature data returned from signing operations
 */
export interface Signature {
  /** The signature bytes (hex encoded) */
  signature: HexString
  /** Recovery id for secp256k1 signatures */
  recoveryId?: number
  /** Public key used for signing (hex encoded) */
  publicKey: HexString
}

/**
 * Unsigned transaction (chain-specific)
 */
export interface UnsignedTransaction {
  /** Target chain */
  chain: ChainId
  /** Transaction data (chain-specific format) */
  data: unknown
  /** Optional transaction metadata */
  metadata?: Record<string, unknown>
}

/**
 * Signed transaction ready for broadcast
 */
export interface SignedTransaction {
  /** Original unsigned transaction */
  unsigned: UnsignedTransaction
  /** The signature(s) */
  signatures: Signature[]
  /** Serialized transaction ready for broadcast (hex encoded) */
  serialized: HexString
}

/**
 * Transaction receipt after broadcast
 */
export interface TransactionReceipt {
  /** Transaction hash */
  txHash: HexString
  /** Block number (if confirmed) */
  blockNumber?: bigint
  /** Block hash (if confirmed) */
  blockHash?: HexString
  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed'
  /** Gas/fee used */
  feeUsed?: bigint
  /** Timestamp */
  timestamp?: number
}

// ============================================================================
// Wallet Events
// ============================================================================

/**
 * Wallet event types
 */
export type WalletEventType =
  | 'connect'
  | 'disconnect'
  | 'accountChanged'
  | 'chainChanged'
  | 'error'

/**
 * Base wallet event
 */
export interface WalletEventBase {
  type: WalletEventType
  timestamp: number
}

/**
 * Connect event - wallet successfully connected
 */
export interface WalletConnectEvent extends WalletEventBase {
  type: 'connect'
  address: string
  chain: ChainId
}

/**
 * Disconnect event - wallet disconnected
 */
export interface WalletDisconnectEvent extends WalletEventBase {
  type: 'disconnect'
  reason?: string
}

/**
 * Account changed event - user switched accounts
 */
export interface WalletAccountChangedEvent extends WalletEventBase {
  type: 'accountChanged'
  previousAddress: string
  newAddress: string
}

/**
 * Chain changed event - user switched networks
 */
export interface WalletChainChangedEvent extends WalletEventBase {
  type: 'chainChanged'
  previousChain: ChainId
  newChain: ChainId
}

/**
 * Error event - wallet error occurred
 */
export interface WalletErrorEvent extends WalletEventBase {
  type: 'error'
  code: string
  message: string
  details?: unknown
}

/**
 * Union of all wallet events
 */
export type WalletEvent =
  | WalletConnectEvent
  | WalletDisconnectEvent
  | WalletAccountChangedEvent
  | WalletChainChangedEvent
  | WalletErrorEvent

/**
 * Event handler function
 */
export type WalletEventHandler<T extends WalletEvent = WalletEvent> = (
  event: T
) => void

// ============================================================================
// Wallet Adapter Interface
// ============================================================================

/**
 * Core wallet adapter interface
 *
 * Chain-agnostic interface that all wallet implementations must support.
 * Provides basic wallet operations: connection, signing, and balance queries.
 *
 * @example
 * ```typescript
 * class SolanaWalletAdapter implements WalletAdapter {
 *   readonly chain = 'solana'
 *
 *   async connect(): Promise<void> {
 *     // Connect to Phantom, Solflare, etc.
 *   }
 *
 *   async signMessage(message: Uint8Array): Promise<Signature> {
 *     // Sign using connected wallet
 *   }
 * }
 * ```
 */
export interface WalletAdapter {
  // ── Identity ──────────────────────────────────────────────────────────────

  /** Chain this adapter connects to */
  readonly chain: ChainId

  /** Wallet name/identifier (e.g., 'phantom', 'metamask') */
  readonly name: string

  /** Current address (empty string if not connected) */
  readonly address: string

  /** Public key (hex encoded, empty string if not connected) */
  readonly publicKey: HexString | ''

  // ── Connection ────────────────────────────────────────────────────────────

  /**
   * Current connection state
   */
  readonly connectionState: WalletConnectionState

  /**
   * Connect to the wallet
   *
   * @throws {WalletError} If connection fails
   */
  connect(): Promise<void>

  /**
   * Disconnect from the wallet
   */
  disconnect(): Promise<void>

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean

  // ── Signing ───────────────────────────────────────────────────────────────

  /**
   * Sign an arbitrary message
   *
   * @param message - The message bytes to sign
   * @returns The signature
   * @throws {WalletError} If signing fails or wallet not connected
   */
  signMessage(message: Uint8Array): Promise<Signature>

  /**
   * Sign a transaction
   *
   * @param tx - The unsigned transaction
   * @returns The signed transaction
   * @throws {WalletError} If signing fails or wallet not connected
   */
  signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>

  /**
   * Sign and broadcast a transaction
   *
   * @param tx - The unsigned transaction
   * @returns The transaction receipt
   * @throws {WalletError} If signing or broadcast fails
   */
  signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt>

  // ── Balance ───────────────────────────────────────────────────────────────

  /**
   * Get native token balance
   *
   * @returns Balance in smallest unit (lamports, wei, etc.)
   * @throws {WalletError} If query fails
   */
  getBalance(): Promise<bigint>

  /**
   * Get token balance for a specific asset
   *
   * @param asset - The asset to query balance for
   * @returns Balance in smallest unit
   * @throws {WalletError} If query fails or asset not supported
   */
  getTokenBalance(asset: Asset): Promise<bigint>

  // ── Events ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to wallet events
   *
   * @param event - Event type to subscribe to
   * @param handler - Event handler function
   */
  on<T extends WalletEventType>(
    event: T,
    handler: WalletEventHandler<Extract<WalletEvent, { type: T }>>
  ): void

  /**
   * Unsubscribe from wallet events
   *
   * @param event - Event type to unsubscribe from
   * @param handler - Event handler to remove
   */
  off<T extends WalletEventType>(
    event: T,
    handler: WalletEventHandler<Extract<WalletEvent, { type: T }>>
  ): void
}

// ============================================================================
// Privacy-Enhanced Wallet Interface
// ============================================================================

/**
 * Parameters for shielded send operations
 */
export interface ShieldedSendParams {
  /** Recipient address or stealth address */
  to: string
  /** Amount in smallest unit */
  amount: bigint
  /** Asset to send */
  asset: Asset
  /** Optional memo (may be encrypted) */
  memo?: string
  /** Use full privacy (shielded pools if available) */
  fullPrivacy?: boolean
}

/**
 * Result of a shielded send operation
 */
export interface ShieldedSendResult {
  /** Transaction hash */
  txHash: HexString
  /** Whether the transaction used shielded pools */
  isShielded: boolean
  /** Ephemeral public key (for stealth address sends) */
  ephemeralPublicKey?: HexString
  /** Fee paid */
  fee: bigint
}

/**
 * Privacy-enhanced wallet adapter
 *
 * Extends WalletAdapter with privacy features:
 * - Stealth address generation and scanning
 * - Viewing key export for compliance
 * - Shielded transaction support
 *
 * @example
 * ```typescript
 * class ZcashPrivateWallet implements PrivateWalletAdapter {
 *   // ... WalletAdapter methods ...
 *
 *   getStealthMetaAddress(): StealthMetaAddress {
 *     return this.stealthMeta
 *   }
 *
 *   async shieldedSend(params: ShieldedSendParams): Promise<ShieldedSendResult> {
 *     // Use Zcash shielded pool
 *   }
 * }
 * ```
 */
export interface PrivateWalletAdapter extends WalletAdapter {
  // ── Stealth Addresses ─────────────────────────────────────────────────────

  /**
   * Check if wallet supports stealth addresses
   */
  supportsStealthAddresses(): boolean

  /**
   * Get the stealth meta-address for receiving private payments
   *
   * The meta-address contains spending and viewing public keys that senders
   * use to derive one-time stealth addresses.
   *
   * @returns The stealth meta-address
   * @throws {WalletError} If stealth addresses not supported
   */
  getStealthMetaAddress(): StealthMetaAddress

  /**
   * Generate a one-time stealth address from an ephemeral public key
   *
   * Used by senders to derive a unique receiving address.
   *
   * @param ephemeralPubKey - Sender's ephemeral public key
   * @returns The derived stealth address
   */
  deriveStealthAddress(ephemeralPubKey: HexString): StealthAddress

  /**
   * Check if a stealth address belongs to this wallet
   *
   * @param stealthAddress - The address to check
   * @param ephemeralPubKey - The ephemeral public key used
   * @returns True if this wallet can spend from the address
   */
  checkStealthAddress(
    stealthAddress: HexString,
    ephemeralPubKey: HexString
  ): boolean

  /**
   * Scan for received stealth payments
   *
   * Scans announcements/transactions to find payments to this wallet's
   * stealth addresses.
   *
   * @param fromBlock - Optional starting block
   * @param toBlock - Optional ending block
   * @returns Array of detected stealth addresses with amounts
   */
  scanStealthPayments(
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<
    Array<{
      address: HexString
      ephemeralPubKey: HexString
      amount: bigint
      asset: Asset
      blockNumber: bigint
    }>
  >

  // ── Viewing Keys ──────────────────────────────────────────────────────────

  /**
   * Check if wallet supports viewing key export
   */
  supportsViewingKeys(): boolean

  /**
   * Export viewing key for selective disclosure
   *
   * Allows third parties (auditors, regulators) to view transaction
   * details without spending capability.
   *
   * @returns The viewing key
   * @throws {WalletError} If viewing keys not supported
   */
  exportViewingKey(): ViewingKey

  // ── Shielded Operations ───────────────────────────────────────────────────

  /**
   * Check if wallet supports shielded transactions
   */
  supportsShieldedTransactions(): boolean

  /**
   * Get shielded balance (in shielded pools, if applicable)
   *
   * @returns Shielded balance in smallest unit
   */
  getShieldedBalance(): Promise<bigint>

  /**
   * Send tokens with maximum privacy
   *
   * Uses shielded pools and/or stealth addresses depending on
   * the target chain's capabilities.
   *
   * @param params - Shielded send parameters
   * @returns The transaction result
   * @throws {WalletError} If shielded send fails
   */
  shieldedSend(params: ShieldedSendParams): Promise<ShieldedSendResult>
}

// ============================================================================
// Wallet Error Types
// ============================================================================

/**
 * Wallet error codes
 */
export const WalletErrorCode = {
  // Connection errors
  NOT_INSTALLED: 'WALLET_NOT_INSTALLED',
  CONNECTION_REJECTED: 'WALLET_CONNECTION_REJECTED',
  CONNECTION_FAILED: 'WALLET_CONNECTION_FAILED',
  NOT_CONNECTED: 'WALLET_NOT_CONNECTED',

  // Signing errors
  SIGNING_REJECTED: 'WALLET_SIGNING_REJECTED',
  SIGNING_FAILED: 'WALLET_SIGNING_FAILED',
  INVALID_MESSAGE: 'WALLET_INVALID_MESSAGE',

  // Transaction errors
  INSUFFICIENT_FUNDS: 'WALLET_INSUFFICIENT_FUNDS',
  TRANSACTION_REJECTED: 'WALLET_TRANSACTION_REJECTED',
  TRANSACTION_FAILED: 'WALLET_TRANSACTION_FAILED',
  INVALID_TRANSACTION: 'WALLET_INVALID_TRANSACTION',

  // Chain errors
  UNSUPPORTED_CHAIN: 'WALLET_UNSUPPORTED_CHAIN',
  CHAIN_SWITCH_REJECTED: 'WALLET_CHAIN_SWITCH_REJECTED',
  CHAIN_SWITCH_FAILED: 'WALLET_CHAIN_SWITCH_FAILED',

  // Privacy errors
  STEALTH_NOT_SUPPORTED: 'WALLET_STEALTH_NOT_SUPPORTED',
  VIEWING_KEY_NOT_SUPPORTED: 'WALLET_VIEWING_KEY_NOT_SUPPORTED',
  SHIELDED_NOT_SUPPORTED: 'WALLET_SHIELDED_NOT_SUPPORTED',

  // Generic errors
  UNKNOWN: 'WALLET_UNKNOWN_ERROR',
} as const

export type WalletErrorCodeType =
  (typeof WalletErrorCode)[keyof typeof WalletErrorCode]

// ============================================================================
// Wallet Registry
// ============================================================================

/**
 * Wallet metadata for discovery/display
 */
export interface WalletInfo {
  /** Wallet identifier */
  id: string
  /** Display name */
  name: string
  /** Icon URL */
  icon?: string
  /** Supported chains */
  chains: ChainId[]
  /** Download/install URL */
  url?: string
  /** Whether wallet supports privacy features */
  supportsPrivacy: boolean
}

/**
 * Wallet adapter factory function
 */
export type WalletAdapterFactory = () => WalletAdapter | PrivateWalletAdapter

/**
 * Registry entry for a wallet adapter
 */
export interface WalletRegistryEntry {
  info: WalletInfo
  factory: WalletAdapterFactory
  /** Detection function - returns true if wallet is available */
  detect: () => boolean
}
