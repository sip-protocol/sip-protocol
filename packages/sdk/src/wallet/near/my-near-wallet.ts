/**
 * MyNearWallet Privacy Integration
 *
 * Specific integration for MyNearWallet with privacy transaction support.
 * Handles URL-based transaction signing and callback processing.
 *
 * @example Basic usage
 * ```typescript
 * import { MyNearWalletPrivacy } from '@sip-protocol/sdk'
 *
 * const wallet = new MyNearWalletPrivacy({
 *   network: 'mainnet',
 *   callbackUrl: 'https://myapp.com/callback',
 * })
 *
 * // Connect to wallet
 * await wallet.connect()
 *
 * // Send private transfer (redirects to MyNearWallet)
 * await wallet.sendPrivateTransfer({
 *   recipientMetaAddress: 'sip:near:0x...',
 *   amount: '1000000000000000000000000',
 * })
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

/** MyNearWallet mainnet URL */
export const MY_NEAR_WALLET_MAINNET = 'https://app.mynearwallet.com'

/** MyNearWallet testnet URL */
export const MY_NEAR_WALLET_TESTNET = 'https://testnet.mynearwallet.com'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * MyNearWallet configuration
 */
export interface MyNearWalletConfig {
  /** NEAR network */
  network: NEARNetwork
  /** Callback URL after signing */
  callbackUrl: string
  /** Custom wallet URL (optional) */
  walletUrl?: string
  /** Contract ID for function calls (optional) */
  contractId?: string
}

/**
 * Connection state
 */
export type MyNearWalletConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'signing'
  | 'error'

/**
 * Privacy key pair
 */
export interface MyNearWalletPrivacyKeys {
  spendingPrivateKey: HexString
  spendingPublicKey: HexString
  viewingPrivateKey: HexString
  viewingPublicKey: HexString
  derivationLabel: string
}

/**
 * Stealth address with metadata
 */
export interface MyNearWalletStealthAddress {
  stealthAddress: StealthAddress
  stealthAccountId: string
  ephemeralPublicKey: HexString
  createdAt: number
  label?: string
}

/**
 * Private transfer parameters
 */
export interface MyNearWalletPrivateTransferParams {
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
 * Transaction preview data
 */
export interface TransactionPreview {
  /** Sender account ID */
  senderId: string
  /** Receiver (stealth account ID) */
  receiverId: string
  /** Amount in NEAR (formatted) */
  amountNEAR: string
  /** Amount in yoctoNEAR */
  amountYocto: string
  /** Is this a privacy transaction */
  isPrivate: true
  /** Stealth address info */
  stealthInfo: {
    stealthAccountId: string
    announcementMemo: string
    viewTag: number
  }
  /** Actions to execute */
  actions: Array<{
    type: string
    params: Record<string, unknown>
  }>
}

/**
 * Callback result from MyNearWallet
 */
export interface MyNearWalletCallbackResult {
  /** Transaction hash (if successful) */
  transactionHashes?: string
  /** Error code (if failed) */
  errorCode?: string
  /** Error message (if failed) */
  errorMessage?: string
  /** Account ID that signed */
  accountId?: string
}

/**
 * Viewing key export
 */
export interface MyNearWalletViewingKeyExport {
  network: NEARNetwork
  viewingPublicKey: HexString
  viewingPrivateKey: HexString
  spendingPublicKey: HexString
  accountId: string
  createdAt: number
  label?: string
  walletType: 'mynearwallet'
}

/**
 * Ledger integration status
 */
export interface LedgerStatus {
  isLedger: boolean
  ledgerPath?: string
  requiresLedgerConfirmation: boolean
}

// ─── MyNearWallet Privacy Class ───────────────────────────────────────────────

/**
 * MyNearWallet Privacy Integration
 *
 * Provides privacy transaction support for MyNearWallet.
 */
export class MyNearWalletPrivacy {
  private config: MyNearWalletConfig
  private walletUrl: string
  private connectionState: MyNearWalletConnectionState = 'disconnected'
  private accountId: string | null = null
  private publicKey: string | null = null
  private privacyKeys: MyNearWalletPrivacyKeys | null = null
  private stealthAddresses: Map<string, MyNearWalletStealthAddress> = new Map()
  private isLedger: boolean = false

