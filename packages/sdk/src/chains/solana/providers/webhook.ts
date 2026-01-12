/**
 * Helius Webhook Handler
 *
 * Real-time stealth payment detection using Helius webhooks.
 * Push-based notifications instead of polling for efficient scanning.
 *
 * @see https://docs.helius.dev/webhooks-and-websockets/webhooks
 *
 * @example Server setup (Express.js)
 * ```typescript
 * import express from 'express'
 * import { createWebhookHandler } from '@sip-protocol/sdk'
 *
 * const app = express()
 * app.use(express.json())
 *
 * const handler = createWebhookHandler({
 *   viewingPrivateKey: '0x...',
 *   spendingPublicKey: '0x...',
 *   onPaymentFound: (payment) => {
 *     console.log('Found payment!', payment)
 *     // Notify user, update database, etc.
 *   },
 * })
 *
 * app.post('/webhook/helius', async (req, res) => {
 *   await handler(req.body)
 *   res.status(200).send('OK')
 * })
 * ```
 *
 * @example Helius webhook configuration
 * ```
 * Webhook URL: https://your-server.com/webhook/helius
 * Transaction Type: Any (or TRANSFER for token transfers)
 * Account Addresses: [MEMO_PROGRAM_ID] for memo filtering
 * Webhook Type: raw (to get full transaction data)
 * ```
 */

import type { HexString } from '@sip-protocol/types'
import {
  checkEd25519StealthAddress,
  solanaAddressToEd25519PublicKey,
} from '../../../stealth'
import type { StealthAddress } from '@sip-protocol/types'
import { parseAnnouncement } from '../types'
import type { SolanaScanResult } from '../types'
import { SIP_MEMO_PREFIX, SOLANA_TOKEN_MINTS } from '../constants'
import { ValidationError } from '../../../errors'

/**
 * Helius raw webhook payload for a transaction
 *
 * @see https://docs.helius.dev/webhooks-and-websockets/webhooks
 */
export interface HeliusWebhookTransaction {
  /** Block timestamp (Unix seconds) */
  blockTime: number
  /** Position within block */
  indexWithinBlock?: number
  /** Transaction metadata */
  meta: {
    /** Error if transaction failed */
    err: unknown | null
    /** Transaction fee in lamports */
    fee: number
    /** Inner instructions (CPI calls) */
    innerInstructions: Array<{
      index: number
      instructions: Array<{
        accounts: number[]
        data: string
        programIdIndex: number
      }>
    }>
    /** Loaded address tables */
    loadedAddresses?: {
      readonly: string[]
      writable: string[]
    }
    /** Program log messages */
    logMessages: string[]
    /** Post-transaction lamport balances */
    postBalances: number[]
    /** Post-transaction token balances */
    postTokenBalances: Array<{
      accountIndex: number
      mint: string
      owner?: string
      programId?: string
      uiTokenAmount: {
        amount: string
        decimals: number
        uiAmount: number | null
        uiAmountString: string
      }
    }>
    /** Pre-transaction lamport balances */
    preBalances: number[]
    /** Pre-transaction token balances */
    preTokenBalances: Array<{
      accountIndex: number
      mint: string
      owner?: string
      programId?: string
      uiTokenAmount: {
        amount: string
        decimals: number
        uiAmount: number | null
        uiAmountString: string
      }
    }>
    /** Rewards */
    rewards: unknown[]
  }
  /** Slot number */
  slot: number
  /** Transaction data */
  transaction: {
    /** Transaction message */
    message: {
      /** Account keys involved */
      accountKeys: string[]
      /** Compiled instructions */
      instructions: Array<{
        accounts: number[]
        data: string
        programIdIndex: number
      }>
      /** Recent blockhash */
      recentBlockhash: string
    }
    /** Transaction signatures */
    signatures: string[]
  }
}

/**
 * Helius enhanced webhook payload
 *
 * Enhanced webhooks provide parsed/decoded transaction data.
 */
export interface HeliusEnhancedTransaction {
  /** Human-readable description */
  description: string
  /** Transaction type (TRANSFER, NFT_SALE, etc.) */
  type: string
  /** Source wallet/program */
  source: string
  /** Transaction fee in lamports */
  fee: number
  /** Fee payer address */
  feePayer: string
  /** Transaction signature */
  signature: string
  /** Slot number */
  slot: number
  /** Block timestamp */
  timestamp: number
  /** Native SOL transfers */
  nativeTransfers: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
  /** Token transfers */
  tokenTransfers: Array<{
    fromUserAccount: string
    toUserAccount: string
    fromTokenAccount: string
    toTokenAccount: string
    tokenAmount: number
    mint: string
    tokenStandard: string
  }>
  /** Account data changes */
  accountData: Array<{
    account: string
    nativeBalanceChange: number
    tokenBalanceChanges: Array<{
      userAccount: string
      tokenAccount: string
      mint: string
      rawTokenAmount: {
        tokenAmount: string
        decimals: number
      }
    }>
  }>
  /** Events (NFT sales, etc.) */
  events?: Record<string, unknown>
}

