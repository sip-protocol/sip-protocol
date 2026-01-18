/**
 * Solana Key Derivation for SIP Stealth Addresses
 *
 * Derives spending and viewing keypairs from Solana seed phrases (BIP39 mnemonics)
 * using standard Solana derivation paths (SLIP-0010 for ed25519).
 *
 * @module chains/solana/key-derivation
 */

import {
  generateMnemonic as bip39GenerateMnemonic,
  validateMnemonic as bip39ValidateMnemonic,
  mnemonicToSeedSync,
} from '@scure/bip39'
import { wordlist as english } from '@scure/bip39/wordlists/english.js'
import { ed25519 } from '@noble/curves/ed25519'
import { sha256, sha512 } from '@noble/hashes/sha2'
import { hmac } from '@noble/hashes/hmac'
import type { StealthMetaAddress, HexString } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { bytesToHex } from '../../stealth/utils'
import { secureWipe } from '../../secure-memory'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Standard Solana derivation path (BIP44)
 *
 * m/44'/501'/account'/change'
 *
 * - 44' = BIP44 purpose
 * - 501' = Solana coin type
 * - 0' = first account
 * - 0' = external chain (most wallets use this)
 */
export const SOLANA_DEFAULT_PATH = "m/44'/501'/0'/0'"

/**
 * SIP-specific derivation context for viewing key
 *
 * The viewing key is derived deterministically from the spending key
 * using HMAC-SHA256 with this context string.
 */
const VIEWING_KEY_CONTEXT = 'SIP-viewing-key-v1'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Options for key derivation from mnemonic
 */
export interface SolanaKeyDerivationOptions {
  /**
   * BIP39 mnemonic phrase (12 or 24 words)
   */
  mnemonic: string

  /**
   * Optional passphrase for BIP39 seed derivation
   * @default undefined (no passphrase)
   */
  passphrase?: string

  /**
   * Derivation path for the spending key
   * @default "m/44'/501'/0'/0'" (standard Solana)
   */
  derivationPath?: string

  /**
   * Account index to use (modifies derivation path)
   * @default 0
   */
  accountIndex?: number

  /**
   * Optional label for the generated meta-address
   */
  label?: string
}

/**
 * Result of key derivation
 */
export interface SolanaKeyDerivationResult {
  /**
   * The stealth meta-address (safe to share publicly)
   */
  metaAddress: StealthMetaAddress

  /**
   * Spending private key (CRITICAL - never share)
   */
  spendingPrivateKey: HexString

  /**
   * Viewing private key (sensitive - share only with auditors)
   */
  viewingPrivateKey: HexString

  /**
   * The derivation path used
   */
  derivationPath: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a BIP39 mnemonic phrase
 *
 * @param mnemonic - The mnemonic to validate
 * @returns true if valid
 * @throws {ValidationError} if invalid
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    throw new ValidationError('Mnemonic must be a non-empty string', 'mnemonic')
  }

  // Normalize: trim, lowercase, and collapse multiple spaces
  const words = mnemonic.trim().toLowerCase().split(/\s+/)
  const normalized = words.join(' ')

  // Standard BIP39 supports 12, 15, 18, 21, or 24 words
  const validLengths = [12, 15, 18, 21, 24]
  if (!validLengths.includes(words.length)) {
    throw new ValidationError(
      `Mnemonic must have 12, 15, 18, 21, or 24 words (got ${words.length})`,
      'mnemonic'
    )
  }

  // Validate using bip39 library
  if (!bip39ValidateMnemonic(normalized, english)) {
    throw new ValidationError(
      'Invalid mnemonic: checksum failed or contains invalid words',
      'mnemonic'
    )
  }

  return true
}

/**
 * Validate a derivation path
 *
 * @param path - The derivation path to validate
 * @returns true if valid
 * @throws {ValidationError} if invalid
 */
export function validateDerivationPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    throw new ValidationError('Derivation path must be a non-empty string', 'derivationPath')
  }

  // Must start with 'm/'
  if (!path.startsWith('m/')) {
    throw new ValidationError("Derivation path must start with 'm/'", 'derivationPath')
  }

  // Validate path format (e.g., m/44'/501'/0'/0')
  const pathRegex = /^m(\/\d+'?)*$/
  if (!pathRegex.test(path)) {
    throw new ValidationError(
      'Invalid derivation path format. Use format like m/44\'/501\'/0\'/0\'',
      'derivationPath'
    )
  }

  return true
}

