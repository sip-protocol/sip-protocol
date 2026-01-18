/**
 * Meteor Wallet Privacy Integration
 *
 * Specific integration for Meteor wallet with privacy transaction support.
 * Handles both browser extension and mobile deep link signing flows.
 *
 * @example Browser extension usage
 * ```typescript
 * import { MeteorWalletPrivacy } from '@sip-protocol/sdk'
 *
 * const wallet = new MeteorWalletPrivacy({
 *   network: 'mainnet',
 * })
 *
 * // Connect via extension
 * await wallet.connect()
 *
 * // Send private transfer
 * await wallet.sendPrivateTransfer({
 *   recipientMetaAddress: 'sip:near:0x...',
 *   amount: '1000000000000000000000000',
 * })
 * ```
 *
 * @example Mobile deep link usage
 * ```typescript
 * const wallet = new MeteorWalletPrivacy({
 *   network: 'mainnet',
 *   callbackUrl: 'myapp://callback',
 * })
 *
 * // Get deep link for mobile signing
 * const deepLink = wallet.getPrivateTransferDeepLink({
 *   recipientMetaAddress: 'sip:near:0x...',
 *   amount: '1000000000000000000000000',
 * })
 *
 * // Open in mobile app
 * window.location.href = deepLink
 * ```
 *
 * @packageDocumentation
 */

import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'
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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Meteor wallet deep link scheme */
export const METEOR_DEEP_LINK_SCHEME = 'meteorwallet://'

/** Meteor wallet mainnet app link */
export const METEOR_APP_LINK_MAINNET = 'https://app.meteorwallet.app'

/** Meteor wallet testnet app link */
export const METEOR_APP_LINK_TESTNET = 'https://testnet.meteorwallet.app'

/** Meteor wallet provider key in window object */
export const METEOR_PROVIDER_KEY = 'meteorWallet'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Meteor wallet provider interface (injected in browser extension)
 */
export interface MeteorWalletProvider {
  /** Check if connected */
  isConnected(): Promise<boolean>
  /** Request connection */
  requestSignIn(options?: {
    contractId?: string
    methodNames?: string[]
  }): Promise<{
    accountId: string
    publicKey: string
  }>
  /** Sign out */
  signOut(): Promise<void>
  /** Get account ID */
  getAccountId(): Promise<string | null>
  /** Sign and send transaction */
  signAndSendTransaction(params: {
    receiverId: string
    actions: Array<{
      type: string
      params: Record<string, unknown>
    }>
  }): Promise<{
    transactionHash: string
  }>
  /** Sign and send multiple transactions */
  signAndSendTransactions(params: {
    transactions: Array<{
      receiverId: string
      actions: Array<{
        type: string
        params: Record<string, unknown>
      }>
    }>
  }): Promise<Array<{ transactionHash: string }>>
  /** Sign message */
  signMessage(params: {
    message: string
    recipient?: string
    nonce?: Uint8Array
  }): Promise<{
    signature: string
    publicKey: string
    accountId: string
  }>
  /** Simulate transaction */
  simulateTransaction?(params: {
    receiverId: string
    actions: Array<{
      type: string
      params: Record<string, unknown>
    }>
  }): Promise<{
    success: boolean
    gasUsed: string
    result?: unknown
    error?: string
  }>
}

/**
 * Meteor wallet configuration
 */
export interface MeteorWalletConfig {
  /** NEAR network */
  network: NEARNetwork
  /** Callback URL for mobile deep links (optional) */
  callbackUrl?: string
  /** Contract ID for function calls (optional) */
  contractId?: string
  /** Prefer extension over mobile if both available */
  preferExtension?: boolean
}

/**
 * Connection state
 */
export type MeteorConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'signing'
  | 'error'

/**
 * Signing mode
 */
export type MeteorSigningMode = 'extension' | 'deeplink' | 'unknown'

/**
 * Privacy key pair
 */