/**
 * Webhook payload (can be single transaction or array)
 */
export type HeliusWebhookPayload =
  | HeliusWebhookTransaction
  | HeliusWebhookTransaction[]
  | HeliusEnhancedTransaction
  | HeliusEnhancedTransaction[]

/**
 * Configuration for webhook handler
 */
export interface WebhookHandlerConfig {
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending public key (hex) */
  spendingPublicKey: HexString
  /**
   * Callback when a payment is found
   *
   * @param payment - The detected payment details
   */
  onPaymentFound: (payment: SolanaScanResult) => void | Promise<void>
  /**
   * Optional callback for errors
   *
   * @param error - The error that occurred
   * @param transaction - The transaction that caused the error (if available)
   */
  onError?: (error: Error, transaction?: HeliusWebhookTransaction) => void
}

/**
 * Result of processing a single webhook transaction
 */
export interface WebhookProcessResult {
  /** Whether a payment was found for us */
  found: boolean
  /** The payment details (if found) */
  payment?: SolanaScanResult
  /** Transaction signature */
  signature: string
}

/**
 * Create a webhook handler for processing Helius webhook payloads
 *
 * @param config - Handler configuration
 * @returns Async function to process webhook payloads
 *
 * @example
 * ```typescript
 * const handler = createWebhookHandler({
 *   viewingPrivateKey: recipientKeys.viewingPrivateKey,
 *   spendingPublicKey: recipientKeys.spendingPublicKey,
 *   onPaymentFound: async (payment) => {
 *     await db.savePayment(payment)
 *     await notifyUser(payment)
 *   },
 * })
 *
 * // In your Express route:
 * app.post('/webhook', async (req, res) => {
 *   const results = await handler(req.body)
 *   res.json({ processed: results.length })
 * })
 * ```
 */
export function createWebhookHandler(
  config: WebhookHandlerConfig
): (payload: HeliusWebhookPayload) => Promise<WebhookProcessResult[]> {
  const { viewingPrivateKey, spendingPublicKey, onPaymentFound, onError } = config

  // Validate required keys
  if (!viewingPrivateKey || !viewingPrivateKey.startsWith('0x')) {
    throw new ValidationError('viewingPrivateKey must be a valid hex string starting with 0x', 'viewingPrivateKey')
  }
  if (!spendingPublicKey || !spendingPublicKey.startsWith('0x')) {
    throw new ValidationError('spendingPublicKey must be a valid hex string starting with 0x', 'spendingPublicKey')
  }
  if (typeof onPaymentFound !== 'function') {
    throw new ValidationError('onPaymentFound callback is required', 'onPaymentFound')
  }

  return async (payload: HeliusWebhookPayload): Promise<WebhookProcessResult[]> => {
    // Normalize to array
    const transactions = Array.isArray(payload) ? payload : [payload]
    const results: WebhookProcessResult[] = []

    for (const tx of transactions) {
      try {
        // Handle raw vs enhanced webhook format
        if (isRawTransaction(tx)) {
          const result = await processRawTransaction(
            tx,
            viewingPrivateKey,
            spendingPublicKey,
            onPaymentFound,
            onError // H8 FIX: Pass onError to propagate callback errors
          )
          results.push(result)
        } else {
          // Enhanced transactions don't include log messages,
          // so we can't detect SIP announcements directly
          // For now, skip enhanced transactions
          results.push({
            found: false,
            signature: (tx as HeliusEnhancedTransaction).signature,
          })
        }
      } catch (error) {
        onError?.(error as Error, isRawTransaction(tx) ? tx : undefined)
        results.push({
          found: false,
          signature: getSignature(tx),
        })
      }
    }

    return results
  }
}

/**
 * Process a single raw transaction for SIP announcements
 */
