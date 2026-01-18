/**
 * NEAR Privacy Adapter
 *
 * Orchestrates privacy operations for NEAR same-chain transactions.
 * Provides a unified interface for stealth transfers, scanning, and claiming.
 *
 * @module chains/near/privacy-adapter
 */

import type { StealthMetaAddress, HexString, StealthAddress } from '@sip-protocol/types'
import {
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  parseNEARStealthMetaAddress,
  encodeNEARStealthMetaAddress,
  ed25519PublicKeyToImplicitAccount,
  deriveNEARStealthPrivateKey,
  checkNEARStealthAddress,
} from './stealth'
import {
  buildPrivateTransfer,
  buildPrivateTokenTransfer,
  buildStorageDeposit,
  deriveStealthAccountKeyPair,
  buildClaimTransaction,
  buildDeleteStealthAccount,
  type NEARPrivateTransferBuild,
  type NEARAction,
} from './implicit-account'
import {
  NEARStealthScanner,
  createNEARStealthScanner,
  type NEARScanRecipient,
  type NEARStealthScannerOptions,
  type NEARDetectedPaymentResult,
} from './resolver'
import {
  exportNEARViewingKey,
  importNEARViewingKey,
  type NEARViewingKey,
  type NEARViewingKeyExport,
} from './viewing-key'
import {
  NEAR_RPC_ENDPOINTS,
  DEFAULT_GAS,
  isValidAccountId,
  getExplorerUrl,
} from './constants'
import type { NEARAnnouncement } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Network type (limited to mainnet/testnet for scanner compatibility)
 */
export type NEARPrivacyNetwork = 'mainnet' | 'testnet'

/**
 * Privacy levels for NEAR transactions
 */
export type NEARPrivacyLevel = 'transparent' | 'shielded' | 'compliant'

/**
 * Configuration for NEARPrivacyAdapter
 */
export interface NEARPrivacyAdapterConfig {
  /**
   * NEAR RPC URL
   */
  rpcUrl: string

  /**
   * Network type
   * @default 'mainnet'
   */
  network?: NEARPrivacyNetwork

  /**
   * Default privacy level
   * @default 'shielded'
   */
  defaultPrivacyLevel?: NEARPrivacyLevel

  /**
   * Custom announcement contract (for future use)
   */
  announcementContract?: string

  /**
   * Scanner options
   */
  scannerOptions?: Partial<NEARStealthScannerOptions>
}

/**
 * Parameters for shielded NEAR transfer
 */
export interface NEARShieldedTransferParams {
  /**
   * Sender's NEAR account ID
   */
  senderAccountId: string

  /**
   * Recipient's stealth meta-address
   */
  recipient: StealthMetaAddress | string

  /**
   * Amount in yoctoNEAR
   */
  amount: bigint

  /**
   * Privacy level for this transaction
   */
  privacyLevel?: NEARPrivacyLevel

  /**
   * Optional memo (visible on-chain)
   */
  memo?: string
}

/**
 * Parameters for shielded token transfer
 */
export interface NEARShieldedTokenTransferParams extends NEARShieldedTransferParams {
  /**
   * NEP-141 token contract address
   */
  tokenContract: string
}

/**
 * Result of building a shielded transfer
 */
export interface NEARShieldedTransferBuild {
  /**
   * Built transfer details
   */
  transfer: NEARPrivateTransferBuild

  /**
   * Privacy level used
   */
  privacyLevel: NEARPrivacyLevel

  /**
   * Stealth address details
   */
  stealthAddress: StealthAddress

  /**
   * Stealth account ID (NEAR implicit account)
   */
  stealthAccountId: string
}

/**
 * Parameters for claiming a payment
 */
export interface NEARAdapterClaimParams {
  /**
   * Detected payment to claim
   */
  payment: NEARDetectedPaymentResult

  /**
   * Viewing private key (hex)
   */
  viewingPrivateKey: HexString

  /**
   * Spending private key (hex)
   */
  spendingPrivateKey: HexString

  /**
   * Destination account ID
   */
  destinationAccountId: string

  /**
   * Whether to delete the stealth account after claiming
   * @default true
   */
  deleteAccount?: boolean
}

/**
 * Gas estimation result
 */
export interface NEARGasEstimate {
  /**
   * Estimated gas in gas units
   */
  gas: bigint

  /**
   * Estimated cost in yoctoNEAR (at current gas price)
   */
  estimatedCost: bigint

  /**
   * Breakdown by action
   */
  breakdown: {
    action: string
    gas: bigint
  }[]
}

/**
 * Privacy adapter state
 */