export interface MeteorPrivacyKeys {
  spendingPrivateKey: HexString
  spendingPublicKey: HexString
  viewingPrivateKey: HexString
  viewingPublicKey: HexString
  derivedFrom: 'signature' | 'secret'
}

/**
 * Private transfer parameters
 */
export interface MeteorPrivateTransferParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: string | StealthMetaAddress
  /** Amount in yoctoNEAR */
  amount: string | bigint
  /** Optional memo */
  memo?: string
  /** Optional label for tracking */
  label?: string
}

/**
 * Transaction simulation result
 */
export interface TransactionSimulation {
  /** Would succeed */
  success: boolean
  /** Estimated gas used */
  gasUsed: string
  /** Formatted gas cost in NEAR */
  gasCostNEAR: string
  /** Result data (if successful) */
  result?: unknown
  /** Error message (if failed) */
  error?: string
}

/**
 * Transaction result
 */
export interface MeteorTransactionResult {
  /** Transaction hash */
  transactionHash: string
  /** Stealth account ID */
  stealthAccountId: string
  /** Announcement memo */
  announcementMemo: string
  /** Success status */
  success: boolean
}

/**
 * Multi-account info
 */
export interface MeteorAccountInfo {
  accountId: string
  publicKey: string
  hasPrivacyKeys: boolean
}

/**
 * Meteor-specific error codes
 */
export enum MeteorErrorCode {
  USER_REJECTED = 'USER_REJECTED',
  NOT_CONNECTED = 'NOT_CONNECTED',
  EXTENSION_NOT_FOUND = 'EXTENSION_NOT_FOUND',
  INVALID_PARAMS = 'INVALID_PARAMS',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  SIGNING_FAILED = 'SIGNING_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Meteor wallet error
 */
export class MeteorWalletError extends Error {
  constructor(
    message: string,
    public readonly code: MeteorErrorCode,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'MeteorWalletError'
  }
}

// ─── Meteor Wallet Privacy Class ──────────────────────────────────────────────

/**
 * Meteor Wallet Privacy Integration
 *
 * Provides privacy transaction support for Meteor wallet.
 */
export class MeteorWalletPrivacy {
  private config: MeteorWalletConfig
  private connectionState: MeteorConnectionState = 'disconnected'
  private signingMode: MeteorSigningMode = 'unknown'
  private accountId: string | null = null
  private publicKey: string | null = null
  private privacyKeys: MeteorPrivacyKeys | null = null
  private accounts: Map<string, MeteorAccountInfo> = new Map()
  private provider: MeteorWalletProvider | null = null

