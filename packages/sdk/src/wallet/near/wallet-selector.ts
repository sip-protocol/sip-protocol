/**
 * NEAR Wallet Selector Privacy Integration
 *
 * Integrates SIP privacy features with NEAR Wallet Selector,
 * enabling privacy transactions across all compatible wallets.
 *
 * @example Basic usage
 * ```typescript
 * import { setupWalletSelector } from '@near-wallet-selector/core'
 * import { setupModal } from '@near-wallet-selector/modal-ui'
 * import { createPrivacyWalletSelector } from '@sip-protocol/sdk'
 *
 * // Setup standard wallet selector
 * const selector = await setupWalletSelector({
 *   network: 'testnet',
 *   modules: [setupMyNearWallet(), setupMeteorWallet()],
 * })
 *
 * // Wrap with privacy support
 * const privacySelector = createPrivacyWalletSelector(selector, {
 *   network: 'testnet',
 * })
 *
 * // Generate stealth meta-address for receiving
 * const { metaAddress, encoded } = await privacySelector.generateStealthMetaAddress()
 *
 * // Send private transfer
 * const result = await privacySelector.sendPrivateTransfer({
 *   recipientMetaAddress: encoded,
 *   amount: '1000000000000000000000000', // 1 NEAR
 * })
 * ```
 *
 * @packageDocumentation
 */

import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { ed25519 } from '@noble/curves/ed25519'
import type { HexString, StealthMetaAddress, StealthAddress } from '@sip-protocol/types'
import type { NEARNetwork } from '../../chains/near/constants'
import {
  generateNEARStealthAddress,
  deriveNEARStealthPrivateKey,
  checkNEARStealthAddress,
  encodeNEARStealthMetaAddress,
  parseNEARStealthMetaAddress,
} from '../../chains/near/stealth'
import { buildPrivateTransfer } from '../../chains/near/implicit-account'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * NEAR Wallet Selector interface (minimal type for compatibility)
 * This matches the core interface from @near-wallet-selector/core
 */
export interface WalletSelector {
  /** Get the currently selected wallet */
  wallet(): Promise<Wallet | null>
  /** Check if connected */
  isSignedIn(): boolean
  /** Get account ID */
  getAccounts(): Promise<Array<{ accountId: string; publicKey?: string }>>
  /** Subscribe to state changes */
  on(event: string, callback: (state: unknown) => void): () => void
  /** Get current state */
  store: {
    getState(): WalletSelectorState
    observable: {
      subscribe(callback: (state: WalletSelectorState) => void): { unsubscribe(): void }
    }
  }
}

/**
 * Wallet Selector state
 */
export interface WalletSelectorState {
  accounts: Array<{ accountId: string; publicKey?: string }>
  selectedWalletId: string | null
}

/**
 * Wallet interface from Wallet Selector
 */
export interface Wallet {
  id: string
  type: string
  metadata: {
    name: string
    description?: string
    iconUrl?: string
  }
  signAndSendTransaction(params: SignAndSendTransactionParams): Promise<WalletTransactionResult>
  signAndSendTransactions?(params: SignAndSendTransactionsParams): Promise<WalletTransactionResult[]>
  signMessage?(params: SignMessageParams): Promise<SignedMessage>
}

/**
 * Transaction parameters for Wallet Selector
 */
export interface SignAndSendTransactionParams {
  signerId?: string
  receiverId: string
  actions: WalletAction[]
}

/**
 * Batch transaction parameters
 */
export interface SignAndSendTransactionsParams {
  transactions: SignAndSendTransactionParams[]
}

/**
 * Wallet action types
 */
export interface WalletAction {
  type: 'Transfer' | 'FunctionCall' | 'AddKey' | 'DeleteKey' | 'DeleteAccount'
  params: Record<string, unknown>
}

/**
 * Transaction result from wallet
 */
export interface WalletTransactionResult {
  transaction: {
    hash: string
    signerId: string
    receiverId: string
  }
  receipts?: unknown[]
}

/**
 * Sign message parameters
 */
export interface SignMessageParams {
  message: string
  recipient: string
  nonce: Buffer
}

/**
 * Signed message result
 */
export interface SignedMessage {
  signature: string
  publicKey: string
  accountId: string
}

/**
 * Privacy Wallet Selector configuration
 */
export interface PrivacyWalletSelectorConfig {
  /** NEAR network */
  network: NEARNetwork
  /** Custom RPC URL */
  rpcUrl?: string
  /** Auto-derive privacy keys on connect */
  autoDerive?: boolean
}

/**
 * Privacy key pair derived from wallet
 */
export interface PrivacyKeyPair {
  spendingPrivateKey: HexString
  spendingPublicKey: HexString
  viewingPrivateKey: HexString
  viewingPublicKey: HexString
  derivationLabel: string
}

