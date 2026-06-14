/**
 * Jito Relayer for SIP Protocol
 *
 * Enables gas abstraction for Solana shielded transactions using Jito's MEV infrastructure.
 * The relayer submits transaction bundles on behalf of users, paying gas fees and breaking
 * the direct link between the user's wallet and the privacy transaction.
 *
 * ## Why Jito?
 *
 * 1. **Native Solana**: Jito is battle-tested MEV infrastructure on Solana
 * 2. **No Dedicated Server**: Uses Jito's network, no VPS maintenance needed
 * 3. **Bundle Guarantees**: Atomic execution, no partial failures
 * 4. **Lower Regulatory Risk**: Relayer only handles gas, not asset movement
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  GAS ABSTRACTION FLOW                                                       │
 * │                                                                             │
 * │  ┌─────────┐      ┌───────────────┐      ┌───────────┐      ┌──────────┐  │
 * │  │  User   │ ──▶  │ Sign TX       │ ──▶  │ Jito      │ ──▶  │ Solana   │  │
 * │  │  Wallet │      │ (no SOL fee)  │      │ Relayer   │      │ Network  │  │
 * │  └─────────┘      └───────────────┘      └───────────┘      └──────────┘  │
 * │                                                │                          │
 * │                                                ▼                          │
 * │                                          Relayer pays                     │
 * │                                          gas from tip                     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Fee Model
 *
 * The relayer takes a small tip from the transaction (configurable, typically 0.1-0.5%)
 * to cover gas costs and operational overhead.
 *
 * @see https://jito-foundation.gitbook.io/mev/
 * @see https://jito-labs.github.io/jito-ts/
 */

import {
  Connection,
  PublicKey,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  Keypair,
  type TransactionInstruction,
} from '@solana/web3.js'
import { bytesToBase58 } from '../stealth/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Jito Block Engine endpoints
 * @see https://jito-foundation.gitbook.io/mev/searcher-resources/block-engine
 */
export const JITO_BLOCK_ENGINES = {
  mainnet: {
    amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1',
    frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1',
    ny: 'https://ny.mainnet.block-engine.jito.wtf/api/v1',
    tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf/api/v1',
  },
  // Jito doesn't have devnet block engines - use simulation for testing
} as const

/**
 * Jito tip accounts (one must receive the tip)
 * @see https://jito-foundation.gitbook.io/mev/searcher-resources/tip-accounts
 */
export const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkekGTo46ibhvdrPnSVX',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
] as const

/**
 * Default configuration values
 */
