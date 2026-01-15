/**
 * Zcash RPC Client
 *
 * HTTP client for interacting with zcashd node via JSON-RPC.
 * Supports both mainnet and testnet with automatic retry logic.
 *
 * @example
 * ```typescript
 * const client = new ZcashRPCClient({
 *   username: 'rpcuser',
 *   password: 'rpcpassword',
 *   testnet: true,
 * })
 *
 * // Create new account and get address
 * const { account } = await client.createAccount()
 * const { address } = await client.getAddressForAccount(account)
 *
 * // Send shielded transaction
 * const opId = await client.sendShielded({
 *   fromAddress: address,
 *   recipients: [{ address: recipientAddr, amount: 0.1 }],
 * })
 *
 * // Wait for completion
 * const result = await client.waitForOperation(opId)
 * ```
 */

import {
  type ZcashConfig,
  type ZcashAddressInfo,
  type ZcashNewAccount,
  type ZcashAccountAddress,
  type ZcashAccountBalance,
  type ZcashReceiverType,
  type ZcashUnspentNote,
  type ZcashShieldedSendParams,
  type ZcashOperation,
  type ZcashBlockHeader,
  type ZcashBlock,
  type ZcashRPCRequest,
  type ZcashRPCResponse,
  type ZcashRPCError as ZcashRPCErrorType,
  type ZcashBlockchainInfo,
  type ZcashNetworkInfo,
  ZcashErrorCode,
} from '@sip-protocol/types'
import { NetworkError, ErrorCode } from '../errors'
import { warnOnce, deprecationMessage } from '../utils'
import { ZCASH_RPC_CONFIG } from '../config/endpoints'

// ─── Default Configuration ─────────────────────────────────────────────────────

/**
 * Default configuration for Zcash RPC client
 * Host and port are configurable via ZCASH_RPC_HOST and ZCASH_RPC_PORT environment variables
 */
const DEFAULT_CONFIG: Required<Omit<ZcashConfig, 'username' | 'password'>> = {
  host: ZCASH_RPC_CONFIG.host,
  port: ZCASH_RPC_CONFIG.port,
  testnet: false,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
}

// ─── Error Classes ─────────────────────────────────────────────────────────────

/**
 * Error thrown when Zcash RPC call fails
 */
export class ZcashRPCError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ZcashRPCError'
  }

  /**
   * Check if error is due to insufficient funds
   */
  isInsufficientFunds(): boolean {
    return this.code === ZcashErrorCode.WALLET_INSUFFICIENT_FUNDS
  }

  /**
   * Check if error is due to invalid address
   */
  isInvalidAddress(): boolean {
    return this.code === ZcashErrorCode.INVALID_ADDRESS_OR_KEY
  }

  /**
   * Check if error is due to wallet being locked
   */
  isWalletLocked(): boolean {
    return this.code === ZcashErrorCode.WALLET_UNLOCK_NEEDED
  }
}

// ─── RPC Client ────────────────────────────────────────────────────────────────

/**
 * Zcash RPC Client
 *
 * Provides type-safe access to zcashd JSON-RPC API with automatic
 * retry logic and proper error handling.
 *
 * @security IMPORTANT: Always use HTTPS in production environments.
 * This client uses HTTP Basic Authentication which transmits credentials
 * in base64-encoded cleartext. Without TLS/HTTPS, credentials and all
 * RPC data are vulnerable to network sniffing and man-in-the-middle attacks.
 *
 * Production configuration should use:
 * - HTTPS endpoint (e.g., https://your-node.com:8232)
 * - Valid TLS certificates
 * - Secure credential storage
 * - Network-level access controls
 */
export class ZcashRPCClient {
  private readonly config: Required<ZcashConfig>
  private readonly baseUrl: string
  private requestId: number = 0

  constructor(config: ZcashConfig) {
    // Use testnet port if testnet is enabled and no custom port provided
    const defaultPort = config.testnet ? 18232 : DEFAULT_CONFIG.port

    this.config = {
      host: config.host ?? DEFAULT_CONFIG.host,
      port: config.port ?? defaultPort,
      username: config.username,
      password: config.password,
      testnet: config.testnet ?? DEFAULT_CONFIG.testnet,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      retries: config.retries ?? DEFAULT_CONFIG.retries,
      retryDelay: config.retryDelay ?? DEFAULT_CONFIG.retryDelay,
    }

    this.baseUrl = `http://${this.config.host}:${this.config.port}`
  }

