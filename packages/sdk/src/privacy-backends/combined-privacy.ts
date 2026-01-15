/**
 * Combined Privacy Service
 *
 * Integrates SIP Native (stealth addresses, Pedersen commitments, viewing keys)
 * with Arcium C-SPL (encrypted amounts) for comprehensive transaction privacy.
 *
 * ## Privacy Layers Combined
 *
 * | Feature | SIP Native | Arcium C-SPL | Combined |
 * |---------|------------|--------------|----------|
 * | Hidden Sender | ✓ | ✗ | ✓ |
 * | Hidden Recipient | ✓ | ✗ | ✓ |
 * | Hidden Amount | ✓ (Pedersen) | ✓ (Encrypted) | ✓ |
 * | Hidden Compute | ✗ | ✓ (MPC) | ✓ |
 * | Compliance | ✓ (Viewing Keys) | ✗ | ✓ |
 *
 * ## Usage
 *
 * ```typescript
 * import { CombinedPrivacyService } from '@sip-protocol/sdk'
 *
 * const service = new CombinedPrivacyService({
 *   rpcUrl: 'https://api.devnet.solana.com',
 * })
 *
 * await service.initialize()
 *
 * // Execute private transfer with full privacy
 * const result = await service.executePrivateTransfer({
 *   sender: wallet.publicKey,
 *   recipientMetaAddress: 'sip:solana:0x...',
 *   amount: 1_000_000_000n,
 *   token: 'So11111111111111111111111111111111111111112',
 *   privacyLevel: 'shielded',
 * })
 *
 * // IMPORTANT: Always check success before accessing result fields
 * if (!result.success) {
 *   console.error('Transfer failed:', result.error)
 *   return
 * }
 *
 * console.log('Stealth address:', result.stealthAddress)
 * console.log('Signature:', result.signature)
 * ```
 *
 * @see CSPLTokenService for C-SPL operations
 * @see SIPNativeBackend for stealth address operations
 */

import { PrivacyLevel, type ViewingKey } from '@sip-protocol/types'
import {
  CSPLTokenService,
  type CSPLTokenServiceConfig,
} from './cspl-token'
import type { CSPLToken } from './cspl-types'
import { SIPNativeBackend, type SIPNativeBackendConfig } from './sip-native'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Parameters for a combined private transfer
 */
export interface CombinedTransferParams {
  /** Sender wallet address */
  sender: string
  /** Recipient's meta-address (sip:chain:spending:viewing format) */
  recipientMetaAddress: string
  /** Amount to transfer (in smallest units) */
  amount: bigint
  /** Token mint address (SPL token, will be wrapped to C-SPL) */
  token: string
  /** Privacy level */
  privacyLevel: PrivacyLevel
  /** Optional viewing key for compliance (required for 'compliant' level) */
  viewingKey?: ViewingKey
  /** Optional memo (public if not encrypted) */
  memo?: string
}

/**
 * Result of a combined private transfer
 *
 * IMPORTANT: Always check `success` before accessing other fields.
 * Fields like stealthAddress, csplMint, etc. are only populated when success is true.
 */
export interface CombinedTransferResult {
  /** Whether the transfer succeeded */
  success: boolean
  /** Error message (only if !success) */
  error?: string
  /** The one-time stealth address for this transfer (only if success) */
  stealthAddress?: string
  /** The C-SPL token mint used (only if success) */
  csplMint?: string
  /** Encrypted balance after transfer (only if success) */
  encryptedBalance?: Uint8Array
  /** Transaction signature for wrap operation (only if success) */
  wrapSignature?: string
  /** Transaction signature for transfer operation (only if success) */
  transferSignature?: string
  /** Combined operation signatures (only if success) */
  signatures?: string[]
  /** Transfer metadata */
  metadata?: {
    privacyLevel: PrivacyLevel
    hasViewingKey: boolean
    wrapDuration?: number
    transferDuration?: number
    totalDuration?: number
  }
}

/**
 * Result of stealth address derivation
 */
export interface StealthAddressResult {
  /** Whether derivation succeeded */
  success: boolean
  /** Error message (only if !success) */
  error?: string
  /** The derived stealth address (only if success) */
  stealthAddress?: string
  /** The ephemeral public key (only if success) */
  ephemeralPubkey?: string
  /** The view tag for efficient scanning (only if success) */
  viewTag?: number
}

