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
import { SIP_MEMO_PREFIX } from '../constants'
import { getTokenSymbol, parseTokenTransferFromBalances } from '../utils'
import { ValidationError, SecurityError } from '../../../errors'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'

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
 * Configuration for the Helius webhook handler
 *
 * @security This config contains sensitive cryptographic keys.
 * Never log, store in plain text, or transmit insecurely.
 */
export interface WebhookHandlerConfig {
  /**
   * Recipient's viewing private key (hex)
   *
   * @security SENSITIVE - This key enables detection of incoming payments.
   * Store securely (encrypted). Never log or expose in error messages.
   * Use environment variables or secure vault in production.
   */
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
  /**
   * Webhook authentication secret (recommended for production)
   *
   * When set, the handler will verify the X-Helius-Signature header
   * using HMAC-SHA256 to ensure webhook payloads are authentic.
   *
   * Get your webhook secret from Helius Dashboard:
   * https://dev.helius.xyz/webhooks
   */
  webhookSecret?: string
  /**
   * Authorization token for additional security
   *
   * When set, the handler will verify the Authorization header
   * matches this token. Use for simple auth in trusted environments.
   */
  authToken?: string
}

/**
 * Webhook request with headers for signature verification
 */
export interface WebhookRequest {
  /** Raw request body as string (for signature verification) */
  rawBody: string
  /** Parsed payload */
  payload: HeliusWebhookPayload
  /** Request headers */
  headers: {
    /** Helius webhook signature (X-Helius-Signature header) */
    signature?: string
    /** Authorization header */
    authorization?: string
  }
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
 * Verify Helius webhook signature using HMAC-SHA256
 *
 * H-4, H-8 FIX: Implement webhook signature verification
 *
 * @param rawBody - Raw request body as string
 * @param signature - Signature from X-Helius-Signature header
 * @param secret - Webhook secret from Helius dashboard
 * @returns True if signature is valid
 *
 * @example
 * ```typescript
 * const isValid = verifyWebhookSignature(
 *   req.rawBody,
 *   req.headers['x-helius-signature'],
 *   process.env.HELIUS_WEBHOOK_SECRET!
 * )
 * if (!isValid) {
 *   res.status(401).send('Invalid signature')
 *   return
 * }
 * ```
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false
  }

  try {
    // Compute expected signature using HMAC-SHA256
    const encoder = new TextEncoder()
    const expectedSignature = bytesToHex(
      hmac(sha256, encoder.encode(secret), encoder.encode(rawBody))
    )

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}

/**
 * Verify authorization token
 *
 * H-7 FIX: Implement authorization verification
 *
 * @param authHeader - Authorization header value
 * @param expectedToken - Expected token
 * @returns True if token matches
 */
export function verifyAuthToken(
  authHeader: string | undefined,
  expectedToken: string
): boolean {
  if (!authHeader || !expectedToken) {
    return false
  }

  // Support both "Bearer <token>" and raw token formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  // Constant-time comparison
  if (token.length !== expectedToken.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i)
  }
  return result === 0
}

/**
 * Handler function type returned by createWebhookHandler
 */
export interface WebhookHandler {
  /**
   * Process a webhook payload (simple mode - no signature verification)
   */
  (payload: HeliusWebhookPayload): Promise<WebhookProcessResult[]>

  /**
   * Process a webhook request with full authentication
   *
   * H-4, H-7, H-8 FIX: Supports signature and auth token verification
   */
  processRequest(request: WebhookRequest): Promise<WebhookProcessResult[]>
}

/**
 * Create a webhook handler for processing Helius webhook payloads
 *
 * @param config - Handler configuration
 * @returns Handler function to process webhook payloads
 *
 * @example Simple usage (not recommended for production)
 * ```typescript
 * const handler = createWebhookHandler({
 *   viewingPrivateKey: recipientKeys.viewingPrivateKey,
 *   spendingPublicKey: recipientKeys.spendingPublicKey,
 *   onPaymentFound: async (payment) => {
 *     await db.savePayment(payment)
 *   },
 * })
 *
 * app.post('/webhook', async (req, res) => {
 *   const results = await handler(req.body)
 *   res.json({ processed: results.length })
 * })
 * ```
 *
 * @example Production usage with signature verification
 * ```typescript
 * const handler = createWebhookHandler({
 *   viewingPrivateKey: recipientKeys.viewingPrivateKey,
 *   spendingPublicKey: recipientKeys.spendingPublicKey,
 *   webhookSecret: process.env.HELIUS_WEBHOOK_SECRET!,
 *   onPaymentFound: async (payment) => {
 *     await db.savePayment(payment)
 *   },
 * })
 *
 * app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
 *   try {
 *     const results = await handler.processRequest({
 *       rawBody: req.body.toString(),
 *       payload: JSON.parse(req.body.toString()),
 *       headers: {
 *         signature: req.headers['x-helius-signature'] as string,
 *         authorization: req.headers['authorization'] as string,
 *       },
 *     })
 *     res.json({ processed: results.length })
 *   } catch (error) {
 *     if (error instanceof SecurityError) {
 *       res.status(401).json({ error: error.message })
 *     } else {
 *       res.status(500).json({ error: 'Internal error' })
 *     }
 *   }
 * })
 * ```
 */
