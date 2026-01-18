/**
 * NEAR Stealth Address Resolver
 *
 * Scans NEAR blockchain for stealth address announcements and identifies
 * addresses belonging to a user's viewing key for wallet balance discovery.
 *
 * ## Architecture
 *
 * ```
 * NEAR Blockchain
 *       │
 *       ▼ RPC / Indexer
 * Transaction Logs
 *       │
 *       ▼ Parse SIP: prefixed memos
 * Announcements
 *       │
 *       ▼ Check against viewing keys
 * Detected Payments
 * ```
 *
 * ## Features
 *
 * - Historical scanning with pagination
 * - Real-time scanning placeholder (WebSocket planned)
 * - Batch scanning for multiple recipients
 * - View tag filtering for efficient scanning
 * - Announcement caching layer
 *
 * @module chains/near/resolver
 */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString, StealthAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidHex } from '../../validation'
import { checkNEARStealthAddress, implicitAccountToEd25519PublicKey } from './stealth'
import { parseAnnouncement, type NEARAnnouncement } from './types'
import {
  SIP_MEMO_PREFIX,
  VIEW_TAG_MIN,
  VIEW_TAG_MAX,
  isImplicitAccount,
} from './constants'
import type { NEARViewingKey } from './viewing-key'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A recipient to scan for (viewing + spending key pair)
 */
export interface NEARScanRecipient {
  /**
   * Viewing private key (hex)
   * @security SENSITIVE - enables scanning for payments
   */
  viewingPrivateKey: HexString

  /**
   * Spending private key (hex)
   * @security SENSITIVE - required for DKSAP shared secret computation
   */
  spendingPrivateKey: HexString

  /**
   * Optional label for this recipient
   */
  label?: string
}

/**
 * Options for the NEAR stealth scanner
 */
export interface NEARStealthScannerOptions {
  /**
   * NEAR RPC URL
   */
  rpcUrl: string

  /**
   * Optional network for explorer links
   * @default 'mainnet'
   */
  network?: 'mainnet' | 'testnet'

  /**
   * Maximum results per scan batch
   * @default 100
   */
  batchSize?: number

  /**
   * Enable view tag filtering for efficient scanning
   * @default true
   */
  useViewTagFilter?: boolean

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number
}

/**
 * Options for historical scanning
 */
export interface NEARHistoricalScanOptions {
  /**
   * Account ID to scan for announcements
   * This is typically the SIP registry contract or a specific stealth address
   */
  accountId?: string

  /**
   * Start block height for scanning
   */
  fromBlock?: number

  /**
   * End block height for scanning
   */
  toBlock?: number

  /**
   * Maximum number of transactions to scan
   * @default 1000
   */
  limit?: number

  /**
   * Cursor for pagination
   */
  cursor?: string
}

/**
 * A detected stealth payment on NEAR
 */
export interface NEARDetectedPaymentResult {
  /**
   * Stealth address (implicit account ID - 64 hex chars)
   */
  stealthAddress: string

  /**
   * Ed25519 public key for the stealth address (hex)
   */
  stealthPublicKey: HexString

  /**
   * Ephemeral public key from the sender (hex)
   */
  ephemeralPublicKey: HexString

  /**
   * View tag for efficient scanning
   */
  viewTag: number

  /**
   * Amount in yoctoNEAR
   */
  amount: bigint

  /**
   * Token contract (null for native NEAR)
   */
  tokenContract: string | null

  /**
   * Token decimals
   */
  decimals: number

  /**
   * Transaction hash
   */
  txHash: string

  /**
   * Block height
   */
  blockHeight: number

  /**
   * Block timestamp (nanoseconds)
   */
  timestamp: number

  /**
   * Label of the recipient this payment was detected for
   */
  recipientLabel?: string
}

/**
 * Result of a historical scan
 */
export interface NEARHistoricalScanResult {
  /**
   * Detected payments
   */
  payments: NEARDetectedPaymentResult[]

  /**
   * Total transactions scanned
   */
  scannedCount: number

  /**
   * Whether more results are available
   */
  hasMore: boolean

  /**
   * Cursor for next page
   */
  nextCursor?: string

  /**
   * Last block height scanned
   */
  lastBlockHeight?: number
}

/**
 * Callback for real-time payment detection
 */
export type NEARPaymentCallback = (payment: NEARDetectedPaymentResult) => void

/**
 * Callback for scan errors
 */
export type NEARErrorCallback = (error: Error) => void

/**
 * Announcement cache entry
 */
