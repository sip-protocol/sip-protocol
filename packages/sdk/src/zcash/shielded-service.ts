/**
 * Zcash Shielded Transaction Service
 *
 * High-level service for managing Zcash shielded transactions,
 * providing integration with SIP Protocol privacy levels.
 *
 * @example
 * ```typescript
 * const service = new ZcashShieldedService({
 *   rpcConfig: { username: 'user', password: 'pass', testnet: true },
 * })
 *
 * // Initialize and create account
 * await service.initialize()
 *
 * // Send shielded transaction
 * const result = await service.sendShielded({
 *   to: recipientAddress,
 *   amount: 1.5,
 *   memo: 'Payment for services',
 *   privacyLevel: PrivacyLevel.SHIELDED,
 * })
 *
 * // Check incoming transactions
 * const received = await service.getReceivedNotes()
 * ```
 */

import {
  type ZcashConfig,
  type ZcashUnspentNote,
  type ZcashAccountBalance,
  type ZcashOperation,
  type ZcashPrivacyPolicy,
  type ZcashAddressInfo,
  PrivacyLevel,
} from '@sip-protocol/types'
import { ZcashRPCClient, ZcashRPCError } from './rpc-client'
import { ValidationError, IntentError, ErrorCode } from '../errors'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Configuration for ZcashShieldedService
 */
export interface ZcashShieldedServiceConfig {
  /** RPC client configuration */
  rpcConfig: ZcashConfig
  /** Default account to use (default: 0) */
  defaultAccount?: number
  /** Default minimum confirmations (default: 1) */
  defaultMinConf?: number
  /** Poll interval for operations in ms (default: 1000) */
  operationPollInterval?: number
  /** Operation timeout in ms (default: 300000 = 5 min) */
  operationTimeout?: number
}

/**
 * Shielded send parameters
 */
export interface ShieldedSendParams {
  /** Recipient address (shielded or unified) */
  to: string
  /** Amount in ZEC */
  amount: number
  /** Optional memo (max 512 bytes) */
  memo?: string
  /** SIP privacy level */
  privacyLevel?: PrivacyLevel
  /** Source address (uses default if not specified) */
  from?: string
  /** Minimum confirmations for inputs */
  minConf?: number
  /** Custom fee (uses ZIP-317 default if not specified) */
  fee?: number
}

/**
 * Result of a shielded send operation
 */
export interface ShieldedSendResult {
  /** Transaction ID */
  txid: string
  /** Operation ID (for tracking) */
  operationId: string
  /** Amount sent (excluding fee) */
  amount: number
  /** Fee paid */
  fee: number
  /** Recipient address */
  to: string
  /** Sender address */
  from: string
  /** Timestamp */
  timestamp: number
}

/**
 * Received note information
 */
export interface ReceivedNote {
  /** Transaction ID */
  txid: string
  /** Amount received */
  amount: number
  /** Memo content (if any) */
  memo?: string
  /** Number of confirmations */
  confirmations: number
  /** Whether spendable */
  spendable: boolean
  /** Pool type (sapling/orchard) */
  pool: 'sapling' | 'orchard'
  /** Receiving address */
  address: string
  /** Whether this is change */
  isChange: boolean
}

/**
 * Shielded balance summary
 */
export interface ShieldedBalance {
  /** Total confirmed balance in ZEC */
  confirmed: number
  /** Total unconfirmed balance in ZEC */
  unconfirmed: number
  /** Balance by pool */
  pools: {
    transparent: number
    sapling: number
    orchard: number
  }
  /** Number of spendable notes */
  spendableNotes: number
}

/**
 * Viewing key export result
 */
export interface ExportedViewingKey {
  /** The viewing key */
  key: string
  /** Associated address */
  address: string
  /** Account number */
  account: number
  /** Creation timestamp */
  exportedAt: number
}

// ─── Service Implementation ────────────────────────────────────────────────────

/**
 * Zcash Shielded Transaction Service
 *
 * Provides high-level operations for Zcash shielded transactions
 * with SIP Protocol integration.
 */
