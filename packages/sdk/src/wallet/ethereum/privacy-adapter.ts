/**
 * Privacy-Extended Ethereum Wallet Adapter
 *
 * Extends EthereumWalletAdapter with stealth address capabilities for
 * same-chain privacy operations using secp256k1 curve.
 *
 * @module wallet/ethereum/privacy-adapter
 */

import type {
  HexString,
  StealthMetaAddress,
  StealthAddress,
} from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha2'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { EthereumWalletAdapter } from './adapter'
import type { EthereumAdapterConfig, EIP712TypedData } from './types'
import {
  generateEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  deriveEthereumStealthPrivateKey,
  checkEthereumStealthAddress,
  stealthPublicKeyToEthAddress,
  encodeEthereumStealthMetaAddress,
  parseEthereumStealthMetaAddress,
  type EthereumStealthMetaAddress,
} from '../../chains/ethereum/stealth'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Configuration for privacy adapter
 */
export interface PrivacyEthereumAdapterConfig extends EthereumAdapterConfig {
  /**
   * Pre-existing stealth meta-address to use
   * If not provided, one will be generated on first use
   */
  metaAddress?: StealthMetaAddress | EthereumStealthMetaAddress | string
  /**
   * Pre-existing spending private key
   * Required if metaAddress is provided
   */
  spendingPrivateKey?: HexString
  /**
   * Pre-existing viewing private key
   * Required if metaAddress is provided
   */
  viewingPrivateKey?: HexString
  /**
   * Derive stealth keys from wallet signature
   * If true, keys are derived deterministically from wallet
   * If false (default), random keys are generated
   */
  deriveFromWallet?: boolean
  /**
   * Domain separation string for key derivation
   * Used when deriveFromWallet is true
   */
  derivationDomain?: string
}

/**
 * Stealth key material for Ethereum
 */
export interface EthereumStealthKeyMaterial {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
  /** Encoded EIP-5564 format */
  encodedMetaAddress: string
}

/**
 * Scanned stealth payment
 */
export interface EthereumScannedPayment {
  /** Stealth address that received the payment */
  stealthAddress: HexString
  /** Ephemeral public key from sender */
  ephemeralPublicKey: HexString
  /** View tag for fast scanning */
  viewTag: number
  /** Whether this payment belongs to us */
  isOwned: boolean
  /** Ethereum address format of stealth address */
  ethAddress: HexString
}

/**
 * Result of claiming a stealth payment
 */
export interface EthereumClaimResult {
  /** Derived private key for spending */
  privateKey: HexString
  /** Public key (compressed) */
  publicKey: HexString
  /** Ethereum address */
  ethAddress: HexString
}

/**
 * Privacy context that persists across reconnections
 */
export interface PrivacyContext {
  /** Current stealth keys */
  keys: EthereumStealthKeyMaterial
  /** Whether keys were derived from wallet */
  derivedFromWallet: boolean
  /** Derivation domain if applicable */
  derivationDomain?: string
  /** Wallet address keys were derived for */
  derivedForAddress?: string
}

// ─── Privacy Adapter ────────────────────────────────────────────────────────

/**
 * Privacy-enabled Ethereum wallet adapter
 *
 * Extends the base EthereumWalletAdapter with:
 * - Stealth meta-address generation and management
 * - Stealth address derivation for receiving
 * - Private key derivation for spending
 * - Payment scanning with view tags
 * - EIP-712 signing for permit operations
 *
 * @example Generate stealth address for receiving
 * ```typescript
 * const wallet = new PrivacyEthereumWalletAdapter({ wallet: 'metamask' })
 * await wallet.connect()
 * await wallet.initializePrivacy()
 *
 * // Share meta-address with senders
 * const metaAddress = wallet.getMetaAddress()
 * console.log('Send to:', wallet.getEncodedMetaAddress())
 * ```
 *
 * @example Derive from wallet (deterministic)
 * ```typescript
 * const wallet = new PrivacyEthereumWalletAdapter({
 *   wallet: 'metamask',
 *   deriveFromWallet: true,
 *   derivationDomain: 'my-app.com',
 * })
 * await wallet.connect()
 * await wallet.initializePrivacy()
 * // Keys derived deterministically from wallet signature
 * ```
 *
 * @example Scan and claim payments
 * ```typescript
 * const payments = wallet.scanPayments([announcement1, announcement2])
 * for (const payment of payments.filter(p => p.isOwned)) {
 *   const claim = wallet.deriveClaimKey(payment.ephemeralPublicKey, payment.viewTag)
 *   // Use claim.privateKey to sign transactions
 * }
 * ```
 */
export class PrivacyEthereumWalletAdapter extends EthereumWalletAdapter {
  private stealthKeys: EthereumStealthKeyMaterial | undefined
  private deriveFromWallet: boolean
  private derivationDomain: string
  private privacyContext: PrivacyContext | undefined