interface CacheEntry {
  announcement: NEARAnnouncement
  txHash: string
  blockHeight: number
  timestamp: number
}

/**
 * Announcement cache interface
 */
export interface NEARAnnouncementCache {
  /**
   * Get cached announcements for a block range
   */
  get(fromBlock: number, toBlock: number): CacheEntry[]

  /**
   * Add announcements to cache
   */
  add(entries: CacheEntry[]): void

  /**
   * Get the highest cached block
   */
  getHighestBlock(): number | null

  /**
   * Clear cache for reorg handling
   */
  clearFrom(blockHeight: number): void

  /**
   * Get total cached count
   */
  size(): number
}

// ─── In-Memory Cache Implementation ───────────────────────────────────────────

/**
 * Create an in-memory announcement cache
 */
export function createNEARAnnouncementCache(): NEARAnnouncementCache {
  const entries: CacheEntry[] = []

  return {
    get(fromBlock: number, toBlock: number): CacheEntry[] {
      return entries.filter(
        e => e.blockHeight >= fromBlock && e.blockHeight <= toBlock
      )
    },

    add(newEntries: CacheEntry[]): void {
      for (const entry of newEntries) {
        // Avoid duplicates
        const exists = entries.some(
          e => e.txHash === entry.txHash
        )
        if (!exists) {
          entries.push(entry)
        }
      }
      // Sort by block height
      entries.sort((a, b) => a.blockHeight - b.blockHeight)
    },

    getHighestBlock(): number | null {
      if (entries.length === 0) return null
      return entries[entries.length - 1].blockHeight
    },

    clearFrom(blockHeight: number): void {
      const idx = entries.findIndex(e => e.blockHeight >= blockHeight)
      if (idx !== -1) {
        entries.splice(idx)
      }
    },

    size(): number {
      return entries.length
    },
  }
}

// ─── NEAR RPC Helper ──────────────────────────────────────────────────────────

/**
 * Simple NEAR RPC client for scanning
 */
class NEARRpcClient {
  constructor(
    private rpcUrl: string,
    private timeout: number = 30000
  ) {}

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
      }

      const json = await response.json() as { result?: T; error?: { message: string } }

      if (json.error) {
        throw new Error(`RPC error: ${json.error.message}`)
      }

      return json.result as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get account balance
   */
  async getBalance(accountId: string): Promise<bigint> {
    interface AccountView {
      amount: string
      locked: string
      code_hash: string
      storage_usage: number
      storage_paid_at: number
    }

    const result = await this.call<AccountView>('query', [{
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId,
    }])

    return BigInt(result.amount)
  }

  /**
   * Get block info
   */
  async getBlock(blockId: number | string = 'final'): Promise<{
    header: {
      height: number
      timestamp: number
      hash: string
    }
  }> {
    if (typeof blockId === 'number') {
      return this.call('block', [{ block_id: blockId }])
    }
    return this.call('block', [{ finality: blockId }])
  }

  /**
   * Get transaction status
   */
  async getTxStatus(txHash: string, senderId: string): Promise<{
    transaction: {
      hash: string
      signer_id: string
      receiver_id: string
      actions: Array<{
        FunctionCall?: {
          method_name: string
          args: string
        }
        Transfer?: {
          deposit: string
        }
      }>
    }
    receipts_outcome: Array<{
      outcome: {
        logs: string[]
        status: unknown
      }
    }>
  }> {
    return this.call('tx', [txHash, senderId])
  }
}

// ─── NEARStealthScanner Class ─────────────────────────────────────────────────

/**
 * NEAR Stealth Address Scanner/Resolver
 *
 * Scans NEAR blockchain for stealth address announcements and identifies
 * which addresses belong to a user's viewing key.
 *
 * @example Basic usage
 * ```typescript
 * const scanner = new NEARStealthScanner({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 * })
 *
 * // Add recipients to scan for
 * scanner.addRecipient({
 *   viewingPrivateKey: '0x...',
 *   spendingPublicKey: '0x...',
 *   label: 'Wallet 1',
 * })
 *
 * // Scan announcements
 * const result = await scanner.scanAnnouncements([
 *   { stealthAddress: '...', ephemeralPublicKey: '0x...', viewTag: 42 }
 * ])
 *
 * console.log(`Found ${result.payments.length} payments`)
 * ```
 */
export class NEARStealthScanner {
  private rpc: NEARRpcClient
  private recipients: NEARScanRecipient[] = []
  private _batchSize: number
  private cache: NEARAnnouncementCache | null = null
  private network: 'mainnet' | 'testnet'