/**
 * Stealth address result with account ID
 */
export interface StealthAddressResult {
  stealthAddress: StealthAddress
  stealthAccountId: string
  ephemeralPublicKey: HexString
}

/**
 * Private transfer parameters
 */
export interface PrivateTransferParams {
  /** Recipient's stealth meta-address (encoded or object) */
  recipientMetaAddress: string | StealthMetaAddress
  /** Amount in yoctoNEAR */
  amount: string | bigint
  /** Optional memo */
  memo?: string
}

/**
 * Private transfer result
 */
export interface PrivateTransferResult {
  /** Transaction hash */
  txHash: string
  /** Stealth address created */
  stealthAddress: StealthAddress
  /** Stealth account ID (implicit account) */
  stealthAccountId: string
  /** Announcement memo for recipient scanning */
  announcementMemo: string
}

/**
 * Wallet privacy capabilities
 */
export interface WalletPrivacyCapabilities {
  /** Wallet ID */
  walletId: string
  /** Wallet name */
  walletName: string
  /** Supports message signing (required for key derivation) */
  supportsMessageSigning: boolean
  /** Supports transaction signing */
  supportsTransactionSigning: boolean
  /** Supports batch transactions */
  supportsBatchTransactions: boolean
  /** Overall privacy support level */
  privacySupport: 'full' | 'partial' | 'none'
}

/**
 * Viewing key export
 */
export interface ViewingKeyExport {
  network: NEARNetwork
  viewingPublicKey: HexString
  viewingPrivateKey: HexString
  spendingPublicKey: HexString
  accountId: string
  createdAt: number
  label?: string
}

// ─── Privacy Wallet Selector ──────────────────────────────────────────────────

/**
 * Privacy-enhanced Wallet Selector wrapper
 *
 * Wraps the standard NEAR Wallet Selector to add privacy capabilities.
 */
export class PrivacyWalletSelector {
  private selector: WalletSelector
  private config: PrivacyWalletSelectorConfig
  private privacyKeys: PrivacyKeyPair | null = null
  private stealthAddresses: Map<string, StealthAddressResult> = new Map()
  private connectionListeners: Set<(connected: boolean) => void> = new Set()

  constructor(selector: WalletSelector, config: PrivacyWalletSelectorConfig) {
    this.selector = selector
    this.config = config

    // Subscribe to wallet selector state changes
    this.selector.store.observable.subscribe((state) => {
      const isConnected = state.accounts.length > 0
      this.connectionListeners.forEach((listener) => listener(isConnected))

      // Clear privacy keys on disconnect
      if (!isConnected) {
        this.privacyKeys = null
        this.stealthAddresses.clear()
      }
    })
  }