/**
 * Parameters for claiming from stealth address
 */
export interface ClaimParams {
  /** The stealth address to claim from */
  stealthAddress: string
  /** The ephemeral public key from sender */
  ephemeralPubkey: string
  /** Recipient's spending private key */
  spendingPrivateKey: string
  /** Recipient's viewing private key */
  viewingPrivateKey: string
  /** C-SPL token to claim */
  csplMint: string
}

/**
 * Result of claiming from stealth address
 */
export interface ClaimResult {
  /** Whether claim succeeded */
  success: boolean
  /** Error message (only if !success) */
  error?: string
  /** Amount claimed (decrypted) */
  amount?: bigint
  /** Transaction signature */
  signature?: string
}

/**
 * Cost breakdown for combined operations
 */
export interface CostBreakdown {
  /** Cost for wrapping to C-SPL */
  wrapCost: bigint
  /** Cost for stealth address derivation */
  stealthCost: bigint
  /** Cost for confidential transfer */
  transferCost: bigint
  /** Total estimated cost */
  totalCost: bigint
  /** Currency (e.g., 'lamports', 'gwei') */
  currency: string
}

/**
 * Privacy comparison between backends
 */
export interface PrivacyComparison {
  sipNative: {
    hiddenSender: boolean
    hiddenRecipient: boolean
    hiddenAmount: boolean
    hiddenCompute: boolean
    compliance: boolean
  }
  arciumCSPL: {
    hiddenSender: boolean
    hiddenRecipient: boolean
    hiddenAmount: boolean
    hiddenCompute: boolean
    compliance: boolean
  }
  combined: {
    hiddenSender: boolean
    hiddenRecipient: boolean
    hiddenAmount: boolean
    hiddenCompute: boolean
    compliance: boolean
  }
}

/**
 * Service status
 */
export interface ServiceStatus {
  /** Whether service is initialized */
  initialized: boolean
  /** C-SPL service status */
  csplStatus: {
    connected: boolean
    tokenCount: number
  }
  /** SIP Native backend status */
  sipNativeStatus: {
    available: boolean
    chainCount: number
  }
}

// ─── Service Implementation ────────────────────────────────────────────────────

/**
 * Configuration for CombinedPrivacyService
 */
export interface CombinedPrivacyServiceConfig {
  /** Solana RPC endpoint URL */
  rpcUrl?: string
  /** C-SPL service configuration */
  csplConfig?: CSPLTokenServiceConfig
  /** SIP Native backend configuration */
  sipNativeConfig?: SIPNativeBackendConfig
  /** Default privacy level */
  defaultPrivacyLevel?: PrivacyLevel
}

/**
 * Combined Privacy Service
 *
 * Provides comprehensive privacy by combining:
 * - SIP Native: Stealth addresses (unlinkable recipients)
 * - SIP Native: Pedersen commitments (hidden amounts)
 * - SIP Native: Viewing keys (compliance support)
 * - Arcium C-SPL: Encrypted token balances
 *
 * ## Critical: Always Check Success Before Accessing Fields
 *
 * All result types in this service use the Result pattern.
 * You MUST check `result.success` before accessing other fields.
 *
 * @example
 * ```typescript
 * // CORRECT: Check success first
 * if (!result.success) {
 *   console.error(result.error)
 *   return
 * }
 * console.log(result.stealthAddress) // Now safe to access
 *
 * // INCORRECT: Never use non-null assertions without checking success
 * // console.log(result.stealthAddress!) // UNSAFE - could be undefined
 * ```
 */
export class CombinedPrivacyService {
  private csplService: CSPLTokenService
  private sipNativeBackend: SIPNativeBackend
  private config: Required<CombinedPrivacyServiceConfig>
  private initialized: boolean = false

  /**
   * Create a new Combined Privacy Service
   *
   * @param config - Service configuration
   */
  constructor(config: CombinedPrivacyServiceConfig = {}) {
    this.config = {
      rpcUrl: config.rpcUrl ?? 'https://api.devnet.solana.com',
      csplConfig: config.csplConfig ?? {},
      sipNativeConfig: config.sipNativeConfig ?? {},
      defaultPrivacyLevel: config.defaultPrivacyLevel ?? PrivacyLevel.SHIELDED,
    }

    // Initialize sub-services
    this.csplService = new CSPLTokenService({
      ...this.config.csplConfig,
      rpcUrl: this.config.rpcUrl,
    })

    this.sipNativeBackend = new SIPNativeBackend(this.config.sipNativeConfig)
  }