export interface NEARPrivacyAdapterState {
  /**
   * Whether the adapter is initialized
   */
  isInitialized: boolean

  /**
   * Current network
   */
  network: NEARPrivacyNetwork

  /**
   * RPC URL being used
   */
  rpcUrl: string

  /**
   * Default privacy level
   */
  defaultPrivacyLevel: NEARPrivacyLevel

  /**
   * Number of recipients in the scanner
   */
  scannerRecipientCount: number
}

// ─── NEARPrivacyAdapter Class ─────────────────────────────────────────────────

/**
 * NEAR Privacy Adapter
 *
 * Provides a unified interface for privacy operations on NEAR:
 * - Shielded transfers to stealth addresses
 * - Payment scanning and detection
 * - Claiming detected payments
 * - Meta-address and keypair generation
 *
 * @example Basic usage
 * ```typescript
 * const adapter = new NEARPrivacyAdapter({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   network: 'mainnet',
 * })
 *
 * // Generate meta-address for recipient
 * const { metaAddress, viewingPrivateKey, spendingPrivateKey } =
 *   adapter.generateMetaAddress('Primary Wallet')
 *
 * // Build shielded transfer
 * const build = adapter.buildShieldedTransfer({
 *   senderAccountId: 'alice.near',
 *   recipient: recipientMetaAddress,
 *   amount: ONE_NEAR,
 * })
 *
 * // Sign and submit transaction externally
 * const result = await signAndSubmit(build.transfer)
 * ```
 *
 * @example Scanning and claiming
 * ```typescript
 * // Add recipient for scanning
 * adapter.addScanRecipient({
 *   viewingPrivateKey,
 *   spendingPrivateKey,
 *   label: 'Main Wallet',
 * })
 *
 * // Scan announcements
 * const payments = await adapter.scanAnnouncements(announcements)
 *
 * // Claim a payment
 * const claimBuild = adapter.buildClaimTransaction({
 *   payment: payments[0],
 *   viewingPrivateKey,
 *   spendingPrivateKey,
 *   destinationAccountId: 'alice.near',
 * })
 * ```
 */
export class NEARPrivacyAdapter {
  private rpcUrl: string
  private network: NEARPrivacyNetwork
  private defaultPrivacyLevel: NEARPrivacyLevel
  private scanner: NEARStealthScanner
  // Reserved for future use when announcement contract is deployed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _announcementContract?: string
  private initialized: boolean = false

  constructor(config: NEARPrivacyAdapterConfig) {
    this.rpcUrl = config.rpcUrl
    this.network = config.network ?? 'mainnet'
    this.defaultPrivacyLevel = config.defaultPrivacyLevel ?? 'shielded'
    this._announcementContract = config.announcementContract

    // Initialize scanner
    this.scanner = createNEARStealthScanner({
      rpcUrl: this.rpcUrl,
      network: this.network,
      ...config.scannerOptions,
    })

    this.initialized = true
  }

  // ─── Meta-Address Generation ────────────────────────────────────────────────

  /**
   * Generate a new stealth meta-address
   *
   * Creates a new keypair for receiving private payments.
   * The meta-address can be shared publicly; only the private keys
   * enable scanning and claiming.
   *
   * @param label - Optional label for the address
   * @returns Meta-address and private keys
   */
  generateMetaAddress(label?: string): {
    metaAddress: StealthMetaAddress
    encoded: string
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
  } {
    const result = generateNEARStealthMetaAddress(label)
    const encoded = encodeNEARStealthMetaAddress(result.metaAddress)

    return {
      metaAddress: result.metaAddress,
      encoded,
      viewingPrivateKey: result.viewingPrivateKey,
      spendingPrivateKey: result.spendingPrivateKey,
    }
  }

  /**
   * Parse an encoded meta-address string
   *
   * @param encoded - Encoded meta-address (sip:near:...)
   * @returns Decoded meta-address
   */
  parseMetaAddress(encoded: string): StealthMetaAddress {
    return parseNEARStealthMetaAddress(encoded)
  }

  /**
   * Encode a meta-address to string format
   *
   * @param metaAddress - Meta-address to encode
   * @returns Encoded string (sip:near:...)
   */
  encodeMetaAddress(metaAddress: StealthMetaAddress): string {
    return encodeNEARStealthMetaAddress(metaAddress)
  }

  // ─── Viewing Key Management ─────────────────────────────────────────────────

  /**
   * Export a viewing key for sharing (compliance)
   *
   * @param viewingKey - Viewing key to export
   * @returns Exportable viewing key data
   */
  exportViewingKey(viewingKey: NEARViewingKey): NEARViewingKeyExport {
    return exportNEARViewingKey(viewingKey)
  }