// ─── SLIP-0010 ed25519 Key Derivation ─────────────────────────────────────────

/**
 * Derive ed25519 private key using SLIP-0010 from BIP39 seed
 *
 * SLIP-0010 defines ed25519 key derivation differently from secp256k1.
 * It uses HMAC-SHA512 at each derivation level.
 *
 * Note: SLIP-0010 for ed25519 only supports hardened derivation.
 *
 * @param seed - 64-byte BIP39 seed
 * @param path - Derivation path (all indices must be hardened)
 * @returns 32-byte ed25519 private key
 */
function slip0010DeriveEd25519(seed: Uint8Array, path: string): Uint8Array {
  // SLIP-0010 ed25519 master key derivation using HMAC-SHA512
  const I = hmac(sha512, 'ed25519 seed', seed)

  let key: Uint8Array = new Uint8Array(I.slice(0, 32))
  let chainCode: Uint8Array = new Uint8Array(I.slice(32, 64))

  // Parse path components (skip 'm')
  const components = path.split('/').slice(1)

  for (const component of components) {
    // All ed25519 derivations must be hardened
    const hardened = component.endsWith("'")
    const indexStr = hardened ? component.slice(0, -1) : component
    const index = parseInt(indexStr, 10)

    if (!hardened) {
      throw new ValidationError(
        'SLIP-0010 ed25519 only supports hardened derivation. Add \' to path index.',
        'derivationPath'
      )
    }

    // Hardened child: index + 0x80000000
    const hardenedIndex = index + 0x80000000

    // HMAC-SHA512(chainCode, 0x00 || key || index)
    const data = new Uint8Array(1 + 32 + 4)
    data[0] = 0x00
    data.set(key, 1)
    new DataView(data.buffer).setUint32(33, hardenedIndex, false) // big-endian

    const derivedI = hmac(sha512, chainCode, data)

    // Split into key (first 32 bytes) and chain code (last 32 bytes)
    key = new Uint8Array(derivedI.slice(0, 32))
    chainCode = new Uint8Array(derivedI.slice(32, 64))
  }

  return key
}

// ─── Key Derivation ───────────────────────────────────────────────────────────

/**
 * Derive spending and viewing keypairs from a Solana mnemonic
 *
 * This is the primary function for generating SIP stealth keys from an existing
 * Solana wallet's seed phrase.
 *
 * @param options - Derivation options including mnemonic and optional path
 * @returns Stealth meta-address and private keys
 *
 * @example Basic usage
 * ```typescript
 * const result = deriveSolanaStealthKeys({
 *   mnemonic: 'abandon abandon abandon ... about',
 * })
 *
 * console.log('Meta-address:', result.metaAddress)
 * // Share metaAddress with senders
 * // Keep spendingPrivateKey SECURE
 * // viewingPrivateKey can be shared with auditors
 * ```
 *
 * @example With custom derivation path
 * ```typescript
 * const result = deriveSolanaStealthKeys({
 *   mnemonic: 'your twelve word mnemonic phrase here ...',
 *   derivationPath: "m/44'/501'/1'/0'", // Second account
 *   label: 'Trading account',
 * })
 * ```
 *
 * @example With account index shorthand
 * ```typescript
 * const result = deriveSolanaStealthKeys({
 *   mnemonic: 'your mnemonic...',
 *   accountIndex: 2, // Uses m/44'/501'/2'/0'
 * })
 * ```
 */