  constructor(config: MyNearWalletConfig) {
    this.config = config
    this.walletUrl = config.walletUrl ?? (
      config.network === 'mainnet'
        ? MY_NEAR_WALLET_MAINNET
        : MY_NEAR_WALLET_TESTNET
    )
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  /**
   * Get wallet URL for signing in
   */
  getSignInUrl(options?: {
    successUrl?: string
    failureUrl?: string
  }): string {
    const params = new URLSearchParams({
      success_url: options?.successUrl ?? this.config.callbackUrl,
      failure_url: options?.failureUrl ?? this.config.callbackUrl,
    })

    if (this.config.contractId) {
      params.set('contract_id', this.config.contractId)
    }

    return `${this.walletUrl}/login?${params.toString()}`
  }

  /**
   * Connect by redirecting to MyNearWallet
   */
  connect(options?: {
    successUrl?: string
    failureUrl?: string
  }): void {
    this.connectionState = 'connecting'

    if (typeof window !== 'undefined') {
      window.location.href = this.getSignInUrl(options)
    } else {
      throw new Error('MyNearWallet connect requires browser environment')
    }
  }

  /**
   * Handle callback from MyNearWallet login
   */
  handleLoginCallback(callbackParams: URLSearchParams): boolean {
    const accountId = callbackParams.get('account_id')
    const publicKey = callbackParams.get('public_key')
    const allKeys = callbackParams.get('all_keys')

    if (accountId) {
      this.accountId = accountId
      this.publicKey = publicKey
      this.connectionState = 'connected'

      // Check if using Ledger
      if (allKeys) {
        try {
          const keys = JSON.parse(allKeys)
          this.isLedger = keys.some((k: string) => k.includes('ledger'))
        } catch {
          this.isLedger = false
        }
      }

      return true
    }

    this.connectionState = 'error'
    return false
  }

  /**
   * Set connection from stored credentials
   */
  setConnection(accountId: string, publicKey?: string): void {
    this.accountId = accountId
    this.publicKey = publicKey ?? null
    this.connectionState = 'connected'
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.accountId = null
    this.publicKey = null
    this.privacyKeys = null
    this.stealthAddresses.clear()
    this.connectionState = 'disconnected'
    this.isLedger = false
  }

  /**
   * Get connection state
   */
  getConnectionState(): MyNearWalletConnectionState {
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

  /**
   * Get Ledger status
   */
  getLedgerStatus(): LedgerStatus {
    return {
      isLedger: this.isLedger,
      requiresLedgerConfirmation: this.isLedger,
    }
  }

  // ─── Privacy Key Management ─────────────────────────────────────────────────

  /**
   * Derive privacy keys
   *
   * Note: MyNearWallet doesn't support message signing directly,
   * so we use a deterministic derivation from account ID + secret.
   */
  derivePrivacyKeys(secret: string, label: string = 'default'): MyNearWalletPrivacyKeys {
    if (!this.accountId) {
      throw new Error('Not connected to MyNearWallet')
    }

    // Create deterministic entropy from account + secret + label
    const derivationPath = `sip/mynearwallet/${this.config.network}/${this.accountId}/${label}`
    const entropy = sha256(
      new TextEncoder().encode(`${derivationPath}:${secret}`)
    )

    // Derive spending key
    const spendingEntropy = sha256(new Uint8Array([...entropy, 0x01]))
    const spendingPrivateKey = clampScalar(spendingEntropy)
    const spendingPublicKey = ed25519.getPublicKey(spendingPrivateKey)

    // Derive viewing key
    const viewingEntropy = sha256(new Uint8Array([...entropy, 0x02]))
    const viewingPrivateKey = clampScalar(viewingEntropy)
    const viewingPublicKey = ed25519.getPublicKey(viewingPrivateKey)

    const keys: MyNearWalletPrivacyKeys = {
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      spendingPublicKey: `0x${bytesToHex(spendingPublicKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
      viewingPublicKey: `0x${bytesToHex(viewingPublicKey)}` as HexString,
      derivationLabel: label,
    }

    this.privacyKeys = keys
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
  getPrivacyKeys(): MyNearWalletPrivacyKeys | null {
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
      throw new Error('Privacy keys not derived. Call derivePrivacyKeys first.')
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
  generateStealthAddress(
    metaAddress: string | StealthMetaAddress,
    label?: string
  ): MyNearWalletStealthAddress {
    const meta = typeof metaAddress === 'string'
      ? parseNEARStealthMetaAddress(metaAddress)
      : metaAddress

    const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(meta)

    const result: MyNearWalletStealthAddress = {
      stealthAddress,
      stealthAccountId: implicitAccountId,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      createdAt: Date.now(),
      label,
    }

    this.stealthAddresses.set(implicitAccountId, result)
    return result
  }

  /**
   * Check stealth address ownership
   */
  checkStealthAddress(stealthAddress: StealthAddress): boolean {
    if (!this.privacyKeys) {
      throw new Error('Privacy keys not derived')
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
      throw new Error('Privacy keys not derived')
    }

    const isOwner = this.checkStealthAddress(stealthAddress)
    if (!isOwner) {
      throw new Error('Stealth address does not belong to this wallet')
    }

    const recovery = deriveNEARStealthPrivateKey(
      stealthAddress,
      this.privacyKeys.spendingPrivateKey,
      this.privacyKeys.viewingPrivateKey
    )

    return recovery.privateKey
  }

  // ─── Transaction Preview ────────────────────────────────────────────────────

  /**
   * Preview a private transfer before signing
   */
  previewPrivateTransfer(params: MyNearWalletPrivateTransferParams): TransactionPreview {
    if (!this.accountId) {
      throw new Error('Not connected to MyNearWallet')
    }

    const recipientMeta = typeof params.recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
      : params.recipientMetaAddress

    const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
    const transfer = buildPrivateTransfer(recipientMeta, amount)

    // Format amount in NEAR
    const amountNEAR = formatNearAmount(amount)

    return {
      senderId: this.accountId,
      receiverId: transfer.stealthAccountId,
      amountNEAR,
      amountYocto: amount.toString(),
      isPrivate: true,
      stealthInfo: {
        stealthAccountId: transfer.stealthAccountId,
        announcementMemo: transfer.announcementMemo,
        viewTag: transfer.stealthAddress.viewTag,
      },
      actions: transfer.actions.map((action) => ({
        type: action.type,
        params: serializeParams(action.params as unknown as Record<string, unknown>),
      })),
    }
  }

  // ─── Private Transfers ──────────────────────────────────────────────────────

  /**
   * Get URL for private transfer signing
   */
  getPrivateTransferUrl(params: MyNearWalletPrivateTransferParams): string {
    if (!this.accountId) {
      throw new Error('Not connected to MyNearWallet')
    }

    const recipientMeta = typeof params.recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
      : params.recipientMetaAddress

    const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
    const transfer = buildPrivateTransfer(recipientMeta, amount)

    // Build transaction URL
    const urlParams = new URLSearchParams({
      signerId: this.accountId,
      receiverId: transfer.stealthAccountId,
      callbackUrl: this.config.callbackUrl,
    })

    // Encode actions
    const encodedActions = transfer.actions.map((action) => ({
      type: action.type,
      ...serializeParams(action.params as unknown as Record<string, unknown>),
    }))

    urlParams.set('actions', JSON.stringify(encodedActions))

    // Add privacy metadata
    urlParams.set('meta', JSON.stringify({
      isPrivate: true,
      stealthAccountId: transfer.stealthAccountId,
      announcementMemo: transfer.announcementMemo,
      label: params.label,
    }))

    return `${this.walletUrl}/sign?${urlParams.toString()}`
  }

  /**
   * Send private transfer by redirecting to MyNearWallet
   */
  sendPrivateTransfer(params: MyNearWalletPrivateTransferParams): void {
    this.connectionState = 'signing'

    if (typeof window !== 'undefined') {
      window.location.href = this.getPrivateTransferUrl(params)
    } else {
      throw new Error('sendPrivateTransfer requires browser environment')
    }
  }

  /**
   * Handle callback after signing
   */
  handleTransactionCallback(callbackParams: URLSearchParams): MyNearWalletCallbackResult {
    this.connectionState = 'connected'

    const transactionHashes = callbackParams.get('transactionHashes') ?? undefined
    const errorCode = callbackParams.get('errorCode') ?? undefined
    const errorMessage = callbackParams.get('errorMessage') ?? undefined

    return {
      transactionHashes,
      errorCode,
      errorMessage,
      accountId: this.accountId ?? undefined,
    }
  }

  // ─── Multi-Action Transactions ──────────────────────────────────────────────

  /**
   * Get URL for batch private transfers
   */
  getBatchPrivateTransferUrl(
    transfers: MyNearWalletPrivateTransferParams[]
  ): string {
    if (!this.accountId) {
      throw new Error('Not connected to MyNearWallet')
    }

    // Build all transactions
    const transactions = transfers.map((params) => {
      const recipientMeta = typeof params.recipientMetaAddress === 'string'
        ? parseNEARStealthMetaAddress(params.recipientMetaAddress)
        : params.recipientMetaAddress

      const amount = typeof params.amount === 'string' ? BigInt(params.amount) : params.amount
      const transfer = buildPrivateTransfer(recipientMeta, amount)

      return {
        signerId: this.accountId,
        receiverId: transfer.stealthAccountId,
        actions: transfer.actions.map((action) => ({
          type: action.type,
          ...serializeParams(action.params as unknown as Record<string, unknown>),
        })),
        meta: {
          isPrivate: true,
          stealthAccountId: transfer.stealthAccountId,
          announcementMemo: transfer.announcementMemo,
          label: params.label,
        },
      }
    })

    const urlParams = new URLSearchParams({
      transactions: JSON.stringify(transactions),
      callbackUrl: this.config.callbackUrl,
    })

    return `${this.walletUrl}/sign?${urlParams.toString()}`
  }

  /**
   * Send batch private transfers
   */
  sendBatchPrivateTransfers(transfers: MyNearWalletPrivateTransferParams[]): void {
    this.connectionState = 'signing'

    if (typeof window !== 'undefined') {
      window.location.href = this.getBatchPrivateTransferUrl(transfers)
    } else {
      throw new Error('sendBatchPrivateTransfers requires browser environment')
    }
  }

  // ─── Viewing Key Export ─────────────────────────────────────────────────────

  /**
   * Export viewing key
   */
  exportViewingKey(label?: string): MyNearWalletViewingKeyExport {
    if (!this.privacyKeys) {
      throw new Error('Privacy keys not derived')
    }

    if (!this.accountId) {
      throw new Error('Not connected')
    }

    return {
      network: this.config.network,
      viewingPublicKey: this.privacyKeys.viewingPublicKey,
      viewingPrivateKey: this.privacyKeys.viewingPrivateKey,
      spendingPublicKey: this.privacyKeys.spendingPublicKey,
      accountId: this.accountId,
      createdAt: Date.now(),
      label,
      walletType: 'mynearwallet',
    }
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────

  /**
   * Get tracked stealth addresses
   */
  getStealthAddresses(): Map<string, MyNearWalletStealthAddress> {
    return new Map(this.stealthAddresses)
  }

  /**
   * Get wallet URL
   */
  getWalletUrl(): string {
    return this.walletUrl
  }

  /**
   * Get config
   */
  getConfig(): MyNearWalletConfig {
    return { ...this.config }
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create MyNearWallet privacy integration
 */
export function createMyNearWalletPrivacy(
  config: MyNearWalletConfig
): MyNearWalletPrivacy {
  return new MyNearWalletPrivacy(config)
}

/**
 * Create mainnet MyNearWallet integration
 */
export function createMainnetMyNearWallet(
  callbackUrl: string
): MyNearWalletPrivacy {
  return new MyNearWalletPrivacy({
    network: 'mainnet',
    callbackUrl,
  })
}

/**
 * Create testnet MyNearWallet integration
 */
export function createTestnetMyNearWallet(
  callbackUrl: string
): MyNearWalletPrivacy {
  return new MyNearWalletPrivacy({
    network: 'testnet',
    callbackUrl,
  })
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
 * Format amount in NEAR
 */
function formatNearAmount(yoctoNear: bigint): string {
  const nearStr = yoctoNear.toString().padStart(25, '0')
  const whole = nearStr.slice(0, -24) || '0'
  const decimal = nearStr.slice(-24).replace(/0+$/, '')
  return decimal ? `${whole}.${decimal}` : whole
}

/**
 * Serialize action params for URL encoding
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
 * Parse callback URL parameters
 */
export function parseMyNearWalletCallback(
  url: string
): { type: 'login' | 'transaction'; params: URLSearchParams } {
  const urlObj = new URL(url)
  const params = urlObj.searchParams

  // Check if login or transaction callback
  if (params.has('account_id')) {
    return { type: 'login', params }
  }

  return { type: 'transaction', params }
}
