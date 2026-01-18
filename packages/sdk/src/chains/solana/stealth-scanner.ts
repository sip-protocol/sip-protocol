/**
 * Solana Stealth Address Scanner
 *
 * Advanced scanner for detecting incoming stealth payments with support for:
 * - Real-time WebSocket subscriptions
 * - Historical scanning with pagination
 * - Batch scanning for multiple viewing keys
 * - Efficient view tag filtering
 *
 * @module chains/solana/stealth-scanner
 */

import { PublicKey, type Connection } from '@solana/web3.js'
// hexToBytes available but unused - kept for potential future view tag computation
// import { hexToBytes } from '@noble/hashes/utils'
import type { StealthAddress, HexString } from '@sip-protocol/types'
import { checkEd25519StealthAddress, solanaAddressToEd25519PublicKey } from '../../stealth'
import { parseAnnouncement, type SolanaAnnouncement } from './types'
import {
  SIP_MEMO_PREFIX,
  MEMO_PROGRAM_ID,
  DEFAULT_SCAN_LIMIT,
  VIEW_TAG_MAX,
} from './constants'
import { getTokenSymbol, parseTokenTransferFromBalances } from './utils'
import type { SolanaRPCProvider } from './providers/interface'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A recipient to scan for (viewing + spending key pair)
 */
export interface ScanRecipient {
  /**
   * Viewing private key (hex)
   * @security SENSITIVE - enables scanning for payments
   */
  viewingPrivateKey: HexString

  /**
   * Spending public key (hex)
   */
  spendingPublicKey: HexString

  /**
   * Optional label for this recipient
   */
  label?: string
}

/**
 * Options for the stealth scanner
 */
export interface StealthScannerOptions {
  /**
   * Solana RPC connection
   */
  connection: Connection

  /**
   * Optional RPC provider for efficient queries
   */
  provider?: SolanaRPCProvider

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
}

/**
 * Options for historical scanning
 */
export interface HistoricalScanOptions {
  /**
   * Start slot for scanning
   */
  fromSlot?: number

  /**
   * End slot for scanning
   */
  toSlot?: number

  /**
   * Maximum number of transactions to scan
   * @default 1000
   */
  limit?: number

  /**
   * Cursor for pagination (signature of last scanned tx)
   */
  beforeSignature?: string
}

/**
 * A detected stealth payment
 */
export interface DetectedPayment {
  /**
   * Stealth address that received the payment (base58)
   */
  stealthAddress: string

  /**
   * Ephemeral public key from the sender (base58)
   */
  ephemeralPublicKey: string

  /**
   * View tag for efficient scanning
   */
  viewTag: number

  /**
   * Token amount (in smallest unit)
   */
  amount: bigint

  /**
   * Token mint address (base58)
   */
  mint: string

  /**
   * Human-readable token symbol
   */
  tokenSymbol: string

  /**
   * Transaction signature
   */
  txSignature: string

  /**
   * Slot number
   */
  slot: number

  /**
   * Unix timestamp
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
export interface HistoricalScanResult {
  /**
   * Detected payments
   */
  payments: DetectedPayment[]

  /**
   * Total transactions scanned
   */
  scannedCount: number

  /**
   * Whether more results are available
   */
  hasMore: boolean

  /**
   * Cursor for next page (last signature scanned)
   */
  nextCursor?: string

  /**
   * Last slot scanned
   */
  lastSlot?: number
}

/**
 * Callback for real-time payment detection
 */
export type PaymentCallback = (payment: DetectedPayment) => void

/**
 * Callback for scan errors
 */
export type ErrorCallback = (error: Error) => void

// ─── View Tag Computation ─────────────────────────────────────────────────────
// NOTE: View tag filtering optimization is planned for future implementation.
// The view tag is derived from the shared secret between ephemeral and viewing keys,
// which allows for efficient filtering without full ECDH computation.
// Currently all announcements are checked against all recipients.

// ─── StealthScanner Class ─────────────────────────────────────────────────────