  // ─── Address Operations ────────────────────────────────────────────────────

  /**
   * Validate a Zcash address
   *
   * @param address - Address to validate (t-addr, z-addr, or unified)
   * @returns Address validation info
   */
  async validateAddress(address: string): Promise<ZcashAddressInfo> {
    return this.call<ZcashAddressInfo>('z_validateaddress', [address])
  }

  /**
   * Create a new HD account
   *
   * @returns New account number
   */
  async createAccount(): Promise<ZcashNewAccount> {
    return this.call<ZcashNewAccount>('z_getnewaccount', [])
  }

  /**
   * Get or derive an address for an account
   *
   * @param account - Account number
   * @param receiverTypes - Optional receiver types (default: best shielded + p2pkh)
   * @param diversifierIndex - Optional specific diversifier index
   * @returns Account address info
   */
  async getAddressForAccount(
    account: number,
    receiverTypes?: ZcashReceiverType[],
    diversifierIndex?: number,
  ): Promise<ZcashAccountAddress> {
    const params: unknown[] = [account]
    if (receiverTypes !== undefined) {
      params.push(receiverTypes)
      if (diversifierIndex !== undefined) {
        params.push(diversifierIndex)
      }
    }
    return this.call<ZcashAccountAddress>('z_getaddressforaccount', params)
  }

  /**
   * Generate a new shielded address (DEPRECATED)
   *
   * @deprecated Use createAccount() and getAddressForAccount() instead
   * @param type - Address type ('sapling' or 'sprout')
   * @returns New shielded address
   */
  async generateShieldedAddress(type: 'sapling' | 'sprout' = 'sapling'): Promise<string> {
    warnOnce('generateShieldedAddress', deprecationMessage(
      'generateShieldedAddress()',
      'createAccount() and getAddressForAccount()',
      '2026-06-01'
    ))
    return this.call<string>('z_getnewaddress', [type])
  }

  /**
   * List all shielded addresses in the wallet
   *
   * @returns Array of shielded addresses
   */
  async listAddresses(): Promise<string[]> {
    return this.call<string[]>('z_listaddresses', [])
  }

  // ─── Balance Operations ────────────────────────────────────────────────────

  /**
   * Get balance for an account
   *
   * @param account - Account number
   * @param minConf - Minimum confirmations (default: 1)
   * @returns Account balance by pool
   */
  async getAccountBalance(account: number, minConf: number = 1): Promise<ZcashAccountBalance> {
    return this.call<ZcashAccountBalance>('z_getbalanceforaccount', [account, minConf])
  }

  /**
   * Get balance for an address (DEPRECATED)
   *
   * @deprecated Use getAccountBalance() instead
   * @param address - Address to check
   * @param minConf - Minimum confirmations
   * @returns Balance in ZEC
   */
  async getBalance(address: string, minConf: number = 1): Promise<number> {
    return this.call<number>('z_getbalance', [address, minConf])
  }

  /**
   * Get total wallet balance
   *
   * @param minConf - Minimum confirmations
   * @returns Total balances (transparent, private, total)
   */
  async getTotalBalance(minConf: number = 1): Promise<{
    transparent: string
    private: string
    total: string
  }> {
    return this.call('z_gettotalbalance', [minConf])
  }

  // ─── UTXO Operations ───────────────────────────────────────────────────────

  /**
   * List unspent shielded notes
   *
   * @param minConf - Minimum confirmations (default: 1)
   * @param maxConf - Maximum confirmations (default: 9999999)
   * @param includeWatchonly - Include watchonly addresses
   * @param addresses - Filter by addresses
   * @returns Array of unspent notes
   */
  async listUnspent(
    minConf: number = 1,
    maxConf: number = 9999999,
    includeWatchonly: boolean = false,
    addresses?: string[],
  ): Promise<ZcashUnspentNote[]> {
    const params: unknown[] = [minConf, maxConf, includeWatchonly]
    if (addresses) {
      params.push(addresses)
    }
    return this.call<ZcashUnspentNote[]>('z_listunspent', params)
  }

  // ─── Transaction Operations ────────────────────────────────────────────────

