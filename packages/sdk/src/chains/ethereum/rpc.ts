/**
 * Ethereum RPC Client for Privacy Transactions
 *
 * Provides JSON-RPC integration for submitting and monitoring
 * privacy transactions with nonce management and confirmation tracking.
 *
 * @module chains/ethereum/rpc
 */

import type { HexString } from '@sip-protocol/types'
import {
  type EthereumNetwork,
  ETHEREUM_RPC_ENDPOINTS,
  getChainId,
} from './constants'
import {
  updateGasPriceCache,
  parseFeeHistoryResponse,
  parseGasPriceResponse,
} from './gas-estimation'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Transaction status
 */
export type TransactionStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'replaced'

/**
 * Submitted transaction info
 */
export interface SubmittedTransaction {
  /**
   * Transaction hash
   */
  txHash: HexString

  /**
   * Transaction status
   */
  status: TransactionStatus

  /**
   * Nonce used
   */
  nonce: number

  /**
   * Block number (if confirmed)
   */
  blockNumber?: number

  /**
   * Block hash (if confirmed)
   */
  blockHash?: HexString

  /**
   * Gas used (if confirmed)
   */
  gasUsed?: bigint

  /**
   * Effective gas price (if confirmed)
   */
  effectiveGasPrice?: bigint

  /**
   * Confirmation count
   */
  confirmations: number

  /**
   * Error message (if failed)
   */
  error?: string

  /**
   * Timestamp of submission
   */
  submittedAt: number
}

/**
 * Transaction receipt from RPC
 */
export interface TransactionReceipt {
  /**
   * Transaction hash
   */
  transactionHash: HexString

  /**
   * Block number
   */
  blockNumber: number

  /**
   * Block hash
   */
  blockHash: HexString

  /**
   * Contract address (if deployment)
   */
  contractAddress?: HexString

  /**
   * Gas used
   */
  gasUsed: bigint

  /**
   * Effective gas price
   */
  effectiveGasPrice: bigint

  /**
   * Status (1 = success, 0 = failure)
   */
  status: 0 | 1

  /**
   * Transaction logs
   */
  logs: Array<{
    address: HexString
    topics: HexString[]
    data: HexString
    logIndex: number
  }>
}

/**
 * RPC request options
 */
export interface RpcRequestOptions {
  /**
   * Request timeout in ms (default: 30000)
   */
  timeout?: number

  /**
   * Number of retries (default: 3)
   */
  retries?: number

  /**
   * Retry delay in ms (default: 1000)
   */
  retryDelay?: number
}

/**
 * Nonce manager state
 */