/**
 * Advanced stealth address scanner
 *
 * Provides efficient scanning for incoming stealth payments with support for
 * multiple recipients, real-time subscriptions, and pagination.
 *
 * @example Basic usage
 * ```typescript
 * const scanner = new StealthScanner({
 *   connection,
 *   provider: heliusProvider,
 * })
 *
 * // Add recipients to scan for
 * scanner.addRecipient({
 *   viewingPrivateKey: '0x...',
 *   spendingPublicKey: '0x...',
 *   label: 'Wallet 1',
 * })
 *
 * // Historical scan
 * const result = await scanner.scanHistorical({
 *   fromSlot: 250000000,
 *   limit: 1000,
 * })
 *
 * console.log(`Found ${result.payments.length} payments`)
 * ```
 *
 * @example Real-time scanning
 * ```typescript
 * scanner.subscribe(
 *   (payment) => console.log('New payment:', payment),
 *   (error) => console.error('Scan error:', error)
 * )
 *
 * // Later: stop subscription
 * scanner.unsubscribe()
 * ```
 */
export class StealthScanner {
  private connection: Connection
  private provider?: SolanaRPCProvider
  private recipients: ScanRecipient[] = []
  private batchSize: number
  private subscriptionId: number | null = null
  private paymentCallback: PaymentCallback | null = null
  private errorCallback: ErrorCallback | null = null

  constructor(options: StealthScannerOptions) {
    this.connection = options.connection
    this.provider = options.provider
    this.batchSize = options.batchSize ?? DEFAULT_SCAN_LIMIT
    // Note: useViewTagFilter option is accepted for future optimization
    // Currently all announcements are checked against all recipients
    void options.useViewTagFilter
  }

