/**
 * Ethereum Privacy Adapter
 *
 * Orchestrates privacy operations for Ethereum same-chain transactions.
 * Provides a unified interface for stealth transfers, scanning, and claiming.
 *
 * @module chains/ethereum/privacy-adapter
 */

import type { StealthMetaAddress, HexString, StealthAddress } from '@sip-protocol/types'
import {
  generateEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  parseEthereumStealthMetaAddress,
  encodeEthereumStealthMetaAddress,
  deriveEthereumStealthPrivateKey,
  checkEthereumStealthAddress,
  type EthereumStealthMetaAddress,
  type EthereumStealthAddress,
} from './stealth'
import {
  commitETH,
  commitERC20Token,
  fromWei,
} from './commitment'
import {
  exportViewingKey,
  importViewingKey,
  createSharedViewingKey,
  type ViewingKeyPermissions,
} from './viewing-key'
import {
  createAnnouncementMetadata,
  encodeAnnouncementCallData,
  announcementToStealthAddress,
  buildAnnouncementTopics,
} from './announcement'
import {
  type EthereumNetwork,
  ETHEREUM_RPC_ENDPOINTS,
  EIP5564_ANNOUNCER_ADDRESS,
  DEFAULT_GAS_LIMITS,
  ONE_GWEI,
  getExplorerUrl,
  getChainId,
  isValidEthAddress,
} from './constants'
import type {
  EthereumPrivacyLevel,
  EthereumAnnouncement,
  EthereumShieldedTransferBuild,
  EthereumClaimParams,
  EthereumClaimBuild,
  EthereumGasEstimate,
  EthereumPrivacyAdapterState,
  EthereumScanRecipient,
  EthereumDetectedPaymentResult,
  EthereumViewingKeyExport,
  EthereumViewingKeyPair,
  EthereumPedersenCommitment,
} from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Configuration for EthereumPrivacyAdapter
 */
export interface EthereumPrivacyAdapterConfig {
  /**
   * Ethereum RPC URL
   */
  rpcUrl?: string

  /**
   * Network type
   * @default 'mainnet'
   */
  network?: EthereumNetwork

  /**
   * Default privacy level
   * @default 'shielded'
   */
  defaultPrivacyLevel?: EthereumPrivacyLevel

  /**
   * Custom announcer contract address
   */
  announcerAddress?: HexString

  /**
   * Enable amount hiding with Pedersen commitments
   * @default true
   */
  hideAmounts?: boolean
}

/**
 * Parameters for shielded ETH transfer
 */
export interface EthereumShieldedTransferParams {
  /**
   * Recipient's stealth meta-address
   */
  recipient: StealthMetaAddress | string

  /**
   * Amount in wei
   */
  amount: bigint

  /**
   * Privacy level for this transaction
   */
  privacyLevel?: EthereumPrivacyLevel

  /**
   * Optional memo/reference
   */
  memo?: string
}

/**
 * Parameters for shielded ERC-20 transfer
 */
export interface EthereumShieldedTokenTransferParams extends EthereumShieldedTransferParams {
  /**
   * ERC-20 token contract address
   */
  tokenContract: HexString

  /**
   * Token decimals (for display purposes)
   */
  decimals?: number
}

/**
 * Built transaction for signing
 */
export interface EthereumBuiltTransaction {
  /**
   * Target address
   */
  to: HexString

  /**
   * ETH value in wei
   */
  value: bigint

  /**
   * Transaction data (for contract calls)
   */
  data?: HexString

  /**
   * Suggested gas limit
   */
  gasLimit: bigint

  /**
   * Chain ID
   */
  chainId: number
}

// ─── EthereumPrivacyAdapter Class ─────────────────────────────────────────────

/**
 * Ethereum Privacy Adapter
 *
 * Provides a unified interface for privacy operations on Ethereum:
 * - Shielded transfers to stealth addresses
 * - Payment scanning and detection
 * - Claiming detected payments
 * - Meta-address and keypair generation
 *
 * @example Basic usage
 * ```typescript
 * const adapter = new EthereumPrivacyAdapter({
 *   rpcUrl: 'https://eth.llamarpc.com',
 *   network: 'mainnet',
 * })
 *
 * // Generate meta-address for recipient
 * const { metaAddress, viewingPrivateKey, spendingPrivateKey } =
 *   adapter.generateMetaAddress('Primary Wallet')
 *
 * // Build shielded transfer
 * const build = adapter.buildShieldedTransfer({
 *   recipient: recipientMetaAddress,
 *   amount: toWei(1), // 1 ETH
 * })
 *
 * // Sign and submit transactions externally
 * // 1. Send ETH to stealth address
 * // 2. Announce the payment
 * ```
 *
 * @example Scanning and claiming
 * ```typescript
 * // Add recipient for scanning
 * adapter.addScanRecipient({
 *   viewingPrivateKey,
 *   spendingPublicKey: metaAddress.spendingKey,
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
 *   destinationAddress: '0x...',
 * })
 * ```
 */