interface NonceState {
  current: number
  pending: number
  lastUpdated: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default request timeout (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000

/**
 * Default retry count
 */
const DEFAULT_RETRIES = 3

/**
 * Default retry delay
 */
const DEFAULT_RETRY_DELAY = 1000

/**
 * Nonce cache duration (10 seconds)
 */
const NONCE_CACHE_DURATION = 10000

// ─── RPC Client Class ────────────────────────────────────────────────────────

/**
 * Ethereum RPC Client
 *
 * Provides JSON-RPC methods for privacy transaction submission,
 * monitoring, and gas price fetching.
 *
 * @example Basic usage
 * ```typescript
 * const rpc = new EthereumRpcClient('mainnet')
 *
 * // Fetch gas prices
 * const gasPrice = await rpc.getGasPrice()
 *
 * // Get account nonce
 * const nonce = await rpc.getTransactionCount(address)
 *
 * // Submit transaction
 * const txHash = await rpc.sendRawTransaction(signedTx)
 *
 * // Wait for confirmation
 * const receipt = await rpc.waitForTransaction(txHash)
 * ```
 */
export class EthereumRpcClient {
  private rpcUrl: string
  private network: EthereumNetwork
  private chainId: number
  private nonceCache: Map<string, NonceState> = new Map()
  private pendingTxs: Map<string, SubmittedTransaction> = new Map()
  private requestId: number = 0

  constructor(
    network: EthereumNetwork = 'mainnet',
    options?: {
      rpcUrl?: string
    }
  ) {
    this.network = network
    this.rpcUrl = options?.rpcUrl ?? ETHEREUM_RPC_ENDPOINTS[network]
    this.chainId = getChainId(network)
  }

  // ─── Gas Price Methods ───────────────────────────────────────────────────────

  /**
   * Get current gas price (legacy)
   *
   * @param options - Request options
   * @returns Gas price in wei
   */
  async getGasPrice(options?: RpcRequestOptions): Promise<bigint> {
    const result = await this.rpcCall<HexString>('eth_gasPrice', [], options)
    const gasPrice = parseGasPriceResponse(result)

    // Update cache
    updateGasPriceCache(this.network, gasPrice, 2n * 10n ** 9n) // Default 2 gwei priority

    return gasPrice
  }

  /**
   * Get EIP-1559 fee data
   *
   * @param blockCount - Number of blocks to analyze (default: 4)
   * @param options - Request options
   * @returns Base fee and priority fee suggestions
   */
  async getFeeData(
    blockCount: number = 4,
    options?: RpcRequestOptions
  ): Promise<{
    baseFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    maxFeePerGas: bigint
  }> {
    try {
      const result = await this.rpcCall<{
        baseFeePerGas: HexString[]
        reward: HexString[][]
      }>(
        'eth_feeHistory',
        [
          `0x${blockCount.toString(16)}`,
          'latest',
          [25, 50, 75], // Percentiles
        ],
        options
      )

      const { baseFee, priorityFee } = parseFeeHistoryResponse(
        result.baseFeePerGas,
        result.reward
      )

      // Update cache
      updateGasPriceCache(this.network, baseFee, priorityFee)

      const maxFeePerGas = baseFee * 2n + priorityFee

      return {
        baseFeePerGas: baseFee,
        maxPriorityFeePerGas: priorityFee,
        maxFeePerGas,
      }
    } catch {
      // Fallback to legacy gas price
      const gasPrice = await this.getGasPrice(options)
      return {
        baseFeePerGas: gasPrice,
        maxPriorityFeePerGas: 2n * 10n ** 9n,
        maxFeePerGas: gasPrice * 2n,
      }
    }
  }

  // ─── Account Methods ─────────────────────────────────────────────────────────

  /**
   * Get transaction count (nonce) for an address
   *
   * @param address - Ethereum address
   * @param blockTag - Block tag (default: 'pending')
   * @param options - Request options
   * @returns Transaction count
   */
  async getTransactionCount(
    address: HexString,
    blockTag: 'latest' | 'pending' = 'pending',
    options?: RpcRequestOptions
  ): Promise<number> {
    // Check cache
    const cached = this.getCachedNonce(address)
    if (cached !== undefined && blockTag === 'pending') {
      return cached
    }

    const result = await this.rpcCall<HexString>(
      'eth_getTransactionCount',
      [address, blockTag],
      options
    )

    const count = parseInt(result, 16)

    // Update cache
    this.updateNonceCache(address, count)

    return count
  }

  /**
   * Get next available nonce (with local tracking)
   *
   * @param address - Ethereum address
   * @param options - Request options
   * @returns Next nonce to use
   */
  async getNextNonce(
    address: HexString,
    options?: RpcRequestOptions
  ): Promise<number> {
    const key = address.toLowerCase()
    const cached = this.nonceCache.get(key)

    // If we have pending transactions, return the next pending nonce
    if (cached && Date.now() - cached.lastUpdated < NONCE_CACHE_DURATION) {
      return cached.pending
    }

    // Fetch from network
    const networkNonce = await this.getTransactionCount(address, 'pending', options)
    return networkNonce
  }

  /**
   * Reserve a nonce for a transaction
   *
   * @param address - Ethereum address
   * @returns Reserved nonce
   */
  reserveNonce(address: HexString): number {
    const key = address.toLowerCase()
    const cached = this.nonceCache.get(key)

    if (!cached) {
      // Initialize with 0, will be corrected on first actual tx
      this.nonceCache.set(key, {
        current: 0,
        pending: 1,
        lastUpdated: Date.now(),
      })
      return 0
    }

    // Increment pending nonce
    const nonce = cached.pending
    cached.pending++
    cached.lastUpdated = Date.now()

    return nonce
  }

  /**
   * Release a reserved nonce (if transaction failed before submission)
   *
   * @param address - Ethereum address
   * @param nonce - Nonce to release
   */
  releaseNonce(address: HexString, nonce: number): void {
    const key = address.toLowerCase()
    const cached = this.nonceCache.get(key)

    if (cached && cached.pending > nonce) {
      cached.pending = nonce
    }
  }

  /**
   * Get account balance
   *
   * @param address - Ethereum address
   * @param blockTag - Block tag
   * @param options - Request options
   * @returns Balance in wei
   */
  async getBalance(
    address: HexString,
    blockTag: 'latest' | 'pending' = 'latest',
    options?: RpcRequestOptions
  ): Promise<bigint> {
    const result = await this.rpcCall<HexString>(
      'eth_getBalance',
      [address, blockTag],
      options
    )

    return BigInt(result)
  }

  // ─── Transaction Methods ─────────────────────────────────────────────────────

  /**
   * Send a signed raw transaction
   *
   * @param signedTx - Signed transaction hex
   * @param options - Request options
   * @returns Transaction hash
   */
  async sendRawTransaction(
    signedTx: HexString,
    options?: RpcRequestOptions
  ): Promise<HexString> {
    const txHash = await this.rpcCall<HexString>(
      'eth_sendRawTransaction',
      [signedTx],
      options
    )

    // Track pending transaction
    this.pendingTxs.set(txHash.toLowerCase(), {
      txHash,
      status: 'submitted',
      nonce: -1, // Will be updated from receipt
      confirmations: 0,
      submittedAt: Date.now(),
    })

    return txHash
  }

  /**
   * Get transaction receipt
   *
   * @param txHash - Transaction hash
   * @param options - Request options
   * @returns Receipt or null if pending
   */
  async getTransactionReceipt(
    txHash: HexString,
    options?: RpcRequestOptions
  ): Promise<TransactionReceipt | null> {
    const result = await this.rpcCall<{
      transactionHash: HexString
      blockNumber: HexString
      blockHash: HexString
      contractAddress: HexString | null
      gasUsed: HexString
      effectiveGasPrice: HexString
      status: HexString
      logs: Array<{
        address: HexString
        topics: HexString[]
        data: HexString
        logIndex: HexString
      }>
    } | null>('eth_getTransactionReceipt', [txHash], options)

    if (!result) {
      return null
    }

    return {
      transactionHash: result.transactionHash,
      blockNumber: parseInt(result.blockNumber, 16),
      blockHash: result.blockHash,
      contractAddress: result.contractAddress ?? undefined,
      gasUsed: BigInt(result.gasUsed),
      effectiveGasPrice: BigInt(result.effectiveGasPrice),
      status: parseInt(result.status, 16) as 0 | 1,
      logs: result.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        logIndex: parseInt(log.logIndex, 16),
      })),
    }
  }

  /**
   * Wait for transaction confirmation
   *
   * @param txHash - Transaction hash
   * @param confirmations - Number of confirmations to wait for (default: 1)
   * @param timeout - Timeout in ms (default: 60000)
   * @returns Transaction receipt
   */
  async waitForTransaction(
    txHash: HexString,
    confirmations: number = 1,
    timeout: number = 60000
  ): Promise<TransactionReceipt> {
    const startTime = Date.now()
    const pollInterval = 2000 // 2 seconds

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getTransactionReceipt(txHash)

      if (receipt) {
        // Get current block for confirmation count
        const currentBlock = await this.getBlockNumber()
        const txConfirmations = currentBlock - receipt.blockNumber + 1

        if (txConfirmations >= confirmations) {
          // Update tracked transaction
          const tracked = this.pendingTxs.get(txHash.toLowerCase())
          if (tracked) {
            tracked.status = receipt.status === 1 ? 'confirmed' : 'failed'
            tracked.blockNumber = receipt.blockNumber
            tracked.blockHash = receipt.blockHash
            tracked.gasUsed = receipt.gasUsed
            tracked.effectiveGasPrice = receipt.effectiveGasPrice
            tracked.confirmations = txConfirmations
          }

          return receipt
        }
      }

      // Wait before next poll
      await this.sleep(pollInterval)
    }

    throw new Error(`Transaction ${txHash} not confirmed within ${timeout}ms`)
  }

  /**
   * Get current block number
   *
   * @param options - Request options
   * @returns Block number
   */
  async getBlockNumber(options?: RpcRequestOptions): Promise<number> {
    const result = await this.rpcCall<HexString>('eth_blockNumber', [], options)
    return parseInt(result, 16)
  }

  // ─── Call Methods ────────────────────────────────────────────────────────────

  /**
   * Execute a read-only call
   *
   * @param call - Call parameters
   * @param blockTag - Block tag
   * @param options - Request options
   * @returns Call result
   */
  async call(
    call: {
      to: HexString
      data: HexString
      from?: HexString
      value?: bigint
    },
    blockTag: 'latest' | 'pending' = 'latest',
    options?: RpcRequestOptions
  ): Promise<HexString> {
    const params: Record<string, string> = {
      to: call.to,
      data: call.data,
    }

    if (call.from) {
      params.from = call.from
    }

    if (call.value !== undefined) {
      params.value = `0x${call.value.toString(16)}`
    }

    return await this.rpcCall<HexString>('eth_call', [params, blockTag], options)
  }

  /**
   * Estimate gas for a transaction
   *
   * @param tx - Transaction parameters
   * @param options - Request options
   * @returns Estimated gas
   */
  async estimateGas(
    tx: {
      to: HexString
      data?: HexString
      from?: HexString
      value?: bigint
    },
    options?: RpcRequestOptions
  ): Promise<bigint> {
    const params: Record<string, string> = {
      to: tx.to,
    }

    if (tx.data) {
      params.data = tx.data
    }

    if (tx.from) {
      params.from = tx.from
    }

    if (tx.value !== undefined) {
      params.value = `0x${tx.value.toString(16)}`
    }

    const result = await this.rpcCall<HexString>('eth_estimateGas', [params], options)
    return BigInt(result)
  }

  // ─── Log Methods ─────────────────────────────────────────────────────────────

  /**
   * Get logs matching a filter
   *
   * @param filter - Log filter
   * @param options - Request options
   * @returns Matching logs
   */
  async getLogs(
    filter: {
      address?: HexString | HexString[]
      topics?: (HexString | HexString[] | null)[]
      fromBlock?: number | 'latest'
      toBlock?: number | 'latest'
    },
    options?: RpcRequestOptions
  ): Promise<
    Array<{
      address: HexString
      topics: HexString[]
      data: HexString
      blockNumber: number
      transactionHash: HexString
      logIndex: number
    }>
  > {
    const params: Record<string, unknown> = {}

    if (filter.address) {
      params.address = filter.address
    }

    if (filter.topics) {
      params.topics = filter.topics
    }

    params.fromBlock =
      typeof filter.fromBlock === 'number'
        ? `0x${filter.fromBlock.toString(16)}`
        : (filter.fromBlock ?? 'latest')

    params.toBlock =
      typeof filter.toBlock === 'number'
        ? `0x${filter.toBlock.toString(16)}`
        : (filter.toBlock ?? 'latest')

    const result = await this.rpcCall<
      Array<{
        address: HexString
        topics: HexString[]
        data: HexString
        blockNumber: HexString
        transactionHash: HexString
        logIndex: HexString
      }>
    >('eth_getLogs', [params], options)

    return result.map((log) => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      blockNumber: parseInt(log.blockNumber, 16),
      transactionHash: log.transactionHash,
      logIndex: parseInt(log.logIndex, 16),
    }))
  }

  // ─── Utility Methods ─────────────────────────────────────────────────────────

  /**
   * Get RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl
  }

  /**
   * Get network
   */
  getNetwork(): EthereumNetwork {
    return this.network
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.chainId
  }

  /**
   * Get tracked pending transactions
   */
  getPendingTransactions(): SubmittedTransaction[] {
    return Array.from(this.pendingTxs.values()).filter(
      (tx) => tx.status === 'submitted' || tx.status === 'pending'
    )
  }

  /**
   * Get transaction status
   *
   * @param txHash - Transaction hash
   * @returns Transaction info or undefined
   */
  getTrackedTransaction(txHash: HexString): SubmittedTransaction | undefined {
    return this.pendingTxs.get(txHash.toLowerCase())
  }

  /**
   * Clear tracked transactions
   */
  clearTrackedTransactions(): void {
    this.pendingTxs.clear()
  }

  /**
   * Clear nonce cache
   */
  clearNonceCache(): void {
    this.nonceCache.clear()
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Make an RPC call
   */
  private async rpcCall<T>(
    method: string,
    params: unknown[],
    options?: RpcRequestOptions
  ): Promise<T> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT
    const retries = options?.retries ?? DEFAULT_RETRIES
    const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY

    let lastError: Error | undefined

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: ++this.requestId,
            method,
            params,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        const json = (await response.json()) as {
          result?: T
          error?: { code: number; message: string }
        }

        if (json.error) {
          throw new Error(`RPC error: ${json.error.message} (${json.error.code})`)
        }

        return json.result as T
      } catch (error) {
        lastError = error as Error

        // Don't retry on abort
        if (lastError.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`)
        }

        // Wait before retry
        if (attempt < retries) {
          await this.sleep(retryDelay * (attempt + 1))
        }
      }
    }

    throw lastError ?? new Error('RPC call failed')
  }

  /**
   * Get cached nonce
   */
  private getCachedNonce(address: HexString): number | undefined {
    const key = address.toLowerCase()
    const cached = this.nonceCache.get(key)

    if (!cached || Date.now() - cached.lastUpdated > NONCE_CACHE_DURATION) {
      return undefined
    }

    return cached.pending
  }

  /**
   * Update nonce cache
   */
  private updateNonceCache(address: HexString, nonce: number): void {
    const key = address.toLowerCase()
    const cached = this.nonceCache.get(key)

    if (cached) {
      cached.current = nonce
      if (cached.pending < nonce) {
        cached.pending = nonce
      }
      cached.lastUpdated = Date.now()
    } else {
      this.nonceCache.set(key, {
        current: nonce,
        pending: nonce,
        lastUpdated: Date.now(),
      })
    }
  }

  /**
   * Sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create an RPC client for a network
 *
 * @param network - Target network
 * @param rpcUrl - Optional custom RPC URL
 * @returns RPC client
 */
export function createRpcClient(
  network: EthereumNetwork = 'mainnet',
  rpcUrl?: string
): EthereumRpcClient {
  return new EthereumRpcClient(network, { rpcUrl })
}

/**
 * Create a mainnet RPC client
 */
export function createMainnetRpcClient(rpcUrl?: string): EthereumRpcClient {
  return new EthereumRpcClient('mainnet', { rpcUrl })
}

/**
 * Create a Sepolia testnet RPC client
 */
export function createSepoliaRpcClient(rpcUrl?: string): EthereumRpcClient {
  return new EthereumRpcClient('sepolia', { rpcUrl })
}
