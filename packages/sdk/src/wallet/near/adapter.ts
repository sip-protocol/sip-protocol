/**
 * NEAR Wallet Adapter with Privacy Support
 *
 * Extends the base wallet adapter to support NEAR same-chain privacy operations,
 * including stealth address generation and privacy transaction signing.
 *
 * @example Basic usage
 * ```typescript
 * import { NEARWalletAdapter } from '@sip-protocol/sdk'
 *
 * const wallet = new NEARWalletAdapter({
 *   network: 'mainnet',
 * })
 *
 * await wallet.connect()
 *
 * // Generate stealth meta-address
 * const { metaAddress, encoded } = await wallet.generateStealthMetaAddress()
 *
 * // Sign a privacy transaction
 * const signed = await wallet.signPrivacyTransaction(transfer)
 * ```
 *
 * @packageDocumentation
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type {
  ChainId,
  HexString,
  Asset,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
  StealthMetaAddress,
  StealthAddress,
} from '@sip-protocol/types'
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import { WalletErrorCode } from '@sip-protocol/types'
import type { NEARNetwork } from '../../chains/near/constants'
import {
  generateNEARStealthAddress,
  deriveNEARStealthPrivateKey,
  encodeNEARStealthMetaAddress,
  parseNEARStealthMetaAddress,
  checkNEARStealthAddress,
} from '../../chains/near/stealth'
import type { NEARAction } from '../../chains/near/implicit-account'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * NEAR wallet adapter configuration
 */
export interface NEARWalletAdapterConfig {
  /** NEAR network (mainnet, testnet) */
  network: NEARNetwork
  /** Wallet name/identifier */
  walletName?: string
  /** RPC URL override */
  rpcUrl?: string
}

/**
 * NEAR wallet connection options
 */
export interface NEARConnectOptions {
  /** Contract to request access for (optional) */
  contractId?: string
  /** Methods to request access for (optional) */
  methodNames?: string[]
}

/**
 * Privacy key pair derived from wallet
 */
export interface NEARPrivacyKeyPair {
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Spending public key */
  spendingPublicKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Viewing public key */
  viewingPublicKey: HexString
  /** Derivation path used */
  derivationPath: string
}

/**
 * Stealth address with derived keys
 */
export interface NEARStealthAddressWithKeys {
  /** The stealth address */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Private key for spending (derived) */
  privateKey?: HexString
}

/**
 * Privacy transaction to sign
 */
export interface NEARPrivacyTransaction {
  /** Receiver account ID */
  receiverId: string
  /** Transaction actions */
  actions: NEARAction[]
  /** Announcement memo for stealth address */
  announcementMemo?: string
  /** Is this from a stealth account */
  fromStealthAccount?: boolean
  /** Stealth account keypair (if signing from stealth) */
  stealthKeyPair?: {
    publicKey: HexString
    privateKey: HexString
  }
}

/**
 * Signed privacy transaction
 */
export interface NEARSignedPrivacyTransaction {
  /** Serialized signed transaction */
  signedTx: string
  /** Transaction hash */
  txHash: string
  /** Sender account ID */
  senderId: string
  /** Receiver account ID */
  receiverId: string
}

/**
 * Viewing key export format
 */
export interface NEARViewingKeyExport {
  /** Network */
  network: NEARNetwork
  /** Viewing public key */
  viewingPublicKey: HexString
  /** Viewing private key (encrypted or raw) */
  viewingPrivateKey: HexString
  /** Associated spending public key */
  spendingPublicKey: HexString
  /** Creation timestamp */
  createdAt: number
  /** Label */
  label?: string
}

// ─── NEAR Wallet Adapter ──────────────────────────────────────────────────────

/**
 * NEAR Wallet Adapter with Privacy Support
 *
 * Provides wallet connection and privacy operations for NEAR.
 */
export class NEARWalletAdapter extends BaseWalletAdapter {
  readonly chain: ChainId = 'near'
  readonly name: string

