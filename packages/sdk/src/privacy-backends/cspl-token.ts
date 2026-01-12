/**
 * C-SPL Token Service
 *
 * High-level service for managing Confidential SPL (C-SPL) tokens on Solana.
 * Provides wrapping, unwrapping, transfers, and balance management.
 *
 * ## Overview
 *
 * C-SPL tokens are confidential versions of SPL tokens where:
 * - Balances are encrypted (hidden from public view)
 * - Transfer amounts are encrypted
 * - Sender/recipient remain public (use SIP Native for endpoint privacy)
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  C-SPL TOKEN LIFECYCLE                                      │
 * │                                                             │
 * │  SPL Token ──wrap()──► C-SPL Token ──unwrap()──► SPL Token  │
 * │      │                     │                        │       │
 * │      │                     │                        │       │
 * │   Public               Encrypted                 Public     │
 * │   Balance              Balance                   Balance    │
 * │                                                             │
 * │  Operations on C-SPL:                                       │
 * │  • transfer() — Confidential transfer                       │
 * │  • getBalance() — Decrypt balance (owner only)              │
 * │  • approve() — Encrypted allowance for DeFi                 │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @example
 * ```typescript
 * import { CSPLTokenService } from '@sip-protocol/sdk'
 *
 * const service = new CSPLTokenService({ network: 'devnet' })
 * await service.initialize()
 *
 * // Wrap SPL to C-SPL
 * const wrapResult = await service.wrap({
 *   splMint: USDC_MINT,
 *   amount: 1_000_000n,
 *   owner: wallet.publicKey,
 * })
 *
 * // Transfer confidentially
 * const transferResult = await service.transfer({
 *   csplMint: wrapResult.csplMint,
 *   amount: 500_000n,
 *   sender: wallet.publicKey,
 *   recipient: recipientAddress,
 * })
 *
 * // Check encrypted balance
 * const balance = await service.getBalance(csplMint, wallet.publicKey)
 * ```
 *
 * @module privacy-backends/cspl-token
 */

import {
  type ArciumNetwork,
  type CSPLToken,
  type ComputationReference,
  type ComputationStatus,
  ARCIUM_RPC_ENDPOINTS,
  CSPL_TOKEN_REGISTRY,
  hasCSPLSupport,
  getCSPLToken,
  deriveCSPLMint,
  estimateArciumCost,
  ArciumError,
  ArciumErrorCode,
} from './arcium-types'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * C-SPL Token Service configuration
 */
export interface CSPLTokenServiceConfig {
  /**
   * Arcium network
   * @default 'devnet'
   */
  network?: ArciumNetwork

  /**
   * Solana RPC endpoint
   */
  solanaRpcUrl?: string

  /**
   * Arcium RPC endpoint
   */
  arciumRpcUrl?: string

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean

  /**
   * Operation timeout in ms
   * @default 60000
   */
  timeout?: number
}

/**
 * Confidential balance information
 *
 * Represents an encrypted balance that only the owner can decrypt
 */
export interface ConfidentialBalance {
  /** C-SPL token mint */
  csplMint: string
  /** Token symbol */
  symbol: string
  /** Encrypted balance (on-chain representation) */
  encryptedBalance: Uint8Array
  /** Decrypted balance (if owner has decryption key) */
  decryptedBalance?: bigint
  /** Token decimals */
  decimals: number
  /** Last update slot */
  lastUpdatedSlot: number
  /** Whether balance is pending (in MPC computation) */
  isPending: boolean
}

/**
 * Token account information
 */
export interface CSPLTokenAccount {
  /** Account address */
  address: string
  /** C-SPL token mint */
  csplMint: string
  /** Owner address */
  owner: string
  /** Corresponding SPL token account (if linked) */
  splTokenAccount?: string
  /** Confidential balance */
  balance: ConfidentialBalance
  /** Account is initialized */
  isInitialized: boolean
  /** Account is frozen */
  isFrozen: boolean
}

/**
 * Parameters for wrapping SPL to C-SPL
 */