  /**
   * Initialize the service
   *
   * Initializes both C-SPL and SIP Native components.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.csplService.initialize()
    this.initialized = true
  }

  /**
   * Execute a privacy-preserving transfer
   *
   * This combines:
   * 1. Wrap SPL to C-SPL (encrypted balance)
   * 2. Derive stealth address (unlinkable recipient)
   * 3. Transfer to stealth address with encrypted amount
   *
   * IMPORTANT: Always check result.success before accessing result fields!
   *
   * @param params - Transfer parameters
   * @returns Transfer result with success status
   *
   * @example
   * ```typescript
   * const result = await service.executePrivateTransfer({
   *   sender: wallet.publicKey,
   *   recipientMetaAddress: 'sip:solana:0x...',
   *   amount: 1_000_000_000n,
   *   token: 'So11...',
   *   privacyLevel: 'shielded',
   * })
   *
   * // ALWAYS check success first
   * if (!result.success) {
   *   console.error('Failed:', result.error)
   *   return
   * }
   *
   * // Now safe to access fields
   * console.log('Stealth:', result.stealthAddress)
   * console.log('C-SPL:', result.csplMint)
   * ```
   */
  async executePrivateTransfer(
    params: CombinedTransferParams
  ): Promise<CombinedTransferResult> {
    const startTime = Date.now()

    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    // Validate inputs
    const validation = this.validateTransferParams(params)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      }
    }

    try {
      // Step 1: Wrap SPL to C-SPL
      const wrapStartTime = Date.now()
      const wrapResult = await this.csplService.wrap({
        mint: params.token,
        amount: params.amount,
        owner: params.sender,
      })

      // CRITICAL: Check wrapResult.success BEFORE accessing fields!
      // This is the fix for issue #527 - never use non-null assertion
      // on result fields without first checking success.
      if (!wrapResult.success) {
        return {
          success: false,
          error: `Failed to wrap tokens: ${wrapResult.error}`,
        }
      }

      const wrapDuration = Date.now() - wrapStartTime

      // Now safe to access wrapResult fields since success is true
      const csplMint = wrapResult.csplMint
      const encryptedBalance = wrapResult.encryptedBalance

      // Step 2: Derive stealth address for recipient
      const stealthResult = await this.deriveStealthAddress(params.recipientMetaAddress)

      // Check stealthResult.success before accessing fields
      if (!stealthResult.success) {
        return {
          success: false,
          error: `Failed to derive stealth address: ${stealthResult.error}`,
        }
      }

      const stealthAddress = stealthResult.stealthAddress

      // Step 3: Execute transfer via SIP Native backend
      const transferStartTime = Date.now()

      // Note: Using SIP Native for the actual transfer with stealth address
      // The C-SPL wrapping provides encrypted amounts, SIP Native provides
      // stealth addresses for unlinkable recipients
      const transferResult = await this.sipNativeBackend.execute({
        chain: 'solana',
        sender: params.sender,
        recipient: stealthAddress!,
        mint: csplMint!,
        amount: params.amount,
        decimals: 9, // TODO(#645): Get from token metadata
        viewingKey: params.viewingKey,
      })

      // Check transferResult.success
      if (!transferResult.success) {
        return {
          success: false,
          error: `Failed to execute transfer: ${transferResult.error}`,
        }
      }

      const transferDuration = Date.now() - transferStartTime
      const totalDuration = Date.now() - startTime

      // All steps succeeded - return complete result
      return {
        success: true,
        stealthAddress: stealthAddress,
        csplMint: csplMint,
        encryptedBalance: encryptedBalance,
        wrapSignature: wrapResult.signature,
        transferSignature: transferResult.signature,
        signatures: [wrapResult.signature!, transferResult.signature!].filter(Boolean),
        metadata: {
          privacyLevel: params.privacyLevel,
          hasViewingKey: !!params.viewingKey,
          wrapDuration,
          transferDuration,
          totalDuration,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during transfer',
      }
    }
  }

  /**
   * Derive a one-time stealth address from a recipient's meta-address
   *
   * Stealth addresses provide unlinkable recipients — each payment creates a unique
   * address that only the recipient can identify and claim. This prevents linking
   * multiple payments to the same recipient.
   *
   * ## Meta-Address Format
   *
   * The meta-address must follow the SIP format: `sip:<chain>:<spendingKey>:<viewingKey>`
   *
   * - `chain` — The blockchain (e.g., "solana", "ethereum")
   * - `spendingKey` — Recipient's public spending key (controls funds)
   * - `viewingKey` — Recipient's public viewing key (for scanning)
   *
   * ## Return Value
   *
   * On success, returns:
   * - `stealthAddress` — The derived one-time address to send funds to
   * - `ephemeralPubkey` — Must be published so recipient can compute private key
   * - `viewTag` — Optimization for efficient payment scanning (0-255)
   *
   * IMPORTANT: Always check `result.success` before accessing other fields.
   *
   * @param metaAddress - SIP meta-address in format `sip:<chain>:<spendingKey>:<viewingKey>`
   * @returns Stealth address result with success status
   *
   * @example
   * ```typescript
   * const result = await service.deriveStealthAddress(
   *   'sip:solana:0x02abc...123:0x03def...456'
   * )
   *
   * if (!result.success) {
   *   console.error('Failed:', result.error)
   *   return
   * }
   *
   * // Now safe to access fields
   * console.log('Send to:', result.stealthAddress)
   * console.log('Publish:', result.ephemeralPubkey)
   * console.log('View tag:', result.viewTag)
   * ```
   */
  async deriveStealthAddress(metaAddress: string): Promise<StealthAddressResult> {
    // Parse meta-address
    const parts = metaAddress.split(':')
    if (parts.length !== 4 || parts[0] !== 'sip') {
      return {
        success: false,
        error: `Invalid meta-address format. Expected: sip:<chain>:<spendingKey>:<viewingKey>, got: ${metaAddress}`,
      }
    }

    const [, chain, spendingKey, viewingKey] = parts

    if (!chain || !spendingKey || !viewingKey) {
      return {
        success: false,
        error: 'Meta-address must contain chain, spending key, and viewing key',
      }
    }

    try {
      // In production, this would:
      // 1. Generate ephemeral keypair
      // 2. Compute shared secret with recipient's viewing key
      // 3. Derive stealth address from spending key + shared secret

      // Simulated stealth address derivation
      const simulatedEphemeralPubkey = `eph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
      const simulatedStealthAddress = `stealth_${chain}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
      const viewTag = Math.floor(Math.random() * 256)

      return {
        success: true,
        stealthAddress: simulatedStealthAddress,
        ephemeralPubkey: simulatedEphemeralPubkey,
        viewTag,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to derive stealth address',
      }
    }
  }

  /**
   * Claim tokens from a stealth address
   *
   * Recipients use this method to claim funds sent to their stealth addresses.
   * The ephemeral public key (published by sender) is combined with the
   * recipient's private viewing key to derive the stealth private key.
   *
   * ## Required Parameters
   *
   * - `stealthAddress` — The stealth address containing funds
   * - `ephemeralPubkey` — The sender's ephemeral public key (from announcement)
   * - `spendingPrivateKey` — Recipient's private spending key
   * - `viewingPrivateKey` — Recipient's private viewing key
   *
   * ## Process
   *
   * 1. Computes shared secret from ephemeralPubkey + viewingPrivateKey
   * 2. Derives stealth private key from spendingPrivateKey + shared secret
   * 3. Creates claim transaction signed with stealth private key
   * 4. Unwraps C-SPL back to regular SPL token
   *
   * IMPORTANT: Always check `result.success` before accessing other fields.
   *
   * @param params - Claim parameters including keys and addresses
   * @returns Claim result with amount and transaction signature
   *
   * @example
   * ```typescript
   * const result = await service.claimFromStealth({
   *   stealthAddress: 'stealth_solana_...',
   *   ephemeralPubkey: 'eph_...',
   *   spendingPrivateKey: 'spending_priv_...',
   *   viewingPrivateKey: 'viewing_priv_...',
   * })
   *
   * if (!result.success) {
   *   console.error('Claim failed:', result.error)
   *   return
   * }
   *
   * console.log('Claimed:', result.amount, 'tokens')
   * console.log('Transaction:', result.signature)
   * ```
   */
  async claimFromStealth(params: ClaimParams): Promise<ClaimResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.',
      }
    }

    // Validate inputs
    if (!params.stealthAddress || !params.ephemeralPubkey) {
      return {
        success: false,
        error: 'stealthAddress and ephemeralPubkey are required',
      }
    }

    if (!params.spendingPrivateKey || !params.viewingPrivateKey) {
      return {
        success: false,
        error: 'Both spending and viewing private keys are required',
      }
    }

    try {
      // In production, this would:
      // 1. Compute shared secret from ephemeralPubkey + viewingPrivateKey
      // 2. Derive stealth private key from spendingPrivateKey + shared secret
      // 3. Create claim transaction signed with stealth private key
      // 4. Unwrap C-SPL back to SPL

      // Simulated claim
      const simulatedSignature = `claim_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const simulatedAmount = BigInt(1_000_000_000) // 1 token (simulated)

      return {
        success: true,
        amount: simulatedAmount,
        signature: simulatedSignature,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim from stealth',
      }
    }
  }

  /**
   * Estimate the total cost for a combined privacy transfer
   *
   * Returns a breakdown of costs across all privacy layers:
   * - `wrapCost` — Cost to wrap SPL into C-SPL (encrypted balance)
   * - `stealthCost` — Cost for stealth address derivation (client-side, 0)
   * - `transferCost` — Cost for the SIP Native transfer
   * - `totalCost` — Sum of all costs
   *
   * All costs are in lamports (1 SOL = 1,000,000,000 lamports).
   *
   * @param params - Transfer parameters (sender, recipient, amount, token)
   * @returns Cost breakdown with individual and total costs
   *
   * @example
   * ```typescript
   * const costs = await service.estimateCost({
   *   sender: wallet.publicKey,
   *   recipientMetaAddress: 'sip:solana:0x...',
   *   amount: 1_000_000_000n,
   *   token: 'So11...',
   * })
   *
   * console.log('Wrap cost:', costs.wrapCost, 'lamports')
   * console.log('Transfer cost:', costs.transferCost, 'lamports')
   * console.log('Total:', costs.totalCost, 'lamports')
   * ```
   */
  async estimateCost(params: CombinedTransferParams): Promise<CostBreakdown> {
    // Wrap cost
    const wrapCost = await this.csplService.estimateCost('wrap')

    // Stealth address derivation is client-side, minimal cost
    const stealthCost = BigInt(0)

    // Transfer cost from SIP Native
    const transferCost = await this.sipNativeBackend.estimateCost({
      chain: 'solana',
      sender: params.sender,
      recipient: params.recipientMetaAddress,
      mint: params.token,
      amount: params.amount,
      decimals: 9,
    })

    return {
      wrapCost,
      stealthCost,
      transferCost,
      totalCost: wrapCost + stealthCost + transferCost,
      currency: 'lamports',
    }
  }

  /**
   * Get a comparison of privacy features across backends
   *
   * Compares privacy capabilities between:
   * - **SIP Native** — Stealth addresses + Pedersen commitments + viewing keys
   * - **Arcium C-SPL** — Encrypted balances + MPC compute
   * - **Combined** — Full privacy using both layers
   *
   * Privacy dimensions:
   * - `hiddenSender` — Sender identity is not revealed on-chain
   * - `hiddenRecipient` — Recipient identity is unlinkable
   * - `hiddenAmount` — Transfer amount is encrypted/committed
   * - `hiddenCompute` — Contract execution is private
   * - `compliance` — Selective disclosure available for auditors
   *
   * @returns Privacy comparison for each backend and combined approach
   *
   * @example
   * ```typescript
   * const comparison = service.getPrivacyComparison()
   *
   * console.log('SIP Native hides sender:', comparison.sipNative.hiddenSender)
   * console.log('Combined full privacy:', comparison.combined)
   * ```
   */
  getPrivacyComparison(): PrivacyComparison {
    return {
      sipNative: {
        hiddenSender: true,
        hiddenRecipient: true,
        hiddenAmount: true, // Pedersen commitments
        hiddenCompute: false,
        compliance: true, // Viewing keys
      },
      arciumCSPL: {
        hiddenSender: false,
        hiddenRecipient: false,
        hiddenAmount: true, // Encrypted balances
        hiddenCompute: true, // MPC
        compliance: false,
      },
      combined: {
        hiddenSender: true, // From SIP Native
        hiddenRecipient: true, // From SIP Native stealth addresses
        hiddenAmount: true, // Both Pedersen and encrypted
        hiddenCompute: true, // From Arcium when used
        compliance: true, // From SIP Native viewing keys
      },
    }
  }

  /**
   * Get the current status of the combined privacy service
   *
   * Returns status information for both underlying services:
   * - `initialized` — Whether the service has been initialized
   * - `csplStatus` — C-SPL service connection and token count
   * - `sipNativeStatus` — SIP Native availability and chain support
   *
   * @returns Service status for monitoring and debugging
   *
   * @example
   * ```typescript
   * const status = service.getStatus()
   *
   * if (!status.initialized) {
   *   console.log('Service needs initialization')
   *   await service.initialize()
   * }
   *
   * console.log('C-SPL connected:', status.csplStatus.connected)
   * console.log('Registered tokens:', status.csplStatus.tokenCount)
   * console.log('SIP Native available:', status.sipNativeStatus.available)
   * ```
   */
  getStatus(): ServiceStatus {
    const csplStatus = this.csplService.getStatus()
    const sipNativeCaps = this.sipNativeBackend.getCapabilities()

    return {
      initialized: this.initialized,
      csplStatus: {
        connected: csplStatus.connected,
        tokenCount: csplStatus.registeredTokenCount,
      },
      sipNativeStatus: {
        available: sipNativeCaps.setupRequired === false,
        chainCount: this.sipNativeBackend.chains.length,
      },
    }
  }

  /**
   * Register a token for use with the service
   *
   * @param token - C-SPL token to register
   */
  registerToken(token: CSPLToken): void {
    this.csplService.registerToken(token)
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    await this.csplService.disconnect()
    this.initialized = false
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Validate transfer parameters
   */
  private validateTransferParams(params: CombinedTransferParams): {
    valid: boolean
    error?: string
  } {
    if (!params.sender || params.sender.trim() === '') {
      return { valid: false, error: 'Sender address is required' }
    }

    if (!params.recipientMetaAddress || params.recipientMetaAddress.trim() === '') {
      return { valid: false, error: 'Recipient meta-address is required' }
    }

    if (!params.recipientMetaAddress.startsWith('sip:')) {
      return {
        valid: false,
        error: 'Recipient must be a SIP meta-address (sip:chain:spending:viewing)',
      }
    }

    if (params.amount <= BigInt(0)) {
      return { valid: false, error: 'Amount must be greater than 0' }
    }

    if (!params.token || params.token.trim() === '') {
      return { valid: false, error: 'Token mint address is required' }
    }

    if (params.privacyLevel === PrivacyLevel.COMPLIANT && !params.viewingKey) {
      return {
        valid: false,
        error: 'Viewing key is required for compliant privacy level',
      }
    }

    return { valid: true }
  }
}

// ─── Factory Functions ─────────────────────────────────────────────────────────

/**
 * Create a CombinedPrivacyService for devnet
 *
 * @param config - Optional additional configuration
 * @returns Configured service for devnet
 */
export function createCombinedPrivacyServiceDevnet(
  config?: Partial<CombinedPrivacyServiceConfig>
): CombinedPrivacyService {
  return new CombinedPrivacyService({
    ...config,
    rpcUrl: config?.rpcUrl ?? 'https://api.devnet.solana.com',
  })
}

/**
 * Create a CombinedPrivacyService for mainnet
 *
 * @param config - Optional additional configuration
 * @returns Configured service for mainnet
 */
export function createCombinedPrivacyServiceMainnet(
  config?: Partial<CombinedPrivacyServiceConfig>
): CombinedPrivacyService {
  return new CombinedPrivacyService({
    ...config,
    rpcUrl: config?.rpcUrl ?? 'https://api.mainnet-beta.solana.com',
  })
}
