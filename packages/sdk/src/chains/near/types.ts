/**
 * NEAR Same-Chain Privacy Types
 *
 * Type definitions for NEAR privacy operations including transfers,
 * scanning, claiming, and announcements.
 *
 * @packageDocumentation
 */

import type { HexString, StealthAddress } from '@sip-protocol/types'
import { SIP_MEMO_PREFIX, VIEW_TAG_MIN, VIEW_TAG_MAX } from './constants'

// ─── Announcement Types ──────────────────────────────────────────────────────

/**
 * NEAR privacy announcement (included in transaction memo/logs)
 *
 * Contains the information needed for recipients to scan for payments.
 */
export interface NEARAnnouncement {
  /** Ephemeral public key (ed25519, 0x-prefixed hex) */
  ephemeralPublicKey: HexString
  /** View tag for efficient filtering (0-255) */
  viewTag: number
  /** Stealth address (ed25519 public key, 0x-prefixed hex) */
  stealthAddress: HexString
  /** NEAR implicit account ID derived from stealth address */
  stealthAccountId: string
  /** Transaction hash where the announcement was made */
  txHash?: string
  /** Block height of the announcement */
  blockHeight?: number
}

/**
 * Parse an announcement from a NEAR memo string
 *
 * Format: SIP:1:<ephemeral_pubkey_hex>:<view_tag_hex>
 *
 * @param memo - The memo string to parse
 * @returns Parsed announcement or null if invalid
 *
 * @example
 * ```typescript
 * const memo = 'SIP:1:1234...abcd:0f'
 * const announcement = parseAnnouncement(memo)
 * if (announcement) {
 *   console.log(announcement.ephemeralPublicKey)
 *   console.log(announcement.viewTag) // 15
 * }
 * ```
 */
export function parseAnnouncement(memo: string): Partial<NEARAnnouncement> | null {
  if (!memo || typeof memo !== 'string') {
    return null
  }

  // Check prefix
  if (!memo.startsWith(SIP_MEMO_PREFIX)) {
    return null
  }

  // Parse parts: SIP:1:<ephemeral_pubkey>:<view_tag>
  const content = memo.slice(SIP_MEMO_PREFIX.length)
  const parts = content.split(':')

  if (parts.length < 2) {
    return null
  }

  const [ephemeralKeyHex, viewTagHex] = parts

  // Validate ephemeral key (64 hex chars = 32 bytes)
  if (!ephemeralKeyHex || !/^[0-9a-fA-F]{64}$/.test(ephemeralKeyHex)) {
    return null
  }

  // Parse view tag (hex byte)
  if (!viewTagHex || !/^[0-9a-fA-F]{1,2}$/.test(viewTagHex)) {
    return null
  }

  const viewTag = parseInt(viewTagHex, 16)
  if (viewTag < VIEW_TAG_MIN || viewTag > VIEW_TAG_MAX) {
    return null
  }

  return {
    ephemeralPublicKey: `0x${ephemeralKeyHex.toLowerCase()}` as HexString,
    viewTag,
  }
}

/**
 * Create an announcement memo string
 *
 * @param ephemeralPublicKey - Ephemeral public key (0x-prefixed hex)
 * @param viewTag - View tag (0-255)
 * @returns Encoded memo string
 *
 * @example
 * ```typescript
 * const memo = createAnnouncementMemo(
 *   stealthAddress.ephemeralPublicKey,
 *   stealthAddress.viewTag
 * )
 * // => 'SIP:1:1234...abcd:0f'
 * ```
 */
export function createAnnouncementMemo(
  ephemeralPublicKey: HexString,
  viewTag: number
): string {
  // Remove 0x prefix
  const ephemeralKeyHex = ephemeralPublicKey.slice(2)

  // Convert view tag to 2-char hex
  const viewTagHex = viewTag.toString(16).padStart(2, '0')

  return `${SIP_MEMO_PREFIX}${ephemeralKeyHex}:${viewTagHex}`
}

// ─── Transfer Types ──────────────────────────────────────────────────────────

/**
 * Parameters for sending a private NEAR transfer
 */
export interface NEARPrivateTransferParams {
  /** NEAR RPC URL or connection object */
  rpcUrl: string
  /** Sender's NEAR account ID */
  senderAccountId: string
  /** Sender's private key for signing */
  senderPrivateKey: string
  /** Recipient's stealth meta-address (or encoded string) */
  recipientMetaAddress: string
  /** Amount in yoctoNEAR (for native NEAR) */
  amount: bigint
  /** Token contract for NEP-141 transfers (omit for native NEAR) */
  tokenContract?: string
  /** Network ID (mainnet, testnet, etc.) */
  networkId?: 'mainnet' | 'testnet' | 'betanet' | 'localnet'
  /** Gas limit for the transaction */
  gas?: bigint
}