export interface WrapParams {
  /** SPL token mint address */
  splMint: string
  /** Amount to wrap (in token units) */
  amount: bigint
  /** Owner/signer address */
  owner: string
  /** Optional: Create new C-SPL account if needed */
  createAccount?: boolean
}

/**
 * Result of wrap operation
 */
export interface WrapResult {
  /** Operation success */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** C-SPL mint address */
  csplMint?: string
  /** C-SPL token account */
  csplTokenAccount?: string
  /** Amount wrapped */
  amount?: bigint
  /** Computation reference */
  computation?: ComputationReference
  /** Error message */
  error?: string
}

/**
 * Parameters for unwrapping C-SPL to SPL
 */
export interface UnwrapParams {
  /** C-SPL token mint address */
  csplMint: string
  /** Amount to unwrap */
  amount: bigint
  /** Owner/signer address */
  owner: string
  /** Recipient address (defaults to owner) */
  recipient?: string
  /** Close C-SPL account after unwrap */
  closeAccount?: boolean
}

/**
 * Result of unwrap operation
 */
export interface UnwrapResult {
  /** Operation success */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** SPL mint address */
  splMint?: string
  /** SPL token account */
  splTokenAccount?: string
  /** Amount unwrapped */
  amount?: bigint
  /** Computation reference */
  computation?: ComputationReference
  /** Error message */
  error?: string
}

/**
 * Parameters for confidential transfer
 */
export interface ConfidentialTransferParams {
  /** C-SPL token mint */
  csplMint: string
  /** Transfer amount */
  amount: bigint
  /** Sender address */
  sender: string
  /** Recipient address */
  recipient: string
  /** Auditor key for compliance */
  auditorKey?: string
  /** Memo (public) */
  memo?: string
}

/**
 * Result of confidential transfer
 */
export interface ConfidentialTransferResult {
  /** Operation success */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Computation reference */
  computation?: ComputationReference
  /** New sender balance (encrypted) */
  newSenderBalance?: ConfidentialBalance
  /** Error message */
  error?: string
}

/**
 * Parameters for approval (DeFi integration)
 */
export interface ApproveParams {
  /** C-SPL token mint */
  csplMint: string
  /** Delegate address (e.g., DEX program) */
  delegate: string
  /** Approved amount */
  amount: bigint
  /** Owner address */
  owner: string
}

/**
 * Result of approval
 */
export interface ApproveResult {
  /** Operation success */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Error message */
  error?: string
}

// ─── Service Implementation ──────────────────────────────────────────────────

/**
 * C-SPL Token Service
 *
 * Manages confidential token operations on Solana via Arcium.
 */
export class CSPLTokenService {
  private config: Required<CSPLTokenServiceConfig>
  private _isInitialized = false
  private tokenAccounts: Map<string, CSPLTokenAccount> = new Map()

  constructor(config: CSPLTokenServiceConfig = {}) {
    const network = config.network ?? 'devnet'

    this.config = {
      network,
      solanaRpcUrl: config.solanaRpcUrl ?? 'https://api.devnet.solana.com',
      arciumRpcUrl: config.arciumRpcUrl ?? ARCIUM_RPC_ENDPOINTS[network],
      verbose: config.verbose ?? false,
      timeout: config.timeout ?? 60000,
    }
  }

  /**
   * Check if service is initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized
  }

  /**
   * Get current network
   */
  getNetwork(): ArciumNetwork {
    return this.config.network
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      return
    }

    if (this.config.verbose) {
      console.log('[CSPLTokenService] Initializing...')
      console.log(`[CSPLTokenService] Network: ${this.config.network}`)
    }

    // In production: connect to Arcium and Solana RPCs
    this._isInitialized = true