  private config: NEARWalletAdapterConfig
  private privacyKeyPair: NEARPrivacyKeyPair | null = null
  private stealthAddresses: Map<string, NEARStealthAddressWithKeys> = new Map()

  constructor(config: NEARWalletAdapterConfig) {
    super()
    this.config = config
    this.name = config.walletName ?? `near-${config.network}`
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  /**
   * Connect to NEAR wallet
   */
  async connect(options?: NEARConnectOptions): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // In a real implementation, this would connect to NEAR Wallet Selector
      // For now, we simulate the connection

      // Check if window.near exists (browser extension)
      if (typeof window !== 'undefined' && (window as any).near) {
        const near = (window as any).near
        const account = await near.requestSignIn({
          contractId: options?.contractId,
          methodNames: options?.methodNames,
        })

        this._address = account.accountId
        this._publicKey = `0x${account.publicKey}` as HexString
      } else {
        // Mock connection for non-browser environments
        throw new WalletError(
          'NEAR wallet not available',
          WalletErrorCode.NOT_INSTALLED
        )
      }

      this._connectionState = 'connected'
      this.emitConnect(this._address, this.chain)
    } catch (error) {
      this._connectionState = 'error'

      if (error instanceof WalletError) {
        throw error
      }

      throw new WalletError(
        `Failed to connect to NEAR wallet: ${error}`,
        WalletErrorCode.CONNECTION_FAILED
      )
    }
  }

  /**
   * Disconnect from NEAR wallet
   */
  async disconnect(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).near) {
      await (window as any).near.signOut()
    }

    this.privacyKeyPair = null
    this.stealthAddresses.clear()
    this.setDisconnected('User disconnected')
  }

  // ─── Standard Wallet Operations ─────────────────────────────────────────────

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (typeof window !== 'undefined' && (window as any).near) {
      const near = (window as any).near
      const result = await near.signMessage({
        message: Buffer.from(message).toString('base64'),
        recipient: this._address,
      })

      return {
        signature: `0x${result.signature}` as HexString,
        publicKey: this._publicKey as HexString,
        recoveryId: 0,
      }
    }

    throw new WalletError(
      'NEAR wallet not available for signing',
      WalletErrorCode.SIGNING_FAILED
    )
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    const signature = await this.signMessage(
      new TextEncoder().encode(JSON.stringify(tx.data))
    )

    return {
      unsigned: tx,
      signatures: [signature],
      serialized: `0x${Buffer.from(JSON.stringify(tx)).toString('hex')}` as HexString,
    }
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    if (typeof window !== 'undefined' && (window as any).near) {
      const near = (window as any).near
      const txData = tx.data as { receiverId?: string; actions?: unknown[] }
      const result = await near.signAndSendTransaction({
        receiverId: txData.receiverId ?? this._address,
        actions: txData.actions ?? tx.data,
      })

      return {
        txHash: `0x${result.transaction.hash}` as HexString,
        status: result.status ? 'confirmed' : 'failed',
        blockNumber: BigInt(result.transaction.block_height ?? 0),
        feeUsed: BigInt(result.transaction.gas_used ?? 0),
        timestamp: Date.now(),
      }
    }

    throw new WalletError(
      'NEAR wallet not available for transaction',
      WalletErrorCode.TRANSACTION_FAILED
    )
  }

  /**
   * Get native NEAR balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    // In a real implementation, query the RPC
    // For now, return 0
    return 0n
  }

  /**
   * Get token balance
   */
  async getTokenBalance(_asset: Asset): Promise<bigint> {
    this.requireConnected()

    // In a real implementation, query the token contract using _asset.contract
    // For now, return 0
    return 0n
  }

  // ─── Privacy Operations ─────────────────────────────────────────────────────

  /**
   * Derive privacy keys from wallet
   *
   * Uses a deterministic derivation from the wallet's signing capability
   * to generate privacy keys without exposing the seed.
   */
  async derivePrivacyKeys(label: string = 'default'): Promise<NEARPrivacyKeyPair> {
    this.requireConnected()

    // Derive keys using signature-based derivation
    // This works even when the wallet doesn't expose the seed
    const derivationPath = `sip/near/${this.config.network}/${label}`
    const derivationMessage = new TextEncoder().encode(
      `SIP Privacy Key Derivation: ${derivationPath}`
    )

    // Sign the derivation message to get entropy
    const signature = await this.signMessage(derivationMessage)
    const entropy = hexToBytes(signature.signature.slice(2))

    // Derive spending key from first half
    const spendingEntropy = sha256(new Uint8Array([...entropy.slice(0, 32), 0x01]))
    const spendingPrivateKeyScalar = bytesToBigIntLE(spendingEntropy) % ED25519_ORDER
    const spendingPrivateKeyBytes = bigIntToBytesLE(spendingPrivateKeyScalar, 32)
    const spendingPublicKeyBytes = ed25519.getPublicKey(spendingPrivateKeyBytes)

    // Derive viewing key from second half
    const viewingEntropy = sha256(new Uint8Array([...entropy.slice(32, 64), 0x02]))
    const viewingPrivateKeyScalar = bytesToBigIntLE(viewingEntropy) % ED25519_ORDER
    const viewingPrivateKeyBytes = bigIntToBytesLE(viewingPrivateKeyScalar, 32)
    const viewingPublicKeyBytes = ed25519.getPublicKey(viewingPrivateKeyBytes)

    const keyPair: NEARPrivacyKeyPair = {
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKeyBytes)}` as HexString,
      spendingPublicKey: `0x${bytesToHex(spendingPublicKeyBytes)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKeyBytes)}` as HexString,
      viewingPublicKey: `0x${bytesToHex(viewingPublicKeyBytes)}` as HexString,
      derivationPath,
    }

    this.privacyKeyPair = keyPair
    return keyPair
  }

  /**
   * Generate a stealth meta-address
   *
   * Creates a meta-address that can be shared publicly for receiving
   * private payments.
   */
  async generateStealthMetaAddress(label?: string): Promise<{
    metaAddress: StealthMetaAddress
    encoded: string
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
  }> {
    // Use derived keys if available, otherwise derive new ones
    const keys = this.privacyKeyPair ?? await this.derivePrivacyKeys(label)

    // Create meta-address from derived keys
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
   * Generate a fresh stealth address for receiving
   *
   * Creates a one-time stealth address from a meta-address.
   */
  generateStealthAddress(metaAddress: StealthMetaAddress | string): NEARStealthAddressWithKeys {
    const meta = typeof metaAddress === 'string'
      ? parseNEARStealthMetaAddress(metaAddress)
      : metaAddress

    const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(meta)

    const result: NEARStealthAddressWithKeys = {
      stealthAddress,
      stealthAccountId: implicitAccountId,
    }

    // Store for later spending
    this.stealthAddresses.set(implicitAccountId, result)

    return result
  }

  /**
   * Check if a stealth address belongs to this wallet
   */
  async checkStealthAddress(
    stealthAddress: StealthAddress
  ): Promise<boolean> {
    const keys = this.privacyKeyPair ?? await this.derivePrivacyKeys()

    return checkNEARStealthAddress(
      stealthAddress,
      keys.spendingPublicKey,
      keys.viewingPrivateKey
    )
  }

  /**
   * Derive the private key for a stealth address
   *
   * Only works for stealth addresses that belong to this wallet.
   */
  async deriveStealthPrivateKey(
    stealthAddress: StealthAddress
  ): Promise<HexString> {
    const keys = this.privacyKeyPair ?? await this.derivePrivacyKeys()

    const isOwner = await this.checkStealthAddress(stealthAddress)
    if (!isOwner) {
      throw new WalletError(
        'Stealth address does not belong to this wallet',
        WalletErrorCode.INVALID_TRANSACTION
      )
    }

    const recovery = deriveNEARStealthPrivateKey(
      stealthAddress,
      keys.spendingPrivateKey,
      keys.viewingPrivateKey
    )

    return recovery.privateKey
  }

  /**
   * Sign a privacy transaction
   *
   * Signs a transaction for privacy operations, including stealth transfers.
   */
  async signPrivacyTransaction(
    tx: NEARPrivacyTransaction
  ): Promise<NEARSignedPrivacyTransaction> {
    // If from stealth account, use the stealth keypair
    if (tx.fromStealthAccount && tx.stealthKeyPair) {
      return this.signWithStealthKey(tx, tx.stealthKeyPair)
    }

    // Otherwise, sign with main wallet
    this.requireConnected()

    const unsigned: UnsignedTransaction = {
      chain: 'near',
      data: {
        signerId: this._address,
        receiverId: tx.receiverId,
        actions: tx.actions,
      },
      metadata: {
        network: this.config.network,
        announcementMemo: tx.announcementMemo,
      },
    }

    const signed = await this.signTransaction(unsigned)

    return {
      signedTx: signed.serialized,
      txHash: sha256Hash(signed.serialized),
      senderId: this._address,
      receiverId: tx.receiverId,
    }
  }

  /**
   * Sign with a stealth key
   */
  private async signWithStealthKey(
    tx: NEARPrivacyTransaction,
    keyPair: { publicKey: HexString; privateKey: HexString }
  ): Promise<NEARSignedPrivacyTransaction> {
    // Derive the implicit account ID from the public key
    const publicKeyBytes = hexToBytes(keyPair.publicKey.slice(2))
    const accountId = bytesToHex(publicKeyBytes)

    // Create the transaction to sign (convert bigints to strings for serialization)
    const txData = {
      signerId: accountId,
      receiverId: tx.receiverId,
      actions: tx.actions.map(action => ({
        type: action.type,
        params: Object.fromEntries(
          Object.entries(action.params).map(([k, v]) => [
            k,
            typeof v === 'bigint' ? v.toString() : v,
          ])
        ),
      })),
      publicKey: keyPair.publicKey,
    }

    // Sign with ed25519
    const message = new TextEncoder().encode(JSON.stringify(txData))
    const privateKeyBytes = hexToBytes(keyPair.privateKey.slice(2))

    // Note: In a real implementation, you'd use proper NEAR transaction serialization
    const signature = ed25519.sign(message, privateKeyBytes)
    const signedTx = JSON.stringify({
      ...txData,
      signature: bytesToHex(signature),
    })

    return {
      signedTx,
      txHash: sha256Hash(signedTx),
      senderId: accountId,
      receiverId: tx.receiverId,
    }
  }

  /**
   * Export viewing key
   *
   * Exports the viewing key for sharing with auditors or other services.
   */
  async exportViewingKey(label?: string): Promise<NEARViewingKeyExport> {
    const keys = this.privacyKeyPair ?? await this.derivePrivacyKeys(label)

    return {
      network: this.config.network,
      viewingPublicKey: keys.viewingPublicKey,
      viewingPrivateKey: keys.viewingPrivateKey,
      spendingPublicKey: keys.spendingPublicKey,
      createdAt: Date.now(),
      label,
    }
  }

  /**
   * Get all tracked stealth addresses
   */
  getStealthAddresses(): Map<string, NEARStealthAddressWithKeys> {
    return new Map(this.stealthAddresses)
  }

  /**
   * Get network
   */
  getNetwork(): NEARNetwork {
    return this.config.network
  }

  /**
   * Check if privacy keys are derived
   */
  hasPrivacyKeys(): boolean {
    return this.privacyKeyPair !== null
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

function bigIntToBytesLE(n: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let temp = n
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(temp & 0xffn)
    temp = temp >> 8n
  }
  return bytes
}

function sha256Hash(data: string): string {
  const hash = sha256(new TextEncoder().encode(data))
  return `0x${bytesToHex(hash)}`
}