/**
 * Result of a private NEAR transfer
 */
export interface NEARPrivateTransferResult {
  /** Transaction hash */
  txHash: string
  /** Stealth address that received the funds */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID derived from stealth address */
  stealthAccountId: string
  /** Ephemeral public key for recipient scanning */
  ephemeralPublicKey: HexString
  /** View tag for efficient filtering */
  viewTag: number
  /** Shared secret (for debugging, should be discarded) */
  sharedSecret?: HexString
  /** Block height of the transaction */
  blockHeight?: number
  /** Gas used by the transaction */
  gasUsed?: bigint
}

// ─── Scan Types ──────────────────────────────────────────────────────────────

/**
 * Parameters for scanning for incoming NEAR payments
 */
export interface NEARScanParams {
  /** NEAR RPC URL */
  rpcUrl: string
  /** Viewing private key for scanning */
  viewingPrivateKey: HexString
  /** Spending public key for address verification */
  spendingPublicKey: HexString
  /** Network ID */
  networkId?: 'mainnet' | 'testnet' | 'betanet' | 'localnet'
  /** Start block height (optional, for incremental scanning) */
  fromBlock?: number
  /** End block height (optional) */
  toBlock?: number
  /** Maximum transactions to scan */
  limit?: number
  /** Token contract to filter for (omit for native NEAR) */
  tokenContract?: string
}

/**
 * Result of scanning for NEAR payments
 */
export interface NEARScanResult {
  /** Detected payments */
  payments: NEARDetectedPayment[]
  /** Last scanned block height */
  lastBlockHeight: number
  /** Total announcements scanned */
  scannedCount: number
  /** Time taken in milliseconds */
  scanTimeMs: number
}

/**
 * A detected NEAR payment
 */
export interface NEARDetectedPayment {
  /** Stealth address that received the payment */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Amount received (in yoctoNEAR or token smallest units) */
  amount: bigint
  /** Transaction hash */
  txHash: string
  /** Block height */
  blockHeight: number
  /** Token contract (undefined for native NEAR) */
  tokenContract?: string
  /** Timestamp of the transaction */
  timestamp?: number
}

// ─── Claim Types ─────────────────────────────────────────────────────────────

/**
 * Parameters for claiming a stealth payment
 */
export interface NEARClaimParams {
  /** NEAR RPC URL */
  rpcUrl: string
  /** Stealth address to claim from */
  stealthAddress: StealthAddress
  /** Ephemeral public key from the announcement */
  ephemeralPublicKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Destination account ID to receive funds */
  destinationAccountId: string
  /** Network ID */
  networkId?: 'mainnet' | 'testnet' | 'betanet' | 'localnet'
  /** Token contract for NEP-141 claims (omit for native NEAR) */
  tokenContract?: string
  /** Amount to claim (defaults to full balance) */
  amount?: bigint
  /** Gas limit */
  gas?: bigint
}

/**
 * Result of claiming a stealth payment
 */
export interface NEARClaimResult {
  /** Transaction hash */
  txHash: string
  /** Amount claimed */
  amount: bigint
  /** Destination account ID */
  destinationAccountId: string
  /** Gas used */
  gasUsed?: bigint
  /** Block height */
  blockHeight?: number
}

// ─── Balance Types ───────────────────────────────────────────────────────────

/**
 * Balance query result for a stealth account
 */
export interface NEARStealthBalance {
  /** NEAR implicit account ID */
  accountId: string
  /** Native NEAR balance in yoctoNEAR */
  nearBalance: bigint
  /** Token balances (contract -> balance) */
  tokenBalances: Map<string, bigint>
  /** Whether the account exists on-chain */
  exists: boolean
  /** Storage used by the account */
  storageUsed?: bigint
}

// ─── RPC Types ───────────────────────────────────────────────────────────────

/**
 * NEAR RPC error response
 */
export interface NEARRpcError {
  /** Error code */
  code: number
  /** Error message */
  message: string
  /** Error data */
  data?: unknown
}

/**
 * NEAR transaction outcome
 */
export interface NEARTransactionOutcome {
  /** Transaction hash */
  transactionHash: string
  /** Block height */
  blockHeight: number
  /** Status */
  status: 'SUCCESS' | 'FAILURE'
  /** Gas burnt */
  gasBurnt: bigint
  /** Logs */
  logs: string[]
}