async function processRawTransaction(
  tx: HeliusWebhookTransaction,
  viewingPrivateKey: HexString,
  spendingPublicKey: HexString,
  onPaymentFound: (payment: SolanaScanResult) => void | Promise<void>,
  onError?: (error: Error, transaction?: HeliusWebhookTransaction) => void
): Promise<WebhookProcessResult> {
  const signature = tx.transaction?.signatures?.[0] ?? 'unknown'

  // Check if transaction failed
  if (tx.meta?.err) {
    return { found: false, signature }
  }

  // Ensure log messages exist
  if (!tx.meta?.logMessages) {
    return { found: false, signature }
  }

  // Search log messages for SIP announcement
  for (const log of tx.meta.logMessages) {
    if (!log.includes(SIP_MEMO_PREFIX)) continue

    // Extract memo content from log
    const memoMatch = log.match(/Program log: (.+)/)
    if (!memoMatch) continue

    const memoContent = memoMatch[1]
    const announcement = parseAnnouncement(memoContent)
    if (!announcement) continue

    // Check if this payment is for us
    const ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(
      announcement.ephemeralPublicKey
    )

    // Parse view tag with bounds checking (view tags are 1 byte: 0-255)
    const viewTagNumber = parseInt(announcement.viewTag, 16)
    if (!Number.isFinite(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > 255) {
      continue // Invalid view tag, skip this announcement
    }
    const stealthAddressToCheck: StealthAddress = {
      address: announcement.stealthAddress
        ? solanaAddressToEd25519PublicKey(announcement.stealthAddress)
        : ('0x' + '00'.repeat(32)) as HexString,
      ephemeralPublicKey: ephemeralPubKeyHex,
      viewTag: viewTagNumber,
    }

    // Check if this is our payment (may throw for invalid curve points)
    let isOurs = false
    try {
      isOurs = checkEd25519StealthAddress(
        stealthAddressToCheck,
        viewingPrivateKey,
        spendingPublicKey
      )
    } catch {
      // Invalid ephemeral key or malformed data - not our payment
      continue
    }

    if (isOurs) {
      // Parse token transfer info
      const transferInfo = parseTokenTransferFromWebhook(tx)

      const payment: SolanaScanResult = {
        stealthAddress: announcement.stealthAddress || '',
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        amount: transferInfo?.amount ?? 0n,
        mint: transferInfo?.mint ?? '',
        tokenSymbol: transferInfo?.mint ? getTokenSymbol(transferInfo.mint) : undefined,
        txSignature: signature,
        slot: tx.slot,
        timestamp: tx.blockTime,
      }

      // Call the callback (wrap in try-catch to prevent callback errors from breaking processing)
      // H8 FIX: Propagate callback errors to onError instead of silently swallowing
      try {
        await onPaymentFound(payment)
      } catch (callbackError) {
        // Callback error should not prevent returning the found payment,
        // but we should propagate it to onError so user is notified
        onError?.(callbackError as Error, tx)
      }

      return { found: true, payment, signature }
    }
  }

  return { found: false, signature }
}

/**
 * Parse token transfer info from webhook transaction
 */
function parseTokenTransferFromWebhook(
  tx: HeliusWebhookTransaction
): { mint: string; amount: bigint } | null {
  const { preTokenBalances, postTokenBalances } = tx.meta

  if (!postTokenBalances || !preTokenBalances) {
    return null
  }

  // Find token balance changes
  for (const post of postTokenBalances) {
    const pre = preTokenBalances.find(
      (p) => p.accountIndex === post.accountIndex
    )

    const postAmount = BigInt(post.uiTokenAmount.amount)
    const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n

    if (postAmount > preAmount) {
      return {
        mint: post.mint,
        amount: postAmount - preAmount,
      }
    }
  }

  return null
}

/**
 * Get token symbol from mint address
 */
function getTokenSymbol(mint: string): string | undefined {
  for (const [symbol, address] of Object.entries(SOLANA_TOKEN_MINTS)) {
    if (address === mint) {
      return symbol
    }
  }
  return undefined
}

/**
 * Type guard for raw transaction
 * Raw transactions have transaction.signatures array, enhanced have signature directly
 */
function isRawTransaction(tx: unknown): tx is HeliusWebhookTransaction {
  return (
    typeof tx === 'object' &&
    tx !== null &&
    'meta' in tx &&
    'transaction' in tx &&
    Array.isArray((tx as HeliusWebhookTransaction).transaction?.signatures)
  )
}

/**
 * Get signature from either transaction type
 */
function getSignature(tx: HeliusWebhookTransaction | HeliusEnhancedTransaction): string {
  // Enhanced transactions have signature at top level
  if ('signature' in tx && typeof (tx as HeliusEnhancedTransaction).signature === 'string') {
    return (tx as HeliusEnhancedTransaction).signature
  }
  // Raw transactions have signatures array in transaction object
  if (isRawTransaction(tx)) {
    return tx.transaction?.signatures?.[0] ?? 'unknown'
  }
  return 'unknown'
}

/**
 * Process a single webhook transaction and check if it's a payment for us
 *
 * Lower-level function for custom webhook handling.
 *
 * @param transaction - Raw Helius webhook transaction
 * @param viewingPrivateKey - Recipient's viewing private key
 * @param spendingPublicKey - Recipient's spending public key
 * @returns Payment result if found, null otherwise
 *
 * @example
 * ```typescript
 * const payment = await processWebhookTransaction(
 *   webhookPayload,
 *   viewingPrivateKey,
 *   spendingPublicKey
 * )
 *
 * if (payment) {
 *   console.log('Found payment:', payment.amount, payment.mint)
 * }
 * ```
 */
export async function processWebhookTransaction(
  transaction: HeliusWebhookTransaction,
  viewingPrivateKey: HexString,
  spendingPublicKey: HexString
): Promise<SolanaScanResult | null> {
  const result = await processRawTransaction(
    transaction,
    viewingPrivateKey,
    spendingPublicKey,
    () => {} // No-op callback
  )

  return result.found ? result.payment ?? null : null
}