  // ─── Connection State ───────────────────────────────────────────────────────

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.selector.isSignedIn()
  }

  /**
   * Get connected account ID
   */
  async getAccountId(): Promise<string | null> {
    const accounts = await this.selector.getAccounts()
    return accounts[0]?.accountId ?? null
  }

  /**
   * Get connected wallet
   */
  async getWallet(): Promise<Wallet | null> {
    return this.selector.wallet()
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback)
    return () => this.connectionListeners.delete(callback)
  }

  // ─── Wallet Capabilities ────────────────────────────────────────────────────

  /**
   * Detect privacy capabilities of the current wallet
   */
  async detectCapabilities(): Promise<WalletPrivacyCapabilities | null> {
    const wallet = await this.selector.wallet()
    if (!wallet) return null

    const supportsMessageSigning = typeof wallet.signMessage === 'function'
    const supportsTransactionSigning = typeof wallet.signAndSendTransaction === 'function'
    const supportsBatchTransactions = typeof wallet.signAndSendTransactions === 'function'

    // Determine privacy support level
    let privacySupport: 'full' | 'partial' | 'none' = 'none'
    if (supportsMessageSigning && supportsTransactionSigning) {
      privacySupport = supportsBatchTransactions ? 'full' : 'partial'
    } else if (supportsTransactionSigning) {
      privacySupport = 'partial'
    }

    return {
      walletId: wallet.id,
      walletName: wallet.metadata.name,
      supportsMessageSigning,
      supportsTransactionSigning,
      supportsBatchTransactions,
      privacySupport,
    }
  }

  /**
   * Check if current wallet supports full privacy operations
   */
  async supportsPrivacy(): Promise<boolean> {
    const capabilities = await this.detectCapabilities()
    return capabilities?.privacySupport !== 'none'
  }

  // ─── Privacy Key Management ─────────────────────────────────────────────────

  /**
   * Derive privacy keys from wallet
   *
   * Uses message signing to deterministically derive privacy keys
   * without exposing the wallet's seed phrase.
   */
  async derivePrivacyKeys(label: string = 'default'): Promise<PrivacyKeyPair> {
    const wallet = await this.selector.wallet()
    if (!wallet) {
      throw new Error('No wallet connected')
    }

    if (!wallet.signMessage) {
      throw new Error('Wallet does not support message signing for key derivation')
    }

    const accountId = await this.getAccountId()
    if (!accountId) {
      throw new Error('No account connected')
    }

    // Create derivation message
    const derivationPath = `sip/near/${this.config.network}/${label}`
    const nonce = Buffer.from(sha256(new TextEncoder().encode(derivationPath)).slice(0, 32))

    // Sign the derivation message
    const signed = await wallet.signMessage({
      message: `SIP Privacy Key Derivation: ${derivationPath}`,
      recipient: accountId,
      nonce,
    })

    // Derive keys from signature
    const entropy = hexToBytes(signed.signature.replace(/^0x/, '').slice(0, 128))

    // Derive spending key
    const spendingEntropy = sha256(new Uint8Array([...entropy.slice(0, 32), 0x01]))
    const spendingPrivateKey = clampScalar(spendingEntropy)
    const spendingPublicKey = ed25519.getPublicKey(spendingPrivateKey)

    // Derive viewing key
    const viewingEntropy = sha256(new Uint8Array([...entropy.slice(32, 64), 0x02]))
    const viewingPrivateKey = clampScalar(viewingEntropy)
    const viewingPublicKey = ed25519.getPublicKey(viewingPrivateKey)

    const keyPair: PrivacyKeyPair = {
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      spendingPublicKey: `0x${bytesToHex(spendingPublicKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
      viewingPublicKey: `0x${bytesToHex(viewingPublicKey)}` as HexString,
      derivationLabel: label,
    }

    this.privacyKeys = keyPair
    return keyPair
  }

  /**
   * Check if privacy keys are derived
   */
  hasPrivacyKeys(): boolean {
    return this.privacyKeys !== null
  }

  /**
   * Get derived privacy keys
   */
  getPrivacyKeys(): PrivacyKeyPair | null {
    return this.privacyKeys
  }

  // ─── Stealth Address Operations ─────────────────────────────────────────────

  /**
   * Generate a stealth meta-address for receiving private payments
   */
  async generateStealthMetaAddress(label?: string): Promise<{
    metaAddress: StealthMetaAddress
    encoded: string
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
  }> {
    const keys = this.privacyKeys ?? await this.derivePrivacyKeys(label)

    const metaAddress: StealthMetaAddress = {
      chain: 'near',
      spendingKey: keys.spendingPublicKey,
      viewingKey: keys.viewingPublicKey,
    }

    const encoded = encodeNEARStealthMetaAddress(metaAddress)

    return {
      metaAddress,
      encoded,
      viewingPrivateKey: keys.viewingPrivateKey,
      spendingPrivateKey: keys.spendingPrivateKey,
    }
  }

  /**
   * Generate a one-time stealth address from a meta-address
   */
  generateStealthAddress(metaAddress: string | StealthMetaAddress): StealthAddressResult {
    const meta = typeof metaAddress === 'string'
      ? parseNEARStealthMetaAddress(metaAddress)
      : metaAddress

    const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(meta)

    const result: StealthAddressResult = {
      stealthAddress,
      stealthAccountId: implicitAccountId,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    }

    this.stealthAddresses.set(implicitAccountId, result)
    return result
  }

  /**
   * Check if a stealth address belongs to this wallet
   */
  async checkStealthAddress(stealthAddress: StealthAddress): Promise<boolean> {
    const keys = this.privacyKeys ?? await this.derivePrivacyKeys()

    return checkNEARStealthAddress(
      stealthAddress,
      keys.spendingPublicKey,
      keys.viewingPrivateKey
    )
  }

  /**
   * Derive private key for a stealth address
   */
  async deriveStealthPrivateKey(stealthAddress: StealthAddress): Promise<HexString> {
    const keys = this.privacyKeys ?? await this.derivePrivacyKeys()

    const isOwner = await this.checkStealthAddress(stealthAddress)
    if (!isOwner) {
      throw new Error('Stealth address does not belong to this wallet')
    }

    const recovery = deriveNEARStealthPrivateKey(
      stealthAddress,
      keys.spendingPrivateKey,
      keys.viewingPrivateKey
    )

    return recovery.privateKey
  }

  // ─── Private Transfers ──────────────────────────────────────────────────────

  /**
   * Send a private NEAR transfer
   */
  async sendPrivateTransfer(params: PrivateTransferParams): Promise<PrivateTransferResult> {
    const wallet = await this.selector.wallet()
    if (!wallet) {
      throw new Error('No wallet connected')
    }

    const accountId = await this.getAccountId()
    if (!accountId) {
      throw new Error('No account connected')
    }

    // Parse recipient meta-address
    const recipientMeta = typeof params.recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
      : params.recipientMetaAddress

    // Build the transfer (generates stealth address internally)
    const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
    const transfer = buildPrivateTransfer(recipientMeta, amount)

    // Get stealth address info from the transfer result
    const { stealthAddress, stealthAccountId: implicitAccountId, announcementMemo } = transfer

    // Convert actions to wallet selector format
    const walletActions: WalletAction[] = transfer.actions.map((action) => ({
      type: action.type,
      params: action.params as unknown as Record<string, unknown>,
    }))

    // Send transaction
    const result = await wallet.signAndSendTransaction({
      signerId: accountId,
      receiverId: implicitAccountId,
      actions: walletActions,
    })

    return {
      txHash: result.transaction.hash,
      stealthAddress,
      stealthAccountId: implicitAccountId,
      announcementMemo,
    }
  }

  /**
   * Send multiple private transfers in a batch
   */
  async sendBatchPrivateTransfers(
    transfers: PrivateTransferParams[]
  ): Promise<PrivateTransferResult[]> {
    const wallet = await this.selector.wallet()
    if (!wallet) {
      throw new Error('No wallet connected')
    }

    if (!wallet.signAndSendTransactions) {
      throw new Error('Wallet does not support batch transactions')
    }

    const accountId = await this.getAccountId()
    if (!accountId) {
      throw new Error('No account connected')
    }

    // Build all transfers
    const transactions: SignAndSendTransactionParams[] = []
    const transferResults: Array<{
      stealthAddress: StealthAddress
      stealthAccountId: string
      announcementMemo: string
    }> = []

    for (const params of transfers) {
      const recipientMeta = typeof params.recipientMetaAddress === 'string'
        ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
        : params.recipientMetaAddress

      const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
      const transfer = buildPrivateTransfer(recipientMeta, amount)

      const { stealthAddress, stealthAccountId, announcementMemo } = transfer

      const walletActions: WalletAction[] = transfer.actions.map((action) => ({
        type: action.type,
        params: action.params as unknown as Record<string, unknown>,
      }))

      transactions.push({
        signerId: accountId,
        receiverId: stealthAccountId,
        actions: walletActions,
      })

      transferResults.push({
        stealthAddress,
        stealthAccountId,
        announcementMemo,
      })
    }

    // Send batch
    const results = await wallet.signAndSendTransactions({ transactions })

    return results.map((result, index) => ({
      txHash: result.transaction.hash,
      ...transferResults[index],
    }))
  }

  // ─── Viewing Key Export ─────────────────────────────────────────────────────

  /**
   * Export viewing key for compliance/audit sharing
   */
  async exportViewingKey(label?: string): Promise<ViewingKeyExport> {
    const keys = this.privacyKeys ?? await this.derivePrivacyKeys(label)
    const accountId = await this.getAccountId()

    if (!accountId) {
      throw new Error('No account connected')
    }

    return {
      network: this.config.network,
      viewingPublicKey: keys.viewingPublicKey,
      viewingPrivateKey: keys.viewingPrivateKey,
      spendingPublicKey: keys.spendingPublicKey,
      accountId,
      createdAt: Date.now(),
      label,
    }
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────

  /**
   * Get all tracked stealth addresses
   */
  getStealthAddresses(): Map<string, StealthAddressResult> {
    return new Map(this.stealthAddresses)
  }

  /**
   * Get the underlying wallet selector
   */
  getSelector(): WalletSelector {
    return this.selector
  }

  /**
   * Get configuration
   */
  getConfig(): PrivacyWalletSelectorConfig {
    return { ...this.config }
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a privacy-enhanced wallet selector wrapper
 */
export function createPrivacyWalletSelector(
  selector: WalletSelector,
  config: PrivacyWalletSelectorConfig
): PrivacyWalletSelector {
  return new PrivacyWalletSelector(selector, config)
}

/**
 * Create privacy wallet selector for mainnet
 */
export function createMainnetPrivacySelector(
  selector: WalletSelector
): PrivacyWalletSelector {
  return new PrivacyWalletSelector(selector, { network: 'mainnet' })
}

/**
 * Create privacy wallet selector for testnet
 */
export function createTestnetPrivacySelector(
  selector: WalletSelector
): PrivacyWalletSelector {
  return new PrivacyWalletSelector(selector, { network: 'testnet' })
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Clamp a 32-byte scalar for ed25519
 */
function clampScalar(bytes: Uint8Array): Uint8Array {
  const clamped = new Uint8Array(bytes)
  clamped[0] &= 248
  clamped[31] &= 127
  clamped[31] |= 64
  return clamped
}
