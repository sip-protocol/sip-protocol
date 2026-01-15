/**
 * C-SPL (Confidential SPL) Token Client
 *
 * Client for interacting with Confidential SPL tokens on Solana.
 * Provides wrapping, unwrapping, transfers, and balance queries for C-SPL tokens.
 *
 * ## Features
 *
 * - Wrap any SPL token to its confidential version
 * - Transfer C-SPL tokens with encrypted amounts
 * - Query confidential balances
 * - Encrypt/decrypt amounts for transfers
 *
 * ## Usage
 *
 * ```typescript
 * import { CSPLClient, CSPL_TOKENS } from '@sip-protocol/sdk'
 *
 * const client = new CSPLClient({ rpcUrl: 'https://api.devnet.solana.com' })
 *
 * // Wrap 1 SOL to C-wSOL
 * const wrapResult = await client.wrapToken({
 *   mint: CSPL_TOKENS['C-wSOL'].mint!,
 *   amount: 1_000_000_000n, // 1 SOL
 *   owner: walletAddress,
 * })
 *
 * // Transfer confidentially
 * const encryptedAmount = await client.encryptAmount({
 *   amount: 500_000_000n,
 *   recipientPubkey: recipientAddress,
 * })
 *
 * await client.transfer({
 *   from: walletAddress,
 *   to: recipientAddress,
 *   token: wrapResult.token!,
 *   encryptedAmount: encryptedAmount.ciphertext,
 * })
 * ```
 *
 * @see https://docs.arcium.com
 */

import type {
  CSPLToken,
  ConfidentialTokenAccount,
  ConfidentialBalance,
  ConfidentialTransferParams,
  ConfidentialTransferResult,
  WrapTokenParams,
  WrapTokenResult,
  UnwrapTokenParams,
  UnwrapTokenResult,
  CSPLEncryptionParams,
  CSPLDecryptionParams,
  EncryptedAmount,
  CSPLEncryptionType,
  ICSPLClient,
} from './cspl-types'

import {
  CSPL_TOKENS,
  CSPL_PROGRAM_IDS,
  CSPL_OPERATION_COSTS,
  CSPL_OPERATION_TIMES,
  CSPL_MAX_MEMO_BYTES,
} from './cspl-types'

import { isValidSolanaAddressFormat } from '../validation'
import { deepFreeze } from './interface'
import {
  LRUCache,
  DEFAULT_CACHE_SIZES,
  DEFAULT_CACHE_TTL,
  type LRUCacheStats,
} from './lru-cache'

/**
 * Cache configuration for CSPLClient
 */
export interface CSPLCacheConfig {
  /** Maximum entries in account cache (default: 1000) */
  accountCacheSize?: number
  /** Maximum entries in balance cache (default: 500) */
  balanceCacheSize?: number
  /** Account cache TTL in ms (default: 5 minutes) */
  accountCacheTTL?: number
  /** Balance cache TTL in ms (default: 30 seconds) */
  balanceCacheTTL?: number
}

/**
 * Configuration for CSPLClient
 */
export interface CSPLClientConfig {
  /** Solana RPC endpoint URL */
  rpcUrl?: string
  /** Default encryption type */
  defaultEncryption?: CSPLEncryptionType
  /** Enable compliance/audit features */
  enableCompliance?: boolean
  /** Request timeout in milliseconds */
  timeout?: number
  /** Cache configuration */
  cache?: CSPLCacheConfig
}

/**
 * C-SPL Token Client
 *
 * Handles all operations for Confidential SPL tokens.
 */
/**
 * Extended cache stats including LRU metrics
 */
export interface CSPLCacheStats {
  /** Account cache statistics */
  accounts: LRUCacheStats
  /** Balance cache statistics */
  balances: LRUCacheStats
}

export class CSPLClient implements ICSPLClient {
  private config: Required<Omit<CSPLClientConfig, 'cache'>>
  private cacheConfig: Required<CSPLCacheConfig>
  private connected: boolean = false
  private accountCache: LRUCache<string, ConfidentialTokenAccount>
  private balanceCache: LRUCache<string, ConfidentialBalance>

