/**
 * NEAR Privacy Transaction History
 *
 * Provides transaction history retrieval for NEAR privacy operations,
 * including stealth address resolution, amount revelation, and filtering.
 *
 * ## Features
 *
 * - Historical transaction scanning with pagination
 * - Amount decryption for owned transactions via viewing key
 * - Transaction type classification (send, receive, contract_call)
 * - Filtering by date range, type, token
 * - Search by transaction hash or address
 * - Export to CSV/JSON formats
 *
 * @module chains/near/history
 */

import type { HexString } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidHex } from '../../validation'
import {
  createNEARStealthScanner,
  type NEARDetectedPaymentResult,
} from './resolver'
import { getExplorerUrl } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Transaction type classification
 */
export type NEARTransactionType = 'send' | 'receive' | 'contract_call'

/**
 * Privacy level indicator
 */
export type NEARHistoryPrivacyLevel = 'transparent' | 'shielded' | 'compliant'

/**
 * A historical transaction with privacy metadata
 */
export interface NEARHistoricalTransaction {
  /** Unique transaction hash */
  hash: string

  /** Transaction timestamp (milliseconds since epoch) */
  timestamp: number

  /** Block height */
  blockHeight: number

  /** Transaction type */
  type: NEARTransactionType

  /** Stealth address (implicit account ID) */
  stealthAddress: string

  /** Stealth public key (hex) */
  stealthPublicKey: HexString

  /** Ephemeral public key from sender (hex) */
  ephemeralPublicKey: HexString

  /** View tag for efficient scanning */
  viewTag: number

  /** Amount in smallest units (yoctoNEAR or token units) */
  amount: string

  /** Human-readable amount (with decimals applied) */
  amountFormatted: string

  /** Token symbol or 'NEAR' */
  token: string

  /** Token contract address (null for native NEAR) */
  tokenContract: string | null

  /** Token decimals */
  decimals: number

  /** Privacy level used */
  privacyLevel: NEARHistoryPrivacyLevel

  /** Whether the amount was revealed via viewing key */
  amountRevealed: boolean

  /** Sender account (if known) */
  sender?: string

  /** Receiver account (if known) */
  receiver?: string

  /** Transaction fee in yoctoNEAR */
  fee?: string

  /** Block explorer URL */
  explorerUrl: string

  /** Label for this recipient (if multiple viewing keys) */
  recipientLabel?: string
}

/**
 * Parameters for retrieving transaction history
 */
export interface NEARTransactionHistoryParams {
  /** NEAR RPC URL */
  rpcUrl: string

  /** Viewing private key for scanning (hex) */
  viewingPrivateKey: HexString

  /** Spending private key for address verification (hex) */
  spendingPrivateKey: HexString

  /** Network type */
  network?: 'mainnet' | 'testnet'

  /** Start block height (optional) */
  fromBlock?: number

  /** End block height (optional) */
  toBlock?: number

  /** Start timestamp filter (milliseconds) */
  fromTimestamp?: number

  /** End timestamp filter (milliseconds) */
  toTimestamp?: number

  /** Maximum transactions to return */
  limit?: number

  /** Pagination cursor */
  cursor?: string

  /** Filter by transaction types */
  typeFilter?: NEARTransactionType[]

  /** Filter by token contracts (null = native NEAR) */
  tokenFilter?: (string | null)[]

  /** Search by transaction hash or address */
  searchQuery?: string

  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Result of transaction history retrieval
 */
export interface NEARTransactionHistoryResult {
  /** Retrieved transactions */
  transactions: NEARHistoricalTransaction[]

  /** Total transactions found (before filtering) */
  totalCount: number

  /** Whether more results are available */
  hasMore: boolean

  /** Cursor for next page */
  nextCursor?: string

  /** Last block height scanned */
  lastBlockHeight?: number

  /** Time taken in milliseconds */
  scanTimeMs: number
}

/**
 * Export format options
 */
export type NEARExportFormat = 'csv' | 'json'

/**
 * Export options
 */
export interface NEARExportOptions {
  /** Export format */
  format: NEARExportFormat

  /** Include headers in CSV */
  includeHeaders?: boolean

  /** Fields to include (default: all) */
  fields?: (keyof NEARHistoricalTransaction)[]

