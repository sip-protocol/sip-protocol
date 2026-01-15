/**
 * C-SPL Token Service
 *
 * Higher-level service wrapper for CSPLClient that provides:
 * - Token registration and validation
 * - Enhanced error handling with Result pattern
 * - Delegate approvals for DeFi integrations
 * - Cost estimation utilities
 *
 * This service is used by CombinedPrivacyService to integrate C-SPL
 * encrypted amounts with SIP Native stealth addresses.
 *
 * @example
 * ```typescript
 * import { CSPLTokenService } from '@sip-protocol/sdk'
 *
 * const service = new CSPLTokenService({
 *   rpcUrl: 'https://api.devnet.solana.com',
 * })
 *
 * await service.initialize()
 *
 * // Wrap tokens with proper error handling
 * const result = await service.wrap({
 *   mint: 'So11111111111111111111111111111111111111112',
 *   amount: 1_000_000_000n,
 *   owner: walletAddress,
 * })
 *
 * // IMPORTANT: Always check success before accessing result fields
 * if (!result.success) {
 *   console.error('Wrap failed:', result.error)
 *   return
 * }
 *
 * // Now safe to access result fields
 * console.log('C-SPL mint:', result.csplMint)
 * console.log('Encrypted balance:', result.encryptedBalance)
 * ```
 *
 * @see CSPLClient for the underlying client implementation
 * @see CombinedPrivacyService for integration with stealth addresses
 */

import type { CSPLToken, ConfidentialBalance, ConfidentialTransferResult } from './cspl-types'
import { CSPLClient, type CSPLClientConfig } from './cspl'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Parameters for wrapping SPL tokens to C-SPL
 */
export interface WrapParams {
  /** SPL token mint address */
  mint: string
  /** Amount to wrap (in smallest units) */
  amount: bigint
  /** Owner wallet address */
  owner: string
  /** Create C-SPL account if it doesn't exist (default: true) */
  createAccount?: boolean
}

/**
 * Result of a wrap operation
 *
 * IMPORTANT: Always check `success` before accessing other fields!
 * The csplMint and encryptedBalance are only present when success is true.
 */
export interface WrapResult {
  /** Whether the wrap operation succeeded */
  success: boolean
  /** Transaction signature (only if success) */
  signature?: string
  /** The C-SPL token mint address (only if success) */
  csplMint?: string
  /** The encrypted balance after wrapping (only if success) */
  encryptedBalance?: Uint8Array
  /** Error message (only if !success) */
  error?: string
  /** Token info (only if success) */
  token?: CSPLToken
}

/**
 * Parameters for unwrapping C-SPL back to SPL
 */
export interface UnwrapParams {
  /** C-SPL token mint address */
  csplMint: string
  /** Encrypted amount to unwrap */
  encryptedAmount: Uint8Array
  /** Owner wallet address */
  owner: string
  /** Proof of ownership (optional, for zero-knowledge unwrap) */
  proof?: Uint8Array
}

/**
 * Result of an unwrap operation
 */
export interface UnwrapResult {
  /** Whether the unwrap operation succeeded */
  success: boolean
  /** Transaction signature (only if success) */
  signature?: string
  /** The decrypted/unwrapped amount (only if success) */
  amount?: bigint
  /** Error message (only if !success) */
  error?: string
}

/**
 * Parameters for delegate approval
 */
export interface ApproveParams {
  /** C-SPL token mint address */
  csplMint: string
  /** Delegate address (e.g., DEX contract) */
  delegate: string
  /** Owner wallet address */
  owner: string
  /** Maximum encrypted amount the delegate can transfer */
  maxAmount?: Uint8Array
}

/**
 * Result of an approve/revoke operation
 */
export interface ApproveResult {
  /** Whether the operation succeeded */
  success: boolean
  /** Transaction signature (only if success) */
  signature?: string
  /** Error message (only if !success) */
  error?: string
}

/**
 * Service status information
 */
export interface CSPLServiceStatus {
  /** Whether the service is initialized */
  initialized: boolean
  /** Whether connected to Solana RPC */
  connected: boolean
  /** Number of registered tokens */
  registeredTokenCount: number
  /** RPC endpoint URL */
  rpcUrl: string
}

// ─── Service Implementation ────────────────────────────────────────────────────

/**
 * Configuration for CSPLTokenService
 */
export interface CSPLTokenServiceConfig extends CSPLClientConfig {
  /** Pre-register these tokens on initialization */
  initialTokens?: CSPLToken[]
}

