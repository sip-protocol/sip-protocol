/**
 * Privacy-Extended Solana Wallet Adapter
 *
 * Extends SolanaWalletAdapter with stealth address capabilities for
 * same-chain privacy operations.
 *
 * @module wallet/solana/privacy-adapter
 */

import type {
  HexString,
  StealthMetaAddress,
  StealthAddress,
} from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha2'
import { ed25519 } from '@noble/curves/ed25519'
import { SolanaWalletAdapter } from './adapter'
import type { SolanaAdapterConfig } from './types'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../stealth'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Configuration for privacy adapter
 */
export interface PrivacySolanaAdapterConfig extends SolanaAdapterConfig {
  /**
   * Pre-existing stealth meta-address to use
   * If not provided, one will be generated on first use
   */
  metaAddress?: StealthMetaAddress
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
 * Stealth key material
 */
export interface StealthKeyMaterial {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
}

/**
 * Scanned stealth payment
 */
export interface ScannedPayment {
  /** Stealth address that received the payment */
  stealthAddress: string
  /** Ephemeral public key from sender */
  ephemeralPublicKey: HexString
  /** View tag for fast scanning */
  viewTag: number
  /** Whether this payment belongs to us */
  isOwned: boolean
  /** Solana address format of stealth address */
  solanaAddress: string
}

/**
 * Result of claiming a stealth payment
 */
export interface ClaimResult {
  /** Derived private key for spending */
  privateKey: HexString
  /** Public key (stealth address) */
  publicKey: HexString
  /** Solana address format */
  solanaAddress: string
}

// ─── Privacy Adapter ────────────────────────────────────────────────────────

/**
 * Privacy-enabled Solana wallet adapter
 *
 * Extends the base SolanaWalletAdapter with:
 * - Stealth meta-address generation and management
 * - Stealth address derivation for receiving
 * - Private key derivation for spending
 * - Payment scanning with view tags
 *
 * @example Generate stealth address for receiving
 * ```typescript
 * const wallet = new PrivacySolanaWalletAdapter({ wallet: 'phantom' })
 * await wallet.connect()
 * await wallet.initializePrivacy()
 *
 * // Share meta-address with senders
 * const metaAddress = wallet.getMetaAddress()
 * console.log('Send to:', metaAddress)
 * ```
 *
 * @example Derive from wallet (deterministic)
 * ```typescript
 * const wallet = new PrivacySolanaWalletAdapter({
 *   wallet: 'phantom',
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
export class PrivacySolanaWalletAdapter extends SolanaWalletAdapter {
  private stealthKeys: StealthKeyMaterial | undefined
  private deriveFromWallet: boolean
  private derivationDomain: string

  constructor(config: PrivacySolanaAdapterConfig = {}) {
    super(config)

    this.deriveFromWallet = config.deriveFromWallet ?? false
    this.derivationDomain = config.derivationDomain ?? 'sip-protocol.org'

    // If pre-existing keys provided, validate and store
    if (config.metaAddress) {
      if (!config.spendingPrivateKey || !config.viewingPrivateKey) {
        throw new Error('spendingPrivateKey and viewingPrivateKey required when metaAddress provided')
      }
      this.stealthKeys = {
        metaAddress: config.metaAddress,
        spendingPrivateKey: config.spendingPrivateKey,
        viewingPrivateKey: config.viewingPrivateKey,
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
  generateStealthAddressFor(recipientMetaAddress: StealthMetaAddress): {
    stealthAddress: StealthAddress
    solanaAddress: string
    sharedSecret: HexString
  } {
    const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(recipientMetaAddress)
    const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

    return {
      stealthAddress,
      solanaAddress,
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
  scanPayments(announcements: StealthAddress[]): ScannedPayment[] {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }

    const results: ScannedPayment[] = []

    for (const announcement of announcements) {
      try {
        const isOwned = checkEd25519StealthAddress(
          announcement,
          this.stealthKeys.metaAddress.spendingKey,
          this.stealthKeys.viewingPrivateKey,
        )

        results.push({
          stealthAddress: announcement.address,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          viewTag: announcement.viewTag,
          isOwned,
          solanaAddress: ed25519PublicKeyToSolanaAddress(announcement.address),
        })
      } catch {
        // Invalid announcement, skip
        results.push({
          stealthAddress: announcement.address,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          viewTag: announcement.viewTag,
          isOwned: false,
          solanaAddress: '',
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

    // Compute expected view tag from our viewing key
    // View tags are derived from hash(viewing_key || ephemeral_key)[0]
    const viewingKeyBytes = hexToBytes(this.stealthKeys.metaAddress.viewingKey.slice(2))

    return announcements.filter(ann => {
      try {
        const ephemeralBytes = hexToBytes(ann.ephemeralPublicKey.slice(2))

        // Compute expected view tag
        const combined = new Uint8Array(viewingKeyBytes.length + ephemeralBytes.length)
        combined.set(viewingKeyBytes)
        combined.set(ephemeralBytes, viewingKeyBytes.length)

        const hash = sha256(combined)
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
  ): ClaimResult {
    if (!this.stealthKeys) {
      throw new Error('Privacy not initialized. Call initializePrivacy() first.')
    }

    // Compute stealth address from ephemeral key
    const ephemeralPubBytes = hexToBytes(ephemeralPublicKey.slice(2))

    // Compute shared secret: S = spending_scalar * R
    const spendingScalar = getEd25519ScalarFromPrivate(
      hexToBytes(this.stealthKeys.spendingPrivateKey.slice(2))
    )

    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
    const sharedSecretPoint = ephemeralPoint.multiply(spendingScalar)
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // Derive stealth public key: P_stealth = P_view + hash(S)*G
    const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
    const hashTimesG = ed25519.ExtendedPoint.BASE.multiply(hashScalar)

    const viewingPoint = ed25519.ExtendedPoint.fromHex(
      hexToBytes(this.stealthKeys.metaAddress.viewingKey.slice(2))
    )
    const stealthPoint = viewingPoint.add(hashTimesG)
    const stealthAddressHex = `0x${bytesToHex(stealthPoint.toRawBytes())}` as HexString

    // Create StealthAddress for derivation
    const stealthAddr: StealthAddress = {
      address: stealthAddressHex,
      ephemeralPublicKey,
      viewTag,
    }

    // Derive the private key
    const recovery = deriveEd25519StealthPrivateKey(
      stealthAddr,
      this.stealthKeys.spendingPrivateKey,
      this.stealthKeys.viewingPrivateKey,
    )

    return {
      privateKey: recovery.privateKey,
      publicKey: stealthAddressHex,
      solanaAddress: ed25519PublicKeyToSolanaAddress(stealthAddressHex),
    }
  }

  /**
   * Export stealth keys for backup
   *
   * Returns all key material needed to restore privacy functionality.
   * SENSITIVE: Store securely and never expose.
   */
  exportStealthKeys(): StealthKeyMaterial | undefined {
    return this.stealthKeys ? { ...this.stealthKeys } : undefined
  }