  /**
   * Send a shielded transaction
   *
   * @param params - Send parameters
   * @returns Operation ID for tracking
   */
  async sendShielded(params: ZcashShieldedSendParams): Promise<string> {
    const amounts = params.recipients.map((r) => ({
      address: r.address,
      amount: r.amount,
      ...(r.memo && { memo: r.memo }),
    }))

    const rpcParams: unknown[] = [params.fromAddress, amounts]

    if (params.minConf !== undefined) {
      rpcParams.push(params.minConf)
      if (params.fee !== undefined) {
        rpcParams.push(params.fee)
        if (params.privacyPolicy !== undefined) {
          rpcParams.push(params.privacyPolicy)
        }
      }
    }

    return this.call<string>('z_sendmany', rpcParams)
  }

  /**
   * Shield coinbase UTXOs to a shielded address
   *
   * @param fromAddress - Transparent address with coinbase
   * @param toAddress - Shielded destination
   * @param fee - Optional fee
   * @param limit - Max UTXOs to shield
   * @returns Operation ID
   */
  async shieldCoinbase(
    fromAddress: string,
    toAddress: string,
    fee?: number,
    limit?: number,
  ): Promise<{ operationid: string; shieldingUTXOs: number; shieldingValue: number }> {
    const params: unknown[] = [fromAddress, toAddress]
    if (fee !== undefined) params.push(fee)
    if (limit !== undefined) params.push(limit)
    return this.call('z_shieldcoinbase', params)
  }

  // ─── Operation Management ──────────────────────────────────────────────────

  /**
   * Get status of async operations
   *
   * @param operationIds - Optional specific operation IDs
   * @returns Array of operation statuses
   */
  async getOperationStatus(operationIds?: string[]): Promise<ZcashOperation[]> {
    return this.call<ZcashOperation[]>('z_getoperationstatus', operationIds ? [operationIds] : [])
  }

  /**
   * Get and remove completed operation results
   *
   * @param operationIds - Optional specific operation IDs
   * @returns Array of operation results
   */
  async getOperationResult(operationIds?: string[]): Promise<ZcashOperation[]> {
    return this.call<ZcashOperation[]>('z_getoperationresult', operationIds ? [operationIds] : [])
  }

  /**
   * List all operation IDs
   *
   * @param status - Optional filter by status
   * @returns Array of operation IDs
   */
  async listOperationIds(status?: string): Promise<string[]> {
    return this.call<string[]>('z_listoperationids', status ? [status] : [])
  }

  /**
   * Wait for an operation to complete
   *
   * @param operationId - Operation ID to wait for
   * @param pollInterval - Poll interval in ms (default: 1000)
   * @param timeout - Max wait time in ms (default: 300000 = 5 min)
   * @returns Completed operation
   * @throws ZcashRPCError if operation fails or times out
   */
  async waitForOperation(
    operationId: string,
    pollInterval: number = 1000,
    timeout: number = 300000,
  ): Promise<ZcashOperation> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const [operation] = await this.getOperationStatus([operationId])

      if (!operation) {
        throw new ZcashRPCError(`Operation ${operationId} not found`, -1)
      }

      if (operation.status === 'success') {
        return operation
      }

      if (operation.status === 'failed') {
        throw new ZcashRPCError(
          operation.error?.message ?? 'Operation failed',
          operation.error?.code ?? -1,
        )
      }

      if (operation.status === 'cancelled') {
        throw new ZcashRPCError('Operation was cancelled', -1)
      }