export class ZcashShieldedService {
  private readonly client: ZcashRPCClient
  private readonly config: Required<Omit<ZcashShieldedServiceConfig, 'rpcConfig'>>
  private initialized: boolean = false
  private accountAddress: string | null = null
  private account: number = 0

  constructor(config: ZcashShieldedServiceConfig) {
    this.client = new ZcashRPCClient(config.rpcConfig)
    this.config = {
      defaultAccount: config.defaultAccount ?? 0,
      defaultMinConf: config.defaultMinConf ?? 1,
      operationPollInterval: config.operationPollInterval ?? 1000,
      operationTimeout: config.operationTimeout ?? 300000,
    }
    this.account = this.config.defaultAccount
  }

  // ─── Initialization ──────────────────────────────────────────────────────────

  /**
   * Initialize the service
   *
   * Creates an account if needed and retrieves the default address.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Verify connection
    await this.client.getBlockCount()

    // Get or create account address
    try {
      const addressResult = await this.client.getAddressForAccount(this.account, ['sapling', 'orchard'])
      this.accountAddress = addressResult.address
    } catch (error) {
      // Account might not exist, create it
      if (error instanceof ZcashRPCError) {
        const newAccount = await this.client.createAccount()
        this.account = newAccount.account
        const addressResult = await this.client.getAddressForAccount(this.account, ['sapling', 'orchard'])
        this.accountAddress = addressResult.address
      } else {
        throw error
      }
    }

    this.initialized = true
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new IntentError(
        'ZcashShieldedService not initialized. Call initialize() first.',
        ErrorCode.INTENT_INVALID_STATE,
      )
    }
  }

  // ─── Address Operations ──────────────────────────────────────────────────────

  /**
   * Get the default shielded address
   */
  getAddress(): string {
    this.ensureInitialized()
    return this.accountAddress!
  }

  /**
   * Generate a new diversified address for the account
   *
   * Each address is unlinkable but controlled by the same account.
   */
  async generateNewAddress(): Promise<string> {
    this.ensureInitialized()
    const result = await this.client.getAddressForAccount(this.account, ['sapling', 'orchard'])
    return result.address
  }

  /**
   * Validate an address
   */
  async validateAddress(address: string): Promise<ZcashAddressInfo> {
    return this.client.validateAddress(address)
  }

  /**
   * Check if an address is a shielded address
   */
  async isShieldedAddress(address: string): Promise<boolean> {
    const info = await this.client.validateAddress(address)
    if (!info.isvalid) return false
    return info.address_type === 'sapling' ||
           info.address_type === 'orchard' ||
           info.address_type === 'unified'
  }

  // ─── Balance Operations ──────────────────────────────────────────────────────

  /**
   * Get shielded balance summary
   */
  async getBalance(minConf?: number): Promise<ShieldedBalance> {
    this.ensureInitialized()

    const accountBalance = await this.client.getAccountBalance(
      this.account,
      minConf ?? this.config.defaultMinConf,
    )

    // Get unspent notes for spendable count
    const notes = await this.client.listUnspent(minConf ?? this.config.defaultMinConf)
    const spendableNotes = notes.filter((n) => n.spendable).length

    // Convert zatoshis to ZEC
    const toZec = (zat: number | undefined) => (zat ?? 0) / 100_000_000

    const transparent = toZec(accountBalance.pools.transparent?.valueZat)
    const sapling = toZec(accountBalance.pools.sapling?.valueZat)
    const orchard = toZec(accountBalance.pools.orchard?.valueZat)

    return {
      confirmed: transparent + sapling + orchard,
      unconfirmed: 0, // Would need separate RPC call
      pools: {
        transparent,
        sapling,
        orchard,
      },
      spendableNotes,
    }
  }

  // ─── Send Operations ─────────────────────────────────────────────────────────