  /**
   * Create a new C-SPL client
   *
   * @param config - Client configuration
   */
  constructor(config: CSPLClientConfig = {}) {
    this.config = {
      rpcUrl: config.rpcUrl ?? 'https://api.devnet.solana.com',
      defaultEncryption: config.defaultEncryption ?? 'twisted-elgamal',
      enableCompliance: config.enableCompliance ?? false,
      timeout: config.timeout ?? 30_000,
    }

    // Initialize cache configuration with defaults
    this.cacheConfig = {
      accountCacheSize: config.cache?.accountCacheSize ?? DEFAULT_CACHE_SIZES.TOKEN_ACCOUNTS,
      balanceCacheSize: config.cache?.balanceCacheSize ?? DEFAULT_CACHE_SIZES.BALANCES,
      accountCacheTTL: config.cache?.accountCacheTTL ?? DEFAULT_CACHE_TTL.TOKEN_ACCOUNTS,
      balanceCacheTTL: config.cache?.balanceCacheTTL ?? DEFAULT_CACHE_TTL.BALANCES,
    }

    // Initialize LRU caches
    this.accountCache = new LRUCache<string, ConfidentialTokenAccount>({
      maxSize: this.cacheConfig.accountCacheSize,
      ttl: this.cacheConfig.accountCacheTTL,
    })

    this.balanceCache = new LRUCache<string, ConfidentialBalance>({
      maxSize: this.cacheConfig.balanceCacheSize,
      ttl: this.cacheConfig.balanceCacheTTL,
    })
  }

  /**
   * Initialize connection to Solana
   */
  async connect(rpcUrl?: string): Promise<void> {
    if (rpcUrl) {
      this.config.rpcUrl = rpcUrl
    }

    // In production: Initialize Solana connection
    // const connection = new Connection(this.config.rpcUrl)
    // await connection.getVersion()

    this.connected = true
  }