  constructor(config: PrivacyEthereumAdapterConfig = {}) {
    super(config)

    this.deriveFromWallet = config.deriveFromWallet ?? false
    this.derivationDomain = config.derivationDomain ?? 'sip-protocol.org'

    // If pre-existing keys provided, validate and store
    if (config.metaAddress) {
      if (!config.spendingPrivateKey || !config.viewingPrivateKey) {
        throw new Error('spendingPrivateKey and viewingPrivateKey required when metaAddress provided')
      }

      // Parse meta-address if string
      let metaAddress: StealthMetaAddress
      if (typeof config.metaAddress === 'string') {
        const parsed = parseEthereumStealthMetaAddress(config.metaAddress)
        metaAddress = {
          chain: 'ethereum',
          spendingKey: parsed.spendingKey,
          viewingKey: parsed.viewingKey,
        }
      } else if ('spendingKey' in config.metaAddress) {
        // Already StealthMetaAddress format
        metaAddress = config.metaAddress as StealthMetaAddress
      } else {
        throw new Error('Invalid meta-address format')
      }

      this.stealthKeys = {
        metaAddress,
        spendingPrivateKey: config.spendingPrivateKey,
        viewingPrivateKey: config.viewingPrivateKey,
        encodedMetaAddress: encodeEthereumStealthMetaAddress(metaAddress),
      }
    }
  }

  /**
   * Initialize privacy features
   *
   * Generates or derives stealth keys. Must be called after connect().
   * If deriveFromWallet is true, will prompt for a signature.
   */
  async initializePrivacy(): Promise<void> {
    this.requireConnected()

    // If we have a privacy context for this address, restore it
    if (this.privacyContext && this.privacyContext.derivedForAddress === this.address) {
      this.stealthKeys = this.privacyContext.keys
      return
    }

    if (this.stealthKeys) {
      return // Already initialized
    }

    if (this.deriveFromWallet) {
      await this.deriveStealthKeysFromWallet()
    } else {
      this.generateRandomStealthKeys()
    }
  }

  /**
   * Check if privacy is initialized
   */
  isPrivacyInitialized(): boolean {
    return !!this.stealthKeys
  }

