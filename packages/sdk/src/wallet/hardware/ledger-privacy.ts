/**
 * Ledger Privacy Wallet Adapter
 *
 * Extends the Ledger wallet adapter with privacy features for
 * Ethereum stealth address operations.
 *
 * @module wallet/hardware/ledger-privacy
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString, StealthMetaAddress, StealthAddress } from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { WalletError } from '../errors'
import { LedgerWalletAdapter } from './ledger'
import {
  type LedgerConfig,
  type HardwareAccount,
  HardwareErrorCode,
  HardwareWalletError,
} from './types'
import {
  generateEthereumStealthAddress,
  deriveEthereumStealthPrivateKey,
  checkEthereumStealthAddress,
  encodeEthereumStealthMetaAddress,
} from '../../chains/ethereum/stealth'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Privacy Ledger adapter configuration
 */
export interface LedgerPrivacyConfig extends Omit<LedgerConfig, 'chain'> {
  /**
   * Domain for key derivation message
   * Used to generate deterministic privacy keys
   */
  derivationDomain?: string
  /**
   * Nonce for key derivation (default: 0)
   * Different nonces produce different key sets
   */
  derivationNonce?: number
}

/**
 * Ledger-derived stealth key material
 */
export interface LedgerStealthKeyMaterial {
  /** Stealth meta-address */
  metaAddress: StealthMetaAddress
  /** Spending private key (derived from signature) */
  spendingPrivateKey: HexString
  /** Viewing private key (derived from signature) */
  viewingPrivateKey: HexString
  /** Encoded meta-address string */
  encodedMetaAddress: string
}

/**
 * Scanned payment from stealth address
 */
export interface LedgerScannedPayment {
  /** Original stealth address announcement */
  announcement: StealthAddress
  /** Derived private key to claim funds */
  claimKey: HexString
  /** Standard Ethereum address for the stealth address */
  ethAddress: HexString
}

/**
 * Claim result from stealth address
 */
export interface LedgerClaimResult {
  /** Stealth address */
  stealthAddress: HexString
  /** Ephemeral public key used */
  ephemeralPublicKey: HexString
  /** Private key to claim funds */
  privateKey: HexString
  /** Standard Ethereum address */
  ethAddress: HexString
}

// ─── Ledger Privacy Adapter ─────────────────────────────────────────────────

/**
 * Ledger Privacy Wallet Adapter
 *
 * Provides privacy features (stealth addresses) for Ledger hardware wallets.
 * Keys are derived from signatures on the device, ensuring private keys
 * never leave the hardware wallet.
 *
 * @example Basic usage
 * ```typescript
 * const ledger = new LedgerPrivacyAdapter({
 *   accountIndex: 0,
 *   derivationDomain: 'myapp.com',
 * })
 *
 * await ledger.connect()
 * await ledger.initializePrivacy()
 *
 * // Get stealth meta-address for receiving
 * const metaAddress = ledger.getMetaAddress()
 *
 * // Scan for payments
 * const payments = ledger.scanPayments(announcements)
 * ```
 *
 * @remarks
 * Hardware wallets cannot export private keys directly. Instead, we derive
 * privacy keys by signing a deterministic message and using the signature
 * as entropy. The same domain/nonce will always produce the same keys.
 *
 * IMPORTANT: Privacy keys are held in memory and will be lost when the
 * adapter is disconnected. Call `initializePrivacy()` after each connection.
 */
export class LedgerPrivacyAdapter extends LedgerWalletAdapter {
  private derivationDomain: string
  private derivationNonce: number
  private stealthKeys: LedgerStealthKeyMaterial | undefined
  private _privacyInitialized: boolean = false

  constructor(config: LedgerPrivacyConfig) {
    super({
      ...config,
      chain: 'ethereum', // Privacy adapter is Ethereum-only
    })
    this.derivationDomain = config.derivationDomain ?? 'sip-protocol.org'
    this.derivationNonce = config.derivationNonce ?? 0
  }