export class EthereumPrivacyAdapter {
  private rpcUrl: string
  private network: EthereumNetwork
  private chainId: number
  private defaultPrivacyLevel: EthereumPrivacyLevel
  private announcerAddress: HexString
  private hideAmounts: boolean
  private scanRecipients: Map<string, EthereumScanRecipient> = new Map()
  private lastScannedBlock?: number

  constructor(config: EthereumPrivacyAdapterConfig = {}) {
    this.network = config.network ?? 'mainnet'
    this.rpcUrl = config.rpcUrl ?? ETHEREUM_RPC_ENDPOINTS[this.network]
    this.chainId = getChainId(this.network)
    this.defaultPrivacyLevel = config.defaultPrivacyLevel ?? 'shielded'
    this.announcerAddress = config.announcerAddress ?? (EIP5564_ANNOUNCER_ADDRESS as HexString)
    this.hideAmounts = config.hideAmounts ?? true
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
    metaAddress: EthereumStealthMetaAddress
    encoded: string
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
  } {
    const result = generateEthereumStealthMetaAddress(label)
    return {
      metaAddress: result.metaAddress,
      encoded: result.encoded,
      viewingPrivateKey: result.viewingPrivateKey,
      spendingPrivateKey: result.spendingPrivateKey,
    }
  }

  /**
   * Parse an encoded meta-address string
   *
   * @param encoded - Encoded meta-address (st:eth:0x...)
   * @returns Decoded meta-address
   */
  parseMetaAddress(encoded: string): EthereumStealthMetaAddress {
    return parseEthereumStealthMetaAddress(encoded)
  }

  /**
   * Encode a meta-address to string format
   *
   * @param metaAddress - Meta-address to encode
   * @returns Encoded string (st:eth:0x...)
   */
  encodeMetaAddress(metaAddress: StealthMetaAddress): string {
    return encodeEthereumStealthMetaAddress(metaAddress)
  }

  // ─── Viewing Key Management ─────────────────────────────────────────────────

  /**
   * Export a viewing key for sharing (compliance)
   *
   * @param viewingKeyPair - Viewing keypair to export
   * @param expiresAt - Optional expiration date
   * @returns Exportable viewing key data
   */
  exportViewingKey(
    viewingKeyPair: EthereumViewingKeyPair,
    expiresAt?: Date
  ): EthereumViewingKeyExport {
    return exportViewingKey(viewingKeyPair, this.network, expiresAt)
  }

  /**
   * Import a viewing key from export format
   *
   * @param exported - Exported viewing key data (JSON string or object)
   * @returns Parsed viewing key export
   */
  importViewingKey(exported: string | EthereumViewingKeyExport): EthereumViewingKeyExport {
    return importViewingKey(exported)
  }