export function createWebhookHandler(config: WebhookHandlerConfig): WebhookHandler {
  const {
    viewingPrivateKey,
    spendingPublicKey,
    onPaymentFound,
    onError,
    webhookSecret,
    authToken,
  } = config

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

  // Validate key lengths (ed25519 keys are 32 bytes = 64 hex chars + '0x' prefix)
  if (viewingPrivateKey.length !== 66) {
    throw new ValidationError('viewingPrivateKey must be 32 bytes (64 hex characters)', 'viewingPrivateKey')
  }
  if (spendingPublicKey.length !== 66) {
    throw new ValidationError('spendingPublicKey must be 32 bytes (64 hex characters)', 'spendingPublicKey')
  }

  /**
   * Process transactions after authentication
   */
  async function processTransactions(
    payload: HeliusWebhookPayload
  ): Promise<WebhookProcessResult[]> {
    // H-4 FIX: Validate payload structure before processing
    if (!payload || (typeof payload !== 'object')) {
      throw new ValidationError('Invalid webhook payload', 'payload')
    }

    // Normalize to array
    const transactions = Array.isArray(payload) ? payload : [payload]

    // Validate we have at least one transaction
    if (transactions.length === 0) {
      return []
    }

    // Limit batch size to prevent DoS
    const MAX_BATCH_SIZE = 100
    if (transactions.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
        'payload'
      )
    }

    const results: WebhookProcessResult[] = []

    for (const tx of transactions) {
      try {
        // Handle raw vs enhanced webhook format
        if (isRawTransaction(tx)) {
          const result = await processRawTransaction(
            tx,
            viewingPrivateKey,
            spendingPublicKey,
            onPaymentFound
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

  /**
   * Simple handler (backwards compatible)
   */
  const handler = async (payload: HeliusWebhookPayload): Promise<WebhookProcessResult[]> => {
    return processTransactions(payload)
  }

  /**
   * Process request with full authentication
   * H-4, H-7, H-8 FIX: Signature and auth verification
   */
  handler.processRequest = async (request: WebhookRequest): Promise<WebhookProcessResult[]> => {
    // Verify webhook signature if configured
    if (webhookSecret) {
      if (!verifyWebhookSignature(request.rawBody, request.headers.signature, webhookSecret)) {
        throw new SecurityError(
          'Invalid webhook signature - request rejected',
          'INVALID_SIGNATURE'
        )
      }
    }

    // Verify auth token if configured
    if (authToken) {
      if (!verifyAuthToken(request.headers.authorization, authToken)) {
        throw new SecurityError(
          'Invalid authorization token - request rejected',
          'INVALID_AUTH'
        )
      }
    }

    return processTransactions(request.payload)
  }

  return handler as WebhookHandler
}

/**
 * Process a single raw transaction for SIP announcements
 */
async function processRawTransaction(
  tx: HeliusWebhookTransaction,
  viewingPrivateKey: HexString,
  spendingPublicKey: HexString,
  onPaymentFound: (payment: SolanaScanResult) => void | Promise<void>
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
    // H-5 FIX: Validate ephemeral public key before curve operations
    if (!announcement.ephemeralPublicKey || announcement.ephemeralPublicKey.length < 32) {
      continue // Invalid ephemeral key format, skip
    }

    let ephemeralPubKeyHex: HexString
    try {
      ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(
        announcement.ephemeralPublicKey
      )
    } catch {
      // Invalid base58 encoding or malformed key
      continue
    }

    // H-3 FIX: Enhanced view tag validation with strict hex parsing
    // View tags are 1 byte (0-255), represented as 2-char hex string
    const viewTagStr = announcement.viewTag
    if (!viewTagStr || typeof viewTagStr !== 'string') {
      continue
    }
    // Validate hex format (only 0-9, a-f, A-F)
    if (!/^[0-9a-fA-F]{1,2}$/.test(viewTagStr)) {
      continue // Invalid hex format
    }
    const viewTagNumber = parseInt(viewTagStr, 16)
    // Double-check bounds after parse (defense in depth)
    if (!Number.isInteger(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > 255) {
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
      // Parse token transfer info using shared utility
      const transferInfo = parseTokenTransferFromBalances(
        tx.meta.preTokenBalances,
        tx.meta.postTokenBalances
      )

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
      try {
        await onPaymentFound(payment)
      } catch {
        // Callback error should not prevent returning the found payment
      }

      return { found: true, payment, signature }
    }
  }

  return { found: false, signature }
}

// Token transfer parsing and symbol lookup moved to ../utils.ts (L3 fix)

/**
 * Type guard for raw Helius webhook transaction
 *
 * Distinguishes between raw and enhanced transaction formats.
 * Raw transactions have transaction.signatures array, enhanced have signature directly.
 *
 * @param tx - Unknown transaction payload
 * @returns True if tx is a raw HeliusWebhookTransaction
 * @internal
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
 * Type guard for enhanced Helius webhook transaction
 *
 * Distinguishes between raw and enhanced transaction formats.
 * Enhanced transactions have signature at top level with type field.
 *
 * @param tx - Unknown transaction payload
 * @returns True if tx is an enhanced HeliusEnhancedTransaction
 * @internal
 */
function isEnhancedTransaction(tx: unknown): tx is HeliusEnhancedTransaction {
  return (
    typeof tx === 'object' &&
    tx !== null &&
    'signature' in tx &&
    'type' in tx &&
    typeof (tx as HeliusEnhancedTransaction).signature === 'string'
  )
}

/**
 * Extract transaction signature from webhook payload
 *
 * Handles both raw and enhanced transaction formats.
 *
 * @param tx - Helius webhook transaction (raw or enhanced)
 * @returns Transaction signature, or 'unknown' if not found
 * @internal
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