  /**
   * Disconnect from Solana
   */
  async disconnect(): Promise<void> {
    this.connected = false
    this.accountCache.clear()
    this.balanceCache.clear()
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get or create a confidential token account
   *
   * Creates the account automatically if it doesn't exist.
   *
   * @param owner - Account owner address
   * @param token - C-SPL token configuration
   * @returns Confidential token account
   */
  async getOrCreateAccount(
    owner: string,
    token: CSPLToken
  ): Promise<ConfidentialTokenAccount> {
    // Validate owner address format
    if (!owner || !isValidSolanaAddressFormat(owner)) {
      throw new Error('Invalid owner address format. Expected base58-encoded Solana address (32-44 chars)')
    }

    // Check cache first
    const cacheKey = `${owner}:${token.confidentialMint}`
    const cached = this.accountCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Validate inputs
    if (!owner || owner.trim() === '') {
      throw new Error('Owner address is required')
    }
    if (!token.confidentialMint || token.confidentialMint.trim() === '') {
      throw new Error('Token confidentialMint is required')
    }

    // In production: Query or create account via Solana
    // const ata = getAssociatedTokenAddress(token.confidentialMint, owner)
    // let accountInfo = await connection.getAccountInfo(ata)
    // if (!accountInfo) {
    //   await createConfidentialTokenAccount(...)
    // }

    // Simulated account
    const account: ConfidentialTokenAccount = {
      address: this.deriveAccountAddress(owner, token),
      owner,
      token,
      encryptedBalance: new Uint8Array(64), // Empty encrypted balance
      pendingBalance: undefined,
      pendingCount: 0,
      isInitialized: true,
      isFrozen: false,
    }

    this.accountCache.set(cacheKey, account)
    return account
  }

  /**
   * Get confidential balance for an account
   *
   * @param owner - Account owner address
   * @param token - C-SPL token configuration
   * @returns Confidential balance
   */
  async getBalance(owner: string, token: CSPLToken): Promise<ConfidentialBalance> {
    // Validate owner address format
    if (!owner || !isValidSolanaAddressFormat(owner)) {
      throw new Error('Invalid owner address format. Expected base58-encoded Solana address (32-44 chars)')
    }

    // Check cache
    const cacheKey = `balance:${owner}:${token.confidentialMint}`
    const cached = this.balanceCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Get or create account
    const account = await this.getOrCreateAccount(owner, token)

    // In production: Query on-chain balance
    // const accountData = await program.account.confidentialAccount.fetch(account.address)

    const balance: ConfidentialBalance = {
      token,
      encryptedAmount: account.encryptedBalance,
      pendingBalance: account.pendingBalance,
    }

    this.balanceCache.set(cacheKey, balance)
    return balance
  }

  /**
   * Wrap SPL tokens to C-SPL
   *
   * Converts regular SPL tokens to their confidential version.
   *
   * @param params - Wrap parameters
   * @returns Wrap result
   */
  async wrapToken(params: WrapTokenParams): Promise<WrapTokenResult> {
    // Validate inputs
    if (!params.mint || params.mint.trim() === '') {
      return {
        success: false,
        error: 'Token mint address is required',
      }
    }
    if (!isValidSolanaAddressFormat(params.mint)) {
      return {
        success: false,
        error: 'Invalid token mint address format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }
    if (!params.owner || params.owner.trim() === '') {
      return {
        success: false,
        error: 'Owner address is required',
      }
    }
    if (!isValidSolanaAddressFormat(params.owner)) {
      return {
        success: false,
        error: 'Invalid owner address format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }
    if (params.amount <= BigInt(0)) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      }
    }

    try {
      // Look up or create C-SPL token config
      const token = this.getOrCreateTokenConfig(params.mint)

      // Ensure confidential account exists
      if (params.createAccount !== false) {
        await this.getOrCreateAccount(params.owner, token)
      }

      // In production:
      // 1. Transfer SPL tokens to wrap escrow
      // 2. Encrypt the amount
      // 3. Credit confidential account

      const encryptedBalance = await this.encryptAmount({
        amount: params.amount,
      })

      // Simulated result
      const signature = this.generateSignature()

      // Update cache
      const cacheKey = `balance:${params.owner}:${token.confidentialMint}`
      this.balanceCache.set(cacheKey, {
        token,
        encryptedAmount: encryptedBalance.ciphertext,
        decryptedAmount: params.amount,
      })

      return {
        success: true,
        signature,
        token,
        encryptedBalance: encryptedBalance.ciphertext,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during wrap',
      }
    }
  }

  /**
   * Unwrap C-SPL back to regular SPL tokens
   *
   * Converts confidential tokens back to their public version.
   *
   * @param params - Unwrap parameters
   * @returns Unwrap result
   */
  async unwrapToken(params: UnwrapTokenParams): Promise<UnwrapTokenResult> {
    // Validate inputs
    if (!params.token || !params.token.confidentialMint) {
      return {
        success: false,
        error: 'Token configuration is required',
      }
    }
    if (!params.owner || params.owner.trim() === '') {
      return {
        success: false,
        error: 'Owner address is required',
      }
    }
    if (!isValidSolanaAddressFormat(params.owner)) {
      return {
        success: false,
        error: 'Invalid owner address format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }
    if (!params.encryptedAmount || params.encryptedAmount.length === 0) {
      return {
        success: false,
        error: 'Encrypted amount is required',
      }
    }

    try {
      // In production:
      // 1. Verify ownership and balance
      // 2. Generate range proof
      // 3. Debit confidential account
      // 4. Transfer SPL tokens from escrow

      // Simulated decryption
      const amount = await this.decryptAmount({
        encryptedAmount: params.encryptedAmount,
        decryptionKey: new Uint8Array(32), // Would be owner's key
      })

      const signature = this.generateSignature()

      // Clear balance cache
      const cacheKey = `balance:${params.owner}:${params.token.confidentialMint}`
      this.balanceCache.delete(cacheKey)

      return {
        success: true,
        signature,
        amount,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during unwrap',
      }
    }
  }

  /**
   * Execute a confidential transfer
   *
   * Transfers C-SPL tokens with encrypted amounts.
   *
   * @param params - Transfer parameters
   * @returns Transfer result
   */
  async transfer(
    params: ConfidentialTransferParams
  ): Promise<ConfidentialTransferResult> {
    // Validate inputs
    if (!params.from || params.from.trim() === '') {
      return {
        success: false,
        error: 'Sender address is required',
      }
    }
    if (!isValidSolanaAddressFormat(params.from)) {
      return {
        success: false,
        error: 'Invalid sender address format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }
    if (!params.to || params.to.trim() === '') {
      return {
        success: false,
        error: 'Recipient address is required',
      }
    }
    if (!isValidSolanaAddressFormat(params.to)) {
      return {
        success: false,
        error: 'Invalid recipient address format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }
    if (!params.token || !params.token.confidentialMint) {
      return {
        success: false,
        error: 'Token configuration is required',
      }
    }
    if (!params.encryptedAmount || params.encryptedAmount.length === 0) {
      return {
        success: false,
        error: 'Encrypted amount is required',
      }
    }

    // Validate memo length (if provided)
    if (params.memo !== undefined) {
      const memoBytes = new TextEncoder().encode(params.memo)
      if (memoBytes.length > CSPL_MAX_MEMO_BYTES) {
        return {
          success: false,
          error: `Memo exceeds maximum length (${memoBytes.length} bytes > ${CSPL_MAX_MEMO_BYTES} bytes limit)`,
        }
      }
    }

    try {
      // Ensure both accounts exist
      await this.getOrCreateAccount(params.from, params.token)
      await this.getOrCreateAccount(params.to, params.token)

      // In production:
      // 1. Generate equality and range proofs
      // 2. Debit sender's confidential balance
      // 3. Credit recipient's pending balance
      // 4. Submit transaction

      const signature = this.generateSignature()

      // Simulate new sender balance (would be calculated from proofs)
      const newSenderBalance = new Uint8Array(64)

      // Clear cache for both parties
      this.balanceCache.delete(`balance:${params.from}:${params.token.confidentialMint}`)
      this.balanceCache.delete(`balance:${params.to}:${params.token.confidentialMint}`)

      return {
        success: true,
        signature,
        newSenderBalance,
        recipientPendingUpdated: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during transfer',
      }
    }
  }

  /**
   * Encrypt an amount for transfer
   *
   * Uses Twisted ElGamal or AES-GCM depending on configuration.
   *
   * @param params - Encryption parameters
   * @returns Encrypted amount
   */
  async encryptAmount(params: CSPLEncryptionParams): Promise<EncryptedAmount> {
    // Validate amount
    if (params.amount < BigInt(0)) {
      throw new Error('Amount cannot be negative')
    }

    // Validate recipient pubkey if provided
    if (params.recipientPubkey !== undefined && params.recipientPubkey !== '') {
      if (!isValidSolanaAddressFormat(params.recipientPubkey)) {
        throw new Error(
          `Invalid recipient pubkey format: '${params.recipientPubkey}'. ` +
          'Expected base58-encoded Solana address (32-44 chars)'
        )
      }
    }

    // Validate auditor keys if provided
    if (params.auditorKeys?.length) {
      for (let i = 0; i < params.auditorKeys.length; i++) {
        const auditorKey = params.auditorKeys[i]
        if (!auditorKey || auditorKey.trim() === '') {
          throw new Error(`Auditor key at index ${i} is empty`)
        }
        if (!isValidSolanaAddressFormat(auditorKey)) {
          throw new Error(
            `Invalid auditor key format at index ${i}: '${auditorKey}'. ` +
            'Expected base58-encoded Solana address (32-44 chars)'
          )
        }
      }
    }

    const encryptionType = this.config.defaultEncryption

    // In production: Use actual cryptographic encryption
    // For Twisted ElGamal (Solana Confidential Transfers):
    // const ciphertext = twistedElgamal.encrypt(amount, recipientPubkey)

    // Simulated encryption
    const ciphertext = this.simulateEncryption(params.amount, encryptionType)
    const nonce = this.generateNonce()

    // Handle auditor ciphertexts if compliance enabled
    let auditorCiphertexts: Map<string, Uint8Array> | undefined
    if (this.config.enableCompliance && params.auditorKeys?.length) {
      auditorCiphertexts = new Map()
      for (const auditorKey of params.auditorKeys) {
        const auditorCiphertext = this.simulateEncryption(params.amount, 'aes-gcm')
        auditorCiphertexts.set(auditorKey, auditorCiphertext)
      }
    }

    return {
      ciphertext,
      encryptionType,
      nonce,
      auditorCiphertexts,
    }
  }

  /**
   * Decrypt an encrypted amount
   *
   * Only the account owner can decrypt their balance.
   *
   * @param params - Decryption parameters
   * @returns Decrypted amount
   */
  async decryptAmount(params: CSPLDecryptionParams): Promise<bigint> {
    // Validate
    if (!params.encryptedAmount || params.encryptedAmount.length === 0) {
      throw new Error('Encrypted amount is required')
    }
    if (!params.decryptionKey || params.decryptionKey.length === 0) {
      throw new Error('Decryption key is required')
    }

    // In production: Use actual cryptographic decryption
    // const amount = twistedElgamal.decrypt(encryptedAmount, decryptionKey)

    // Simulated decryption - return a deterministic value based on ciphertext
    return this.simulateDecryption(params.encryptedAmount)
  }

  /**
   * Apply pending balance to available balance
   *
   * Required after receiving transfers to make funds spendable.
   *
   * @param owner - Account owner
   * @param token - C-SPL token
   * @returns Transfer result
   */
  async applyPendingBalance(
    owner: string,
    token: CSPLToken
  ): Promise<ConfidentialTransferResult> {
    // Validate
    if (!owner || owner.trim() === '') {
      return {
        success: false,
        error: 'Owner address is required',
      }
    }
    if (!isValidSolanaAddressFormat(owner)) {
      return {
        success: false,
        error: 'Invalid owner address format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }
    if (!token || !token.confidentialMint) {
      return {
        success: false,
        error: 'Token configuration is required',
      }
    }
    if (!isValidSolanaAddressFormat(token.confidentialMint)) {
      return {
        success: false,
        error: 'Invalid token confidentialMint format. Expected base58-encoded Solana address (32-44 chars)',
      }
    }

    try {
      const account = await this.getOrCreateAccount(owner, token)

      if (!account.pendingBalance || account.pendingCount === 0) {
        return {
          success: true,
          newSenderBalance: account.encryptedBalance,
          recipientPendingUpdated: false,
        }
      }

      // In production:
      // 1. Combine pending balance with available balance
      // 2. Clear pending balance
      // 3. Submit transaction

      const signature = this.generateSignature()

      // Update cache
      const cacheKey = `${owner}:${token.confidentialMint}`
      const updatedAccount: ConfidentialTokenAccount = {
        ...account,
        pendingBalance: undefined,
        pendingCount: 0,
      }
      this.accountCache.set(cacheKey, updatedAccount)

      return {
        success: true,
        signature,
        newSenderBalance: updatedAccount.encryptedBalance,
        recipientPendingUpdated: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ─── Query Methods ────────────────────────────────────────────────────────────

  /**
   * Get token configuration for a known mint
   *
   * @param symbol - Token symbol (e.g., 'C-USDC')
   * @returns Token configuration or undefined
   */
  getKnownToken(symbol: string): Partial<CSPLToken> | undefined {
    return CSPL_TOKENS[symbol]
  }

  /**
   * List all known C-SPL tokens
   */
  listKnownTokens(): string[] {
    return Object.keys(CSPL_TOKENS)
  }

  /**
   * Estimate cost for an operation
   *
   * Returns the estimated cost in lamports. Made async for consistency
   * with other privacy backend cost estimation methods.
   *
   * @param operation - Operation type
   * @returns Estimated cost in lamports
   */
  async estimateCost(operation: keyof typeof CSPL_OPERATION_COSTS): Promise<bigint> {
    return CSPL_OPERATION_COSTS[operation]
  }

  /**
   * Estimate time for an operation
   *
   * Returns the estimated time in milliseconds. Made async for consistency
   * with other privacy backend estimation methods.
   *
   * @param operation - Operation type
   * @returns Estimated time in milliseconds
   */
  async estimateTime(operation: keyof typeof CSPL_OPERATION_TIMES): Promise<number> {
    return CSPL_OPERATION_TIMES[operation]
  }

  /**
   * Get current configuration (deeply frozen copy)
   */
  getConfig(): Readonly<CSPLClientConfig> {
    return deepFreeze({ ...this.config })
  }

  /**
   * Get program IDs
   */
  getProgramIds(): typeof CSPL_PROGRAM_IDS {
    return CSPL_PROGRAM_IDS
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  /**
   * Derive confidential account address
   */
  private deriveAccountAddress(owner: string, token: CSPLToken): string {
    // In production: Calculate actual PDA
    // return PublicKey.findProgramAddress(...)
    const hash = this.simpleHash(`${owner}:${token.confidentialMint}`)
    return `cspl_${hash}`
  }

  /**
   * Get or create token configuration
   */
  private getOrCreateTokenConfig(mint: string): CSPLToken {
    // Check known tokens
    for (const [, config] of Object.entries(CSPL_TOKENS)) {
      if (config.mint === mint) {
        return {
          mint,
          confidentialMint: `cspl_${mint.slice(0, 8)}`,
          decimals: config.decimals ?? 9,
          symbol: config.symbol,
          name: config.name,
          isNativeWrap: config.isNativeWrap,
        }
      }
    }

    // Create generic config for unknown token
    return {
      mint,
      confidentialMint: `cspl_${mint.slice(0, 8)}`,
      decimals: 9, // Default to 9 decimals
    }
  }

  /**
   * Generate a simulated transaction signature
   */
  private generateSignature(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 10)
    return `cspl_tx_${timestamp}_${random}`
  }

  /**
   * Generate a nonce for encryption
   */
  private generateNonce(): Uint8Array {
    const nonce = new Uint8Array(12)
    for (let i = 0; i < 12; i++) {
      nonce[i] = Math.floor(Math.random() * 256)
    }
    return nonce
  }

  /**
   * Simulate encryption (for testing without crypto libs)
   */
  private simulateEncryption(amount: bigint, type: CSPLEncryptionType): Uint8Array {
    const encoder = new TextEncoder()
    const combined = `${type}:${amount.toString()}:${Date.now()}`
    return encoder.encode(combined)
  }

  /**
   * Simulate decryption (for testing)
   */
  private simulateDecryption(ciphertext: Uint8Array): bigint {
    // Deterministic but fake - return hash-based value
    let sum = 0
    for (const byte of ciphertext) {
      sum += byte
    }
    return BigInt(sum % 1_000_000_000)
  }

  /**
   * Simple hash for deterministic addresses
   */
  private simpleHash(input: string): string {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.accountCache.clear()
    this.balanceCache.clear()
  }

  /**
   * Get cache entry counts (backward compatible)
   *
   * @returns Number of entries in each cache
   */
  getCacheStats(): { accounts: number; balances: number } {
    return {
      accounts: this.accountCache.size,
      balances: this.balanceCache.size,
    }
  }

  /**
   * Get detailed cache statistics including LRU metrics
   *
   * @returns Detailed cache stats with hit rates and eviction counts
   */
  getDetailedCacheStats(): CSPLCacheStats {
    return {
      accounts: this.accountCache.getStats(),
      balances: this.balanceCache.getStats(),
    }
  }

  /**
   * Get cache configuration
   *
   * @returns Current cache configuration
   */
  getCacheConfig(): Readonly<CSPLCacheConfig> {
    return deepFreeze({ ...this.cacheConfig })
  }

  /**
   * Prune expired entries from all caches
   *
   * @returns Number of entries pruned from each cache
   */
  pruneExpiredCache(): { accounts: number; balances: number } {
    return {
      accounts: this.accountCache.prune(),
      balances: this.balanceCache.prune(),
    }
  }
}
