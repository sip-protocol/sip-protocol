/**
 * Solana Same-Chain Privacy Types
 *
 * Type definitions for Solana stealth address transfers and scanning.
 */

import type { PublicKey, Connection, Transaction, VersionedTransaction } from '@solana/web3.js'
import type { StealthMetaAddress, HexString } from '@sip-protocol/types'
import type { SolanaCluster } from './constants'
import type { SolanaRPCProvider } from './providers/interface'

/**
 * Parameters for sending a private SPL token transfer
 */
export interface SolanaPrivateTransferParams {
  /** Solana RPC connection */
  connection: Connection
  /** Sender's public key */
  sender: PublicKey
  /** Sender's token account (ATA) */
  senderTokenAccount: PublicKey
  /** Recipient's stealth meta-address (sip:solana:...) */
  recipientMetaAddress: StealthMetaAddress
  /** SPL token mint address */
  mint: PublicKey
  /** Amount to transfer (in token's smallest unit) */
  amount: bigint
  /** Function to sign the transaction */
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
}

/**
 * Result of a private SPL token transfer
 */
export interface SolanaPrivateTransferResult {
  /** Transaction signature */
  txSignature: string
  /** Stealth address (base58 Solana address) */
  stealthAddress: string
  /** Ephemeral public key (base58) for recipient scanning */
  ephemeralPublicKey: string
  /** View tag for efficient scanning */
  viewTag: string
  /** Explorer URL for the transaction */
  explorerUrl: string
  /** Cluster the transaction was sent on */
  cluster: SolanaCluster
}

/**
 * Parameters for scanning for incoming stealth payments
 */
export interface SolanaScanParams {
  /** Solana RPC connection */
  connection: Connection
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending public key (hex) */
  spendingPublicKey: HexString
  /** Optional: Start scanning from this slot */
  fromSlot?: number
  /** Optional: Stop scanning at this slot */
  toSlot?: number
  /** Optional: Limit number of results */
  limit?: number
  /**
   * Optional: RPC provider for efficient asset queries
   *
   * When provided, uses provider.getAssetsByOwner() for token detection
   * instead of parsing transaction logs. Recommended for production.
   *
   * @example
   * ```typescript
   * const helius = createProvider('helius', { apiKey: '...' })
   * const payments = await scanForPayments({
   *   connection,
   *   provider: helius,
   *   viewingPrivateKey,
   *   spendingPublicKey,
   * })
   * ```
   */
  provider?: SolanaRPCProvider
}

/**
 * Result of scanning for incoming payments
 */
export interface SolanaScanResult {
  /** Stealth address that received the payment (base58) */
  stealthAddress: string
  /** Ephemeral public key from the sender (base58) */
  ephemeralPublicKey: string
  /** Amount received (in token's smallest unit) */
  amount: bigint
  /** Token mint address */
  mint: string
  /** Token symbol (if known) */
  tokenSymbol?: string
  /** Transaction signature */
  txSignature: string
  /** Block slot */
  slot: number
  /** Block timestamp */
  timestamp: number
}

/**
 * Parameters for claiming a stealth payment
 */
export interface SolanaClaimParams {
  /** Solana RPC connection */
  connection: Connection
  /** Stealth address to claim from (base58) */
  stealthAddress: string
  /** Ephemeral public key from the payment (base58) */
  ephemeralPublicKey: string
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending private key (hex) */
  spendingPrivateKey: HexString
  /** Destination address to send claimed funds (base58) */
  destinationAddress: string
  /** SPL token mint address */
  mint: PublicKey
}

/**
 * Result of claiming a stealth payment
 */
export interface SolanaClaimResult {
  /** Transaction signature */
  txSignature: string
  /** Destination address that received the funds (base58) */
  destinationAddress: string
  /** Amount claimed (in token's smallest unit) */
  amount: bigint
  /** Explorer URL for the transaction */
  explorerUrl: string
}

/**
 * Announcement data stored in transaction memo
 */
export interface SolanaAnnouncement {
  /** Ephemeral public key (base58) */
  ephemeralPublicKey: string
  /** View tag for efficient scanning (hex, 1 byte) */
  viewTag: string
  /** Full stealth address (for verification) */
  stealthAddress?: string
}

/**
 * Parse announcement from memo string
 * Format: SIP:1:<ephemeral_pubkey_base58>:<view_tag_hex>
 */
export function parseAnnouncement(memo: string): SolanaAnnouncement | null {
  if (!memo.startsWith('SIP:1:')) {
    return null
  }

  const parts = memo.slice(6).split(':')
  if (parts.length < 2) {
    return null
  }

  const viewTag = parts[1]

  // M4 FIX: Validate viewTag is valid hex (1-2 chars, representing 0-255)
  if (!/^[0-9a-fA-F]{1,2}$/.test(viewTag)) {
    return null
  }

  return {
    ephemeralPublicKey: parts[0],
    viewTag,
    stealthAddress: parts[2],
  }
}

/**
 * Create announcement memo string
 */
export function createAnnouncementMemo(
  ephemeralPublicKey: string,
  viewTag: string,
  stealthAddress?: string
): string {
  const parts = ['SIP:1', ephemeralPublicKey, viewTag]
  if (stealthAddress) {
    parts.push(stealthAddress)
  }
  return parts.join(':')
}