export function deriveSolanaStealthKeys(
  options: SolanaKeyDerivationOptions
): SolanaKeyDerivationResult {
  // Validate mnemonic
  validateMnemonic(options.mnemonic)

  // Determine derivation path
  let derivationPath = options.derivationPath ?? SOLANA_DEFAULT_PATH

  // If accountIndex is specified, override the path
  if (options.accountIndex !== undefined) {
    if (options.accountIndex < 0 || !Number.isInteger(options.accountIndex)) {
      throw new ValidationError(
        'accountIndex must be a non-negative integer',
        'accountIndex'
      )
    }
    derivationPath = `m/44'/501'/${options.accountIndex}'/0'`
  }

  validateDerivationPath(derivationPath)

  // Convert mnemonic to seed (normalize whitespace and case)
  const normalizedMnemonic = options.mnemonic.trim().toLowerCase().split(/\s+/).join(' ')
  const seed = mnemonicToSeedSync(normalizedMnemonic, options.passphrase)

  let spendingPrivateKeyBytes: Uint8Array | null = null
  let viewingPrivateKeyBytes: Uint8Array | null = null

  try {
    // Derive spending key using SLIP-0010 for ed25519
    spendingPrivateKeyBytes = slip0010DeriveEd25519(seed, derivationPath)

    // Derive viewing key deterministically from spending key
    // Using HMAC-SHA256 with context ensures:
    // 1. Different key from spending key
    // 2. Deterministic (can be recovered from spending key)
    // 3. Cryptographically secure derivation
    viewingPrivateKeyBytes = hmac(
      sha256,
      new TextEncoder().encode(VIEWING_KEY_CONTEXT),
      spendingPrivateKeyBytes
    )

    // Derive public keys
    const spendingPublicKey = ed25519.getPublicKey(spendingPrivateKeyBytes)
    const viewingPublicKey = ed25519.getPublicKey(viewingPrivateKeyBytes)

    return {
      metaAddress: {
        spendingKey: `0x${bytesToHex(spendingPublicKey)}` as HexString,
        viewingKey: `0x${bytesToHex(viewingPublicKey)}` as HexString,
        chain: 'solana',
        label: options.label,
      },
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKeyBytes)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKeyBytes)}` as HexString,
      derivationPath,
    }
  } finally {
    // Secure wipe sensitive data
    secureWipe(seed)
    if (spendingPrivateKeyBytes) secureWipe(spendingPrivateKeyBytes)
    if (viewingPrivateKeyBytes) secureWipe(viewingPrivateKeyBytes)
  }
}

/**
 * Derive viewing key from spending key
 *
 * Useful when you have the spending private key but need to generate
 * the corresponding viewing key.
 *
 * @param spendingPrivateKey - The spending private key
 * @returns The viewing private key
 */
export function deriveViewingKeyFromSpending(
  spendingPrivateKey: HexString
): HexString {
  if (!spendingPrivateKey || !spendingPrivateKey.startsWith('0x')) {
    throw new ValidationError(
      'spendingPrivateKey must be a hex string with 0x prefix',
      'spendingPrivateKey'
    )
  }

  const spendingBytes = new Uint8Array(
    (spendingPrivateKey.slice(2).match(/.{2}/g) ?? []).map(b => parseInt(b, 16))
  )

  if (spendingBytes.length !== 32) {
    throw new ValidationError(
      'spendingPrivateKey must be 32 bytes',
      'spendingPrivateKey'
    )
  }

  try {
    const viewingBytes = hmac(
      sha256,
      new TextEncoder().encode(VIEWING_KEY_CONTEXT),
      spendingBytes
    )

    return `0x${bytesToHex(viewingBytes)}` as HexString
  } finally {
    secureWipe(spendingBytes)
  }
}

/**
 * Generate a new random mnemonic phrase
 *
 * @param strength - Entropy strength in bits (128 = 12 words, 256 = 24 words)
 * @returns A new BIP39 mnemonic phrase
 */
export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39GenerateMnemonic(english, strength)
}

/**
 * Check if a string is a valid BIP39 mnemonic
 *
 * @param mnemonic - The string to check
 * @returns true if valid mnemonic, false otherwise
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    validateMnemonic(mnemonic)
    return true
  } catch {
    return false
  }
}

/**
 * Get derivation path for a specific account index
 *
 * @param accountIndex - Account index (0-based)
 * @returns Standard Solana derivation path for that account
 */
export function getDerivationPath(accountIndex: number = 0): string {
  if (accountIndex < 0 || !Number.isInteger(accountIndex)) {
    throw new ValidationError(
      'accountIndex must be a non-negative integer',
      'accountIndex'
    )
  }
  return `m/44'/501'/${accountIndex}'/0'`
}