  /**
   * Import a viewing key from export format
   *
   * @param exported - Exported viewing key data
   * @returns Viewing key
   */
  importViewingKey(exported: NEARViewingKeyExport): NEARViewingKey {
    return importNEARViewingKey(exported)
  }

  // ─── Stealth Address Resolution ─────────────────────────────────────────────

  /**
   * Resolve a meta-address to a one-time stealth address
   *
   * Generates a fresh stealth address for the recipient.
   * Each call produces a different, unlinkable address.
   *
   * @param recipient - Recipient's meta-address
   * @returns Stealth address details
   */
  resolveStealthAddress(recipient: StealthMetaAddress | string): {
    stealthAddress: StealthAddress
    stealthAccountId: string
    sharedSecret: HexString
  } {
    const metaAddress = typeof recipient === 'string'
      ? parseNEARStealthMetaAddress(recipient)
      : recipient

    const { stealthAddress, sharedSecret } = generateNEARStealthAddress(metaAddress)

    const stealthAccountId = ed25519PublicKeyToImplicitAccount(stealthAddress.address)

    return {
      stealthAddress,
      stealthAccountId,
      sharedSecret,
    }
  }

  /**
   * Check if a stealth address belongs to a recipient
   *
   * @param stealthAddress - Stealth address object
   * @param spendingPrivateKey - Spending private key (hex)
   * @param viewingPrivateKey - Viewing private key (hex)
   * @returns True if the address belongs to the recipient
   */
  checkStealthAddress(
    stealthAddress: StealthAddress,
    spendingPrivateKey: HexString,
    viewingPrivateKey: HexString
  ): boolean {
    return checkNEARStealthAddress(
      stealthAddress,
      spendingPrivateKey,
      viewingPrivateKey
    )
  }

  // ─── Shielded Transfers ─────────────────────────────────────────────────────

  /**
   * Build a shielded NEAR transfer
   *
   * Creates transaction actions for a private NEAR transfer.
   * The transaction must be signed and submitted externally.
   *
   * @param params - Transfer parameters
   * @returns Built transfer ready for signing
   */
  buildShieldedTransfer(params: NEARShieldedTransferParams): NEARShieldedTransferBuild {
    const privacyLevel = params.privacyLevel ?? this.defaultPrivacyLevel

    // For transparent level, throw - use regular transfer instead
    if (privacyLevel === 'transparent') {
      throw new Error('Use regular NEAR transfer for transparent privacy level')
    }

    const metaAddress = typeof params.recipient === 'string'
      ? parseNEARStealthMetaAddress(params.recipient)
      : params.recipient

    const transfer = buildPrivateTransfer(metaAddress, params.amount)

    return {
      transfer,
      privacyLevel,
      stealthAddress: transfer.stealthAddress,
      stealthAccountId: transfer.stealthAccountId,
    }
  }

  /**
   * Build a shielded token transfer
   *
   * Creates transaction actions for a private NEP-141 token transfer.
   * The transaction must be signed and submitted externally.
   *
   * @param params - Transfer parameters
   * @returns Built transfer ready for signing
   */
  buildShieldedTokenTransfer(params: NEARShieldedTokenTransferParams): NEARShieldedTransferBuild {
    const privacyLevel = params.privacyLevel ?? this.defaultPrivacyLevel

    if (privacyLevel === 'transparent') {
      throw new Error('Use regular NEP-141 transfer for transparent privacy level')
    }

    if (!isValidAccountId(params.tokenContract)) {
      throw new Error(`Invalid token contract: ${params.tokenContract}`)
    }

    const metaAddress = typeof params.recipient === 'string'
      ? parseNEARStealthMetaAddress(params.recipient)
      : params.recipient

    const transfer = buildPrivateTokenTransfer(
      metaAddress,
      params.tokenContract,
      params.amount,
      params.memo
    )

    return {
      transfer,
      privacyLevel,
      stealthAddress: transfer.stealthAddress,
      stealthAccountId: transfer.stealthAccountId,
    }
  }

  /**
   * Build a storage deposit transaction
   *
   * Required for token transfers to new accounts.
   *
   * @param stealthAccountId - Stealth account to deposit for (64 hex chars)
   * @param tokenContract - Token contract address
   * @param amount - Deposit amount (defaults to STORAGE_DEPOSIT_DEFAULT)
   * @returns Actions for storage deposit
   */
  buildStorageDeposit(
    stealthAccountId: string,
    tokenContract: string,
    amount?: bigint
  ): NEARAction[] {
    return buildStorageDeposit(stealthAccountId, tokenContract, amount)
  }

  // ─── Gas Estimation ─────────────────────────────────────────────────────────

