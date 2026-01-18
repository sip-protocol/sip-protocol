/**
 * Solana Privacy Adapter
 *
 * Orchestrates privacy operations for Solana same-chain transactions.
 * Provides a unified interface for stealth transfers, scanning, and claiming.
 *
 * @module chains/solana/privacy-adapter
 */

import { Connection, PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js'
import type { StealthMetaAddress, HexString } from '@sip-protocol/types'
import {
  generateEd25519StealthAddress,
  decodeStealthMetaAddress,
  ed25519PublicKeyToSolanaAddress,
  generateEd25519StealthMetaAddress,
} from '../../stealth'
import { sendPrivateSPLTransfer, estimatePrivateTransferFee, hasTokenAccount } from './transfer'
import { scanForPayments, claimStealthPayment, getStealthBalance } from './scan'
import {
  StealthScanner,
  createStealthScanner,
  type ScanRecipient,
  type DetectedPayment,
  type HistoricalScanOptions,
} from './stealth-scanner'
import {
  generateEphemeralKeypair,
  generateManagedEphemeralKeypair,
  type EphemeralKeypair,
  type ManagedEphemeralKeypair,
} from './ephemeral-keys'
import { createProvider, type SolanaRPCProvider, type ProviderType, type ProviderConfig } from './providers'
import type {
  SolanaPrivateTransferResult,
  SolanaScanResult,
  SolanaClaimResult,
} from './types'
import type { SolanaCluster } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Configuration for SolanaPrivacyAdapter
 */
export interface SolanaPrivacyAdapterConfig {
  /**
   * Solana RPC connection
   */
  connection: Connection

  /**
   * Network cluster
   * @default 'mainnet-beta'
   */
  cluster?: SolanaCluster

  /**
   * Optional RPC provider for efficient queries
   */
  provider?: SolanaRPCProvider

  /**
   * Provider type to auto-create if provider not specified
   */
  providerType?: ProviderType

  /**
   * Provider configuration (API key, etc.)
   */
  providerConfig?: ProviderConfig
}

/**
 * Parameters for creating a shielded transfer
 */
export interface ShieldedTransferParams {
  /**
   * Sender's public key
   */
  sender: PublicKey

  /**
   * Sender's token account (ATA)
   */
  senderTokenAccount: PublicKey

  /**
   * Recipient's stealth meta-address
   * Can be a StealthMetaAddress object or encoded string (sip:solana:...)
   */
  recipient: StealthMetaAddress | string

  /**
   * SPL token mint address
   */
  mint: PublicKey

  /**
   * Amount to transfer (in token's smallest unit)
   */
  amount: bigint

  /**
   * Function to sign the transaction
   */
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
}

/**
 * Parameters for scanning with the adapter
 */
export interface AdapterScanParams {
  /**
   * Viewing private key (hex)
   */
  viewingPrivateKey: HexString

  /**
   * Spending public key (hex)
   */
  spendingPublicKey: HexString

  /**
   * Scan options (slots, limits, etc.)
   */
  options?: HistoricalScanOptions
}

/**
 * Parameters for claiming with the adapter
 */
export interface AdapterClaimParams {
  /**
   * Detected payment to claim
   */
  payment: DetectedPayment

  /**
   * Viewing private key (hex)
   */
  viewingPrivateKey: HexString

  /**
   * Spending private key (hex)
   */
  spendingPrivateKey: HexString

  /**
   * Destination address for claimed funds
   */
  destinationAddress: string
}

/**
 * Privacy adapter state
 */
export interface PrivacyAdapterState {
  /**
   * Whether the adapter is initialized
   */
  isInitialized: boolean

  /**
   * Current cluster
   */
  cluster: SolanaCluster

  /**
   * Whether a provider is available
   */
  hasProvider: boolean

  /**
   * Number of recipients in the scanner
   */
  scannerRecipientCount: number

  /**
   * Whether actively scanning (subscribed)
   */
  isScanning: boolean
}

// ─── SolanaPrivacyAdapter Class ───────────────────────────────────────────────

/**
 * Solana Privacy Adapter
 *
 * Provides a unified interface for privacy operations on Solana:
 * - Shielded transfers to stealth addresses
 * - Payment scanning and detection
 * - Claiming detected payments
 * - Meta-address and keypair generation
 *
 * @example Basic usage
 * ```typescript
 * const adapter = new SolanaPrivacyAdapter({
 *   connection,
 *   cluster: 'mainnet-beta',
 *   providerType: 'helius',
 *   providerConfig: { apiKey: '...' },
 * })
 *
 * // Generate meta-address for recipient
 * const { metaAddress, viewingPrivateKey, spendingPrivateKey } =
 *   adapter.generateMetaAddress('Primary Wallet')
 *
 * // Send shielded transfer
 * const result = await adapter.sendShieldedTransfer({
 *   sender: wallet.publicKey,
 *   senderTokenAccount: walletATA,
 *   recipient: recipientMetaAddress,
 *   mint: USDC_MINT,
 *   amount: 5_000_000n,
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * // Scan for incoming payments
 * const payments = await adapter.scanForPayments({
 *   viewingPrivateKey,
 *   spendingPublicKey: metaAddress.spendingKey,
 * })
 * ```
 *
 * @example Real-time scanning
 * ```typescript
 * // Add recipient for scanning
 * adapter.addScanRecipient({
 *   viewingPrivateKey,
 *   spendingPublicKey,
 *   label: 'Main Wallet',
 * })
 *
 * // Subscribe to real-time payments
 * adapter.subscribeToPayments(
 *   (payment) => console.log('Received:', payment),
 *   (error) => console.error('Error:', error)
 * )
 *
 * // Later: stop scanning
 * await adapter.unsubscribeFromPayments()
 * ```
 */
export class SolanaPrivacyAdapter {
  private connection: Connection
  private cluster: SolanaCluster
  private provider?: SolanaRPCProvider
  private scanner: StealthScanner
  private initialized: boolean = false

  constructor(config: SolanaPrivacyAdapterConfig) {
    this.connection = config.connection
    this.cluster = config.cluster ?? 'mainnet-beta'

    // Initialize provider
    if (config.provider) {
      this.provider = config.provider
    } else if (config.providerType && config.providerConfig) {
      this.provider = createProvider(config.providerType, config.providerConfig)
    }

    // Initialize scanner
    this.scanner = createStealthScanner({
      connection: this.connection,
      provider: this.provider,
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
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
  } {
    const result = generateEd25519StealthMetaAddress('solana', label)
    return {
      metaAddress: result.metaAddress,
      viewingPrivateKey: result.viewingPrivateKey,
      spendingPrivateKey: result.spendingPrivateKey,
    }
  }

  /**
   * Parse an encoded meta-address string
   *
   * @param encoded - Encoded meta-address (sip:solana:...)
   * @returns Decoded meta-address
   */
  parseMetaAddress(encoded: string): StealthMetaAddress {
    return decodeStealthMetaAddress(encoded)
  }

  // ─── Ephemeral Keys ─────────────────────────────────────────────────────────

  /**
   * Generate an ephemeral keypair for a single transfer
   *
   * @returns Ephemeral keypair
   */
  generateEphemeralKeypair(): EphemeralKeypair {
    return generateEphemeralKeypair()
  }

  /**
   * Generate a managed ephemeral keypair with auto-disposal
   *
   * @returns Managed ephemeral keypair
   */
  generateManagedEphemeralKeypair(): ManagedEphemeralKeypair {
    return generateManagedEphemeralKeypair()
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
    stealthAddress: string
    stealthAddressHex: HexString
    ephemeralPublicKey: string
    ephemeralPublicKeyHex: HexString
    viewTag: number
    sharedSecret: HexString
  } {
    const metaAddress = typeof recipient === 'string'
      ? decodeStealthMetaAddress(recipient)
      : recipient

    const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(metaAddress)

    const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralPublicKeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    return {
      stealthAddress: stealthAddressBase58,
      stealthAddressHex: stealthAddress.address,
      ephemeralPublicKey: ephemeralPublicKeyBase58,
      ephemeralPublicKeyHex: stealthAddress.ephemeralPublicKey,
      viewTag: stealthAddress.viewTag,
      sharedSecret,
    }
  }

  // ─── Shielded Transfers ─────────────────────────────────────────────────────

  /**
   * Send a shielded SPL token transfer
   *
   * Transfers tokens to a stealth address with on-chain announcement
   * for recipient scanning.
   *
   * @param params - Transfer parameters
   * @returns Transfer result
   */
  async sendShieldedTransfer(
    params: ShieldedTransferParams
  ): Promise<SolanaPrivateTransferResult> {
    const recipient = typeof params.recipient === 'string'
      ? decodeStealthMetaAddress(params.recipient)
      : params.recipient

    return sendPrivateSPLTransfer({
      connection: this.connection,
      sender: params.sender,
      senderTokenAccount: params.senderTokenAccount,
      recipientMetaAddress: recipient,
      mint: params.mint,
      amount: params.amount,
      signTransaction: params.signTransaction,
    })
  }

  /**
   * Estimate fee for a shielded transfer
   *
   * @param needsATACreation - Whether ATA needs to be created
   * @returns Estimated fee in lamports
   */
  async estimateTransferFee(needsATACreation: boolean = true): Promise<bigint> {
    return estimatePrivateTransferFee(this.connection, needsATACreation)
  }

  /**
   * Check if a stealth address has a token account
   *
   * @param stealthAddress - Stealth address (base58)
   * @param mint - Token mint
   * @returns True if token account exists
   */
  async hasTokenAccount(stealthAddress: string, mint: PublicKey): Promise<boolean> {
    return hasTokenAccount(this.connection, stealthAddress, mint)
  }

  // ─── Payment Scanning ───────────────────────────────────────────────────────

  /**
   * Scan for incoming stealth payments (one-time)
   *
   * @param params - Scan parameters
   * @returns Detected payments
   */
  async scanForPayments(params: AdapterScanParams): Promise<SolanaScanResult[]> {
    return scanForPayments({
      connection: this.connection,
      viewingPrivateKey: params.viewingPrivateKey,
      spendingPublicKey: params.spendingPublicKey,
      provider: this.provider,
      fromSlot: params.options?.fromSlot,
      toSlot: params.options?.toSlot,
      limit: params.options?.limit,
    })
  }

  /**
   * Add a recipient to the continuous scanner
   *
   * @param recipient - Recipient keys and label
   */
  addScanRecipient(recipient: ScanRecipient): void {
    this.scanner.addRecipient(recipient)
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
   * Get all scan recipients
   */
  getScanRecipients(): ScanRecipient[] {
    return this.scanner.getRecipients()
  }

  /**
   * Clear all scan recipients
   */
  clearScanRecipients(): void {
    this.scanner.clearRecipients()
  }

  /**
   * Scan historical transactions
   *
   * @param options - Scan options
   * @returns Scan result with detected payments
   */
  async scanHistorical(options?: HistoricalScanOptions) {
    return this.scanner.scanHistorical(options)
  }

  /**
   * Subscribe to real-time payment detection
   *
   * @param onPayment - Callback for detected payments
   * @param onError - Callback for errors
   */
  subscribeToPayments(
    onPayment: (payment: DetectedPayment) => void,
    onError?: (error: Error) => void
  ): void {
    this.scanner.subscribe(onPayment, onError)
  }

  /**
   * Unsubscribe from real-time payments
   */
  async unsubscribeFromPayments(): Promise<void> {
    await this.scanner.unsubscribe()
  }

  /**
   * Check if currently subscribed to payments
   */
  isSubscribedToPayments(): boolean {
    return this.scanner.isSubscribed()
  }

  // ─── Payment Claiming ───────────────────────────────────────────────────────

  /**
   * Claim a detected payment
   *
   * Derives the stealth private key and transfers funds to the destination.
   *
   * @param params - Claim parameters
   * @returns Claim result
   */
  async claimPayment(params: AdapterClaimParams): Promise<SolanaClaimResult> {
    return claimStealthPayment({
      connection: this.connection,
      stealthAddress: params.payment.stealthAddress,
      ephemeralPublicKey: params.payment.ephemeralPublicKey,
      viewingPrivateKey: params.viewingPrivateKey,
      spendingPrivateKey: params.spendingPrivateKey,
      destinationAddress: params.destinationAddress,
      mint: new PublicKey(params.payment.mint),
    })
  }

  /**
   * Get balance for a stealth address
   *
   * @param stealthAddress - Stealth address (base58)
   * @param mint - Token mint
   * @returns Token balance
   */
  async getStealthBalance(stealthAddress: string, mint: PublicKey): Promise<bigint> {
    return getStealthBalance(this.connection, stealthAddress, mint, this.provider)
  }

  // ─── State & Utilities ──────────────────────────────────────────────────────

  /**
   * Get adapter state
   */
  getState(): PrivacyAdapterState {
    return {
      isInitialized: this.initialized,
      cluster: this.cluster,
      hasProvider: !!this.provider,
      scannerRecipientCount: this.scanner.getRecipients().length,
      isScanning: this.scanner.isSubscribed(),
    }
  }

  /**
   * Get the underlying connection
   */
  getConnection(): Connection {
    return this.connection
  }

  /**
   * Get the RPC provider (if configured)
   */
  getProvider(): SolanaRPCProvider | undefined {
    return this.provider
  }

  /**
   * Get the current cluster
   */
  getCluster(): SolanaCluster {
    return this.cluster
  }

  /**
   * Dispose of the adapter and clean up resources
   */
  async dispose(): Promise<void> {
    await this.scanner.unsubscribe()
    this.scanner.clearRecipients()
    this.initialized = false
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a new Solana privacy adapter
 *
 * @param config - Adapter configuration
 * @returns Configured privacy adapter
 *
 * @example
 * ```typescript
 * const adapter = createSolanaPrivacyAdapter({
 *   connection: new Connection('https://api.mainnet-beta.solana.com'),
 *   cluster: 'mainnet-beta',
 *   providerType: 'helius',
 *   providerConfig: { apiKey: process.env.HELIUS_API_KEY },
 * })
 * ```
 */
export function createSolanaPrivacyAdapter(
  config: SolanaPrivacyAdapterConfig
): SolanaPrivacyAdapter {
  return new SolanaPrivacyAdapter(config)
}