/**
 * C-SPL Token Service
 *
 * Wraps CSPLClient with:
 * - Proper error handling (always check success before field access)
 * - Token registration
 * - Delegate approvals
 * - Cost estimation
 */
export class CSPLTokenService {
  private client: CSPLClient
  private config: CSPLTokenServiceConfig
  private registeredTokens: Map<string, CSPLToken> = new Map()
  private initialized: boolean = false

  /**
   * Create a new C-SPL Token Service
   *
   * @param config - Service configuration
   */
  constructor(config: CSPLTokenServiceConfig = {}) {
    this.config = config
    this.client = new CSPLClient(config)
  }

  /**
   * Initialize the service
   *
   * Connects to Solana RPC and registers initial tokens.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.client.connect(this.config.rpcUrl)

    // Register initial tokens if provided
    if (this.config.initialTokens) {
      for (const token of this.config.initialTokens) {
        this.registeredTokens.set(token.mint, token)
        this.registeredTokens.set(token.confidentialMint, token)
      }
    }

    this.initialized = true
  }

  /**
   * Wrap SPL tokens to C-SPL (encrypted tokens)
   *
   * IMPORTANT: Always check result.success before accessing result.csplMint
   * or other fields. This is the proper pattern to avoid undefined access.
   *
   * @param params - Wrap parameters
   * @returns Wrap result with success status
   *
   * @example
   * ```typescript
   * const result = await service.wrap({
   *   mint: 'So11111111111111111111111111111111111111112',
   *   amount: 1_000_000_000n,
   *   owner: wallet,
   * })
   *
   * // CORRECT: Check success first
   * if (!result.success) {
   *   console.error(result.error)
   *   return
   * }
   * console.log(result.csplMint) // Safe to access
   *
   * // INCORRECT: Don't do this!
   * // console.log(result.csplMint!) // Unsafe non-null assertion
   * ```
   */
  async wrap(params: WrapParams): Promise<WrapResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    // Validate inputs
    if (!params.mint || params.mint.trim() === '') {
      return {
        success: false,
        error: 'Token mint address is required',
      }
    }

    if (!params.owner || params.owner.trim() === '') {
      return {
        success: false,
        error: 'Owner address is required',
      }
    }