  /**
   * Estimate gas for a shielded transfer
   *
   * @param isTokenTransfer - Whether this is a token transfer
   * @param needsStorageDeposit - Whether storage deposit is needed
   * @returns Gas estimate
   */
  estimateTransferGas(
    isTokenTransfer: boolean = false,
    needsStorageDeposit: boolean = false
  ): NEARGasEstimate {
    const breakdown: { action: string; gas: bigint }[] = []

    // Base transfer gas
    const transferGas = isTokenTransfer ? DEFAULT_GAS : 5_000_000_000_000n // 5 TGas for native
    breakdown.push({
      action: isTokenTransfer ? 'ft_transfer' : 'transfer',
      gas: transferGas,
    })

    // Storage deposit if needed
    let storageGas = 0n
    if (needsStorageDeposit) {
      storageGas = DEFAULT_GAS // 30 TGas
      breakdown.push({
        action: 'storage_deposit',
        gas: storageGas,
      })
    }

    const totalGas = transferGas + storageGas

    // Estimate cost (rough approximation: 1 yoctoNEAR per gas unit at base price)
    // Actual price depends on network conditions
    const estimatedCost = totalGas / 10_000n // Very rough estimate

    return {
      gas: totalGas,
      estimatedCost,
      breakdown,
    }
  }

  /**
   * Estimate gas for claiming a payment
   *
   * @param deleteAccount - Whether the account will be deleted
   * @returns Gas estimate
   */
  estimateClaimGas(deleteAccount: boolean = true): NEARGasEstimate {
    const breakdown: { action: string; gas: bigint }[] = []

    // Transfer action
    breakdown.push({
      action: 'transfer',
      gas: 5_000_000_000_000n,
    })

    // Delete account if requested
    if (deleteAccount) {
      breakdown.push({
        action: 'delete_account',
        gas: 1_000_000_000_000n,
      })
    }

    const totalGas = breakdown.reduce((sum, b) => sum + b.gas, 0n)

    return {
      gas: totalGas,
      estimatedCost: totalGas / 10_000n,
      breakdown,
    }
  }

  // ─── Payment Scanning ───────────────────────────────────────────────────────

  /**
   * Add a recipient to the scanner
   *
   * @param recipient - Recipient keys and label
   */
  addScanRecipient(recipient: NEARScanRecipient): void {
    this.scanner.addRecipient(recipient)
  }

  /**
   * Add recipient from a viewing key
   *
   * @param viewingKey - Viewing key
   * @param spendingPrivateKey - Spending private key
   */
  addRecipientFromViewingKey(
    viewingKey: NEARViewingKey,
    spendingPrivateKey: HexString
  ): void {
    this.scanner.addRecipientFromViewingKey(viewingKey, spendingPrivateKey)
  }

  /**
   * Remove a recipient from the scanner
   *
   * @param label - Recipient label to remove
   */
  removeScanRecipient(label: string): void {
    this.scanner.removeRecipient(label)
  }

  /**
   * Get all scan recipients (labels only, keys are sensitive)
   */
  getScanRecipients(): Array<{ label?: string }> {
    return this.scanner.getRecipients()
  }

  /**
   * Clear all scan recipients
   */
  clearScanRecipients(): void {
    this.scanner.clearRecipients()
  }

  /**
   * Scan a list of announcements against configured recipients
   *
   * @param announcements - Announcements to check
   * @param txMetadata - Optional transaction metadata
   * @returns Detected payments
   */
  async scanAnnouncements(
    announcements: NEARAnnouncement[],
    txMetadata?: Array<{
      txHash: string
      blockHeight: number
      timestamp: number
      amount?: bigint
      tokenContract?: string
      decimals?: number
    }>
  ): Promise<NEARDetectedPaymentResult[]> {
    return this.scanner.scanAnnouncements(announcements, txMetadata)
  }

  /**
   * Get balance of a stealth address
   *
   * @param stealthAddress - Stealth address (implicit account ID)
   * @returns Balance in yoctoNEAR
   */
  async getStealthAddressBalance(stealthAddress: string): Promise<bigint> {
    return this.scanner.getStealthAddressBalance(stealthAddress)
  }

  /**
   * Get current block height
   *
   * @returns Current block height
   */
  async getCurrentBlockHeight(): Promise<number> {
    return this.scanner.getCurrentBlockHeight()
  }

  /**
   * Enable caching for announcements
   */
  enableCache(): void {
    this.scanner.enableCache()
  }

  /**
   * Disable caching
   */
  disableCache(): void {
    this.scanner.disableCache()
  }

  // ─── Payment Claiming ───────────────────────────────────────────────────────