  // ─── Privacy Initialization ─────────────────────────────────────────────────

  /**
   * Initialize privacy features
   *
   * Derives stealth keys by signing a message on the Ledger device.
   * This requires user approval on the device.
   *
   * @throws {HardwareWalletError} If user rejects or device error
   */
  async initializePrivacy(): Promise<void> {
    this.requireConnected()

    try {
      // Build key derivation message
      const message = this.buildKeyDerivationMessage()
      const messageBytes = new TextEncoder().encode(message)

      // Sign on Ledger (requires user approval)
      const signature = await this.signMessage(messageBytes)

      // Derive stealth keys from signature
      this.stealthKeys = this.deriveStealthKeysFromSignature(signature.signature)
      this._privacyInitialized = true
    } catch (error) {
      if (error instanceof HardwareWalletError) {
        throw error
      }
      throw new HardwareWalletError(
        'Failed to initialize privacy keys',
        HardwareErrorCode.TRANSPORT_ERROR,
        'ledger',
        error
      )
    }
  }

  /**
   * Check if privacy is initialized
   */
  isPrivacyInitialized(): boolean {
    return this._privacyInitialized && this.stealthKeys !== undefined
  }

  /**
   * Require privacy to be initialized
   */
  private requirePrivacy(): void {
    if (!this.isPrivacyInitialized()) {
      throw new WalletError(
        'Privacy not initialized. Call initializePrivacy() first.',
        WalletErrorCode.NOT_CONNECTED
      )
    }
  }

  // ─── Stealth Address Operations ─────────────────────────────────────────────

  /**
   * Get stealth meta-address for receiving private payments
   */
  getMetaAddress(): StealthMetaAddress {
    this.requirePrivacy()
    return this.stealthKeys!.metaAddress
  }

  /**
   * Get encoded stealth meta-address string
   *
   * Format: st:eth:0x<spendingKey><viewingKey>
   */
  getEncodedMetaAddress(): string {
    this.requirePrivacy()
    return this.stealthKeys!.encodedMetaAddress
  }

  /**
   * Get stealth key material (for backup/export)
   *
   * @remarks
   * SECURITY: Handle with care - contains private keys.
   * Only export if user explicitly requests backup.
   */
  getStealthKeys(): LedgerStealthKeyMaterial | undefined {
    return this.stealthKeys
  }

  /**
   * Generate a stealth address for a recipient
   *
   * @param recipientMetaAddress - Recipient's stealth meta-address
   * @returns Generated stealth address
   */
  generateStealthAddress(recipientMetaAddress: StealthMetaAddress): StealthAddress {
    const result = generateEthereumStealthAddress(recipientMetaAddress)
    return result.stealthAddress
  }

  /**
   * Scan announcements for payments to this wallet
   *
   * @param announcements - Stealth address announcements to scan
   * @returns Payments that belong to this wallet
   */
  scanPayments(announcements: StealthAddress[]): LedgerScannedPayment[] {
    this.requirePrivacy()

    const payments: LedgerScannedPayment[] = []

    for (const announcement of announcements) {
      // Check if this payment belongs to us using viewing key
      const isOurs = checkEthereumStealthAddress(
        announcement,
        this.stealthKeys!.spendingPrivateKey,
        this.stealthKeys!.viewingPrivateKey
      )

      if (isOurs) {
        // Derive claim key
        const recovery = deriveEthereumStealthPrivateKey(
          announcement,
          this.stealthKeys!.spendingPrivateKey,
          this.stealthKeys!.viewingPrivateKey
        )

        payments.push({
          announcement,
          claimKey: recovery.privateKey,
          ethAddress: recovery.ethAddress,
        })
      }
    }

    return payments
  }