    if (params.amount <= BigInt(0)) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      }
    }

    try {
      // Call the underlying client
      const clientResult = await this.client.wrapToken({
        mint: params.mint,
        amount: params.amount,
        owner: params.owner,
        createAccount: params.createAccount ?? true,
      })

      // Check client result success FIRST before accessing fields
      if (!clientResult.success) {
        return {
          success: false,
          error: clientResult.error ?? 'Wrap operation failed',
        }
      }

      // Now safe to access fields - they exist when success is true
      // Register the token for future lookups
      if (clientResult.token) {
        this.registeredTokens.set(clientResult.token.mint, clientResult.token)
        this.registeredTokens.set(clientResult.token.confidentialMint, clientResult.token)
      }

      return {
        success: true,
        signature: clientResult.signature,
        csplMint: clientResult.token?.confidentialMint,
        encryptedBalance: clientResult.encryptedBalance,
        token: clientResult.token,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during wrap',
      }
    }
  }

  /**
   * Unwrap C-SPL tokens back to SPL
   *
   * @param params - Unwrap parameters
   * @returns Unwrap result with success status
   */
  async unwrap(params: UnwrapParams): Promise<UnwrapResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    // Find the token by C-SPL mint
    const token = this.registeredTokens.get(params.csplMint)
    if (!token) {
      return {
        success: false,
        error: `Token ${params.csplMint} not registered. Wrap it first or register it manually.`,
      }
    }

    try {
      const clientResult = await this.client.unwrapToken({
        token,
        encryptedAmount: params.encryptedAmount,
        owner: params.owner,
        proof: params.proof,
      })

      // Check success FIRST
      if (!clientResult.success) {
        return {
          success: false,
          error: clientResult.error ?? 'Unwrap operation failed',
        }
      }

      return {
        success: true,
        signature: clientResult.signature,
        amount: clientResult.amount,
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
   * @param params - Transfer parameters
   * @returns Transfer result with success status
   */
  async transfer(params: {
    csplMint: string
    from: string
    to: string
    encryptedAmount: Uint8Array
    memo?: string
  }): Promise<ConfidentialTransferResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    const token = this.registeredTokens.get(params.csplMint)
    if (!token) {
      return {
        success: false,
        error: `Token ${params.csplMint} not registered.`,
      }
    }

    try {
      const result = await this.client.transfer({
        from: params.from,
        to: params.to,
        token,
        encryptedAmount: params.encryptedAmount,
        memo: params.memo,
      })

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during transfer',
      }
    }
  }

  /**
   * Get confidential balance for an account
   *
   * @param csplMint - C-SPL token mint address
   * @param owner - Account owner address
   * @returns Confidential balance or null if not found
   */
  async getBalance(csplMint: string, owner: string): Promise<ConfidentialBalance | null> {
    if (!this.initialized) {
      return null
    }

    const token = this.registeredTokens.get(csplMint)
    if (!token) {
      return null
    }

    try {
      return await this.client.getBalance(owner, token)
    } catch {
      return null
    }
  }

  /**
   * Approve a delegate to transfer C-SPL tokens
   *
   * Used for DEX integrations where a contract needs to transfer on behalf of user.
   *
   * @param params - Approval parameters
   * @returns Approval result
   */
  async approve(params: ApproveParams): Promise<ApproveResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    // Validate inputs
    if (!params.csplMint || !params.delegate || !params.owner) {
      return {
        success: false,
        error: 'csplMint, delegate, and owner are all required',
      }
    }

    const token = this.registeredTokens.get(params.csplMint)
    if (!token) {
      return {
        success: false,
        error: `Token ${params.csplMint} not registered.`,
      }
    }

    try {
      // In production: Create and submit approval transaction
      // const tx = await createApprovalTransaction(token, params.delegate, params.owner, params.maxAmount)
      // const signature = await sendTransaction(tx)

      // Simulated success
      const simulatedSignature = `approve_${Date.now()}_${Math.random().toString(36).slice(2)}`

      return {
        success: true,
        signature: simulatedSignature,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during approval',
      }
    }
  }

  /**
   * Revoke a delegate's approval
   *
   * @param csplMint - C-SPL token mint address
   * @param delegate - Delegate address to revoke
   * @param owner - Token owner address
   * @returns Revoke result
   */
  async revoke(
    csplMint: string,
    _delegate: string,
    _owner: string
  ): Promise<ApproveResult> {
    // Note: _delegate and _owner are reserved for production implementation.
    // They will be used in createRevokeTransaction() when C-SPL SDK is integrated.

    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    const token = this.registeredTokens.get(csplMint)
    if (!token) {
      return {
        success: false,
        error: `Token ${csplMint} not registered.`,
      }
    }

    try {
      // In production: Create and submit revoke transaction
      // const tx = await createRevokeTransaction(token, _delegate, _owner)
      // const signature = await sendTransaction(tx)

      // Simulated success
      const simulatedSignature = `revoke_${Date.now()}_${Math.random().toString(36).slice(2)}`

      return {
        success: true,
        signature: simulatedSignature,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during revoke',
      }
    }
  }

  /**
   * Estimate cost for an operation
   *
   * @param operation - Operation type ('wrap', 'unwrap', 'transfer', 'approve')
   * @returns Estimated cost in lamports
   */
  async estimateCost(operation: 'wrap' | 'unwrap' | 'transfer' | 'approve'): Promise<bigint> {
    const costs: Record<string, bigint> = {
      wrap: BigInt(5_000),
      unwrap: BigInt(5_000),
      transfer: BigInt(10_000),
      approve: BigInt(5_000),
    }

    return costs[operation] ?? BigInt(0)
  }

  /**
   * Get all supported/registered tokens
   *
   * @returns Array of registered C-SPL tokens
   */
  getSupportedTokens(): CSPLToken[] {
    // De-duplicate (tokens are registered by both mint and confidentialMint)
    const uniqueTokens = new Map<string, CSPLToken>()
    for (const token of this.registeredTokens.values()) {
      uniqueTokens.set(token.confidentialMint, token)
    }
    return Array.from(uniqueTokens.values())
  }

  /**
   * Register a token for use with the service
   *
   * @param token - Token to register
   */
  registerToken(token: CSPLToken): void {
    this.registeredTokens.set(token.mint, token)
    this.registeredTokens.set(token.confidentialMint, token)
  }

  /**
   * Get service status
   *
   * @returns Service status information
   */
  getStatus(): CSPLServiceStatus {
    return {
      initialized: this.initialized,
      connected: this.client.isConnected(),
      registeredTokenCount: this.getSupportedTokens().length,
      rpcUrl: this.config.rpcUrl ?? 'https://api.devnet.solana.com',
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect()
    this.initialized = false
  }
}