  constructor(options: NEARStealthScannerOptions) {
    this.rpc = new NEARRpcClient(options.rpcUrl, options.timeout)
    this._batchSize = options.batchSize ?? 100
    this.network = options.network ?? 'mainnet'
  }

  /**
   * Get the batch size for scanning
   */
  get batchSize(): number {
    return this._batchSize
  }

  /**
   * Get the network
   */
  getNetwork(): 'mainnet' | 'testnet' {
    return this.network
  }

  /**
   * Enable caching for announcements
   */
  enableCache(cache?: NEARAnnouncementCache): void {
    this.cache = cache ?? createNEARAnnouncementCache()
  }

  /**
   * Disable caching
   */
  disableCache(): void {
    this.cache = null
  }

  /**
   * Get the current cache
   */
  getCache(): NEARAnnouncementCache | null {
    return this.cache
  }

  /**
   * Add a recipient to scan for
   *
   * @param recipient - Recipient with viewing/spending keys
   */
  addRecipient(recipient: NEARScanRecipient): void {
    // Validate keys
    if (!isValidHex(recipient.viewingPrivateKey)) {
      throw new ValidationError('Invalid viewingPrivateKey', 'viewingPrivateKey')
    }
    if (!isValidHex(recipient.spendingPrivateKey)) {
      throw new ValidationError('Invalid spendingPrivateKey', 'spendingPrivateKey')
    }

    this.recipients.push(recipient)
  }

  /**
   * Add recipient from a NEARViewingKey
   */
  addRecipientFromViewingKey(
    viewingKey: NEARViewingKey,
    spendingPrivateKey: HexString
  ): void {
    this.addRecipient({
      viewingPrivateKey: viewingKey.privateKey,
      spendingPrivateKey,
      label: viewingKey.label,
    })
  }

  /**
   * Remove a recipient by label
   *
   * @param label - Recipient label to remove
   */
  removeRecipient(label: string): void {
    this.recipients = this.recipients.filter(r => r.label !== label)
  }

  /**
   * Clear all recipients
   */
  clearRecipients(): void {
    this.recipients = []
  }

  /**
   * Get current recipients (labels only, keys are sensitive)
   */
  getRecipients(): Array<{ label?: string }> {
    return this.recipients.map(r => ({
      label: r.label,
    }))
  }

  /**
   * Get the current block height
   */
  async getCurrentBlockHeight(): Promise<number> {
    const block = await this.rpc.getBlock('final')
    return block.header.height
  }

  /**
   * Get balance of a stealth address
   */
  async getStealthAddressBalance(stealthAddress: string): Promise<bigint> {
    if (!isImplicitAccount(stealthAddress)) {
      throw new ValidationError(
        'stealthAddress must be a valid implicit account (64 hex chars)',
        'stealthAddress'
      )
    }
    return this.rpc.getBalance(stealthAddress)
  }