  /**
   * Add a recipient to scan for
   *
   * @param recipient - Recipient with viewing/spending keys
   */
  addRecipient(recipient: ScanRecipient): void {
    this.recipients.push(recipient)
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
   * Get current recipients
   */
  getRecipients(): ScanRecipient[] {
    return [...this.recipients]
  }

  /**
   * Scan historical transactions for stealth payments
   *
   * @param options - Scan options
   * @returns Scan result with detected payments
   */
  async scanHistorical(options: HistoricalScanOptions = {}): Promise<HistoricalScanResult> {
    if (this.recipients.length === 0) {
      return {
        payments: [],
        scannedCount: 0,
        hasMore: false,
      }
    }

    const {
      fromSlot,
      toSlot,
      limit = 1000,
      beforeSignature,
    } = options

    const payments: DetectedPayment[] = []
    let scannedCount = 0
    let lastSignature: string | undefined
    let lastSlot: number | undefined

    const memoProgram = new PublicKey(MEMO_PROGRAM_ID)

    try {
      // Get transaction signatures
      const signatures = await this.connection.getSignaturesForAddress(
        memoProgram,
        {
          limit: Math.min(limit, this.batchSize),
          before: beforeSignature,
          minContextSlot: fromSlot,
        }
      )

      // Filter by slot range
      const filteredSignatures = toSlot
        ? signatures.filter(s => s.slot <= toSlot)
        : signatures

      // Process each transaction
      for (const sigInfo of filteredSignatures) {
        scannedCount++
        lastSignature = sigInfo.signature
        lastSlot = sigInfo.slot

        try {
          const tx = await this.connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          })

          if (!tx?.meta?.logMessages) continue

          // Look for SIP announcements in logs
          for (const log of tx.meta.logMessages) {
            if (!log.includes(SIP_MEMO_PREFIX)) continue

            const memoMatch = log.match(/Program log: (.+)/)
            if (!memoMatch) continue

            const announcement = parseAnnouncement(memoMatch[1])
            if (!announcement) continue

            // Check against all recipients
            const detectedPayment = await this.checkAnnouncementAgainstRecipients(
              announcement,
              { signature: sigInfo.signature, slot: sigInfo.slot, blockTime: sigInfo.blockTime ?? null },
              tx.meta.preTokenBalances as any,
              tx.meta.postTokenBalances as any
            )

            if (detectedPayment) {
              payments.push(detectedPayment)
            }
          }
        } catch {
          // Skip failed transaction parsing
        }
      }

      return {
        payments,
        scannedCount,
        hasMore: signatures.length >= Math.min(limit, this.batchSize),
        nextCursor: lastSignature,
        lastSlot,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Historical scan failed: ${message}`)
    }
  }

  /**
   * Subscribe to real-time stealth payments
   *
   * Uses WebSocket to monitor new transactions for stealth payments.
   *
   * @param onPayment - Callback when a payment is detected
   * @param onError - Callback when an error occurs
   */
  subscribe(onPayment: PaymentCallback, onError?: ErrorCallback): void {
    if (this.subscriptionId !== null) {
      throw new Error('Already subscribed. Call unsubscribe() first.')
    }

    if (this.recipients.length === 0) {
      throw new Error('No recipients configured. Call addRecipient() first.')
    }

    this.paymentCallback = onPayment
    this.errorCallback = onError ?? null

    const memoProgram = new PublicKey(MEMO_PROGRAM_ID)

    // Subscribe to logs mentioning the memo program
    this.subscriptionId = this.connection.onLogs(
      memoProgram,
      async (logs) => {
        try {
          // Look for SIP announcements
          for (const log of logs.logs) {
            if (!log.includes(SIP_MEMO_PREFIX)) continue

            const memoMatch = log.match(/Program log: (.+)/)
            if (!memoMatch) continue

            const announcement = parseAnnouncement(memoMatch[1])
            if (!announcement) continue

            // Get full transaction for balance info
            const tx = await this.connection.getTransaction(logs.signature, {
              maxSupportedTransactionVersion: 0,
            })

            if (!tx?.meta) continue

            const payment = await this.checkAnnouncementAgainstRecipients(
              announcement,
              { signature: logs.signature, slot: tx.slot ?? 0, blockTime: tx.blockTime ?? null },
              tx.meta.preTokenBalances as any,
              tx.meta.postTokenBalances as any
            )

            if (payment && this.paymentCallback) {
              this.paymentCallback(payment)
            }
          }
        } catch (err) {
          if (this.errorCallback) {
            this.errorCallback(err instanceof Error ? err : new Error(String(err)))
          }
        }
      },
      'confirmed'
    )
  }

  /**
   * Unsubscribe from real-time payments
   */
  async unsubscribe(): Promise<void> {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId)
      this.subscriptionId = null
      this.paymentCallback = null
      this.errorCallback = null
    }
  }

  /**
   * Check if currently subscribed
   */
  isSubscribed(): boolean {
    return this.subscriptionId !== null
  }

  /**
   * Check an announcement against all recipients
   */
  private async checkAnnouncementAgainstRecipients(
    announcement: SolanaAnnouncement,
    sigInfo: { signature: string; slot: number; blockTime: number | null },
    preBalances: Parameters<typeof parseTokenTransferFromBalances>[0],
    postBalances: Parameters<typeof parseTokenTransferFromBalances>[1]
  ): Promise<DetectedPayment | null> {
    // Parse view tag
    const viewTagNumber = parseInt(announcement.viewTag, 16)
    if (!Number.isInteger(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > VIEW_TAG_MAX) {
      return null
    }

    // Convert ephemeral key
    let ephemeralPubKeyHex: HexString
    try {
      ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(announcement.ephemeralPublicKey)
    } catch {
      return null
    }

    // Convert stealth address
    let stealthAddressHex: HexString
    try {
      stealthAddressHex = announcement.stealthAddress
        ? solanaAddressToEd25519PublicKey(announcement.stealthAddress)
        : ('0x' + '00'.repeat(32)) as HexString
    } catch {
      return null
    }

    const stealthAddressToCheck: StealthAddress = {
      address: stealthAddressHex,
      ephemeralPublicKey: ephemeralPubKeyHex,
      viewTag: viewTagNumber,
    }

    // Check against each recipient
    for (const recipient of this.recipients) {
      try {
        const isMatch = checkEd25519StealthAddress(
          stealthAddressToCheck,
          recipient.viewingPrivateKey,
          recipient.spendingPublicKey
        )

        if (isMatch) {
          // Parse token transfer
          const transferInfo = parseTokenTransferFromBalances(preBalances, postBalances)
          if (!transferInfo) continue

          // Get current balance if provider available
          let amount = transferInfo.amount
          if (this.provider && announcement.stealthAddress) {
            try {
              const balance = await this.provider.getTokenBalance(
                announcement.stealthAddress,
                transferInfo.mint
              )
              if (balance > 0n) {
                amount = balance
              }
            } catch {
              // Use parsed amount
            }
          }

          return {
            stealthAddress: announcement.stealthAddress || '',
            ephemeralPublicKey: announcement.ephemeralPublicKey,
            viewTag: viewTagNumber,
            amount,
            mint: transferInfo.mint,
            tokenSymbol: getTokenSymbol(transferInfo.mint) || 'UNKNOWN',
            txSignature: sigInfo.signature,
            slot: sigInfo.slot,
            timestamp: sigInfo.blockTime || 0,
            recipientLabel: recipient.label,
          }
        }
      } catch {
        // Invalid keys or malformed data, try next recipient
      }
    }

    return null
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a new stealth scanner
 *
 * @param options - Scanner options
 * @returns Configured stealth scanner
 *
 * @example
 * ```typescript
 * const scanner = createStealthScanner({
 *   connection,
 *   provider: heliusProvider,
 * })
 * ```
 */
export function createStealthScanner(options: StealthScannerOptions): StealthScanner {
  return new StealthScanner(options)
}

// ─── Batch Scanning Utilities ─────────────────────────────────────────────────

/**
 * Batch scan for multiple recipients across a slot range
 *
 * Efficiently scans a range of slots for payments to multiple recipients.
 * Use this for initial wallet sync or periodic historical scans.
 *
 * @param options - Scanner options
 * @param recipients - Recipients to scan for
 * @param scanOptions - Historical scan options
 * @returns All detected payments grouped by recipient
 *
 * @example
 * ```typescript
 * const results = await batchScanForRecipients(
 *   { connection, provider },
 *   [
 *     { viewingPrivateKey: '0x...', spendingPublicKey: '0x...', label: 'Wallet 1' },
 *     { viewingPrivateKey: '0x...', spendingPublicKey: '0x...', label: 'Wallet 2' },
 *   ],
 *   { fromSlot: 250000000, limit: 5000 }
 * )
 *
 * for (const [label, payments] of Object.entries(results)) {
 *   console.log(`${label}: ${payments.length} payments`)
 * }
 * ```
 */
export async function batchScanForRecipients(
  options: StealthScannerOptions,
  recipients: ScanRecipient[],
  scanOptions: HistoricalScanOptions = {}
): Promise<Record<string, DetectedPayment[]>> {
  const scanner = createStealthScanner(options)

  for (const recipient of recipients) {
    scanner.addRecipient(recipient)
  }

  const result = await scanner.scanHistorical(scanOptions)

  // Group by recipient label
  const grouped: Record<string, DetectedPayment[]> = {}

  for (const recipient of recipients) {
    const label = recipient.label || 'unknown'
    grouped[label] = result.payments.filter(p => p.recipientLabel === label)
  }

  return grouped
}

/**
 * Full historical scan with automatic pagination
 *
 * Scans the entire history (or specified range) with automatic pagination.
 * Useful for complete wallet sync.
 *
 * @param options - Scanner options
 * @param recipients - Recipients to scan for
 * @param scanOptions - Historical scan options
 * @param onProgress - Optional progress callback
 * @returns All detected payments
 *
 * @example
 * ```typescript
 * const payments = await fullHistoricalScan(
 *   { connection },
 *   [{ viewingPrivateKey, spendingPublicKey }],
 *   { fromSlot: 250000000 },
 *   (scanned, found) => console.log(`Scanned ${scanned}, found ${found}`)
 * )
 * ```
 */
export async function fullHistoricalScan(
  options: StealthScannerOptions,
  recipients: ScanRecipient[],
  scanOptions: HistoricalScanOptions = {},
  onProgress?: (scannedCount: number, foundCount: number) => void
): Promise<DetectedPayment[]> {
  const scanner = createStealthScanner(options)

  for (const recipient of recipients) {
    scanner.addRecipient(recipient)
  }

  const allPayments: DetectedPayment[] = []
  let cursor: string | undefined = scanOptions.beforeSignature
  let totalScanned = 0
  const maxIterations = 100 // Safety limit

  for (let i = 0; i < maxIterations; i++) {
    const result = await scanner.scanHistorical({
      ...scanOptions,
      beforeSignature: cursor,
    })

    allPayments.push(...result.payments)
    totalScanned += result.scannedCount

    if (onProgress) {
      onProgress(totalScanned, allPayments.length)
    }

    if (!result.hasMore || !result.nextCursor) {
      break
    }

    cursor = result.nextCursor
  }

  return allPayments
}