  /**
   * Get the stealth meta-address
   *
   * Share this with senders to receive private payments.
   *
   * @throws If privacy not initialized
   */
  getMetaAddress(): StealthMetaAddress {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }
    return this.stealthKeys.metaAddress
  }

  /**
   * Get the encoded EIP-5564 meta-address string
   *
   * Format: st:eth:0x<spendingKey><viewingKey>
   *
   * @throws If privacy not initialized
   */
  getEncodedMetaAddress(): string {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }
    return this.stealthKeys.encodedMetaAddress
  }

  /**
   * Get the viewing private key
   *
   * Used for scanning incoming payments.
   * Can be shared with auditors for compliance.
   *
   * @throws If privacy not initialized
   */
  getViewingPrivateKey(): HexString {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }
    return this.stealthKeys.viewingPrivateKey
  }

  /**
   * Get the spending private key
   *
   * SENSITIVE: Required for deriving stealth private keys.
   * Keep secure and never share.
   *
   * @throws If privacy not initialized
   */
  getSpendingPrivateKey(): HexString {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }
    return this.stealthKeys.spendingPrivateKey
  }

  /**
   * Generate a one-time stealth address for a sender
   *
   * Typically used by the sender side. Recipients share their meta-address,
   * and senders generate unique stealth addresses for each payment.
   *
   * @param recipientMetaAddress - Recipient's stealth meta-address
   * @returns Stealth address details for the transaction
   */
  generateStealthAddressFor(recipientMetaAddress: StealthMetaAddress | string): {
    stealthAddress: StealthAddress
    ethAddress: HexString
    sharedSecret: HexString
  } {
    const { stealthAddress, sharedSecret } = generateEthereumStealthAddress(recipientMetaAddress)
    const ethAddress = stealthPublicKeyToEthAddress(stealthAddress.address)

    return {
      stealthAddress,
      ethAddress,
      sharedSecret,
    }
  }

  /**
   * Scan announcements to find payments belonging to us
   *
   * Uses the viewing key to check if stealth addresses belong to this wallet.
   * First checks view tags for fast filtering, then verifies ownership.
   *
   * @param announcements - Array of stealth address announcements to scan
   * @returns Array of payments with ownership status
   */
  scanPayments(announcements: StealthAddress[]): EthereumScannedPayment[] {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }

    const results: EthereumScannedPayment[] = []

    for (const announcement of announcements) {
      try {
        const isOwned = checkEthereumStealthAddress(
          announcement,
          this.stealthKeys.metaAddress.spendingKey,
          this.stealthKeys.viewingPrivateKey,
        )

        let ethAddress: HexString
        try {
          ethAddress = stealthPublicKeyToEthAddress(announcement.address)
        } catch {
          ethAddress = '0x0000000000000000000000000000000000000000' as HexString
        }

        results.push({
          stealthAddress: announcement.address,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          viewTag: announcement.viewTag,
          isOwned,
          ethAddress,
        })
      } catch {
        // Invalid announcement, skip
        results.push({
          stealthAddress: announcement.address,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          viewTag: announcement.viewTag,
          isOwned: false,
          ethAddress: '0x0000000000000000000000000000000000000000' as HexString,
        })
      }
    }

    return results
  }

  /**
   * Fast scan using view tags only
   *
   * Pre-filters announcements by view tag before full verification.
   * Much faster for large announcement sets.
   *
   * @param announcements - Announcements with view tags
   * @returns Potentially matching announcements
   */
  fastScanByViewTag(announcements: StealthAddress[]): StealthAddress[] {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }

    // Get viewing private key bytes
    const viewingKeyBytes = hexToBytes(this.stealthKeys.viewingPrivateKey.slice(2))

    return announcements.filter(ann => {
      try {
        const ephemeralBytes = hexToBytes(ann.ephemeralPublicKey.slice(2))

        // Compute shared secret point
        const ephemeralPoint = secp256k1.ProjectivePoint.fromHex(ephemeralBytes)
        const sharedPoint = ephemeralPoint.multiply(bytesToBigInt(viewingKeyBytes))
        const sharedSecretBytes = sharedPoint.toRawBytes(true)

        // Hash shared secret to get view tag
        const hash = keccak_256(sharedSecretBytes)
        const expectedViewTag = hash[0]

        return ann.viewTag === expectedViewTag
      } catch {
        return false
      }
    })
  }

  /**
   * Derive the private key for spending from a stealth address
   *
   * @param ephemeralPublicKey - Ephemeral public key from the announcement
   * @param viewTag - View tag from the announcement
   * @returns Claim key material for spending
   */
  deriveClaimKey(
    ephemeralPublicKey: HexString,
    viewTag: number
  ): EthereumClaimResult {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }

    // Create StealthAddress for derivation
    const stealthAddr: StealthAddress = {
      address: '0x' + '00'.repeat(33) as HexString, // Will be computed
      ephemeralPublicKey,
      viewTag,
    }

    // Derive the private key using our crypto module
    const recovery = deriveEthereumStealthPrivateKey(
      stealthAddr,
      this.stealthKeys.spendingPrivateKey,
      this.stealthKeys.viewingPrivateKey,
    )

    return {
      privateKey: recovery.privateKey,
      publicKey: recovery.stealthAddress,
      ethAddress: recovery.ethAddress,
    }
  }

  /**
   * Sign EIP-712 typed data for permit or other structured data
   *
   * Convenience method that uses the wallet's signTypedData.
   *
   * @param typedData - EIP-712 typed data
   * @returns Signature
   */
  async signPermitData(typedData: EIP712TypedData): Promise<{
    v: number
    r: HexString
    s: HexString
  }> {
    const signature = await this.signTypedData(typedData)

    // Parse signature into v, r, s
    const sig = signature.signature.slice(2) // Remove 0x
    const r = `0x${sig.slice(0, 64)}` as HexString
    const s = `0x${sig.slice(64, 128)}` as HexString
    const v = parseInt(sig.slice(128, 130), 16)

    return { v, r, s }
  }

  /**
   * Export stealth keys for backup
   *
   * Returns all key material needed to restore privacy functionality.
   * SENSITIVE: Store securely and never expose.
   */
  exportStealthKeys(): EthereumStealthKeyMaterial | undefined {
    return this.stealthKeys ? { ...this.stealthKeys } : undefined
  }

  /**
   * Import stealth keys from backup
   *
   * @param keys - Previously exported stealth keys
   */
  importStealthKeys(keys: EthereumStealthKeyMaterial): void {
    this.stealthKeys = { ...keys }
  }

  /**
   * Get privacy context for persistence
   *
   * Use this to save privacy state across reconnections.
   */
  getPrivacyContext(): PrivacyContext | undefined {
    if (!this.stealthKeys) {
      return undefined
    }

    return {
      keys: { ...this.stealthKeys },
      derivedFromWallet: this.deriveFromWallet,
      derivationDomain: this.deriveFromWallet ? this.derivationDomain : undefined,
      derivedForAddress: this.deriveFromWallet ? this.address : undefined,
    }
  }

  /**
   * Restore privacy context from saved state
   *
   * @param context - Previously saved privacy context
   */
  setPrivacyContext(context: PrivacyContext): void {
    this.privacyContext = context
    if (this.address === context.derivedForAddress || !context.derivedFromWallet) {
      this.stealthKeys = context.keys
    }
  }

  /**
   * Clear privacy state
   *
   * Removes all stealth keys from memory.
   */
  clearPrivacy(): void {
    this.stealthKeys = undefined
    this.privacyContext = undefined
  }

  /**
   * Generate random stealth keys
   */
  private generateRandomStealthKeys(): void {
    const { metaAddress, encoded, spendingPrivateKey, viewingPrivateKey } =
      generateEthereumStealthMetaAddress()

    this.stealthKeys = {
      metaAddress: {
        chain: 'ethereum',
        spendingKey: metaAddress.spendingKey,
        viewingKey: metaAddress.viewingKey,
      },
      spendingPrivateKey,
      viewingPrivateKey,
      encodedMetaAddress: encoded,
    }
  }

  /**
   * Derive stealth keys deterministically from wallet signature
   *
   * Uses wallet signature over a domain-specific message to derive
   * deterministic stealth keys. Same wallet + domain = same keys.
   */
  private async deriveStealthKeysFromWallet(): Promise<void> {
    const message = `SIP Protocol Stealth Key Derivation\n` +
      `Domain: ${this.derivationDomain}\n` +
      `Address: ${this.address}\n` +
      `Chain: ethereum\n` +
      `Version: 1`

    // Sign the derivation message
    const messageBytes = new TextEncoder().encode(message)
    const signature = await this.signMessage(messageBytes)

    // Use signature as seed for key derivation
    const signatureBytes = hexToBytes(signature.signature.slice(2))

    // Derive spending key: hash(sig || "spending")
    const spendingInput = new Uint8Array(signatureBytes.length + 8)
    spendingInput.set(signatureBytes)
    spendingInput.set(new TextEncoder().encode('spending'), signatureBytes.length)
    const spendingHash = sha256(spendingInput)

    // Ensure spending key is valid for secp256k1
    const spendingPrivateKey = ensureValidSecp256k1Key(spendingHash)

    // Derive viewing key: hash(sig || "viewing")
    const viewingInput = new Uint8Array(signatureBytes.length + 7)
    viewingInput.set(signatureBytes)
    viewingInput.set(new TextEncoder().encode('viewing'), signatureBytes.length)
    const viewingHash = sha256(viewingInput)

    // Ensure viewing key is valid for secp256k1
    const viewingPrivateKey = ensureValidSecp256k1Key(viewingHash)

    // Compute public keys (compressed)
    const spendingKey = secp256k1.getPublicKey(spendingPrivateKey, true)
    const viewingKey = secp256k1.getPublicKey(viewingPrivateKey, true)

    const spendingKeyHex = `0x${bytesToHex(spendingKey)}` as HexString
    const viewingKeyHex = `0x${bytesToHex(viewingKey)}` as HexString

    const metaAddress: StealthMetaAddress = {
      chain: 'ethereum',
      spendingKey: spendingKeyHex,
      viewingKey: viewingKeyHex,
    }

    this.stealthKeys = {
      metaAddress,
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
      encodedMetaAddress: encodeEthereumStealthMetaAddress(metaAddress),
    }

    // Store privacy context
    this.privacyContext = {
      keys: this.stealthKeys,
      derivedFromWallet: true,
      derivationDomain: this.derivationDomain,
      derivedForAddress: this.address,
    }
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** secp256k1 curve order */
const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert bytes to BigInt (big-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

/**
 * Ensure key is valid for secp256k1 (1 < key < curve order)
 */
function ensureValidSecp256k1Key(hash: Uint8Array): Uint8Array {
  let key = bytesToBigInt(hash)

  // Reduce modulo curve order and ensure non-zero
  key = key % SECP256K1_ORDER
  if (key === 0n) {
    key = 1n
  }

  // Convert back to bytes
  const result = new Uint8Array(32)
  for (let i = 31; i >= 0; i--) {
    result[i] = Number(key & 0xffn)
    key >>= 8n
  }

  return result
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a privacy-enabled Ethereum wallet adapter
 *
 * @example Random keys
 * ```typescript
 * const wallet = createPrivacyEthereumAdapter({ wallet: 'metamask' })
 * await wallet.connect()
 * await wallet.initializePrivacy()
 * ```
 *
 * @example Deterministic keys from wallet
 * ```typescript
 * const wallet = createPrivacyEthereumAdapter({
 *   wallet: 'metamask',
 *   deriveFromWallet: true,
 * })
 * await wallet.connect()
 * await wallet.initializePrivacy() // Will prompt for signature
 * ```
 */
export function createPrivacyEthereumAdapter(
  config: PrivacyEthereumAdapterConfig = {}
): PrivacyEthereumWalletAdapter {
  return new PrivacyEthereumWalletAdapter(config)
}