  /**
   * Build a claim transaction
   *
   * Derives the stealth private key and creates transaction actions
   * to transfer funds to the destination.
   *
   * @param params - Claim parameters
   * @returns Claim transaction build
   */
  buildClaimTransaction(params: NEARAdapterClaimParams): {
    stealthAccountId: string
    stealthPrivateKey: HexString
    actions: NEARAction[]
    destinationAccountId: string
  } {
    const deleteAccount = params.deleteAccount ?? true

    // Construct StealthAddress from payment data
    const stealthAddress: StealthAddress = {
      address: params.payment.stealthPublicKey,
      ephemeralPublicKey: params.payment.ephemeralPublicKey,
      viewTag: params.payment.viewTag,
    }

    // Derive the stealth private key
    const { privateKey: stealthPrivateKey } = deriveStealthAccountKeyPair({
      stealthAddress,
      viewingPrivateKey: params.viewingPrivateKey,
      spendingPrivateKey: params.spendingPrivateKey,
    })

    // Build claim or delete transaction
    let actions: NEARAction[]

    if (deleteAccount) {
      actions = buildDeleteStealthAccount(
        params.payment.stealthAddress,
        params.destinationAccountId
      )
    } else {
      const claimBuild = buildClaimTransaction({
        stealthAccountId: params.payment.stealthAddress,
        destinationAccountId: params.destinationAccountId,
        amount: params.payment.amount,
      })
      actions = claimBuild.actions
    }

    return {
      stealthAccountId: params.payment.stealthAddress,
      stealthPrivateKey,
      actions,
      destinationAccountId: params.destinationAccountId,
    }
  }

  /**
   * Derive the private key for a stealth address
   *
   * @param stealthAddress - Stealth address object
   * @param spendingPrivateKey - Spending private key
   * @param viewingPrivateKey - Viewing private key
   * @returns Derived stealth address recovery with private key
   */
  deriveStealthPrivateKey(
    stealthAddress: StealthAddress,
    spendingPrivateKey: HexString,
    viewingPrivateKey: HexString
  ): { stealthAddress: HexString; ephemeralPublicKey: HexString; privateKey: HexString } {
    return deriveNEARStealthPrivateKey(
      stealthAddress,
      spendingPrivateKey,
      viewingPrivateKey
    )
  }

  // ─── State & Utilities ──────────────────────────────────────────────────────

  /**
   * Get adapter state
   */
  getState(): NEARPrivacyAdapterState {
    return {
      isInitialized: this.initialized,
      network: this.network,
      rpcUrl: this.rpcUrl,
      defaultPrivacyLevel: this.defaultPrivacyLevel,
      scannerRecipientCount: this.scanner.getRecipients().length,
    }
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl
  }

  /**
   * Get the network
   */
  getNetwork(): NEARPrivacyNetwork {
    return this.network
  }

  /**
   * Get explorer URL for a transaction
   */
  getTransactionExplorerUrl(txHash: string): string {
    return getExplorerUrl(txHash, this.network)
  }

  /**
   * Get the default RPC URL for a network
   */
  static getDefaultRpcUrl(network: NEARPrivacyNetwork): string {
    return NEAR_RPC_ENDPOINTS[network]
  }

  /**
   * Dispose of the adapter and clean up resources
   */
  dispose(): void {
    this.scanner.clearRecipients()
    this.initialized = false
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a new NEAR privacy adapter
 *
 * @param config - Adapter configuration
 * @returns Configured privacy adapter
 *
 * @example
 * ```typescript
 * const adapter = createNEARPrivacyAdapter({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   network: 'mainnet',
 *   defaultPrivacyLevel: 'shielded',
 * })
 * ```
 */
export function createNEARPrivacyAdapter(
  config: NEARPrivacyAdapterConfig
): NEARPrivacyAdapter {
  return new NEARPrivacyAdapter(config)
}

/**
 * Create a NEAR privacy adapter with default mainnet configuration
 *
 * @returns Configured privacy adapter for mainnet
 */
export function createMainnetNEARPrivacyAdapter(): NEARPrivacyAdapter {
  return new NEARPrivacyAdapter({
    rpcUrl: NEAR_RPC_ENDPOINTS.mainnet,
    network: 'mainnet',
  })
}

/**
 * Create a NEAR privacy adapter with default testnet configuration
 *
 * @returns Configured privacy adapter for testnet
 */
export function createTestnetNEARPrivacyAdapter(): NEARPrivacyAdapter {
  return new NEARPrivacyAdapter({
    rpcUrl: NEAR_RPC_ENDPOINTS.testnet,
    network: 'testnet',
  })
}