  /**
   * Derive claim key for a specific stealth address
   *
   * @param stealthAddress - The stealth address announcement
   * @returns Claim result with private key
   */
  deriveClaimKey(stealthAddress: StealthAddress): LedgerClaimResult {
    this.requirePrivacy()

    const recovery = deriveEthereumStealthPrivateKey(
      stealthAddress,
      this.stealthKeys!.spendingPrivateKey,
      this.stealthKeys!.viewingPrivateKey
    )

    return {
      stealthAddress: recovery.stealthAddress,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      privateKey: recovery.privateKey,
      ethAddress: recovery.ethAddress,
    }
  }

  // ─── Account Management ─────────────────────────────────────────────────────

  /**
   * Switch account and reinitialize privacy
   *
   * @param accountIndex - New account index
   * @returns New account info
   */
  async switchAccountWithPrivacy(accountIndex: number): Promise<HardwareAccount> {
    const account = await this.switchAccount(accountIndex)

    // Clear old privacy keys
    this.stealthKeys = undefined
    this._privacyInitialized = false

    // User must call initializePrivacy() again
    return account
  }

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  /**
   * Disconnect and clear privacy keys
   */
  async disconnect(): Promise<void> {
    this.stealthKeys = undefined
    this._privacyInitialized = false
    await super.disconnect()
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Build key derivation message
   *
   * This message is signed on the Ledger to derive privacy keys.
   * The same domain/nonce/address always produces the same signature.
   */
  private buildKeyDerivationMessage(): string {
    return [
      'SIP Protocol Privacy Key Derivation',
      '',
      `Domain: ${this.derivationDomain}`,
      `Address: ${this.address}`,
      `Nonce: ${this.derivationNonce}`,
      '',
      'Sign this message to generate your privacy keys.',
      'Your keys will be derived deterministically from this signature.',
    ].join('\n')
  }

  /**
   * Derive stealth keys from signature
   *
   * Uses the signature as entropy to generate spending and viewing keys.
   */
  private deriveStealthKeysFromSignature(signature: HexString): LedgerStealthKeyMaterial {
    // Remove 0x prefix
    const sigBytes = hexToBytes(signature.slice(2))

    // Derive spending key: hash(signature || "spending")
    const spendingInput = new Uint8Array(sigBytes.length + 8)
    spendingInput.set(sigBytes)
    spendingInput.set(new TextEncoder().encode('spending'), sigBytes.length)
    const spendingPrivateKeyBytes = sha256(spendingInput)
    const spendingPrivateKey = `0x${bytesToHex(spendingPrivateKeyBytes)}` as HexString

    // Derive viewing key: hash(signature || "viewing")
    const viewingInput = new Uint8Array(sigBytes.length + 7)
    viewingInput.set(sigBytes)
    viewingInput.set(new TextEncoder().encode('viewing'), sigBytes.length)
    const viewingPrivateKeyBytes = sha256(viewingInput)
    const viewingPrivateKey = `0x${bytesToHex(viewingPrivateKeyBytes)}` as HexString

    // Derive public keys from private keys using secp256k1
    const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKeyBytes, true)
    const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKeyBytes, true)

    // Create meta-address
    const metaAddress: StealthMetaAddress = {
      spendingKey: `0x${bytesToHex(spendingPublicKey)}` as HexString,
      viewingKey: `0x${bytesToHex(viewingPublicKey)}` as HexString,
      chain: 'ethereum',
    }

    const encodedMetaAddress = encodeEthereumStealthMetaAddress(metaAddress)

    return {
      metaAddress,
      spendingPrivateKey,
      viewingPrivateKey,
      encodedMetaAddress,
    }
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

/**
 * Create a Ledger privacy adapter
 *
 * @example
 * ```typescript
 * const ledger = createLedgerPrivacyAdapter({
 *   accountIndex: 0,
 *   derivationDomain: 'myapp.com',
 * })
 *
 * await ledger.connect()
 * await ledger.initializePrivacy()
 *
 * const metaAddress = ledger.getEncodedMetaAddress()
 * ```
 */
export function createLedgerPrivacyAdapter(
  config: LedgerPrivacyConfig
): LedgerPrivacyAdapter {
  return new LedgerPrivacyAdapter(config)
}