  /**
   * Scan a list of announcements against configured recipients
   *
   * This is the core scanning function. Use this when you have already
   * fetched announcements from the chain or an indexer.
   *
   * @param announcements - Announcements to check
   * @param txMetadata - Optional transaction metadata for each announcement
   * @returns Detected payments
   */
  async scanAnnouncements(
    announcements: NEARAnnouncement[],
    txMetadata?: Array<{
      txHash: string
      blockHeight: number
      timestamp: number
      amount?: bigint
      tokenContract?: string
      decimals?: number
    }>
  ): Promise<NEARDetectedPaymentResult[]> {
    if (this.recipients.length === 0) {
      return []
    }

    const payments: NEARDetectedPaymentResult[] = []

    for (let i = 0; i < announcements.length; i++) {
      const announcement = announcements[i]
      const metadata = txMetadata?.[i]

      // Validate announcement - viewTag is already a number from parseAnnouncement
      const viewTag = announcement.viewTag
      if (!Number.isInteger(viewTag) || viewTag < VIEW_TAG_MIN || viewTag > VIEW_TAG_MAX) {
        continue
      }

      // Get stealth address as ed25519 public key
      let stealthPublicKey: HexString
      try {
        if (isImplicitAccount(announcement.stealthAddress)) {
          stealthPublicKey = implicitAccountToEd25519PublicKey(announcement.stealthAddress)
        } else if (announcement.stealthAddress.startsWith('0x')) {
          stealthPublicKey = announcement.stealthAddress as HexString
        } else {
          continue
        }
      } catch {
        continue
      }

      // Validate ephemeral public key
      if (!isValidHex(announcement.ephemeralPublicKey)) {
        continue
      }

      const stealthAddressToCheck: StealthAddress = {
        address: stealthPublicKey,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag,
      }

      // Check against each recipient
      for (const recipient of this.recipients) {
        try {
          const isMatch = checkNEARStealthAddress(
            stealthAddressToCheck,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )

          if (isMatch) {
            // Get stealth address as implicit account
            const stealthAddress = isImplicitAccount(announcement.stealthAddress)
              ? announcement.stealthAddress
              : bytesToHex(hexToBytes(stealthPublicKey.slice(2)))

            // Get balance if not provided
            let amount = metadata?.amount ?? 0n
            if (amount === 0n && isImplicitAccount(stealthAddress)) {
              try {
                amount = await this.getStealthAddressBalance(stealthAddress)
              } catch {
                // Account might not exist yet
              }
            }

            payments.push({
              stealthAddress,
              stealthPublicKey,
              ephemeralPublicKey: announcement.ephemeralPublicKey,
              viewTag,
              amount,
              tokenContract: metadata?.tokenContract ?? null,
              decimals: metadata?.decimals ?? 24,
              txHash: metadata?.txHash ?? '',
              blockHeight: metadata?.blockHeight ?? 0,
              timestamp: metadata?.timestamp ?? Date.now(),
              recipientLabel: recipient.label,
            })

            // Only one recipient can match per announcement
            break
          }
        } catch {
          // Invalid keys or malformed data, try next recipient
        }
      }
    }

    return payments
  }

  /**
   * Parse announcements from transaction logs
   *
   * @param logs - Transaction log strings
   * @returns Parsed announcements
   */
  parseAnnouncementsFromLogs(logs: string[]): NEARAnnouncement[] {
    const announcements: NEARAnnouncement[] = []

    for (const log of logs) {
      if (!log.includes(SIP_MEMO_PREFIX)) {
        continue
      }

      const parsed = parseAnnouncement(log)
      // parseAnnouncement only returns ephemeralPublicKey and viewTag from the memo
      // stealthAddress must be added separately from the transaction receiver
      if (parsed && parsed.ephemeralPublicKey && typeof parsed.viewTag === 'number') {
        announcements.push({
          ephemeralPublicKey: parsed.ephemeralPublicKey,
          viewTag: parsed.viewTag,
          stealthAddress: '' as HexString, // Must be filled in by caller
          stealthAccountId: '', // Must be filled in by caller
        })
      }
    }

    return announcements
  }

  /**
   * Verify a specific stealth address belongs to a recipient
   *
   * @param stealthAddress - Stealth address (implicit account or hex)
   * @param ephemeralPublicKey - Ephemeral public key from sender
   * @param viewTag - View tag for filtering
   * @param viewingPrivateKey - Viewing private key to check
   * @param spendingPrivateKey - Spending private key to check
   * @returns True if the stealth address belongs to the recipient
   */
  verifyStealthAddressOwnership(
    stealthAddress: string,
    ephemeralPublicKey: HexString,
    viewTag: number,
    viewingPrivateKey: HexString,
    spendingPrivateKey: HexString
  ): boolean {
    // Get stealth address as ed25519 public key
    let stealthPublicKey: HexString
    if (isImplicitAccount(stealthAddress)) {
      stealthPublicKey = implicitAccountToEd25519PublicKey(stealthAddress)
    } else if (stealthAddress.startsWith('0x')) {
      stealthPublicKey = stealthAddress as HexString
    } else {
      return false
    }

    const stealthAddressToCheck: StealthAddress = {
      address: stealthPublicKey,
      ephemeralPublicKey,
      viewTag,
    }

    try {
      return checkNEARStealthAddress(
        stealthAddressToCheck,
        spendingPrivateKey,
        viewingPrivateKey
      )
    } catch {
      return false
    }
  }