  /**
   * Send a shielded transaction
   *
   * @param params - Send parameters
   * @returns Send result with txid
   */
  async sendShielded(params: ShieldedSendParams): Promise<ShieldedSendResult> {
    this.ensureInitialized()

    // Validate recipient address
    const recipientInfo = await this.client.validateAddress(params.to)
    if (!recipientInfo.isvalid) {
      throw new ValidationError(
        `Invalid recipient address: ${params.to}`,
        'to',
        undefined,
        ErrorCode.INVALID_ADDRESS,
      )
    }

    // Validate amount
    if (params.amount <= 0) {
      throw new ValidationError(
        'Amount must be positive',
        'amount',
        { received: params.amount },
        ErrorCode.INVALID_AMOUNT,
      )
    }

    // Determine privacy policy based on SIP privacy level
    const privacyPolicy = this.mapPrivacyLevelToPolicy(params.privacyLevel)

    // Prepare memo (convert to hex if string)
    let memoHex: string | undefined
    if (params.memo) {
      memoHex = Buffer.from(params.memo, 'utf-8').toString('hex')
    }

    // Determine source address
    const fromAddress = params.from ?? this.accountAddress!

    // Send transaction
    const operationId = await this.client.sendShielded({
      fromAddress,
      recipients: [
        {
          address: params.to,
          amount: params.amount,
          memo: memoHex,
        },
      ],
      minConf: params.minConf ?? this.config.defaultMinConf,
      fee: params.fee,
      privacyPolicy,
    })

    // Wait for operation to complete
    const operation = await this.client.waitForOperation(
      operationId,
      this.config.operationPollInterval,
      this.config.operationTimeout,
    )

    if (!operation.result?.txid) {
      throw new IntentError(
        'Transaction completed but no txid returned',
        ErrorCode.INTENT_FAILED,
        { context: { operationId } },
      )
    }

    return {
      txid: operation.result.txid,
      operationId,
      amount: params.amount,
      fee: params.fee ?? 0, // TODO: Get actual fee from operation
      to: params.to,
      from: fromAddress,
      timestamp: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Send shielded transaction with SIP integration
   *
   * Higher-level method that handles privacy level mapping.
   */
  async sendWithPrivacy(
    to: string,
    amount: number,
    privacyLevel: PrivacyLevel,
    memo?: string,
  ): Promise<ShieldedSendResult> {
    // For transparent mode, we could use t-addr but for now require shielded
    if (privacyLevel === PrivacyLevel.TRANSPARENT) {
      throw new ValidationError(
        'Transparent mode not supported for Zcash shielded service. Use standard RPC client.',
        'privacyLevel',
        { received: privacyLevel },
        ErrorCode.INVALID_PRIVACY_LEVEL,
      )
    }

    return this.sendShielded({
      to,
      amount,
      memo,
      privacyLevel,
    })
  }

  // ─── Receive Operations ──────────────────────────────────────────────────────

  /**
   * Get received notes (incoming shielded transactions)
   *
   * @param minConf - Minimum confirmations
   * @param onlySpendable - Only return spendable notes
   */
  async getReceivedNotes(minConf?: number, onlySpendable: boolean = false): Promise<ReceivedNote[]> {
    this.ensureInitialized()

    const notes = await this.client.listUnspent(
      minConf ?? this.config.defaultMinConf,
      9999999,
      false,
    )

    return notes
      .filter((note) => !onlySpendable || note.spendable)
      .filter((note) => note.pool === 'sapling' || note.pool === 'orchard')
      .map((note) => this.mapNoteToReceived(note))
  }

  /**
   * Get pending (unconfirmed) incoming transactions
   */
  async getPendingNotes(): Promise<ReceivedNote[]> {
    return this.getReceivedNotes(0)
      .then((notes) => notes.filter((n) => n.confirmations === 0))
  }

  /**
   * Wait for incoming note with specific criteria
   *
   * @param predicate - Function to match the expected note
   * @param timeout - Timeout in ms
   * @param pollInterval - Poll interval in ms
   */
  async waitForNote(
    predicate: (note: ReceivedNote) => boolean,
    timeout: number = 300000,
    pollInterval: number = 5000,
  ): Promise<ReceivedNote> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const notes = await this.getReceivedNotes(0)
      const match = notes.find(predicate)

      if (match) {
        return match
      }

      await this.delay(pollInterval)
    }

    throw new IntentError(
      'Timed out waiting for incoming note',
      ErrorCode.NETWORK_TIMEOUT,
    )
  }