export const JITO_DEFAULTS = {
  /** Default tip in lamports (0.001 SOL) */
  tipLamports: 1_000_000,
  /** Maximum bundle size */
  maxBundleSize: 5,
  /** Bundle submission timeout (ms) */
  submissionTimeout: 30_000,
  /** Confirmation timeout (ms) */
  confirmationTimeout: 60_000,
  /** Default retry attempts */
  maxRetries: 3,
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Jito relayer configuration
 */
export interface JitoRelayerConfig {
  /** Jito block engine endpoint */
  blockEngineUrl?: string
  /** Solana RPC URL */
  rpcUrl?: string
  /** Default tip amount in lamports */
  defaultTipLamports?: number
  /** Enable debug logging */
  debug?: boolean
  /** Maximum retries for bundle submission */
  maxRetries?: number
  /** Submission timeout in ms */
  submissionTimeout?: number
}

/**
 * Bundle submission request
 */
export interface JitoBundleRequest {
  /** Transactions to include in bundle */
  transactions: (Transaction | VersionedTransaction)[]
  /** Tip amount in lamports */
  tipLamports?: number
  /** Tip payer keypair */
  tipPayer: Keypair
  /** Whether to wait for confirmation */
  waitForConfirmation?: boolean
}

/**
 * Bundle submission result
 */
export interface JitoBundleResult {
  /** Bundle UUID */
  bundleId: string
  /** Transaction signatures in bundle */
  signatures: string[]
  /** Submission status */
  status: 'submitted' | 'landed' | 'failed' | 'timeout'
  /** Slot where bundle landed (if confirmed) */
  slot?: number
  /** Error message if failed */
  error?: string
  /** Actual tip paid in lamports */
  tipPaid: number
}

/**
 * Relayed transaction request
 */
export interface RelayedTransactionRequest {
  /** Signed transaction to relay */
  transaction: Transaction | VersionedTransaction
  /** Tip amount in lamports (paid by relayer, recovered from user) */
  tipLamports?: number
  /** Keypair that pays the Jito tip. Required for the Jito-bundle path to land. */
  tipPayer?: Keypair
  /** Whether to wait for confirmation */
  waitForConfirmation?: boolean
}

/**
 * Relayed transaction result
 */
export interface RelayedTransactionResult {
  /** Transaction signature */
  signature: string
  /** Bundle ID if submitted via Jito */
  bundleId?: string
  /** Submission status */
  status: 'submitted' | 'confirmed' | 'failed'
  /** Slot where transaction landed */
  slot?: number
  /** Error message if failed */
  error?: string
  /** Whether relayer was used or fell back to direct submission */
  relayed: boolean
}

/**
 * Bundle status from Jito API
 */
interface JitoBundleStatus {
  bundleId: string
  status: 'Invalid' | 'Pending' | 'Failed' | 'Landed'
  landedSlot?: number
  error?: string
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Jito relayer error codes
 */
export enum JitoRelayerErrorCode {
  BUNDLE_SUBMISSION_FAILED = 'BUNDLE_SUBMISSION_FAILED',
  BUNDLE_TIMEOUT = 'BUNDLE_TIMEOUT',
  BUNDLE_INVALID = 'BUNDLE_INVALID',
  INSUFFICIENT_TIP = 'INSUFFICIENT_TIP',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
}

/**
 * Jito relayer error
 */
export class JitoRelayerError extends Error {
  constructor(
    public readonly code: JitoRelayerErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(`[${code}] ${message}`)
    this.name = 'JitoRelayerError'
  }
}

// ─── Jito Relayer ─────────────────────────────────────────────────────────────

/**
 * Jito Relayer for gas abstraction
 *
 * Submits Solana transactions via Jito's MEV infrastructure,
 * enabling gas abstraction for privacy transactions.
 *
 * @example
 * ```typescript
 * import { JitoRelayer } from '@sip-protocol/sdk'
 *
 * const relayer = new JitoRelayer({
 *   blockEngineUrl: 'https://ny.mainnet.block-engine.jito.wtf/api/v1',
 * })
 *
 * // Submit a signed transaction via the relayer (tipPayer is required for the bundle to land)
 * const result = await relayer.relayTransaction({
 *   transaction: signedTx,
 *   tipLamports: 10_000, // 0.00001 SOL tip
 *   tipPayer: relayerKeypair,
 * })
 *
 * console.log('Transaction relayed:', result.signature)
 * ```
 */
export class JitoRelayer {
  private readonly connection: Connection
  private readonly blockEngineUrl: string
  private readonly defaultTipLamports: number
  private readonly debug: boolean
  private readonly maxRetries: number
  private readonly submissionTimeout: number

  constructor(config: JitoRelayerConfig = {}) {
    this.blockEngineUrl = config.blockEngineUrl ?? JITO_BLOCK_ENGINES.mainnet.ny
    this.connection = new Connection(
      config.rpcUrl ?? 'https://api.mainnet-beta.solana.com',
      'confirmed'
    )
    this.defaultTipLamports = config.defaultTipLamports ?? JITO_DEFAULTS.tipLamports
    this.debug = config.debug ?? false
    this.maxRetries = config.maxRetries ?? JITO_DEFAULTS.maxRetries
    this.submissionTimeout = config.submissionTimeout ?? JITO_DEFAULTS.submissionTimeout
  }

  // ─── Static Helpers ─────────────────────────────────────────────────────────

  /** Encode a 64-byte ed25519 signature as a base58 string (Solana canonical form). */
  static encodeSignature(sig: Uint8Array): string {
    return bytesToBase58(sig)
  }

  // ─── Public Methods ─────────────────────────────────────────────────────────

  /**
   * Submit a bundle of transactions to Jito
   *
   * @param request - Bundle request with transactions and tip
   * @returns Bundle submission result
   */
  async submitBundle(request: JitoBundleRequest): Promise<JitoBundleResult> {
    const tipLamports = request.tipLamports ?? this.defaultTipLamports

    this.log('Submitting bundle:', {
      transactionCount: request.transactions.length,
      tipLamports,
    })

    // Validate bundle size
    if (request.transactions.length > JITO_DEFAULTS.maxBundleSize) {
      throw new JitoRelayerError(
        JitoRelayerErrorCode.INVALID_TRANSACTION,
        `Bundle too large: ${request.transactions.length} > ${JITO_DEFAULTS.maxBundleSize}`
      )
    }

    // Create tip instruction
    const tipInstruction = this.createTipInstruction(request.tipPayer.publicKey, tipLamports)

    // The relayer cannot re-sign the user (cash-out) transaction — it lacks the
    // signing key. So the prepended tip tx and the confirmation window must ADOPT
    // the user tx's blockhash window; a fresh blockhash would orphan the bundle
    // (the user tx could be expired yet the tip tx still look valid). Fall back to
    // a fresh blockhash only when the user tx carries no window (e.g. versioned tx).
    const ctx = this.extractBlockhashContext(request.transactions[0])
    const { blockhash, lastValidBlockHeight } =
      ctx ?? (await this.connection.getLatestBlockhash())

    // Add tip to the first transaction or create a standalone tip tx
    const bundleTransactions = await this.prepareBundleTransactions(
      request.transactions,
      tipInstruction,
      request.tipPayer,
      blockhash
    )

    // Serialize transactions
    const serializedTxs = bundleTransactions.map(tx => {
      const serialized = tx.serialize()
      return Buffer.from(serialized).toString('base64')
    })

    // Submit bundle
    let bundleId: string
    let retries = 0

    while (retries < this.maxRetries) {
      try {
        bundleId = await this.sendBundle(serializedTxs)
        break
      } catch (error) {
        retries++
        if (retries >= this.maxRetries) {
          throw new JitoRelayerError(
            JitoRelayerErrorCode.BUNDLE_SUBMISSION_FAILED,
            `Failed to submit bundle after ${this.maxRetries} attempts`,
            error
          )
        }
        this.log(`Retry ${retries}/${this.maxRetries} after error:`, error)
        await this.sleep(1000 * retries)
      }
    }

    // Extract signatures
    const signatures = bundleTransactions.map(tx => {
      if (tx instanceof VersionedTransaction) {
        return JitoRelayer.encodeSignature(tx.signatures[0])
      }
      const sig = tx.signature
      return sig ? JitoRelayer.encodeSignature(sig) : ''
    })

    // Wait for confirmation if requested
    if (request.waitForConfirmation) {
      const status = await this.waitForBundleConfirmation(bundleId!, lastValidBlockHeight)
      return {
        bundleId: bundleId!,
        signatures,
        status: status.status === 'Landed' ? 'landed' : 'failed',
        slot: status.landedSlot,
        error: status.error,
        tipPaid: tipLamports,
      }
    }

    return {
      bundleId: bundleId!,
      signatures,
      status: 'submitted',
      tipPaid: tipLamports,
    }
  }

  /**
   * Relay a single transaction via Jito
   *
   * This is the main method for gas abstraction - submit a transaction
   * through the relayer instead of paying gas directly.
   *
   * @param request - Transaction to relay
   * @returns Relay result
   */
  async relayTransaction(
    request: RelayedTransactionRequest
  ): Promise<RelayedTransactionResult> {
    this.log('Relaying transaction')

    try {
      // Jito bundles require a tip to land. A tipPayer is therefore mandatory for
      // the bundle path (which prepends a tip tx). Without one we fail loud below
      // and let the catch fall back to honest direct submission.
      if (request.tipPayer) {
        const bundle = await this.submitBundle({
          transactions: [request.transaction],
          tipLamports: request.tipLamports,
          tipPayer: request.tipPayer,
          waitForConfirmation: request.waitForConfirmation,
        })
        return {
          signature: bundle.signatures[bundle.signatures.length - 1] ?? '',
          bundleId: bundle.bundleId,
          status: bundle.status === 'landed' ? 'confirmed'
            : bundle.status === 'submitted' ? 'submitted' : 'failed',
          slot: bundle.slot,
          error: bundle.error,
          relayed: true,
        }
      }

      // No tipPayer → there is no way to land a Jito bundle. A tip-less bundle is
      // never included by the block engine, so reporting it as 'submitted' would
      // be a silent lie. Fail loud here; the catch below falls back to honest
      // direct submission (relayed:false).
      throw new JitoRelayerError(
        JitoRelayerErrorCode.INSUFFICIENT_TIP,
        'Jito bundle relay requires a tipPayer; tip-less bundles are never included ' +
          'by the block engine. Provide a tipPayer or submit directly.'
      )
    } catch (error) {
      // Fallback to direct submission
      this.log('Relayer failed, falling back to direct submission:', error)
      return this.directSubmit(request.transaction, request.waitForConfirmation)
    }
  }

  /**
   * Check if Jito relayer is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get current tip floor (minimum tip for inclusion)
   */
  async getTipFloor(): Promise<number> {
    // In production, this would query Jito's tip floor endpoint
    // For now, return a conservative default
    return JITO_DEFAULTS.tipLamports
  }

  /**
   * Get a random tip account
   */
  getRandomTipAccount(): PublicKey {
    const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)
    return new PublicKey(JITO_TIP_ACCOUNTS[index])
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Extract a legacy transaction's blockhash window so the tip tx and the
   * confirmation window can be reconciled against the SAME window the user tx is
   * signed for. Returns `null` for versioned transactions, or when either field
   * is missing — callers then fall back to a freshly fetched blockhash.
   */
  private extractBlockhashContext(
    tx: Transaction | VersionedTransaction
  ): { blockhash: string; lastValidBlockHeight: number } | null {
    if (tx instanceof VersionedTransaction) {
      return null
    }
    const lastValidBlockHeight = (
      tx as Transaction & { lastValidBlockHeight?: number }
    ).lastValidBlockHeight
    if (tx.recentBlockhash && typeof lastValidBlockHeight === 'number') {
      return { blockhash: tx.recentBlockhash, lastValidBlockHeight }
    }
    return null
  }

  /**
   * Create tip instruction
   */
  private createTipInstruction(
    payer: PublicKey,
    tipLamports: number
  ): TransactionInstruction {
    const tipAccount = this.getRandomTipAccount()
    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: tipAccount,
      lamports: tipLamports,
    })
  }

  /**
   * Prepare transactions for bundle submission
   */
  private async prepareBundleTransactions(
    transactions: (Transaction | VersionedTransaction)[],
    tipInstruction: TransactionInstruction,
    tipPayer: Keypair,
    blockhash: string
  ): Promise<(Transaction | VersionedTransaction)[]> {
    // Create tip transaction
    const tipTx = new Transaction()
    tipTx.add(tipInstruction)
    tipTx.recentBlockhash = blockhash
    tipTx.feePayer = tipPayer.publicKey
    tipTx.sign(tipPayer)

    // Return tip tx first, then user transactions
    return [tipTx, ...transactions]
  }

  /**
   * Send bundle to Jito block engine
   */
  private async sendBundle(serializedTransactions: string[]): Promise<string> {
    const response = await fetch(`${this.blockEngineUrl}/bundles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serializedTransactions],
      }),
      signal: AbortSignal.timeout(this.submissionTimeout),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new JitoRelayerError(
        JitoRelayerErrorCode.CONNECTION_ERROR,
        `Block engine returned ${response.status}: ${text}`
      )
    }

    const result = await response.json() as {
      result?: string
      error?: { message: string; code: number }
    }

    if (result.error) {
      throw new JitoRelayerError(
        JitoRelayerErrorCode.BUNDLE_SUBMISSION_FAILED,
        result.error.message,
        result.error
      )
    }

    return result.result ?? ''
  }

  /**
   * Wait for bundle confirmation
   */
  private async waitForBundleConfirmation(
    bundleId: string,
    lastValidBlockHeight: number
  ): Promise<JitoBundleStatus> {
    const startTime = Date.now()

    while (Date.now() - startTime < JITO_DEFAULTS.confirmationTimeout) {
      // Check current block height
      const currentBlockHeight = await this.connection.getBlockHeight()

      if (currentBlockHeight > lastValidBlockHeight) {
        return {
          bundleId,
          status: 'Failed',
          error: 'Bundle expired (blockhash invalid)',
        }
      }

      // Check bundle status
      const status = await this.getBundleStatus(bundleId)

      if (status.status === 'Landed' || status.status === 'Failed' || status.status === 'Invalid') {
        return status
      }

      await this.sleep(2000)
    }

    return {
      bundleId,
      status: 'Failed',
      error: 'Confirmation timeout',
    }
  }

  /**
   * Get bundle status from Jito
   */
  private async getBundleStatus(bundleId: string): Promise<JitoBundleStatus> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/bundles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
        signal: AbortSignal.timeout(10000),
      })

      const result = await response.json() as {
        result?: {
          value: Array<{
            bundle_id: string
            status: string
            landed_slot?: number
          }>
        }
      }

      const bundleStatus = result.result?.value?.[0]

      if (!bundleStatus) {
        return { bundleId, status: 'Pending' }
      }

      return {
        bundleId,
        status: bundleStatus.status as 'Invalid' | 'Pending' | 'Failed' | 'Landed',
        landedSlot: bundleStatus.landed_slot,
      }
    } catch {
      return { bundleId, status: 'Pending' }
    }
  }

  /**
   * Direct submission fallback
   */
  private async directSubmit(
    transaction: Transaction | VersionedTransaction,
    waitForConfirmation?: boolean
  ): Promise<RelayedTransactionResult> {
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, maxRetries: 3 }
    )

    if (waitForConfirmation) {
      // Confirm against the SENT tx's own blockhash window — a freshly fetched
      // blockhash could report a different (later) window and misjudge expiry.
      // Fall back to a fresh blockhash only for versioned txs that carry no window.
      const ctx = this.extractBlockhashContext(transaction)
      const { blockhash, lastValidBlockHeight } =
        ctx ?? (await this.connection.getLatestBlockhash())
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed')

      return {
        signature,
        status: confirmation.value.err ? 'failed' : 'confirmed',
        error: confirmation.value.err?.toString(),
        relayed: false,
      }
    }

    return {
      signature,
      status: 'submitted',
      relayed: false,
    }
  }

  /**
   * Log debug message
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[JitoRelayer] ${message}`, ...args)
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a Jito relayer instance
 *
 * @param config - Relayer configuration
 * @returns Jito relayer instance
 */
export function createJitoRelayer(config?: JitoRelayerConfig): JitoRelayer {
  return new JitoRelayer(config)
}

/**
 * Create a mainnet Jito relayer with NY block engine
 */
export function createMainnetRelayer(rpcUrl?: string): JitoRelayer {
  return new JitoRelayer({
    blockEngineUrl: JITO_BLOCK_ENGINES.mainnet.ny,
    rpcUrl: rpcUrl ?? 'https://api.mainnet-beta.solana.com',
  })
}