  /**
   * Batch check multiple announcements efficiently
   *
   * @param announcements - Announcements to check
   * @returns Map of stealth address to recipient label for matches
   */
  batchCheckAnnouncements(
    announcements: NEARAnnouncement[]
  ): Map<string, string | undefined> {
    const matches = new Map<string, string | undefined>()

    for (const announcement of announcements) {
      // viewTag is already a number from parseAnnouncement
      const viewTag = announcement.viewTag
      if (!Number.isInteger(viewTag) || viewTag < VIEW_TAG_MIN || viewTag > VIEW_TAG_MAX) {
        continue
      }

      // Get stealth public key
      let stealthPublicKey: HexString
      try {
        if (isImplicitAccount(announcement.stealthAddress)) {
          stealthPublicKey = implicitAccountToEd25519PublicKey(announcement.stealthAddress)
        } else if (announcement.stealthAddress.startsWith('0x')) {
          stealthPublicKey = announcement.stealthAddress as HexString
        } else {
          continue
        }
      } catch {
        continue
      }

      const stealthAddressToCheck: StealthAddress = {
        address: stealthPublicKey,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag,
      }

      for (const recipient of this.recipients) {
        try {
          const isMatch = checkNEARStealthAddress(
            stealthAddressToCheck,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )

          if (isMatch) {
            matches.set(announcement.stealthAddress, recipient.label)
            break
          }
        } catch {
          continue
        }
      }
    }

    return matches
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a new NEAR stealth scanner
 *
 * @param options - Scanner options
 * @returns Configured stealth scanner
 *
 * @example
 * ```typescript
 * const scanner = createNEARStealthScanner({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 * })
 * ```
 */
export function createNEARStealthScanner(
  options: NEARStealthScannerOptions
): NEARStealthScanner {
  return new NEARStealthScanner(options)
}

// ─── Batch Scanning Utilities ─────────────────────────────────────────────────

/**
 * Batch scan announcements for multiple recipients
 *
 * @param options - Scanner options
 * @param recipients - Recipients to scan for
 * @param announcements - Announcements to check
 * @returns All detected payments grouped by recipient
 *
 * @example
 * ```typescript
 * const results = await batchScanNEARAnnouncements(
 *   { rpcUrl: 'https://rpc.mainnet.near.org' },
 *   [
 *     { viewingPrivateKey: '0x...', spendingPublicKey: '0x...', label: 'Wallet 1' },
 *     { viewingPrivateKey: '0x...', spendingPublicKey: '0x...', label: 'Wallet 2' },
 *   ],
 *   announcements
 * )
 *
 * for (const [label, payments] of Object.entries(results)) {
 *   console.log(`${label}: ${payments.length} payments`)
 * }
 * ```
 */
export async function batchScanNEARAnnouncements(
  options: NEARStealthScannerOptions,
  recipients: NEARScanRecipient[],
  announcements: NEARAnnouncement[],
  txMetadata?: Array<{
    txHash: string
    blockHeight: number
    timestamp: number
    amount?: bigint
    tokenContract?: string
    decimals?: number
  }>
): Promise<Record<string, NEARDetectedPaymentResult[]>> {
  const scanner = createNEARStealthScanner(options)

  for (const recipient of recipients) {
    scanner.addRecipient(recipient)
  }

  const payments = await scanner.scanAnnouncements(announcements, txMetadata)

  // Group by recipient label
  const grouped: Record<string, NEARDetectedPaymentResult[]> = {}

  for (const recipient of recipients) {
    const label = recipient.label || 'unknown'
    grouped[label] = payments.filter(p => p.recipientLabel === label)
  }

  return grouped
}

/**
 * Quick check if any announcement matches any recipient
 *
 * Useful for efficient initial filtering before detailed processing.
 *
 * @param recipients - Recipients to check
 * @param announcements - Announcements to check
 * @returns True if any announcement matches any recipient
 */
export function hasNEARAnnouncementMatch(
  recipients: NEARScanRecipient[],
  announcements: NEARAnnouncement[]
): boolean {
  for (const announcement of announcements) {
    // viewTag is already a number from parseAnnouncement
    const viewTag = announcement.viewTag
    if (!Number.isInteger(viewTag) || viewTag < VIEW_TAG_MIN || viewTag > VIEW_TAG_MAX) {
      continue
    }

    let stealthPublicKey: HexString
    try {
      if (isImplicitAccount(announcement.stealthAddress)) {
        stealthPublicKey = implicitAccountToEd25519PublicKey(announcement.stealthAddress)
      } else if (announcement.stealthAddress.startsWith('0x')) {
        stealthPublicKey = announcement.stealthAddress as HexString
      } else {
        continue
      }
    } catch {
      continue
    }

    const stealthAddressToCheck: StealthAddress = {
      address: stealthPublicKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
      viewTag,
    }

    for (const recipient of recipients) {
      try {
        const isMatch = checkNEARStealthAddress(
          stealthAddressToCheck,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )

        if (isMatch) {
          return true
        }
      } catch {
        continue
      }
    }
  }

  return false
}