    if (this.config.verbose) {
      console.log('[CSPLTokenService] Ready')
    }
  }

  // ─── Token Information ───────────────────────────────────────────────────────

  /**
   * Get all supported C-SPL tokens
   */
  getSupportedTokens(): CSPLToken[] {
    return Object.values(CSPL_TOKEN_REGISTRY)
  }

  /**
   * Check if SPL token has C-SPL support
   */
  isSupported(splMint: string): boolean {
    return hasCSPLSupport(splMint)
  }

  /**
   * Get C-SPL token info from SPL mint
   */
  getTokenInfo(splMint: string): CSPLToken | null {
    return getCSPLToken(splMint)
  }

  /**
   * Derive C-SPL mint from SPL mint
   */
  deriveCSPLMint(splMint: string): string {
    return deriveCSPLMint(splMint)
  }

  // ─── Wrap Operations ─────────────────────────────────────────────────────────

  /**
   * Wrap SPL tokens to C-SPL (make confidential)
   *
   * Converts public SPL tokens to encrypted C-SPL tokens.
   * After wrapping, the balance becomes private.
   *
   * @param params - Wrap parameters
   * @returns Wrap result
   */
  async wrap(params: WrapParams): Promise<WrapResult> {
    this.ensureInitialized()

    // Validate token support
    if (!hasCSPLSupport(params.splMint)) {
      return {
        success: false,
        error: `Token ${params.splMint} does not support C-SPL wrapping`,
      }
    }

    // Validate amount
    if (params.amount <= 0n) {
      return {
        success: false,
        error: 'Amount must be positive',
      }
    }

    const csplToken = getCSPLToken(params.splMint)!

    if (this.config.verbose) {
      console.log(`[CSPLTokenService] Wrapping ${params.amount} ${csplToken.symbol}`)
    }

    try {
      // In production:
      // 1. Get/create C-SPL token account
      // 2. Build wrap instruction
      // 3. Submit to Arcium for encryption
      // 4. Confirm on Solana

      const computation = await this.simulateMPCComputation()
      const signature = this.generateSignature()
      const csplTokenAccount = this.deriveTokenAccount(csplToken.csplMint, params.owner)

      // Cache the account
      this.cacheTokenAccount({
        address: csplTokenAccount,
        csplMint: csplToken.csplMint,
        owner: params.owner,
        balance: {
          csplMint: csplToken.csplMint,
          symbol: csplToken.symbol,
          encryptedBalance: new Uint8Array(32),
          decryptedBalance: params.amount,
          decimals: csplToken.decimals,
          lastUpdatedSlot: Date.now(),
          isPending: false,
        },
        isInitialized: true,
        isFrozen: false,
      })

      if (this.config.verbose) {
        console.log(`[CSPLTokenService] Wrap successful: ${signature}`)
      }

      return {
        success: true,
        signature,
        csplMint: csplToken.csplMint,
        csplTokenAccount,
        amount: params.amount,
        computation: computation.reference,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Wrap failed',
      }
    }
  }

  /**
   * Unwrap C-SPL tokens to SPL (make public)
   *
   * Converts encrypted C-SPL tokens back to public SPL tokens.
   * The specified amount becomes visible on-chain.
   *
   * @param params - Unwrap parameters
   * @returns Unwrap result
   */
  async unwrap(params: UnwrapParams): Promise<UnwrapResult> {
    this.ensureInitialized()

    // Find matching C-SPL token
    const csplToken = Object.values(CSPL_TOKEN_REGISTRY).find(
      t => t.csplMint === params.csplMint
    )

    if (!csplToken) {
      return {
        success: false,
        error: `Unknown C-SPL token: ${params.csplMint}`,
      }
    }

    // Validate amount
    if (params.amount <= 0n) {
      return {
        success: false,
        error: 'Amount must be positive',
      }
    }

    if (this.config.verbose) {
      console.log(`[CSPLTokenService] Unwrapping ${params.amount} ${csplToken.symbol}`)
    }

    try {
      const computation = await this.simulateMPCComputation()
      const signature = this.generateSignature()
      const recipient = params.recipient ?? params.owner
      const splTokenAccount = this.deriveTokenAccount(csplToken.splMint, recipient)

      if (this.config.verbose) {
        console.log(`[CSPLTokenService] Unwrap successful: ${signature}`)
      }

      return {
        success: true,
        signature,
        splMint: csplToken.splMint,
        splTokenAccount,
        amount: params.amount,
        computation: computation.reference,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unwrap failed',
      }
    }
  }

  // ─── Transfer Operations ─────────────────────────────────────────────────────

  /**
   * Confidential transfer between accounts
   *
   * Transfers C-SPL tokens while keeping amount encrypted.
   * Only sender and recipient can see the amount.
   *
   * @param params - Transfer parameters
   * @returns Transfer result
   */
  async transfer(params: ConfidentialTransferParams): Promise<ConfidentialTransferResult> {
    this.ensureInitialized()

    // Find matching C-SPL token
    const csplToken = Object.values(CSPL_TOKEN_REGISTRY).find(
      t => t.csplMint === params.csplMint
    )

    if (!csplToken) {
      return {
        success: false,
        error: `Unknown C-SPL token: ${params.csplMint}`,
      }
    }

    // Validate amount
    if (params.amount <= 0n) {
      return {
        success: false,
        error: 'Amount must be positive',
      }
    }

    if (this.config.verbose) {
      console.log(`[CSPLTokenService] Confidential transfer: ${params.amount} ${csplToken.symbol}`)
      console.log(`[CSPLTokenService] From: ${params.sender}`)
      console.log(`[CSPLTokenService] To: ${params.recipient}`)
    }

    try {
      // In production:
      // 1. Encrypt amount with recipient's key
      // 2. Generate range proof (amount > 0, no overflow)
      // 3. Generate equality proof (encrypted amounts match)
      // 4. Submit via Arcium MPC
      // 5. Confirm on Solana

      const computation = await this.simulateMPCComputation()
      const signature = this.generateSignature()

      // Update cached sender balance (simulated)
      const senderAccountKey = `${params.csplMint}:${params.sender}`
      const senderAccount = this.tokenAccounts.get(senderAccountKey)

      const newSenderBalance: ConfidentialBalance = {
        csplMint: params.csplMint,
        symbol: csplToken.symbol,
        encryptedBalance: new Uint8Array(32),
        decryptedBalance: senderAccount
          ? (senderAccount.balance.decryptedBalance ?? 0n) - params.amount
          : undefined,
        decimals: csplToken.decimals,
        lastUpdatedSlot: Date.now(),
        isPending: false,
      }

      if (this.config.verbose) {
        console.log(`[CSPLTokenService] Transfer successful: ${signature}`)
      }

      return {
        success: true,
        signature,
        computation: computation.reference,
        newSenderBalance,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      }
    }
  }

  // ─── Balance Operations ──────────────────────────────────────────────────────

  /**
   * Get confidential balance for an account
   *
   * Fetches and optionally decrypts the balance for a C-SPL token account.
   *
   * @param csplMint - C-SPL token mint
   * @param owner - Account owner
   * @param decryptionKey - Key to decrypt balance (optional)
   * @returns Confidential balance info
   */
  async getBalance(
    csplMint: string,
    owner: string,
    _decryptionKey?: Uint8Array
  ): Promise<ConfidentialBalance | null> {
    this.ensureInitialized()

    // Find matching C-SPL token
    const csplToken = Object.values(CSPL_TOKEN_REGISTRY).find(
      t => t.csplMint === csplMint
    )

    if (!csplToken) {
      return null
    }

    // Check cache first
    const accountKey = `${csplMint}:${owner}`
    const cached = this.tokenAccounts.get(accountKey)

    if (cached) {
      return cached.balance
    }

    // In production: fetch from chain and decrypt
    // For now, return a simulated balance
    return {
      csplMint,
      symbol: csplToken.symbol,
      encryptedBalance: new Uint8Array(32),
      decryptedBalance: undefined, // Would be decrypted with key
      decimals: csplToken.decimals,
      lastUpdatedSlot: Date.now(),
      isPending: false,
    }
  }

  /**
   * Get all token accounts for an owner
   */
  async getTokenAccounts(owner: string): Promise<CSPLTokenAccount[]> {
    this.ensureInitialized()

    const accounts: CSPLTokenAccount[] = []

    for (const [key, account] of this.tokenAccounts) {
      if (account.owner === owner) {
        accounts.push(account)
      }
    }

    return accounts
  }

  // ─── DeFi Integration ────────────────────────────────────────────────────────

  /**
   * Approve delegate to spend C-SPL tokens
   *
   * Sets an encrypted allowance for a delegate (e.g., DEX program).
   * Enables confidential DeFi operations.
   *
   * @param params - Approval parameters
   * @returns Approval result
   */
  async approve(params: ApproveParams): Promise<ApproveResult> {
    this.ensureInitialized()

    // Find matching C-SPL token
    const csplToken = Object.values(CSPL_TOKEN_REGISTRY).find(
      t => t.csplMint === params.csplMint
    )

    if (!csplToken) {
      return {
        success: false,
        error: `Unknown C-SPL token: ${params.csplMint}`,
      }
    }

    if (this.config.verbose) {
      console.log(`[CSPLTokenService] Approving ${params.amount} ${csplToken.symbol}`)
      console.log(`[CSPLTokenService] Delegate: ${params.delegate}`)
    }

    try {
      // In production: create encrypted approval instruction
      const signature = this.generateSignature()

      return {
        success: true,
        signature,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Approval failed',
      }
    }
  }

  /**
   * Revoke delegate approval
   */
  async revoke(csplMint: string, delegate: string, owner: string): Promise<ApproveResult> {
    return this.approve({
      csplMint,
      delegate,
      amount: 0n,
      owner,
    })
  }

  // ─── Cost Estimation ─────────────────────────────────────────────────────────

  /**
   * Estimate cost for an operation
   */
  estimateCost(operation: 'wrap' | 'unwrap' | 'transfer' | 'approve'): bigint {
    switch (operation) {
      case 'wrap':
      case 'unwrap':
        return estimateArciumCost('wrap')
      case 'transfer':
        return estimateArciumCost('transfer')
      case 'approve':
        return BigInt(5_000) // Simple instruction
      default:
        return BigInt(10_000_000)
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private ensureInitialized(): void {
    if (!this._isInitialized) {
      throw new ArciumError(
        'CSPLTokenService not initialized. Call initialize() first.',
        ArciumErrorCode.NETWORK_ERROR
      )
    }
  }

  private async simulateMPCComputation(): Promise<{
    reference: ComputationReference
    status: ComputationStatus
  }> {
    // Simulate async MPC computation
    await new Promise(resolve => setTimeout(resolve, 50))

    return {
      reference: {
        id: `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        clusterId: 'arcium-cluster-1',
        submitSlot: Math.floor(Date.now() / 400),
      },
      status: 'finalized',
    }
  }

  private generateSignature(): string {
    const bytes = new Uint8Array(64)
    for (let i = 0; i < 64; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private deriveTokenAccount(mint: string, owner: string): string {
    // In production: derive ATA address
    return `ata_${mint.slice(0, 8)}_${owner.slice(0, 8)}`
  }

  private cacheTokenAccount(account: CSPLTokenAccount): void {
    const key = `${account.csplMint}:${account.owner}`
    this.tokenAccounts.set(key, account)
  }
}

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Create C-SPL Token Service for devnet
 */
export function createCSPLServiceDevnet(
  config: Omit<CSPLTokenServiceConfig, 'network'> = {}
): CSPLTokenService {
  return new CSPLTokenService({
    ...config,
    network: 'devnet',
  })
}

/**
 * Create C-SPL Token Service for testnet
 */
export function createCSPLServiceTestnet(
  config: Omit<CSPLTokenServiceConfig, 'network'> = {}
): CSPLTokenService {
  return new CSPLTokenService({
    ...config,
    network: 'testnet',
  })
}

/**
 * Create C-SPL Token Service for mainnet
 */
export function createCSPLServiceMainnet(
  config: Omit<CSPLTokenServiceConfig, 'network'> = {}
): CSPLTokenService {
  return new CSPLTokenService({
    ...config,
    network: 'mainnet',
  })
}
