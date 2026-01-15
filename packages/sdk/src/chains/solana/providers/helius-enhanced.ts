/**
 * Helius Enhanced Transactions Integration
 *
 * Provides human-readable transaction data with SIP-specific parsing
 * for privacy-preserving display to viewing key holders.
 *
 * @see https://docs.helius.dev/solana-apis/enhanced-transactions
 *
 * @example
 * ```typescript
 * import { HeliusEnhanced } from '@sip-protocol/sdk'
 *
 * const helius = new HeliusEnhanced({
 *   apiKey: process.env.HELIUS_API_KEY!,
 *   cluster: 'mainnet-beta'
 * })
 *
 * // Parse a specific transaction
 * const tx = await helius.parseTransaction('5rfFLBUp5YPr...')
 * console.log(tx.description) // "Alice sent 1.5 SOL to Bob"
 *
 * // Get transaction history with SIP metadata
 * const history = await helius.getTransactionHistory('7xK9...', {
 *   type: 'TRANSFER',
 *   limit: 50
 * })
 *
 * // Get human-readable summaries for UI
 * const summaries = await helius.getTransactionSummaries('7xK9...', {
 *   viewingPrivateKey: myViewingKey
 * })
 * ```
 */

import { ValidationError, NetworkError } from '../../../errors'
import {
  SOLANA_ADDRESS_MIN_LENGTH,
  SOLANA_ADDRESS_MAX_LENGTH,
  HELIUS_API_KEY_MIN_LENGTH,
  sanitizeUrl,
  SIP_MEMO_PREFIX,
  getExplorerUrl,
} from '../constants'
import type {
  EnhancedTransaction,
  SIPEnhancedTransaction,
  SIPTransactionMetadata,
  GetTransactionHistoryOptions,
  PrivacyDisplayOptions,
  TransactionSummary,
  EnhancedTransactionType,
} from './helius-enhanced-types'

/** Default fetch timeout in milliseconds */
const DEFAULT_FETCH_TIMEOUT_MS = 30000

/** Maximum transactions per parse request */
const MAX_PARSE_BATCH_SIZE = 100

/** Default history limit */
const DEFAULT_HISTORY_LIMIT = 100

/**
 * Mask API key for safe logging/error messages
 * @internal
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= HELIUS_API_KEY_MIN_LENGTH) return '***'
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
}

/**
 * Fetch with configurable timeout
 * @internal
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkError(
        `Request timeout after ${timeoutMs}ms`,
        undefined,
        { endpoint: sanitizeUrl(url) }
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Helius Enhanced Transactions configuration
 */
export interface HeliusEnhancedConfig {
  /** Helius API key (required) */
  apiKey: string
  /** Solana cluster (default: mainnet-beta) */
  cluster?: 'mainnet-beta' | 'devnet'
}

/**
 * Helius Enhanced Transactions Provider
 *
 * Extends the base Helius provider with Enhanced Transactions API
 * for human-readable transaction parsing and SIP-specific metadata extraction.
 */
export class HeliusEnhanced {
  private readonly apiKey: string
  private readonly cluster: 'mainnet-beta' | 'devnet'
  private readonly baseUrl: string

  constructor(config: HeliusEnhancedConfig) {
    // Validate API key
    if (!config.apiKey) {
      throw new ValidationError(
        'Helius API key is required. Get one at https://dev.helius.xyz',
        'apiKey'
      )
    }

    if (typeof config.apiKey !== 'string' || config.apiKey.length < HELIUS_API_KEY_MIN_LENGTH) {
      throw new ValidationError('Invalid Helius API key format', 'apiKey')
    }

    this.apiKey = config.apiKey
    this.cluster = config.cluster ?? 'mainnet-beta'

    // REST endpoint for Enhanced Transactions API
    this.baseUrl = this.cluster === 'devnet'
      ? 'https://api-devnet.helius.xyz/v0'
      : 'https://api.helius.xyz/v0'
  }