      // Still executing or queued, wait and retry
      await this.delay(pollInterval)
    }

    throw new ZcashRPCError(`Operation ${operationId} timed out after ${timeout}ms`, -1)
  }

  // ─── Blockchain Operations ─────────────────────────────────────────────────

  /**
   * Get current block count
   *
   * @returns Current block height
   */
  async getBlockCount(): Promise<number> {
    return this.call<number>('getblockcount', [])
  }

  /**
   * Get block hash at height
   *
   * @param height - Block height
   * @returns Block hash
   */
  async getBlockHash(height: number): Promise<string> {
    return this.call<string>('getblockhash', [height])
  }

  /**
   * Get block header
   *
   * @param hashOrHeight - Block hash or height
   * @returns Block header
   */
  async getBlockHeader(hashOrHeight: string | number): Promise<ZcashBlockHeader> {
    const hash =
      typeof hashOrHeight === 'number' ? await this.getBlockHash(hashOrHeight) : hashOrHeight
    return this.call<ZcashBlockHeader>('getblockheader', [hash, true])
  }

  /**
   * Get full block data
   *
   * @param hashOrHeight - Block hash or height
   * @returns Block data
   */
  async getBlock(hashOrHeight: string | number): Promise<ZcashBlock> {
    const hash =
      typeof hashOrHeight === 'number' ? await this.getBlockHash(hashOrHeight) : hashOrHeight
    return this.call<ZcashBlock>('getblock', [hash, 1])
  }

  /**
   * Get blockchain info
   *
   * @returns Blockchain information
   */
  async getBlockchainInfo(): Promise<ZcashBlockchainInfo> {
    return this.call<ZcashBlockchainInfo>('getblockchaininfo', [])
  }

  /**
   * Get network info
   *
   * @returns Network information
   */
  async getNetworkInfo(): Promise<ZcashNetworkInfo> {
    return this.call<ZcashNetworkInfo>('getnetworkinfo', [])
  }

  // ─── Key Management ────────────────────────────────────────────────────────

  /**
   * Export viewing key for address
   *
   * @param address - Shielded address
   * @returns Viewing key
   */
  async exportViewingKey(address: string): Promise<string> {
    return this.call<string>('z_exportviewingkey', [address])
  }

  /**
   * Import viewing key
   *
   * @param viewingKey - The viewing key to import
   * @param rescan - Rescan the wallet (default: whenkeyisnew)
   * @param startHeight - Start height for rescan
   */
  async importViewingKey(
    viewingKey: string,
    rescan: 'yes' | 'no' | 'whenkeyisnew' = 'whenkeyisnew',
    startHeight?: number,
  ): Promise<void> {
    const params: unknown[] = [viewingKey, rescan]
    if (startHeight !== undefined) params.push(startHeight)
    await this.call<null>('z_importviewingkey', params)
  }

  // ─── Low-Level RPC ─────────────────────────────────────────────────────────

  /**
   * Make a raw RPC call
   *
   * @param method - RPC method name
   * @param params - Method parameters
   * @returns RPC response result
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const request: ZcashRPCRequest = {
      jsonrpc: '1.0',
      id: ++this.requestId,
      method,
      params,
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.executeRequest<T>(request)

        if (response.error) {
          throw new ZcashRPCError(response.error.message, response.error.code, response.error.data)
        }

        return response.result as T
      } catch (error) {
        lastError = error as Error

        // Don't retry on RPC errors (only on network errors)
        if (error instanceof ZcashRPCError) {
          throw error
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.config.retries) {
          await this.delay(this.config.retryDelay * (attempt + 1))
        }
      }
    }

    throw new NetworkError(
      `Zcash RPC call failed after ${this.config.retries + 1} attempts: ${lastError?.message}`,
      ErrorCode.NETWORK_FAILED,
      { cause: lastError ?? undefined },
    )
  }

  /**
   * Execute HTTP request to RPC endpoint
   */
  private async executeRequest<T>(request: ZcashRPCRequest): Promise<ZcashRPCResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
      }

      return (await response.json()) as ZcashRPCResponse<T>
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  /**
   * Check if client is configured for testnet
   */
  get isTestnet(): boolean {
    return this.config.testnet
  }

  /**
   * Get the RPC endpoint URL
   */
  get endpoint(): string {
    return this.baseUrl
  }
}

/**
 * Create a Zcash RPC client
 *
 * @param config - Client configuration
 * @returns ZcashRPCClient instance
 *
 * @security IMPORTANT: Always use HTTPS in production environments.
 * HTTP Basic Auth transmits credentials in cleartext without TLS/HTTPS.
 * Configure your zcashd node with TLS certificates and use https:// URLs.
 *
 * @example
 * ```typescript
 * // ✅ Production (HTTPS)
 * const client = createZcashClient({
 *   host: 'https://your-node.com',
 *   port: 8232,
 *   username: process.env.ZCASH_RPC_USER,
 *   password: process.env.ZCASH_RPC_PASS,
 * })
 *
 * // ⚠️ Development only (HTTP)
 * const testClient = createZcashClient({
 *   host: '127.0.0.1',
 *   port: 18232,
 *   username: 'test',
 *   password: 'test',
 *   testnet: true,
 * })
 * ```
 */
export function createZcashClient(config: ZcashConfig): ZcashRPCClient {
  return new ZcashRPCClient(config)
}