  /**
   * Import stealth keys from backup
   *
   * @param keys - Previously exported stealth keys
   */
  importStealthKeys(keys: StealthKeyMaterial): void {
    this.stealthKeys = { ...keys }
  }

  /**
   * Generate random stealth keys
   */
  private generateRandomStealthKeys(): void {
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
      generateEd25519StealthMetaAddress('solana')

    this.stealthKeys = {
      metaAddress,
      spendingPrivateKey,
      viewingPrivateKey,
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
    const spendingPrivateKey = sha256(spendingInput)

    // Derive viewing key: hash(sig || "viewing")
    const viewingInput = new Uint8Array(signatureBytes.length + 7)
    viewingInput.set(signatureBytes)
    viewingInput.set(new TextEncoder().encode('viewing'), signatureBytes.length)
    const viewingPrivateKey = sha256(viewingInput)

    // Compute public keys
    const spendingKey = ed25519.getPublicKey(spendingPrivateKey)
    const viewingKey = ed25519.getPublicKey(viewingPrivateKey)

    this.stealthKeys = {
      metaAddress: {
        chain: 'solana',
        spendingKey: `0x${bytesToHex(spendingKey)}` as HexString,
        viewingKey: `0x${bytesToHex(viewingKey)}` as HexString,
      },
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
    }
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** ed25519 curve order */
const ED25519_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed')

/**
 * Convert bytes to BigInt (little-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

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
 * Get ed25519 scalar from private key seed
 *
 * ed25519 derives the actual scalar by hashing the seed and taking
 * the lower 32 bytes with specific bit manipulations.
 */
function getEd25519ScalarFromPrivate(seed: Uint8Array): bigint {
  // Hash the seed to get 64 bytes
  const h = sha256(seed)

  // Take lower 32 bytes and apply ed25519 clamping
  const scalar = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    scalar[i] = h[i]
  }

  // Clamp: clear low 3 bits, clear high bit, set second-high bit
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64

  return bytesToBigInt(scalar)
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a privacy-enabled Solana wallet adapter
 *
 * @example Random keys
 * ```typescript
 * const wallet = createPrivacySolanaAdapter({ wallet: 'phantom' })
 * await wallet.connect()
 * await wallet.initializePrivacy()
 * ```
 *
 * @example Deterministic keys from wallet
 * ```typescript
 * const wallet = createPrivacySolanaAdapter({
 *   wallet: 'phantom',
 *   deriveFromWallet: true,
 * })
 * await wallet.connect()
 * await wallet.initializePrivacy() // Will prompt for signature
 * ```
 */
export function createPrivacySolanaAdapter(
  config: PrivacySolanaAdapterConfig = {}
): PrivacySolanaWalletAdapter {
  return new PrivacySolanaWalletAdapter(config)
}