  constructor(config: MeteorWalletConfig) {
    this.config = {
      preferExtension: true,
      ...config,
    }

    // Try to get extension provider if in browser
    if (typeof window !== 'undefined') {
      this.provider = (window as unknown as Record<string, unknown>)[METEOR_PROVIDER_KEY] as MeteorWalletProvider | null ?? null
    }
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  /**
   * Check if extension is available
   */
  isExtensionAvailable(): boolean {
    return this.provider !== null
  }

  /**
   * Get signing mode
   */
  getSigningMode(): MeteorSigningMode {
    return this.signingMode
  }

  /**
   * Connect via extension
   */
  async connectExtension(): Promise<void> {
    if (!this.provider) {
      throw new MeteorWalletError(
        'Meteor wallet extension not found',
        MeteorErrorCode.EXTENSION_NOT_FOUND
      )
    }

    this.connectionState = 'connecting'
    this.signingMode = 'extension'

    try {
      const result = await this.provider.requestSignIn({
        contractId: this.config.contractId,
      })

      this.accountId = result.accountId
      this.publicKey = result.publicKey
      this.connectionState = 'connected'

      // Track account
      this.accounts.set(result.accountId, {
        accountId: result.accountId,
        publicKey: result.publicKey,
        hasPrivacyKeys: false,
      })
    } catch (error) {
      this.connectionState = 'error'
      throw this.wrapError(error)
    }
  }

  /**
   * Connect (auto-detect mode)
   */
  async connect(): Promise<void> {
    // Prefer extension if available and configured
    if (this.config.preferExtension && this.provider) {
      return this.connectExtension()
    }

    // Fall back to extension if available
    if (this.provider) {
      return this.connectExtension()
    }

    // No extension, must use deep links
    if (!this.config.callbackUrl) {
      throw new MeteorWalletError(
        'No extension available and no callback URL configured for deep links',
        MeteorErrorCode.EXTENSION_NOT_FOUND
      )
    }

    this.signingMode = 'deeplink'
    throw new MeteorWalletError(
      'Deep link connection requires redirect. Use getConnectDeepLink() instead.',
      MeteorErrorCode.INVALID_PARAMS
    )
  }

  /**
   * Get deep link for connection (mobile)
   */
  getConnectDeepLink(): string {
    if (!this.config.callbackUrl) {
      throw new MeteorWalletError(
        'Callback URL required for deep links',
        MeteorErrorCode.INVALID_PARAMS
      )
    }

    const params = new URLSearchParams({
      network: this.config.network,
      callback: this.config.callbackUrl,
    })

    if (this.config.contractId) {
      params.set('contractId', this.config.contractId)
    }

    return `${METEOR_DEEP_LINK_SCHEME}connect?${params.toString()}`
  }

  /**
   * Handle deep link callback
   */
  handleDeepLinkCallback(params: URLSearchParams): boolean {
    const accountId = params.get('accountId')
    const publicKey = params.get('publicKey')
    const error = params.get('error')

    if (error) {
      this.connectionState = 'error'
      return false
    }

    if (accountId) {
      this.accountId = accountId
      this.publicKey = publicKey
      this.connectionState = 'connected'
      this.signingMode = 'deeplink'

      this.accounts.set(accountId, {
        accountId,
        publicKey: publicKey ?? '',
        hasPrivacyKeys: false,
      })

      return true
    }

    this.connectionState = 'error'
    return false
  }

  /**
   * Set connection manually (for restoring from storage)
   */
  setConnection(
    accountId: string,
    publicKey?: string,
    mode: MeteorSigningMode = 'unknown'
  ): void {
    this.accountId = accountId
    this.publicKey = publicKey ?? null
    this.connectionState = 'connected'
    this.signingMode = mode

    this.accounts.set(accountId, {
      accountId,
      publicKey: publicKey ?? '',
      hasPrivacyKeys: this.privacyKeys !== null,
    })
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    if (this.provider && this.signingMode === 'extension') {
      try {
        await this.provider.signOut()
      } catch {
        // Ignore sign out errors
      }
    }

    this.accountId = null
    this.publicKey = null
    this.privacyKeys = null
    this.connectionState = 'disconnected'
    this.signingMode = 'unknown'
    this.accounts.clear()
  }

  /**
   * Get connection state
   */
  getConnectionState(): MeteorConnectionState {
    return this.connectionState
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.accountId !== null
  }

  /**
   * Get account ID
   */
  getAccountId(): string | null {
    return this.accountId
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this.publicKey
  }

  // ─── Multi-Account Support ──────────────────────────────────────────────────

  /**
   * Get all connected accounts
   */
  getAccounts(): MeteorAccountInfo[] {
    return Array.from(this.accounts.values())
  }

  /**
   * Switch active account
   */
  switchAccount(accountId: string): void {
    const account = this.accounts.get(accountId)
    if (!account) {
      throw new MeteorWalletError(
        `Account ${accountId} not found`,
        MeteorErrorCode.INVALID_PARAMS
      )
    }

    this.accountId = account.accountId
    this.publicKey = account.publicKey
    this.privacyKeys = null // Reset privacy keys for new account
  }

  /**
   * Add account
   */
  addAccount(accountId: string, publicKey: string): void {
    this.accounts.set(accountId, {
      accountId,
      publicKey,
      hasPrivacyKeys: false,
    })
  }

  // ─── Privacy Key Management ─────────────────────────────────────────────────

  /**
   * Derive privacy keys from signature (more secure)
   */
  async derivePrivacyKeysFromSignature(
    message: string = 'SIP Privacy Key Derivation'
  ): Promise<MeteorPrivacyKeys> {
    if (!this.accountId) {
      throw new MeteorWalletError(
        'Not connected to Meteor wallet',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    if (!this.provider) {
      throw new MeteorWalletError(
        'Extension required for signature-based key derivation',
        MeteorErrorCode.EXTENSION_NOT_FOUND
      )
    }

    try {
      const nonce = new Uint8Array(32)
      if (typeof crypto !== 'undefined') {
        crypto.getRandomValues(nonce)
      }

      const result = await this.provider.signMessage({
        message: `${message}:${this.accountId}:${this.config.network}`,
        nonce,
      })

      // Use signature as entropy for key derivation
      const signatureBytes = hexToBytes(result.signature)
      const entropy = sha256(signatureBytes)

      return this.deriveKeysFromEntropy(entropy, 'signature')
    } catch (error) {
      throw this.wrapError(error)
    }
  }

  /**
   * Derive privacy keys from secret (works for both modes)
   */
  derivePrivacyKeysFromSecret(secret: string): MeteorPrivacyKeys {
    if (!this.accountId) {
      throw new MeteorWalletError(
        'Not connected to Meteor wallet',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    // Create deterministic entropy from account + secret
    const derivationPath = `sip/meteor/${this.config.network}/${this.accountId}`
    const entropy = sha256(
      new TextEncoder().encode(`${derivationPath}:${secret}`)
    )

    return this.deriveKeysFromEntropy(entropy, 'secret')
  }

  /**
   * Internal: derive keys from entropy
   */
  private deriveKeysFromEntropy(
    entropy: Uint8Array,
    derivedFrom: 'signature' | 'secret'
  ): MeteorPrivacyKeys {
    // Derive spending key
    const spendingEntropy = sha256(new Uint8Array([...entropy, 0x01]))
    const spendingPrivateKey = clampScalar(spendingEntropy)
    const spendingPublicKey = ed25519.getPublicKey(spendingPrivateKey)

    // Derive viewing key
    const viewingEntropy = sha256(new Uint8Array([...entropy, 0x02]))
    const viewingPrivateKey = clampScalar(viewingEntropy)
    const viewingPublicKey = ed25519.getPublicKey(viewingPrivateKey)

    const keys: MeteorPrivacyKeys = {
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      spendingPublicKey: `0x${bytesToHex(spendingPublicKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
      viewingPublicKey: `0x${bytesToHex(viewingPublicKey)}` as HexString,
      derivedFrom,
    }

    this.privacyKeys = keys

    // Update account info
    if (this.accountId) {
      const account = this.accounts.get(this.accountId)
      if (account) {
        account.hasPrivacyKeys = true
      }
    }

    return keys
  }

  /**
   * Check if privacy keys are derived
   */
  hasPrivacyKeys(): boolean {
    return this.privacyKeys !== null
  }

  /**
   * Get privacy keys
   */
  getPrivacyKeys(): MeteorPrivacyKeys | null {
    return this.privacyKeys
  }

  // ─── Stealth Address Operations ─────────────────────────────────────────────

  /**
   * Generate stealth meta-address
   */
  generateStealthMetaAddress(label?: string): {
    metaAddress: StealthMetaAddress
    encoded: string
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
  } {
    if (!this.privacyKeys) {
      throw new MeteorWalletError(
        'Privacy keys not derived',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    const metaAddress: StealthMetaAddress = {
      chain: 'near',
      spendingKey: this.privacyKeys.spendingPublicKey,
      viewingKey: this.privacyKeys.viewingPublicKey,
      label,
    }

    const encoded = encodeNEARStealthMetaAddress(metaAddress)

    return {
      metaAddress,
      encoded,
      viewingPrivateKey: this.privacyKeys.viewingPrivateKey,
      spendingPrivateKey: this.privacyKeys.spendingPrivateKey,
    }
  }

  /**
   * Generate stealth address for receiving
   */
  generateStealthAddress(metaAddress: string | StealthMetaAddress): {
    stealthAddress: StealthAddress
    stealthAccountId: string
    ephemeralPublicKey: HexString
  } {
    const meta = typeof metaAddress === 'string'
      ? parseNEARStealthMetaAddress(metaAddress)
      : metaAddress

    const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(meta)

    return {
      stealthAddress,
      stealthAccountId: implicitAccountId,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    }
  }

  /**
   * Check stealth address ownership
   */
  checkStealthAddress(stealthAddress: StealthAddress): boolean {
    if (!this.privacyKeys) {
      throw new MeteorWalletError(
        'Privacy keys not derived',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    return checkNEARStealthAddress(
      stealthAddress,
      this.privacyKeys.spendingPrivateKey,
      this.privacyKeys.viewingPrivateKey
    )
  }

  /**
   * Derive stealth private key
   */
  deriveStealthPrivateKey(stealthAddress: StealthAddress): HexString {
    if (!this.privacyKeys) {
      throw new MeteorWalletError(
        'Privacy keys not derived',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    const isOwner = this.checkStealthAddress(stealthAddress)
    if (!isOwner) {
      throw new MeteorWalletError(
        'Stealth address does not belong to this wallet',
        MeteorErrorCode.INVALID_PARAMS
      )
    }

    const recovery = deriveNEARStealthPrivateKey(
      stealthAddress,
      this.privacyKeys.spendingPrivateKey,
      this.privacyKeys.viewingPrivateKey
    )

    return recovery.privateKey
  }

  // ─── Transaction Simulation ─────────────────────────────────────────────────

  /**
   * Simulate a private transfer (if supported by extension)
   */
  async simulatePrivateTransfer(
    params: MeteorPrivateTransferParams
  ): Promise<TransactionSimulation> {
    if (!this.accountId) {
      throw new MeteorWalletError(
        'Not connected to Meteor wallet',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    if (!this.provider?.simulateTransaction) {
      // Return estimated simulation if not supported
      return {
        success: true,
        gasUsed: '30000000000000', // ~30 TGas estimate
        gasCostNEAR: '0.003',
        result: undefined,
        error: undefined,
      }
    }

    const recipientMeta = typeof params.recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
      : params.recipientMetaAddress

    const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
    const transfer = buildPrivateTransfer(recipientMeta, amount)

    try {
      const result = await this.provider.simulateTransaction({
        receiverId: transfer.stealthAccountId,
        actions: transfer.actions.map((action) => ({
          type: action.type,
          params: serializeParams(action.params as unknown as Record<string, unknown>),
        })),
      })

      return {
        success: result.success,
        gasUsed: result.gasUsed,
        gasCostNEAR: formatGasCost(BigInt(result.gasUsed)),
        result: result.result,
        error: result.error,
      }
    } catch (error) {
      throw new MeteorWalletError(
        'Transaction simulation failed',
        MeteorErrorCode.SIMULATION_FAILED,
        error
      )
    }
  }

  // ─── Private Transfers (Extension) ──────────────────────────────────────────

  /**
   * Send private transfer via extension
   */
  async sendPrivateTransfer(
    params: MeteorPrivateTransferParams
  ): Promise<MeteorTransactionResult> {
    if (!this.accountId) {
      throw new MeteorWalletError(
        'Not connected to Meteor wallet',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    if (!this.provider) {
      throw new MeteorWalletError(
        'Extension required for sendPrivateTransfer. Use getPrivateTransferDeepLink() for mobile.',
        MeteorErrorCode.EXTENSION_NOT_FOUND
      )
    }

    const recipientMeta = typeof params.recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
      : params.recipientMetaAddress

    const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
    const transfer = buildPrivateTransfer(recipientMeta, amount)

    this.connectionState = 'signing'

    try {
      const result = await this.provider.signAndSendTransaction({
        receiverId: transfer.stealthAccountId,
        actions: transfer.actions.map((action) => ({
          type: action.type,
          params: serializeParams(action.params as unknown as Record<string, unknown>),
        })),
      })

      this.connectionState = 'connected'

      return {
        transactionHash: result.transactionHash,
        stealthAccountId: transfer.stealthAccountId,
        announcementMemo: transfer.announcementMemo,
        success: true,
      }
    } catch (error) {
      this.connectionState = 'connected'
      throw this.wrapError(error)
    }
  }

  /**
   * Send batch private transfers via extension
   */
  async sendBatchPrivateTransfers(
    transfers: MeteorPrivateTransferParams[]
  ): Promise<MeteorTransactionResult[]> {
    if (!this.accountId) {
      throw new MeteorWalletError(
        'Not connected to Meteor wallet',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    if (!this.provider) {
      throw new MeteorWalletError(
        'Extension required for sendBatchPrivateTransfers',
        MeteorErrorCode.EXTENSION_NOT_FOUND
      )
    }

    const transactions = transfers.map((params) => {
      const recipientMeta = typeof params.recipientMetaAddress === 'string'
        ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
        : params.recipientMetaAddress

      const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
      return buildPrivateTransfer(recipientMeta, amount)
    })

    this.connectionState = 'signing'

    try {
      const results = await this.provider.signAndSendTransactions({
        transactions: transactions.map((transfer) => ({
          receiverId: transfer.stealthAccountId,
          actions: transfer.actions.map((action) => ({
            type: action.type,
            params: serializeParams(action.params as unknown as Record<string, unknown>),
          })),
        })),
      })

      this.connectionState = 'connected'

      return results.map((result, index) => ({
        transactionHash: result.transactionHash,
        stealthAccountId: transactions[index].stealthAccountId,
        announcementMemo: transactions[index].announcementMemo,
        success: true,
      }))
    } catch (error) {
      this.connectionState = 'connected'
      throw this.wrapError(error)
    }
  }

  // ─── Private Transfers (Deep Link) ──────────────────────────────────────────

  /**
   * Get deep link for private transfer (mobile)
   */
  getPrivateTransferDeepLink(params: MeteorPrivateTransferParams): string {
    if (!this.accountId) {
      throw new MeteorWalletError(
        'Not connected to Meteor wallet',
        MeteorErrorCode.NOT_CONNECTED
      )
    }

    if (!this.config.callbackUrl) {
      throw new MeteorWalletError(
        'Callback URL required for deep links',
        MeteorErrorCode.INVALID_PARAMS
      )
    }

    const recipientMeta = typeof params.recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
      : params.recipientMetaAddress

    const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
    const transfer = buildPrivateTransfer(recipientMeta, amount)

    const urlParams = new URLSearchParams({
      signerId: this.accountId,
      receiverId: transfer.stealthAccountId,
      callback: this.config.callbackUrl,
      network: this.config.network,
      actions: JSON.stringify(transfer.actions.map((action) => ({
        type: action.type,
        ...serializeParams(action.params as unknown as Record<string, unknown>),
      }))),
      meta: JSON.stringify({
        isPrivate: true,
        stealthAccountId: transfer.stealthAccountId,
        announcementMemo: transfer.announcementMemo,
        label: params.label,
      }),
    })

    return `${METEOR_DEEP_LINK_SCHEME}sign?${urlParams.toString()}`
  }

  /**
   * Get app link for private transfer (universal link)
   */
  getPrivateTransferAppLink(params: MeteorPrivateTransferParams): string {
    const appBase = this.config.network === 'mainnet'
      ? METEOR_APP_LINK_MAINNET
      : METEOR_APP_LINK_TESTNET

    const deepLink = this.getPrivateTransferDeepLink(params)
    return `${appBase}/sign?link=${encodeURIComponent(deepLink)}`
  }

  /**
   * Handle deep link transaction callback
   */
  handleTransactionCallback(params: URLSearchParams): MeteorTransactionResult {
    this.connectionState = 'connected'

    const transactionHash = params.get('transactionHash')
    const stealthAccountId = params.get('stealthAccountId')
    const announcementMemo = params.get('announcementMemo')
    const error = params.get('error')

    if (error) {
      throw new MeteorWalletError(
        error,
        MeteorErrorCode.TRANSACTION_FAILED
      )
    }

    return {
      transactionHash: transactionHash ?? '',
      stealthAccountId: stealthAccountId ?? '',
      announcementMemo: announcementMemo ?? '',
      success: !!transactionHash,
    }
  }

  // ─── Stealth Address Display ────────────────────────────────────────────────

  /**
   * Format stealth account ID for display
   */
  formatStealthAccountId(accountId: string): string {
    if (accountId.length !== 64) {
      return accountId
    }
    return `${accountId.slice(0, 8)}...${accountId.slice(-8)}`
  }

  /**
   * Get explorer URL for stealth account
   */
  getStealthAccountExplorerUrl(accountId: string): string {
    const baseUrl = this.config.network === 'mainnet'
      ? 'https://nearblocks.io/address'
      : 'https://testnet.nearblocks.io/address'
    return `${baseUrl}/${accountId}`
  }

  // ─── Error Handling ─────────────────────────────────────────────────────────

  /**
   * Wrap errors in MeteorWalletError
   */
  private wrapError(error: unknown): MeteorWalletError {
    if (error instanceof MeteorWalletError) {
      return error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Map common error patterns to codes
    if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
      return new MeteorWalletError(errorMessage, MeteorErrorCode.USER_REJECTED, error)
    }
    if (errorMessage.includes('not connected') || errorMessage.includes('Not connected')) {
      return new MeteorWalletError(errorMessage, MeteorErrorCode.NOT_CONNECTED, error)
    }
    if (errorMessage.includes('network') || errorMessage.includes('Network')) {
      return new MeteorWalletError(errorMessage, MeteorErrorCode.NETWORK_ERROR, error)
    }

    return new MeteorWalletError(errorMessage, MeteorErrorCode.UNKNOWN, error)
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────

  /**
   * Get config
   */
  getConfig(): MeteorWalletConfig {
    return { ...this.config }
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create Meteor wallet privacy integration
 */
export function createMeteorWalletPrivacy(
  config: MeteorWalletConfig
): MeteorWalletPrivacy {
  return new MeteorWalletPrivacy(config)
}

/**
 * Create mainnet Meteor wallet integration
 */
export function createMainnetMeteorWallet(
  callbackUrl?: string
): MeteorWalletPrivacy {
  return new MeteorWalletPrivacy({
    network: 'mainnet',
    callbackUrl,
  })
}

/**
 * Create testnet Meteor wallet integration
 */
export function createTestnetMeteorWallet(
  callbackUrl?: string
): MeteorWalletPrivacy {
  return new MeteorWalletPrivacy({
    network: 'testnet',
    callbackUrl,
  })
}

/**
 * Detect if Meteor wallet is available
 */
export function isMeteorWalletAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (window as unknown as Record<string, unknown>)[METEOR_PROVIDER_KEY] !== undefined
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Clamp scalar for ed25519
 */
function clampScalar(bytes: Uint8Array): Uint8Array {
  const clamped = new Uint8Array(bytes)
  clamped[0] &= 248
  clamped[31] &= 127
  clamped[31] |= 64
  return clamped
}

/**
 * Convert hex string to bytes (without 0x prefix handling)
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Serialize action params for URL encoding / JSON
 */
function serializeParams(params: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'bigint') {
      serialized[key] = value.toString()
    } else if (value instanceof Uint8Array) {
      serialized[key] = bytesToHex(value)
    } else {
      serialized[key] = value
    }
  }

  return serialized
}

/**
 * Format gas cost in NEAR
 */
function formatGasCost(gas: bigint): string {
  // 1 TGas = 0.0001 NEAR at 100 Tgas/NEAR price
  const nearAmount = Number(gas) / 1e12 * 0.0001
  return nearAmount.toFixed(6)
}