  /** Pretty print JSON */
  prettyPrint?: boolean
}

/**
 * Network type for history queries
 */
type HistoryNetwork = 'mainnet' | 'testnet'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50
const DEFAULT_TIMEOUT = 30000

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Format amount with decimals
 */
function formatAmount(amount: bigint, decimals: number): string {
  const str = amount.toString()
  if (decimals === 0) return str

  const padded = str.padStart(decimals + 1, '0')
  const intPart = padded.slice(0, -decimals) || '0'
  const fracPart = padded.slice(-decimals).replace(/0+$/, '')

  return fracPart ? `${intPart}.${fracPart}` : intPart
}

/**
 * Determine transaction type based on context
 */
function classifyTransaction(
  _payment: NEARDetectedPaymentResult,
  _userStealthAddresses: Set<string>
): NEARTransactionType {
  // For now, all detected payments are "receive" type
  // TODO: Track outgoing transactions when we have sender info
  return 'receive'
}

/**
 * Determine privacy level from transaction metadata
 */
function determinePrivacyLevel(): NEARHistoryPrivacyLevel {
  // All stealth address transactions are at least "shielded"
  // "compliant" would require viewing key metadata in the announcement
  return 'shielded'
}

/**
 * Convert detected payment to historical transaction format
 */
function paymentToTransaction(
  payment: NEARDetectedPaymentResult,
  network: 'mainnet' | 'testnet',
  userStealthAddresses: Set<string>
): NEARHistoricalTransaction {
  const type = classifyTransaction(payment, userStealthAddresses)
  const privacyLevel = determinePrivacyLevel()
  const token = payment.tokenContract ? getTokenSymbol(payment.tokenContract) : 'NEAR'

  return {
    hash: payment.txHash,
    timestamp: Math.floor(payment.timestamp / 1_000_000), // nanoseconds to milliseconds
    blockHeight: payment.blockHeight,
    type,
    stealthAddress: payment.stealthAddress,
    stealthPublicKey: payment.stealthPublicKey,
    ephemeralPublicKey: payment.ephemeralPublicKey,
    viewTag: payment.viewTag,
    amount: payment.amount.toString(),
    amountFormatted: formatAmount(payment.amount, payment.decimals),
    token,
    tokenContract: payment.tokenContract,
    decimals: payment.decimals,
    privacyLevel,
    amountRevealed: true, // Amount is revealed via viewing key
    explorerUrl: getExplorerUrl(payment.txHash, network),
    recipientLabel: payment.recipientLabel,
  }
}

/**
 * Get token symbol from contract address
 */
function getTokenSymbol(tokenContract: string): string {
  // Well-known tokens
  const knownTokens: Record<string, string> = {
    'wrap.near': 'wNEAR',
    'usdt.tether-token.near': 'USDT',
    'usdc.near': 'USDC',
    'aurora': 'AURORA',
    'meta-pool.near': 'stNEAR',
    'linear-protocol.near': 'LiNEAR',
  }

  return knownTokens[tokenContract] || tokenContract.split('.')[0].toUpperCase()
}

/**
 * Apply filters to transactions
 */
function applyFilters(
  transactions: NEARHistoricalTransaction[],
  params: NEARTransactionHistoryParams
): NEARHistoricalTransaction[] {
  let filtered = transactions

  // Filter by timestamp range
  if (params.fromTimestamp) {
    filtered = filtered.filter(tx => tx.timestamp >= params.fromTimestamp!)
  }
  if (params.toTimestamp) {
    filtered = filtered.filter(tx => tx.timestamp <= params.toTimestamp!)
  }

  // Filter by transaction type
  if (params.typeFilter && params.typeFilter.length > 0) {
    filtered = filtered.filter(tx => params.typeFilter!.includes(tx.type))
  }

  // Filter by token
  if (params.tokenFilter && params.tokenFilter.length > 0) {
    filtered = filtered.filter(tx => params.tokenFilter!.includes(tx.tokenContract))
  }

  // Search by hash or address
  if (params.searchQuery) {
    const query = params.searchQuery.toLowerCase()
    filtered = filtered.filter(tx =>
      tx.hash.toLowerCase().includes(query) ||
      tx.stealthAddress.toLowerCase().includes(query) ||
      (tx.sender && tx.sender.toLowerCase().includes(query)) ||
      (tx.receiver && tx.receiver.toLowerCase().includes(query))
    )
  }

  return filtered
}

// ─── Main Functions ───────────────────────────────────────────────────────────

/**
 * Get transaction history for a NEAR privacy wallet
 *
 * Scans the blockchain for stealth address announcements and returns
 * transactions belonging to the provided viewing key.
 *
 * Note: In production, this would integrate with a blockchain indexer
 * for efficient announcement fetching. Currently uses the scanner API
 * which requires announcements to be pre-fetched.
 *
 * @param params - History retrieval parameters
 * @returns Transaction history result with pagination
 *
 * @example
 * ```typescript
 * const history = await getTransactionHistory({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   viewingPrivateKey: '0x...',
 *   spendingPrivateKey: '0x...',
 *   limit: 20,
 * })
 *
 * for (const tx of history.transactions) {
 *   console.log(`${tx.type}: ${tx.amountFormatted} ${tx.token}`)
 * }
 * ```
 */
export async function getTransactionHistory(
  params: NEARTransactionHistoryParams
): Promise<NEARTransactionHistoryResult> {
  const startTime = Date.now()

  // Validate inputs
  if (!params.rpcUrl) {
    throw new ValidationError('rpcUrl is required')
  }
  if (!isValidHex(params.viewingPrivateKey)) {
    throw new ValidationError('Invalid viewing private key')
  }
  if (!isValidHex(params.spendingPrivateKey)) {
    throw new ValidationError('Invalid spending private key')
  }

  const network: HistoryNetwork = params.network === 'testnet' ? 'testnet' : 'mainnet'
  const limit = params.limit ?? DEFAULT_LIMIT
  const timeout = params.timeout ?? DEFAULT_TIMEOUT

  // Create scanner and add recipient
  const scanner = createNEARStealthScanner({
    rpcUrl: params.rpcUrl,
    network,
    timeout,
  })

  scanner.addRecipient({
    viewingPrivateKey: params.viewingPrivateKey,
    spendingPrivateKey: params.spendingPrivateKey,
  })

  // Fetch announcements from the chain
  // This is a placeholder - in production, use an indexer service
  const announcements = await fetchAnnouncementsFromChain(params.rpcUrl, {
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    limit: limit * 2, // Over-fetch to account for filtering
  })

  // Scan announcements for payments to this recipient
  const payments = await scanner.scanAnnouncements(
    announcements.items,
    announcements.metadata
  )

  // Track user's stealth addresses for type classification
  const userStealthAddresses = new Set<string>(
    payments.map((p: NEARDetectedPaymentResult) => p.stealthAddress)
  )

  // Convert to historical transaction format
  let transactions = payments.map((payment: NEARDetectedPaymentResult) =>
    paymentToTransaction(payment, network, userStealthAddresses)
  )

  // Apply filters
  transactions = applyFilters(transactions, params)

  // Sort by timestamp descending (newest first)
  transactions.sort((a: NEARHistoricalTransaction, b: NEARHistoricalTransaction) =>
    b.timestamp - a.timestamp
  )

  // Apply limit after filtering
  const hasMore = transactions.length > limit || announcements.hasMore
  transactions = transactions.slice(0, limit)

  return {
    transactions,
    totalCount: announcements.scannedCount,
    hasMore,
    nextCursor: announcements.nextCursor,
    lastBlockHeight: announcements.lastBlockHeight,
    scanTimeMs: Date.now() - startTime,
  }
}

/**
 * Fetch SIP announcements from the NEAR blockchain
 *
 * This is a placeholder implementation. In production, this would:
 * 1. Query an indexer service for SIP: memo prefixed transactions
 * 2. Parse announcements from transaction logs
 * 3. Support pagination via cursor
 *
 * @internal
 */
async function fetchAnnouncementsFromChain(
  _rpcUrl: string,
  _options: {
    fromBlock?: number
    toBlock?: number
    limit?: number
    cursor?: string
  }
): Promise<{
  items: Array<{
    ephemeralPublicKey: HexString
    viewTag: number
    stealthAddress: HexString
    stealthAccountId: string
  }>
  metadata: Array<{
    txHash: string
    blockHeight: number
    timestamp: number
    amount?: bigint
    tokenContract?: string
    decimals?: number
  }>
  scannedCount: number
  hasMore: boolean
  nextCursor?: string
  lastBlockHeight?: number
}> {
  // TODO: Implement actual indexer integration
  // This placeholder returns empty results until indexer is available
  //
  // Production implementation would:
  // 1. Query NEAR Indexer for transactions with SIP: memo prefix
  // 2. Parse announcements from transaction receipts/logs
  // 3. Extract stealth address from transaction receiver
  // 4. Support cursor-based pagination

  return {
    items: [],
    metadata: [],
    scannedCount: 0,
    hasMore: false,
    nextCursor: undefined,
    lastBlockHeight: _options.toBlock,
  }
}

/**
 * Export transactions to CSV or JSON format
 *
 * @param transactions - Transactions to export
 * @param options - Export options
 * @returns Formatted string in the specified format
 *
 * @example
 * ```typescript
 * const csv = exportTransactions(history.transactions, { format: 'csv' })
 * downloadFile('transactions.csv', csv, 'text/csv')
 *
 * const json = exportTransactions(history.transactions, {
 *   format: 'json',
 *   prettyPrint: true,
 * })
 * ```
 */
export function exportTransactions(
  transactions: NEARHistoricalTransaction[],
  options: NEARExportOptions
): string {
  const { format, includeHeaders = true, fields, prettyPrint = false } = options

  // Default fields for export
  const defaultFields: (keyof NEARHistoricalTransaction)[] = [
    'hash',
    'timestamp',
    'type',
    'amountFormatted',
    'token',
    'stealthAddress',
    'privacyLevel',
    'explorerUrl',
  ]

  const exportFields = fields ?? defaultFields

  if (format === 'json') {
    const data = transactions.map(tx => {
      const obj: Partial<NEARHistoricalTransaction> = {}
      for (const field of exportFields) {
        obj[field] = tx[field] as never
      }
      return obj
    })
    return prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  }

  // CSV format
  const rows: string[] = []

  if (includeHeaders) {
    rows.push(exportFields.join(','))
  }

  for (const tx of transactions) {
    const values = exportFields.map(field => {
      const value = tx[field]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    })
    rows.push(values.join(','))
  }

  return rows.join('\n')
}

/**
 * Get transaction by hash
 *
 * @param hash - Transaction hash to look up
 * @param params - History parameters (for authentication)
 * @returns Transaction if found and owned, null otherwise
 */
export async function getTransactionByHash(
  hash: string,
  params: Omit<NEARTransactionHistoryParams, 'searchQuery' | 'limit'>
): Promise<NEARHistoricalTransaction | null> {
  const result = await getTransactionHistory({
    ...params,
    searchQuery: hash,
    limit: 1,
  })

  return result.transactions[0] ?? null
}

/**
 * Get transaction count for a date range
 *
 * @param params - History parameters
 * @returns Count of transactions in the range
 */
export async function getTransactionCount(
  params: Omit<NEARTransactionHistoryParams, 'limit' | 'cursor'>
): Promise<number> {
  const result = await getTransactionHistory({
    ...params,
    limit: 10000, // High limit to get total count
  })

  return result.transactions.length
}

/**
 * Get transaction summary statistics
 *
 * @param transactions - Transactions to summarize
 * @returns Summary statistics
 */
export function getTransactionSummary(transactions: NEARHistoricalTransaction[]): {
  totalReceived: Record<string, bigint>
  totalSent: Record<string, bigint>
  transactionCount: number
  uniqueAddresses: number
  dateRange: { from: number; to: number } | null
} {
  const totalReceived: Record<string, bigint> = {}
  const totalSent: Record<string, bigint> = {}
  const addresses = new Set<string>()

  let minTimestamp = Infinity
  let maxTimestamp = -Infinity

  for (const tx of transactions) {
    const token = tx.token
    const amount = BigInt(tx.amount)

    if (tx.type === 'receive') {
      totalReceived[token] = (totalReceived[token] ?? 0n) + amount
    } else if (tx.type === 'send') {
      totalSent[token] = (totalSent[token] ?? 0n) + amount
    }

    addresses.add(tx.stealthAddress)
    if (tx.sender) addresses.add(tx.sender)
    if (tx.receiver) addresses.add(tx.receiver)

    minTimestamp = Math.min(minTimestamp, tx.timestamp)
    maxTimestamp = Math.max(maxTimestamp, tx.timestamp)
  }

  return {
    totalReceived,
    totalSent,
    transactionCount: transactions.length,
    uniqueAddresses: addresses.size,
    dateRange: transactions.length > 0
      ? { from: minTimestamp, to: maxTimestamp }
      : null,
  }
}