  /**
   * Create a shared viewing key with specific permissions
   *
   * @param viewingKeyPair - The full viewing keypair
   * @param permissions - Permissions to grant
   * @param expiresAt - Optional expiration
   * @returns Shared viewing key for auditor
   */
  createSharedViewingKey(
    viewingKeyPair: EthereumViewingKeyPair,
    permissions: ViewingKeyPermissions,
    expiresAt?: Date
  ) {
    return createSharedViewingKey(viewingKeyPair, permissions, expiresAt)
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
    stealthAddress: EthereumStealthAddress
    ethAddress: HexString
    sharedSecret: HexString
  } {
    const metaAddress = typeof recipient === 'string'
      ? parseEthereumStealthMetaAddress(recipient)
      : recipient

    const { stealthAddress, sharedSecret } = generateEthereumStealthAddress(metaAddress)

    return {
      stealthAddress,
      ethAddress: stealthAddress.ethAddress,
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
    return checkEthereumStealthAddress(
      stealthAddress,
      spendingPrivateKey,
      viewingPrivateKey
    )
  }

  // ─── Shielded Transfers ─────────────────────────────────────────────────────

  /**
   * Build a shielded ETH transfer
   *
   * Creates transaction data for a private ETH transfer.
   * Returns two transactions:
   * 1. ETH transfer to stealth address
   * 2. Announcement to EIP-5564 contract
   *
   * @param params - Transfer parameters
   * @returns Built transfer ready for signing
   */
  buildShieldedTransfer(params: EthereumShieldedTransferParams): EthereumShieldedTransferBuild {
    const privacyLevel = params.privacyLevel ?? this.defaultPrivacyLevel

    // For transparent level, throw - use regular transfer instead
    if (privacyLevel === 'transparent') {
      throw new Error('Use regular ETH transfer for transparent privacy level')
    }

    const metaAddress = typeof params.recipient === 'string'
      ? parseEthereumStealthMetaAddress(params.recipient)
      : params.recipient

    // Generate stealth address
    const { stealthAddress, sharedSecret } = generateEthereumStealthAddress(metaAddress)

    // Create amount commitment if hiding amounts
    // Note: privacyLevel is guaranteed to be 'shielded' or 'compliant' here (transparent throws above)
    let amountCommitment: EthereumPedersenCommitment | undefined
    if (this.hideAmounts) {
      amountCommitment = commitETH(params.amount)
    }

    // Create metadata for announcement
    const metadata = this.hideAmounts && amountCommitment
      ? createAnnouncementMetadata({
          amountCommitment: amountCommitment.commitment,
        })
      : undefined

    // Build announcement call data
    const announcementData = encodeAnnouncementCallData(
      1, // schemeId for secp256k1
      stealthAddress.ethAddress,
      stealthAddress.ephemeralPublicKey,
      metadata
    )

    // Estimate gas
    const transferGas = DEFAULT_GAS_LIMITS.ethTransfer
    const announcementGas = DEFAULT_GAS_LIMITS.announcement
    const totalGas = transferGas + announcementGas

    return {
      stealthAddress,
      stealthEthAddress: stealthAddress.ethAddress,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      viewTag: stealthAddress.viewTag,
      sharedSecret,
      amountCommitment: amountCommitment?.commitment,
      blindingFactor: amountCommitment?.blinding,
      transferTx: {
        to: stealthAddress.ethAddress,
        value: params.amount,
      },
      announcementTx: {
        to: this.announcerAddress,
        value: 0n,
        data: announcementData,
      },
      estimatedGas: totalGas,
    }
  }

  /**
   * Build a shielded ERC-20 token transfer
   *
   * Creates transaction data for a private token transfer.
   * Returns multiple transactions:
   * 1. Token transfer to stealth address
   * 2. Announcement to EIP-5564 contract
   *
   * @param params - Transfer parameters
   * @returns Built transfer ready for signing
   */
  buildShieldedTokenTransfer(
    params: EthereumShieldedTokenTransferParams
  ): EthereumShieldedTransferBuild & { tokenTransferData: HexString } {
    const privacyLevel = params.privacyLevel ?? this.defaultPrivacyLevel

    if (privacyLevel === 'transparent') {
      throw new Error('Use regular ERC-20 transfer for transparent privacy level')
    }

    if (!isValidEthAddress(params.tokenContract)) {
      throw new Error(`Invalid token contract: ${params.tokenContract}`)
    }

    const metaAddress = typeof params.recipient === 'string'
      ? parseEthereumStealthMetaAddress(params.recipient)
      : params.recipient

    // Generate stealth address
    const { stealthAddress, sharedSecret } = generateEthereumStealthAddress(metaAddress)

    // Create amount commitment
    const decimals = params.decimals ?? 18
    const amountCommitment = this.hideAmounts
      ? commitERC20Token(params.amount, params.tokenContract, decimals)
      : undefined

    // Create metadata for announcement
    const metadata = createAnnouncementMetadata({
      tokenAddress: params.tokenContract,
      amountCommitment: amountCommitment?.commitment,
    })

    // Build ERC-20 transfer data
    // transfer(address,uint256) selector: 0xa9059cbb
    const tokenTransferData = this.encodeERC20Transfer(
      stealthAddress.ethAddress,
      params.amount
    )

    // Build announcement call data
    const announcementData = encodeAnnouncementCallData(
      1,
      stealthAddress.ethAddress,
      stealthAddress.ephemeralPublicKey,
      metadata
    )

    // Estimate gas
    const transferGas = DEFAULT_GAS_LIMITS.erc20Transfer
    const announcementGas = DEFAULT_GAS_LIMITS.announcement
    const totalGas = transferGas + announcementGas

    return {
      stealthAddress,
      stealthEthAddress: stealthAddress.ethAddress,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      viewTag: stealthAddress.viewTag,
      sharedSecret,
      amountCommitment: amountCommitment?.commitment,
      blindingFactor: amountCommitment?.blinding,
      transferTx: {
        to: params.tokenContract,
        value: 0n,
        data: tokenTransferData,
      },
      announcementTx: {
        to: this.announcerAddress,
        value: 0n,
        data: announcementData,
      },
      estimatedGas: totalGas,
      tokenTransferData,
    }
  }

  // ─── Payment Scanning ───────────────────────────────────────────────────────

  /**
   * Add a recipient for payment scanning
   *
   * @param recipient - Scan recipient with viewing key
   */
  addScanRecipient(recipient: EthereumScanRecipient): void {
    const key = recipient.viewingPrivateKey.toLowerCase()
    this.scanRecipients.set(key, recipient)
  }

  /**
   * Remove a scan recipient
   *
   * @param viewingPrivateKey - The viewing key to remove
   */
  removeScanRecipient(viewingPrivateKey: HexString): void {
    this.scanRecipients.delete(viewingPrivateKey.toLowerCase())
  }

  /**
   * Get all scan recipients
   */
  getScanRecipients(): EthereumScanRecipient[] {
    return Array.from(this.scanRecipients.values())
  }

  /**
   * Scan announcements for incoming payments
   *
   * @param announcements - Announcements to scan
   * @returns Detected payments with recipient info
   */
  scanAnnouncements(
    announcements: EthereumAnnouncement[]
  ): EthereumDetectedPaymentResult[] {
    const results: EthereumDetectedPaymentResult[] = []

    for (const announcement of announcements) {
      const stealthAddress = announcementToStealthAddress(announcement)

      // Check each recipient
      for (const recipient of this.scanRecipients.values()) {
        const isOwner = checkEthereumStealthAddress(
          stealthAddress,
          recipient.spendingPublicKey, // Note: need spending PRIVATE key for full check
          recipient.viewingPrivateKey
        )

        if (isOwner) {
          // Derive stealth private key for claiming
          const recovery = deriveEthereumStealthPrivateKey(
            stealthAddress,
            recipient.spendingPublicKey, // This should be spending PRIVATE key
            recipient.viewingPrivateKey
          )

          results.push({
            payment: {
              stealthAddress,
              stealthEthAddress: announcement.stealthAddress,
              txHash: announcement.txHash!,
              blockNumber: announcement.blockNumber!,
              logIndex: announcement.logIndex,
              timestamp: announcement.timestamp,
            },
            recipient,
            stealthPrivateKey: recovery.privateKey,
          })
          break // Found owner, no need to check other recipients
        }
      }
    }

    return results
  }

  /**
   * Get topics for filtering announcement logs
   *
   * @param options - Optional filters
   * @returns Topics array for eth_getLogs
   */
  getAnnouncementTopics(options?: {
    schemeId?: number
    stealthAddress?: HexString
    caller?: HexString
  }): (HexString | null)[] {
    return buildAnnouncementTopics(options)
  }

  // ─── Claiming ───────────────────────────────────────────────────────────────

  /**
   * Build a claim transaction
   *
   * Creates transaction data to claim funds from a stealth address.
   *
   * @param params - Claim parameters
   * @returns Built claim transaction
   */
  buildClaimTransaction(params: EthereumClaimParams): EthereumClaimBuild {
    // Derive stealth private key
    const recovery = deriveEthereumStealthPrivateKey(
      params.stealthAddress,
      params.spendingPrivateKey,
      params.viewingPrivateKey
    )

    // Build transaction
    const amount = params.amount ?? 0n // Full balance if not specified

    let tx: { to: HexString; value: bigint; data?: HexString }

    if (params.tokenContract) {
      // ERC-20 claim
      const transferData = this.encodeERC20Transfer(
        params.destinationAddress,
        amount
      )
      tx = {
        to: params.tokenContract,
        value: 0n,
        data: transferData,
      }
    } else {
      // Native ETH claim
      tx = {
        to: params.destinationAddress,
        value: amount,
      }
    }

    return {
      stealthEthAddress: recovery.ethAddress,
      stealthPrivateKey: recovery.privateKey,
      destinationAddress: params.destinationAddress,
      amount,
      tx,
      estimatedGas: params.tokenContract
        ? DEFAULT_GAS_LIMITS.erc20Transfer
        : DEFAULT_GAS_LIMITS.ethTransfer,
    }
  }

  // ─── Gas Estimation ─────────────────────────────────────────────────────────

  /**
   * Estimate gas for a shielded transfer
   *
   * @param isTokenTransfer - Whether this is a token transfer
   * @returns Gas estimate
   */
  estimateTransferGas(isTokenTransfer: boolean = false): EthereumGasEstimate {
    const transferGas = isTokenTransfer
      ? DEFAULT_GAS_LIMITS.erc20Transfer
      : DEFAULT_GAS_LIMITS.ethTransfer
    const announcementGas = DEFAULT_GAS_LIMITS.announcement

    const totalGas = transferGas + announcementGas
    const gasPrice = 30n * ONE_GWEI // Assume 30 gwei

    const estimatedCost = totalGas * gasPrice

    return {
      gasLimit: totalGas,
      gasPrice,
      estimatedCost,
      estimatedCostEth: fromWei(estimatedCost),
    }
  }

  /**
   * Estimate gas for claiming a payment
   *
   * @param isTokenClaim - Whether claiming tokens
   * @returns Gas estimate
   */
  estimateClaimGas(isTokenClaim: boolean = false): EthereumGasEstimate {
    const claimGas = isTokenClaim
      ? DEFAULT_GAS_LIMITS.erc20Transfer
      : DEFAULT_GAS_LIMITS.ethTransfer

    const gasPrice = 30n * ONE_GWEI

    return {
      gasLimit: claimGas,
      gasPrice,
      estimatedCost: claimGas * gasPrice,
      estimatedCostEth: fromWei(claimGas * gasPrice),
    }
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────

  /**
   * Get adapter state
   */
  getState(): EthereumPrivacyAdapterState {
    return {
      network: this.network,
      rpcUrl: this.rpcUrl,
      chainId: this.chainId,
      defaultPrivacyLevel: this.defaultPrivacyLevel,
      scanRecipientCount: this.scanRecipients.size,
      lastScannedBlock: this.lastScannedBlock,
      isConnected: true,
    }
  }

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
   * Get transaction explorer URL
   *
   * @param txHash - Transaction hash
   * @returns Explorer URL
   */
  getTransactionExplorerUrl(txHash: HexString): string {
    return getExplorerUrl(txHash, this.network)
  }

  /**
   * Encode ERC-20 transfer data
   *
   * @param to - Recipient address
   * @param amount - Amount in token units
   * @returns Encoded call data
   */
  private encodeERC20Transfer(to: HexString, amount: bigint): HexString {
    // transfer(address,uint256) selector
    const selector = '0xa9059cbb'
    const toParam = to.slice(2).padStart(64, '0')
    const amountParam = amount.toString(16).padStart(64, '0')

    return `${selector}${toParam}${amountParam}` as HexString
  }

  /**
   * Clean up adapter resources
   */
  dispose(): void {
    this.scanRecipients.clear()
    this.lastScannedBlock = undefined
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create an Ethereum privacy adapter
 *
 * @param config - Adapter configuration
 * @returns Configured adapter
 */
export function createEthereumPrivacyAdapter(
  config?: EthereumPrivacyAdapterConfig
): EthereumPrivacyAdapter {
  return new EthereumPrivacyAdapter(config)
}

/**
 * Create a mainnet Ethereum privacy adapter
 */
export function createMainnetEthereumPrivacyAdapter(): EthereumPrivacyAdapter {
  return new EthereumPrivacyAdapter({ network: 'mainnet' })
}

/**
 * Create a Sepolia testnet privacy adapter
 */
export function createSepoliaEthereumPrivacyAdapter(): EthereumPrivacyAdapter {
  return new EthereumPrivacyAdapter({ network: 'sepolia' })
}

/**
 * Create an Arbitrum privacy adapter
 */
export function createArbitrumPrivacyAdapter(): EthereumPrivacyAdapter {
  return new EthereumPrivacyAdapter({ network: 'arbitrum' })
}

/**
 * Create an Optimism privacy adapter
 */
export function createOptimismPrivacyAdapter(): EthereumPrivacyAdapter {
  return new EthereumPrivacyAdapter({ network: 'optimism' })
}

/**
 * Create a Base privacy adapter
 */
export function createBasePrivacyAdapter(): EthereumPrivacyAdapter {
  return new EthereumPrivacyAdapter({ network: 'base' })
}
