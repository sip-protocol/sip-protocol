/**
 * NEAR RPC Client for Privacy Transactions
 *
 * Provides robust RPC integration for submitting and monitoring
 * privacy-enhanced transactions on NEAR Protocol.
 *
 * @module chains/near/rpc
 */

import { ValidationError } from '../../errors'
import {
  NEAR_RPC_ENDPOINTS,
  isValidAccountId,
  type NEARNetwork,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * NEAR RPC error codes
 */
export enum NEARErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RPC_ERROR = 'RPC_ERROR',

  // Transaction errors
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  INVALID_NONCE = 'INVALID_NONCE',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  ACCESS_KEY_NOT_FOUND = 'ACCESS_KEY_NOT_FOUND',

  // Execution errors
  ACTION_ERROR = 'ACTION_ERROR',
  RECEIPT_VALIDATION_ERROR = 'RECEIPT_VALIDATION_ERROR',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

/**
 * NEAR RPC error
 */
export class NEARRpcClientError extends Error {
  constructor(
    message: string,
    public readonly code: NEARErrorCode,
    public readonly cause?: unknown,
    public readonly data?: unknown
  ) {
    super(message)
    this.name = 'NEARRpcClientError'
  }
}

/**
 * Transaction finality levels
 */
export type NEARFinality = 'optimistic' | 'near-final' | 'final'

/**
 * Transaction status
 */
export type NEARTransactionStatus =
  | 'pending'
  | 'included'
  | 'executed'
  | 'final'
  | 'failed'

/**
 * RPC client configuration
 */
export interface NEARRpcConfig {
  /**
   * Primary RPC URL
   */
  rpcUrl: string

  /**
   * Fallback RPC URLs for redundancy
   */
  fallbackUrls?: string[]

  /**
   * Network type
   * @default 'mainnet'
   */
  network?: NEARNetwork

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number

  /**
   * Maximum retry attempts
   * @default 3
   */
  maxRetries?: number

  /**
   * Initial retry delay in milliseconds
   * @default 1000
   */
  retryDelay?: number

  /**
   * Retry delay multiplier for exponential backoff
   * @default 2
   */
  retryMultiplier?: number
}

/**
 * Access key information
 */
export interface NEARAccessKey {
  nonce: bigint
  permission: 'FullAccess' | {
    FunctionCall: {
      allowance: string | null
      receiver_id: string
      method_names: string[]
    }
  }
  blockHeight: number
  blockHash: string
}

/**
 * Account information
 */
export interface NEARAccountInfo {
  amount: bigint
  locked: bigint
  codeHash: string
  storageUsage: number
  storagePaidAt: number
  blockHeight: number
  blockHash: string
}

/**
 * Block information
 */
export interface NEARBlockInfo {
  height: number
  hash: string
  timestamp: number
  prevHash: string
  gasPrice: bigint
}

/**
 * Transaction outcome
 */
export interface NEARTransactionOutcome {
  txHash: string
  signerId: string
  receiverId: string
  status: NEARTransactionStatus
  finalityStatus: NEARFinality
  blockHash: string
  blockHeight: number
  gasUsed: bigint
  tokensBurnt: bigint
  logs: string[]
  receipts: NEARReceiptOutcome[]
  error?: string
}

/**
 * Receipt outcome
 */
export interface NEARReceiptOutcome {
  receiptId: string
  receiverId: string
  status: 'success' | 'failure'
  gasUsed: bigint
  tokensBurnt: bigint
  logs: string[]
  error?: string
}

/**
 * Signed transaction for broadcast
 */
export interface NEARSignedTransaction {
  /**
   * Base64 encoded signed transaction
   */
  signedTx: string

  /**
   * Transaction hash (computed from signed tx)
   */
  txHash: string
}

/**
 * Transaction status result
 */
export interface NEARTxStatusResult {
  status: NEARTransactionStatus
  finality: NEARFinality
  outcome?: NEARTransactionOutcome
  error?: string
}

/**
 * Poll options for transaction status
 */
export interface NEARPollOptions {
  /**
   * Maximum time to poll in milliseconds
   * @default 60000
   */
  maxWaitMs?: number

  /**
   * Initial poll interval in milliseconds
   * @default 1000
   */
  initialIntervalMs?: number

  /**
   * Maximum poll interval in milliseconds
   * @default 5000
   */
  maxIntervalMs?: number

  /**
   * Target finality level to wait for
   * @default 'final'
   */
  targetFinality?: NEARFinality
}

// ─── NEARRpcClient Class ──────────────────────────────────────────────────────

/**
 * NEAR RPC Client
 *
 * Provides robust RPC integration for NEAR privacy transactions:
 * - Transaction broadcasting with nonce management
 * - Status polling with exponential backoff
 * - Finality detection
 * - RPC failover for reliability
 *
 * @example Basic usage
 * ```typescript
 * const rpc = new NEARRpcClient({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   network: 'mainnet',
 * })
 *
 * // Get account info
 * const account = await rpc.getAccount('alice.near')
 *
 * // Get access key for nonce
 * const accessKey = await rpc.getAccessKey('alice.near', publicKey)
 *
 * // Broadcast and wait for finality
 * const result = await rpc.broadcastTxAwait(signedTx)
 * ```
 */
export class NEARRpcClient {
  private urls: string[]
  private currentUrlIndex: number = 0
  private timeout: number
  private maxRetries: number
  private retryDelay: number
  private retryMultiplier: number
  private network: NEARNetwork

  constructor(config: NEARRpcConfig) {
    this.urls = [config.rpcUrl, ...(config.fallbackUrls ?? [])]
    this.network = config.network ?? 'mainnet'
    this.timeout = config.timeout ?? 30000
    this.maxRetries = config.maxRetries ?? 3
    this.retryDelay = config.retryDelay ?? 1000
    this.retryMultiplier = config.retryMultiplier ?? 2
  }

  // ─── Core RPC Methods ───────────────────────────────────────────────────────

  /**
   * Make an RPC call with retry and failover
   */
  async call<T>(method: string, params: unknown): Promise<T> {
    let lastError: Error | undefined
    let delay = this.retryDelay

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      for (let urlIdx = 0; urlIdx < this.urls.length; urlIdx++) {
        const url = this.urls[(this.currentUrlIndex + urlIdx) % this.urls.length]

        try {
          return await this.makeRequest<T>(url, method, params)
        } catch (error) {
          lastError = error as Error

          // Check if error is retryable
          if (!this.isRetryableError(error)) {
            throw error
          }
        }
      }

      // Wait before next retry with exponential backoff
      if (attempt < this.maxRetries - 1) {
        await this.sleep(delay)
        delay *= this.retryMultiplier
      }
    }

    throw lastError ?? new NEARRpcClientError(
      'RPC call failed after all retries',
      NEARErrorCode.RPC_ERROR
    )
  }

  /**
   * Make a single RPC request
   */
  private async makeRequest<T>(
    url: string,
    method: string,
    params: unknown
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `sip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          method,
          params,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new NEARRpcClientError(
          `HTTP error: ${response.status} ${response.statusText}`,
          NEARErrorCode.NETWORK_ERROR
        )
      }

      const json = await response.json() as {
        result?: T
        error?: { code: number; message: string; data?: unknown }
      }

      if (json.error) {
        throw this.parseRpcError(json.error)
      }

      return json.result as T
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new NEARRpcClientError('Request timeout', NEARErrorCode.TIMEOUT)
      }
      if (error instanceof NEARRpcClientError) {
        throw error
      }
      throw new NEARRpcClientError(
        `Network error: ${(error as Error).message}`,
        NEARErrorCode.NETWORK_ERROR,
        error
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ─── Account Methods ────────────────────────────────────────────────────────

  /**
   * Get account information
   */
  async getAccount(accountId: string): Promise<NEARAccountInfo> {
    if (!isValidAccountId(accountId)) {
      throw new ValidationError('Invalid account ID', 'accountId')
    }

    interface AccountView {
      amount: string
      locked: string
      code_hash: string
      storage_usage: number
      storage_paid_at: number
      block_height: number
      block_hash: string
    }

    const result = await this.call<AccountView>('query', {
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId,
    })

    return {
      amount: BigInt(result.amount),
      locked: BigInt(result.locked),
      codeHash: result.code_hash,
      storageUsage: result.storage_usage,
      storagePaidAt: result.storage_paid_at,
      blockHeight: result.block_height,
      blockHash: result.block_hash,
    }
  }

  /**
   * Get account balance
   */
  async getBalance(accountId: string): Promise<bigint> {
    const account = await this.getAccount(accountId)
    return account.amount
  }

  /**
   * Check if account exists
   */
  async accountExists(accountId: string): Promise<boolean> {
    try {
      await this.getAccount(accountId)
      return true
    } catch (error) {
      if (
        error instanceof NEARRpcClientError &&
        error.code === NEARErrorCode.ACCOUNT_NOT_FOUND
      ) {
        return false
      }
      throw error
    }
  }

  // ─── Access Key Methods ─────────────────────────────────────────────────────

  /**
   * Get access key information (includes nonce)
   */
  async getAccessKey(
    accountId: string,
    publicKey: string
  ): Promise<NEARAccessKey> {
    if (!isValidAccountId(accountId)) {
      throw new ValidationError('Invalid account ID', 'accountId')
    }

    interface AccessKeyView {
      nonce: number
      permission: 'FullAccess' | {
        FunctionCall: {
          allowance: string | null
          receiver_id: string
          method_names: string[]
        }
      }
      block_height: number
      block_hash: string
    }

    const result = await this.call<AccessKeyView>('query', {
      request_type: 'view_access_key',
      finality: 'final',
      account_id: accountId,
      public_key: publicKey,
    })

    return {
      nonce: BigInt(result.nonce),
      permission: result.permission,
      blockHeight: result.block_height,
      blockHash: result.block_hash,
    }
  }

  /**
   * Get current nonce for an access key
   */
  async getNonce(accountId: string, publicKey: string): Promise<bigint> {
    const accessKey = await this.getAccessKey(accountId, publicKey)
    return accessKey.nonce
  }

  /**
   * Get next nonce (current + 1)
   */
  async getNextNonce(accountId: string, publicKey: string): Promise<bigint> {
    const nonce = await this.getNonce(accountId, publicKey)
    return nonce + 1n
  }

  // ─── Block Methods ──────────────────────────────────────────────────────────

  /**
   * Get block information
   */
  async getBlock(
    blockReference: 'final' | 'optimistic' | { blockId: string | number }
  ): Promise<NEARBlockInfo> {
    interface BlockView {
      header: {
        height: number
        hash: string
        timestamp: number
        prev_hash: string
        gas_price: string
      }
    }

    const params = typeof blockReference === 'string'
      ? { finality: blockReference }
      : typeof blockReference.blockId === 'number'
        ? { block_id: blockReference.blockId }
        : { block_id: blockReference.blockId }

    const result = await this.call<BlockView>('block', params)

    return {
      height: result.header.height,
      hash: result.header.hash,
      timestamp: Math.floor(result.header.timestamp / 1_000_000), // Convert ns to ms
      prevHash: result.header.prev_hash,
      gasPrice: BigInt(result.header.gas_price),
    }
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    const block = await this.getBlock('final')
    return block.height
  }

  /**
   * Get latest block hash
   */
  async getLatestBlockHash(): Promise<string> {
    const block = await this.getBlock('final')
    return block.hash
  }

  // ─── Transaction Methods ────────────────────────────────────────────────────

  /**
   * Broadcast a signed transaction (async - returns immediately)
   */
  async broadcastTxAsync(signedTx: string): Promise<string> {
    const result = await this.call<string>('broadcast_tx_async', [signedTx])
    return result
  }

  /**
   * Broadcast a signed transaction and wait for inclusion
   */
  async broadcastTxCommit(signedTx: string): Promise<NEARTransactionOutcome> {
    interface TxResult {
      status: {
        SuccessValue?: string
        SuccessReceiptId?: string
        Failure?: { ActionError?: { kind: unknown } }
      }
      transaction: {
        hash: string
        signer_id: string
        receiver_id: string
      }
      transaction_outcome: {
        block_hash: string
        outcome: {
          gas_burnt: number
          tokens_burnt: string
          logs: string[]
        }
      }
      receipts_outcome: Array<{
        id: string
        outcome: {
          executor_id: string
          gas_burnt: number
          tokens_burnt: string
          logs: string[]
          status: {
            SuccessValue?: string
            SuccessReceiptId?: string
            Failure?: unknown
          }
        }
      }>
    }

    const result = await this.call<TxResult>('broadcast_tx_commit', [signedTx])

    return this.parseTransactionResult(result)
  }

  /**
   * Broadcast and wait for final confirmation
   */
  async broadcastTxAwait(
    signedTx: string,
    options?: NEARPollOptions
  ): Promise<NEARTransactionOutcome> {
    // First broadcast async to get the hash
    const txHash = await this.broadcastTxAsync(signedTx)

    // Then poll for finality
    return this.waitForTransaction(txHash, options)
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(
    txHash: string,
    senderId: string
  ): Promise<NEARTxStatusResult> {
    try {
      interface TxStatusResult {
        status: {
          SuccessValue?: string
          SuccessReceiptId?: string
          Failure?: { ActionError?: { kind: unknown } }
        }
        transaction: {
          hash: string
          signer_id: string
          receiver_id: string
        }
        transaction_outcome: {
          block_hash: string
          outcome: {
            gas_burnt: number
            tokens_burnt: string
            logs: string[]
          }
        }
        receipts_outcome: Array<{
          id: string
          outcome: {
            executor_id: string
            gas_burnt: number
            tokens_burnt: string
            logs: string[]
            status: {
              SuccessValue?: string
              SuccessReceiptId?: string
              Failure?: unknown
            }
          }
        }>
      }

      // First try with EXPERIMENTAL_tx_status for finality info
      const result = await this.call<TxStatusResult>(
        'EXPERIMENTAL_tx_status',
        [txHash, senderId]
      )

      const outcome = this.parseTransactionResult(result)

      return {
        status: outcome.status,
        finality: outcome.finalityStatus,
        outcome,
      }
    } catch (error) {
      // Transaction not found yet
      if (
        error instanceof NEARRpcClientError &&
        (error.message.includes('not found') ||
          error.message.includes('UNKNOWN_TRANSACTION'))
      ) {
        return {
          status: 'pending',
          finality: 'optimistic',
        }
      }
      throw error
    }
  }

  /**
   * Wait for transaction with polling
   */
  async waitForTransaction(
    txHash: string,
    options?: NEARPollOptions,
    senderId?: string
  ): Promise<NEARTransactionOutcome> {
    const maxWaitMs = options?.maxWaitMs ?? 60000
    const initialIntervalMs = options?.initialIntervalMs ?? 1000
    const maxIntervalMs = options?.maxIntervalMs ?? 5000
    const targetFinality = options?.targetFinality ?? 'final'

    const startTime = Date.now()
    let intervalMs = initialIntervalMs

    // We need senderId to query status - if not provided, try to extract from hash
    // In practice, caller should provide senderId
    const sender = senderId ?? ''

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const result = await this.getTransactionStatus(txHash, sender)

        if (result.status === 'failed') {
          throw new NEARRpcClientError(
            `Transaction failed: ${result.error ?? 'Unknown error'}`,
            NEARErrorCode.ACTION_ERROR,
            undefined,
            result.outcome
          )
        }

        // Check if we've reached target finality
        if (this.isFinalityReached(result.finality, targetFinality)) {
          if (result.outcome) {
            return result.outcome
          }
        }
      } catch (error) {
        // Ignore "not found" errors - tx may not be indexed yet
        if (
          !(error instanceof NEARRpcClientError) ||
          !error.message.includes('not found')
        ) {
          throw error
        }
      }

      // Wait before next poll with exponential backoff (capped)
      await this.sleep(intervalMs)
      intervalMs = Math.min(intervalMs * 1.5, maxIntervalMs)
    }

    throw new NEARRpcClientError(
      `Transaction did not reach ${targetFinality} finality within ${maxWaitMs}ms`,
      NEARErrorCode.TIMEOUT
    )
  }

  // ─── Contract View Methods ──────────────────────────────────────────────────

  /**
   * Call a view function on a contract
   */
  async viewFunction<T>(
    contractId: string,
    methodName: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    if (!isValidAccountId(contractId)) {
      throw new ValidationError('Invalid contract ID', 'contractId')
    }

    interface ViewResult {
      result: number[]
      logs: string[]
      block_height: number
      block_hash: string
    }

    const result = await this.call<ViewResult>('query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
    })

    // Decode result from bytes
    const decoded = Buffer.from(result.result).toString('utf-8')
    return JSON.parse(decoded) as T
  }

  /**
   * Get token balance for a NEP-141 token
   */
  async getTokenBalance(
    tokenContract: string,
    accountId: string
  ): Promise<bigint> {
    try {
      const balance = await this.viewFunction<string>(
        tokenContract,
        'ft_balance_of',
        { account_id: accountId }
      )
      return BigInt(balance)
    } catch {
      // Account may not be registered
      return 0n
    }
  }

  /**
   * Check if account has storage deposit for a token
   */
  async hasStorageDeposit(
    tokenContract: string,
    accountId: string
  ): Promise<boolean> {
    try {
      const result = await this.viewFunction<{
        total: string
        available: string
      } | null>(tokenContract, 'storage_balance_of', { account_id: accountId })

      return result !== null && BigInt(result.total) > 0n
    } catch {
      return false
    }
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────

  /**
   * Get the current network
   */
  getNetwork(): NEARNetwork {
    return this.network
  }

  /**
   * Get the primary RPC URL
   */
  getRpcUrl(): string {
    return this.urls[0]
  }

  /**
   * Switch to next RPC endpoint (for manual failover)
   */
  switchEndpoint(): void {
    this.currentUrlIndex = (this.currentUrlIndex + 1) % this.urls.length
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private parseRpcError(error: {
    code: number
    message: string
    data?: unknown
  }): NEARRpcClientError {
    const message = error.message

    // Categorize error based on message content
    if (message.includes('does not exist')) {
      if (message.includes('account')) {
        return new NEARRpcClientError(message, NEARErrorCode.ACCOUNT_NOT_FOUND, undefined, error.data)
      }
      if (message.includes('access key')) {
        return new NEARRpcClientError(message, NEARErrorCode.ACCESS_KEY_NOT_FOUND, undefined, error.data)
      }
    }

    if (message.includes('InvalidNonce')) {
      return new NEARRpcClientError(message, NEARErrorCode.INVALID_NONCE, undefined, error.data)
    }

    if (message.includes('NotEnoughBalance') || message.includes('LackBalanceForState')) {
      return new NEARRpcClientError(message, NEARErrorCode.INSUFFICIENT_BALANCE, undefined, error.data)
    }

    if (message.includes('InvalidTransaction')) {
      return new NEARRpcClientError(message, NEARErrorCode.INVALID_TRANSACTION, undefined, error.data)
    }

    return new NEARRpcClientError(message, NEARErrorCode.RPC_ERROR, undefined, error.data)
  }

  private parseTransactionResult(result: {
    status: {
      SuccessValue?: string
      SuccessReceiptId?: string
      Failure?: { ActionError?: { kind: unknown } }
    }
    transaction: {
      hash: string
      signer_id: string
      receiver_id: string
    }
    transaction_outcome: {
      block_hash: string
      outcome: {
        gas_burnt: number
        tokens_burnt: string
        logs: string[]
      }
    }
    receipts_outcome: Array<{
      id: string
      outcome: {
        executor_id: string
        gas_burnt: number
        tokens_burnt: string
        logs: string[]
        status: {
          SuccessValue?: string
          SuccessReceiptId?: string
          Failure?: unknown
        }
      }
    }>
  }): NEARTransactionOutcome {
    const failed = !!result.status.Failure
    const receipts: NEARReceiptOutcome[] = result.receipts_outcome.map((r) => ({
      receiptId: r.id,
      receiverId: r.outcome.executor_id,
      status: r.outcome.status.Failure ? 'failure' : 'success',
      gasUsed: BigInt(r.outcome.gas_burnt),
      tokensBurnt: BigInt(r.outcome.tokens_burnt),
      logs: r.outcome.logs,
      error: r.outcome.status.Failure
        ? JSON.stringify(r.outcome.status.Failure)
        : undefined,
    }))

    return {
      txHash: result.transaction.hash,
      signerId: result.transaction.signer_id,
      receiverId: result.transaction.receiver_id,
      status: failed ? 'failed' : 'final',
      finalityStatus: 'final', // broadcast_tx_commit waits for finality
      blockHash: result.transaction_outcome.block_hash,
      blockHeight: 0, // Not provided in this response
      gasUsed: BigInt(result.transaction_outcome.outcome.gas_burnt),
      tokensBurnt: BigInt(result.transaction_outcome.outcome.tokens_burnt),
      logs: result.transaction_outcome.outcome.logs,
      receipts,
      error: failed
        ? JSON.stringify(result.status.Failure)
        : undefined,
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof NEARRpcClientError) {
      // Retry network and timeout errors
      return (
        error.code === NEARErrorCode.NETWORK_ERROR ||
        error.code === NEARErrorCode.TIMEOUT ||
        error.code === NEARErrorCode.RPC_ERROR
      )
    }
    return false
  }

  private isFinalityReached(
    current: NEARFinality,
    target: NEARFinality
  ): boolean {
    const levels: NEARFinality[] = ['optimistic', 'near-final', 'final']
    return levels.indexOf(current) >= levels.indexOf(target)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a NEAR RPC client
 */
export function createNEARRpcClient(config: NEARRpcConfig): NEARRpcClient {
  return new NEARRpcClient(config)
}

/**
 * Create a mainnet RPC client with default configuration
 */
export function createMainnetRpcClient(
  options?: Partial<Omit<NEARRpcConfig, 'rpcUrl' | 'network'>>
): NEARRpcClient {
  return new NEARRpcClient({
    rpcUrl: NEAR_RPC_ENDPOINTS.mainnet,
    fallbackUrls: [
      'https://rpc.fastnear.com',
      'https://near-mainnet.api.pagoda.co/rpc/v1',
    ],
    network: 'mainnet',
    ...options,
  })
}

/**
 * Create a testnet RPC client with default configuration
 */
export function createTestnetRpcClient(
  options?: Partial<Omit<NEARRpcConfig, 'rpcUrl' | 'network'>>
): NEARRpcClient {
  return new NEARRpcClient({
    rpcUrl: NEAR_RPC_ENDPOINTS.testnet,
    fallbackUrls: [
      'https://rpc.testnet.fastnear.com',
    ],
    network: 'testnet',
    ...options,
  })
}