  /**
   * Parse one or more transactions into human-readable format
   *
   * @param signatures - Transaction signature(s) to parse
   * @returns Array of enhanced transactions with human-readable data
   *
   * @example
   * ```typescript
   * const txs = await helius.parseTransactions(['5rfFLBUp5YPr...', 'abc123...'])
   * for (const tx of txs) {
   *   console.log(`${tx.type}: ${tx.description}`)
   * }
   * ```
   */
  async parseTransactions(
    signatures: string | string[]
  ): Promise<EnhancedTransaction[]> {
    const sigs = Array.isArray(signatures) ? signatures : [signatures]

    // Validate signatures
    if (sigs.length === 0) {
      throw new ValidationError('At least one signature is required', 'signatures')
    }

    if (sigs.length > MAX_PARSE_BATCH_SIZE) {
      throw new ValidationError(
        `Maximum ${MAX_PARSE_BATCH_SIZE} transactions per request`,
        'signatures'
      )
    }

    for (const sig of sigs) {
      if (!sig || typeof sig !== 'string' || sig.length < 32) {
        throw new ValidationError(`Invalid signature format: ${sig?.slice(0, 10)}...`, 'signatures')
      }
    }

    const url = `${this.baseUrl}/transactions`

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        transactions: sigs,
      }),
    })

    if (!response.ok) {
      throw new NetworkError(
        `Helius Enhanced API error: ${response.status} ${response.statusText} (key: ${maskApiKey(this.apiKey)})`,
        undefined,
        { endpoint: sanitizeUrl(url), statusCode: response.status }
      )
    }

    const data = await response.json() as EnhancedTransaction[]
    return data
  }

  /**
   * Parse a single transaction
   *
   * Convenience method for parsing a single transaction.
   *
   * @param signature - Transaction signature
   * @returns Enhanced transaction or null if not found
   */
  async parseTransaction(signature: string): Promise<EnhancedTransaction | null> {
    const results = await this.parseTransactions([signature])
    return results[0] ?? null
  }

  /**
   * Get transaction history for an address
   *
   * Retrieves parsed transaction history with optional type filtering.
   *
   * @param address - Solana address
   * @param options - Filter and pagination options
   * @returns Array of enhanced transactions
   *
   * @example
   * ```typescript
   * // Get all transfers
   * const transfers = await helius.getTransactionHistory(address, {
   *   type: 'TRANSFER',
   *   limit: 50
   * })
   *
   * // Get all swaps
   * const swaps = await helius.getTransactionHistory(address, {
   *   type: 'SWAP'
   * })
   * ```
   */
  async getTransactionHistory(
    address: string,
    options: GetTransactionHistoryOptions = {}
  ): Promise<EnhancedTransaction[]> {
    // Validate address
    if (!address || typeof address !== 'string') {
      throw new ValidationError('address is required', 'address')
    }
    if (address.length < SOLANA_ADDRESS_MIN_LENGTH || address.length > SOLANA_ADDRESS_MAX_LENGTH) {
      throw new ValidationError('invalid Solana address format', 'address')
    }

    // Build URL with query parameters
    const params = new URLSearchParams()
    if (options.type) {
      params.set('type', options.type)
    }
    if (options.limit) {
      params.set('limit', Math.min(options.limit, DEFAULT_HISTORY_LIMIT).toString())
    }
    if (options.before) {
      params.set('before', options.before)
    }

    const queryString = params.toString()
    const url = `${this.baseUrl}/addresses/${address}/transactions${queryString ? `?${queryString}` : ''}`

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new NetworkError(
        `Helius Enhanced API error: ${response.status} ${response.statusText}`,
        undefined,
        { endpoint: sanitizeUrl(url), statusCode: response.status }
      )
    }

    const data = await response.json() as EnhancedTransaction[]
    return data
  }

  /**
   * Get SIP-enhanced transactions with metadata extraction
   *
   * Parses transactions and extracts SIP-specific metadata from memo
   * instructions (stealth addresses, view tags, encrypted amounts).
   *
   * @param address - Solana address
   * @param options - Filter and pagination options
   * @returns Transactions with SIP metadata
   *
   * @example
   * ```typescript
   * const sipTxs = await helius.getSIPTransactionHistory(address)
   * for (const tx of sipTxs) {
   *   if (tx.sipMetadata.isSIPTransaction) {
   *     console.log('SIP Transfer:', tx.sipMetadata.stealthAddress)
   *   }
   * }
   * ```
   */
  async getSIPTransactionHistory(
    address: string,
    options: GetTransactionHistoryOptions = {}
  ): Promise<SIPEnhancedTransaction[]> {
    const transactions = await this.getTransactionHistory(address, options)

    return transactions.map((tx) => ({
      ...tx,
      sipMetadata: this.extractSIPMetadata(tx),
    }))
  }

  /**
   * Extract SIP metadata from a transaction
   *
   * Parses memo program instructions to find SIP announcements.
   * SIP memo format: SIP:1:<ephemeral_pubkey_base58>:<view_tag_hex>
   *
   * @param tx - Enhanced transaction
   * @returns SIP metadata if found
   * @internal
   */
  private extractSIPMetadata(tx: EnhancedTransaction): SIPTransactionMetadata {
    const metadata: SIPTransactionMetadata = {
      isSIPTransaction: false,
    }

    // Look for SIP memo in description or raw data
    const description = tx.description || ''

    // Check if this looks like a SIP transaction
    // SIP transactions have a memo with format: SIP:1:<ephemeral_pubkey>:<view_tag>
    if (description.includes(SIP_MEMO_PREFIX) || description.includes('SIP:')) {
      metadata.isSIPTransaction = true

      // Try to extract SIP memo data
      // The memo format is: SIP:1:<ephemeral_pubkey_base58>:<view_tag_hex>
      const sipMemoMatch = description.match(/SIP:1:([A-Za-z0-9]{32,44}):([0-9a-fA-F]{2})/)
      if (sipMemoMatch) {
        metadata.ephemeralPubKey = sipMemoMatch[1]
        metadata.viewTag = parseInt(sipMemoMatch[2], 16)
        metadata.rawMemo = sipMemoMatch[0]
      }
    }

    // Check token transfers for potential stealth addresses
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      const transfer = tx.tokenTransfers[0]
      // If this is a SIP transaction, the recipient is likely a stealth address
      if (metadata.isSIPTransaction) {
        metadata.stealthAddress = transfer.toUserAccount
        metadata.tokenMint = transfer.mint
      }
    }

    // Check native transfers similarly
    if (!metadata.stealthAddress && tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      const transfer = tx.nativeTransfers[0]
      if (metadata.isSIPTransaction) {
        metadata.stealthAddress = transfer.toUserAccount
      }
    }

    return metadata
  }

  /**
   * Get human-readable transaction summaries
   *
   * Provides clean summaries for UI display with privacy-aware formatting.
   * Amounts are only shown to authorized viewers with the viewing key.
   *
   * @param address - Solana address
   * @param options - Display and privacy options
   * @returns Array of transaction summaries
   *
   * @example
   * ```typescript
   * // Without viewing key - amounts hidden for SIP transactions
   * const summaries = await helius.getTransactionSummaries(address)
   *
   * // With viewing key - full details visible
   * const fullSummaries = await helius.getTransactionSummaries(address, {
   *   viewingPrivateKey: myViewingKey
   * })
   * ```
   */
  async getTransactionSummaries(
    address: string,
    options: PrivacyDisplayOptions & GetTransactionHistoryOptions = {}
  ): Promise<TransactionSummary[]> {
    const sipTxs = await this.getSIPTransactionHistory(address, options)

    return sipTxs.map((tx) => this.createSummary(tx, address, options))
  }

  /**
   * Create a human-readable summary from an enhanced transaction
   * @internal
   */
  private createSummary(
    tx: SIPEnhancedTransaction,
    viewerAddress: string,
    options: PrivacyDisplayOptions
  ): TransactionSummary {
    const isAuthorized = this.isAuthorizedViewer(tx, options)
    const isSIP = tx.sipMetadata.isSIPTransaction

    // Determine transaction direction relative to viewer
    const tokens = this.extractTokenInfo(tx, viewerAddress, isAuthorized || !isSIP)

    // Create human-readable title
    const title = this.createTitle(tx.type, tokens, isSIP)

    // Create description
    const description = isSIP && !isAuthorized
      ? 'Shielded transaction (viewing key required for details)'
      : tx.description || this.createDescription(tx.type, tokens)

    return {
      signature: tx.signature,
      title,
      description,
      type: tx.type,
      timestamp: new Date(tx.timestamp * 1000),
      feeInSol: tx.fee / 1e9,
      isAuthorizedViewer: isAuthorized,
      tokens,
      status: tx.transactionError ? 'failed' : 'success',
      explorerUrl: getExplorerUrl(tx.signature, this.cluster),
    }
  }

  /**
   * Check if viewer is authorized to see full transaction details
   * @internal
   */
  private isAuthorizedViewer(
    tx: SIPEnhancedTransaction,
    options: PrivacyDisplayOptions
  ): boolean {
    // If not a SIP transaction, everyone can see details
    if (!tx.sipMetadata.isSIPTransaction) {
      return true
    }

    // If no viewing key provided, not authorized
    if (!options.viewingPrivateKey) {
      return false
    }

    // TODO: Implement actual viewing key verification
    // This would involve:
    // 1. Deriving the shared secret from ephemeral pubkey + viewing private key
    // 2. Computing the expected view tag
    // 3. Comparing with the transaction's view tag
    // For now, we just check if a viewing key was provided
    return !!options.viewingPrivateKey
  }

  /**
   * Extract token information from transaction
   * @internal
   */
  private extractTokenInfo(
    tx: SIPEnhancedTransaction,
    viewerAddress: string,
    showAmounts: boolean
  ): TransactionSummary['tokens'] {
    const tokens: TransactionSummary['tokens'] = []

    // Process token transfers
    for (const transfer of tx.tokenTransfers || []) {
      const isIncoming = transfer.toUserAccount === viewerAddress
      const amount = showAmounts
        ? this.formatAmount(transfer.tokenAmount, transfer.decimals ?? 0)
        : '***'

      tokens.push({
        symbol: transfer.tokenSymbol || transfer.mint.slice(0, 4) + '...',
        name: transfer.tokenName,
        amount,
        direction: isIncoming ? 'in' : 'out',
      })
    }

    // Process native SOL transfers
    for (const transfer of tx.nativeTransfers || []) {
      const isIncoming = transfer.toUserAccount === viewerAddress
      const amount = showAmounts
        ? this.formatAmount(transfer.amount, 9)
        : '***'

      tokens.push({
        symbol: 'SOL',
        name: 'Solana',
        amount,
        direction: isIncoming ? 'in' : 'out',
      })
    }

    return tokens
  }

  /**
   * Format amount with proper decimal places
   * @internal
   */
  private formatAmount(amount: number, decimals: number): string {
    const value = amount / Math.pow(10, decimals)
    // Use appropriate precision based on value
    if (value >= 1000) {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    } else if (value >= 1) {
      return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
    } else {
      return value.toLocaleString(undefined, { maximumFractionDigits: 6 })
    }
  }

  /**
   * Create human-readable title
   * @internal
   */
  private createTitle(
    type: EnhancedTransactionType,
    tokens: TransactionSummary['tokens'],
    isSIP: boolean
  ): string {
    const prefix = isSIP ? 'Shielded ' : ''

    switch (type) {
      case 'TRANSFER':
        if (tokens.length > 0) {
          const token = tokens[0]
          return `${prefix}${token.direction === 'in' ? 'Received' : 'Sent'} ${token.symbol}`
        }
        return `${prefix}Transfer`

      case 'SWAP':
        return `${prefix}Swap`

      case 'NFT_SALE':
        return 'NFT Sale'

      case 'NFT_MINT':
      case 'COMPRESSED_NFT_MINT':
        return 'NFT Mint'

      case 'ADD_LIQUIDITY':
        return 'Added Liquidity'

      case 'REMOVE_LIQUIDITY':
        return 'Removed Liquidity'

      case 'STAKE':
        return 'Staked'

      case 'UNSTAKE':
        return 'Unstaked'

      case 'CLAIM_REWARDS':
        return 'Claimed Rewards'

      default:
        return `${prefix}${type.replace(/_/g, ' ').toLowerCase()}`
    }
  }

  /**
   * Create human-readable description
   * @internal
   */
  private createDescription(
    type: EnhancedTransactionType,
    tokens: TransactionSummary['tokens']
  ): string {
    switch (type) {
      case 'TRANSFER':
        if (tokens.length > 0) {
          const token = tokens[0]
          const action = token.direction === 'in' ? 'Received' : 'Sent'
          const amountStr = token.amount !== '***' ? `${token.amount} ` : ''
          return `${action} ${amountStr}${token.symbol}`
        }
        return 'Token transfer'

      case 'SWAP': {
        const inputs = tokens.filter(t => t.direction === 'out')
        const outputs = tokens.filter(t => t.direction === 'in')
        if (inputs.length > 0 && outputs.length > 0) {
          return `Swapped ${inputs[0].symbol} for ${outputs[0].symbol}`
        }
        return 'Token swap'
      }

      default:
        return `${type.replace(/_/g, ' ').toLowerCase()} transaction`
    }
  }
}

/**
 * Create a HeliusEnhanced instance
 *
 * Factory function for creating enhanced transactions provider.
 *
 * @param config - Provider configuration
 * @returns HeliusEnhanced instance
 */
export function createHeliusEnhanced(config: HeliusEnhancedConfig): HeliusEnhanced {
  return new HeliusEnhanced(config)
}