  // ─── Viewing Key Operations ──────────────────────────────────────────────────

  /**
   * Export viewing key for an address
   *
   * The viewing key allows monitoring incoming transactions
   * without spending capability.
   */
  async exportViewingKey(address?: string): Promise<ExportedViewingKey> {
    this.ensureInitialized()
    const targetAddress = address ?? this.accountAddress!

    const key = await this.client.exportViewingKey(targetAddress)

    return {
      key,
      address: targetAddress,
      account: this.account,
      exportedAt: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Import viewing key for monitoring
   *
   * Allows monitoring transactions to an address without spending.
   */
  async importViewingKey(
    viewingKey: string,
    rescan: 'yes' | 'no' | 'whenkeyisnew' = 'whenkeyisnew',
    startHeight?: number,
  ): Promise<void> {
    await this.client.importViewingKey(viewingKey, rescan, startHeight)
  }

  /**
   * Export viewing key for compliance/audit
   *
   * Specifically for SIP COMPLIANT privacy level.
   */
  async exportForCompliance(): Promise<{
    viewingKey: ExportedViewingKey
    privacyLevel: PrivacyLevel
    disclaimer: string
  }> {
    const viewingKey = await this.exportViewingKey()

    return {
      viewingKey,
      privacyLevel: PrivacyLevel.COMPLIANT,
      disclaimer:
        'This viewing key provides read-only access to transaction history. ' +
        'It cannot be used to spend funds. Share only with authorized auditors.',
    }
  }

  // ─── Operation Tracking ──────────────────────────────────────────────────────

  /**
   * Get status of an operation
   */
  async getOperationStatus(operationId: string): Promise<ZcashOperation | null> {
    const [operation] = await this.client.getOperationStatus([operationId])
    return operation ?? null
  }

  /**
   * List all pending operations
   */
  async listPendingOperations(): Promise<ZcashOperation[]> {
    const executing = await this.client.getOperationStatus()
    return executing.filter((op) => op.status === 'executing' || op.status === 'queued')
  }

  // ─── Blockchain Info ─────────────────────────────────────────────────────────

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    return this.client.getBlockCount()
  }

  /**
   * Check if connected to testnet
   */
  isTestnet(): boolean {
    return this.client.isTestnet
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Map SIP privacy level to Zcash privacy policy
   */
  private mapPrivacyLevelToPolicy(level?: PrivacyLevel): ZcashPrivacyPolicy {
    switch (level) {
      case PrivacyLevel.TRANSPARENT:
        return 'NoPrivacy'
      case PrivacyLevel.SHIELDED:
        return 'FullPrivacy'
      case PrivacyLevel.COMPLIANT:
        // Compliant mode uses full privacy but exports viewing key separately
        return 'FullPrivacy'
      default:
        return 'FullPrivacy'
    }
  }

  /**
   * Map RPC unspent note to ReceivedNote
   */
  private mapNoteToReceived(note: ZcashUnspentNote): ReceivedNote {
    // Decode memo if present
    let memo: string | undefined
    if (note.memoStr) {
      memo = note.memoStr
    } else if (note.memo && note.memo !== '00' && !note.memo.match(/^f+$/i)) {
      // Try to decode non-empty, non-padding memo
      try {
        memo = Buffer.from(note.memo, 'hex').toString('utf-8').replace(/\0+$/, '')
        if (!memo || memo.length === 0) memo = undefined
      } catch {
        // Invalid UTF-8, leave as undefined
      }
    }

    return {
      txid: note.txid,
      amount: note.amount,
      memo,
      confirmations: note.confirmations,
      spendable: note.spendable,
      pool: note.pool as 'sapling' | 'orchard',
      address: note.address,
      isChange: note.change,
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /**
   * Get underlying RPC client for advanced operations
   */
  get rpcClient(): ZcashRPCClient {
    return this.client
  }

  /**
   * Get current account number
   */
  get currentAccount(): number {
    return this.account
  }
}

/**
 * Create a Zcash shielded service instance
 */
export function createZcashShieldedService(
  config: ZcashShieldedServiceConfig,
): ZcashShieldedService {
  return new ZcashShieldedService(config)
}
