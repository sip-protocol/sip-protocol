/**
 * Privacy level handling for SIP Protocol
 *
 * Provides authenticated encryption using XChaCha20-Poly1305 for viewing key
 * selective disclosure. This allows transaction details to be encrypted and
 * later revealed to auditors holding the viewing key.
 *
 * ## Security Properties
 * - **Confidentiality**: Only viewing key holders can decrypt
 * - **Integrity**: Authentication tag prevents tampering
 * - **Nonce-misuse resistance**: XChaCha20 uses 24-byte nonces
 */

import type {
  PrivacyLevel,
  ViewingKey,
  EncryptedTransaction,
  HexString,
  Hash,
} from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { hkdf } from '@noble/hashes/hkdf'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { ValidationError, CryptoError, ErrorCode } from './errors'

/**
 * Privacy configuration for an intent
 */
export interface PrivacyConfig {
  /** The privacy level */
  level: PrivacyLevel
  /** Viewing key (required for compliant mode) */
  viewingKey?: ViewingKey
  /** Whether to use stealth addresses */
  useStealth: boolean
  /** Whether to encrypt transaction data */
  encryptData: boolean
}

/**
 * Get privacy configuration for a privacy level
 */
export function getPrivacyConfig(
  level: PrivacyLevel,
  viewingKey?: ViewingKey,
): PrivacyConfig {
  switch (level) {
    case 'transparent':
      return {
        level,
        useStealth: false,
        encryptData: false,
      }

    case 'shielded':
      return {
        level,
        useStealth: true,
        encryptData: true,
      }

    case 'compliant':
      if (!viewingKey) {
        throw new ValidationError(
          'viewingKey is required for compliant mode',
          'viewingKey',
          undefined,
          ErrorCode.MISSING_REQUIRED
        )
      }
      return {
        level,
        viewingKey,
        useStealth: true,
        encryptData: true,
      }

    default:
      throw new ValidationError(
        `unknown privacy level: ${level}`,
        'level',
        { received: level },
        ErrorCode.INVALID_PRIVACY_LEVEL
      )
  }
}

/**
 * Generate a new viewing key
 */
export function generateViewingKey(path: string = 'm/0'): ViewingKey {
  const keyBytes = randomBytes(32)
  const key = `0x${bytesToHex(keyBytes)}` as HexString
  const hashBytes = sha256(keyBytes)

  return {
    key,
    path,
    hash: `0x${bytesToHex(hashBytes)}` as Hash,
  }
}

/**
 * Derive a child viewing key
 */
export function deriveViewingKey(
  masterKey: ViewingKey,
  childPath: string,
): ViewingKey {
  // Simple derivation: hash(masterKey || childPath)
  const combined = new TextEncoder().encode(`${masterKey.key}:${childPath}`)
  const derivedBytes = sha256(combined)
  const derived = `0x${bytesToHex(derivedBytes)}` as HexString
  const hashBytes = sha256(derivedBytes)

  return {
    key: derived,
    path: `${masterKey.path}/${childPath}`,
    hash: `0x${bytesToHex(hashBytes)}` as Hash,
  }
}

// ─── Encryption Constants ─────────────────────────────────────────────────────

/**
 * Domain separation for encryption key derivation
 */
const ENCRYPTION_DOMAIN = 'SIP-VIEWING-KEY-ENCRYPTION-V1'

/**
 * XChaCha20-Poly1305 nonce size (24 bytes)
 */
const NONCE_SIZE = 24

// ─── Key Derivation ───────────────────────────────────────────────────────────

/**
 * Derive an encryption key from a viewing key using HKDF
 *
 * Uses HKDF-SHA256 with domain separation for security.
 *
 * @param viewingKey - The viewing key to derive from
 * @returns 32-byte encryption key
 */
function deriveEncryptionKey(viewingKey: ViewingKey): Uint8Array {
  // Extract the raw key bytes (remove 0x prefix)
  const keyHex = viewingKey.key.startsWith('0x')
    ? viewingKey.key.slice(2)
    : viewingKey.key
  const keyBytes = hexToBytes(keyHex)

  // Use HKDF to derive a proper encryption key
  // HKDF(SHA256, ikm=viewingKey, salt=domain, info=path, length=32)
  const salt = utf8ToBytes(ENCRYPTION_DOMAIN)
  const info = utf8ToBytes(viewingKey.path)

  return hkdf(sha256, keyBytes, salt, info, 32)
}

// ─── Transaction Data Type ────────────────────────────────────────────────────

/**
 * Transaction data that can be encrypted for viewing
 */
export interface TransactionData {
  sender: string
  recipient: string
  amount: string
  timestamp: number
}

// ─── Encryption Functions ─────────────────────────────────────────────────────

/**
 * Encrypt transaction data for viewing key holders
 *
 * Uses XChaCha20-Poly1305 authenticated encryption with:
 * - 24-byte random nonce (nonce-misuse resistant)
 * - HKDF-derived encryption key
 * - 16-byte authentication tag (included in ciphertext)
 *
 * @param data - Transaction data to encrypt
 * @param viewingKey - Viewing key for encryption
 * @returns Encrypted transaction with nonce and key hash
 *
 * @example
 * ```typescript
 * const encrypted = encryptForViewing(
 *   { sender: '0x...', recipient: '0x...', amount: '100', timestamp: 123 },
 *   viewingKey
 * )
 * // encrypted.ciphertext contains the encrypted data
 * // encrypted.nonce is needed for decryption
 * // encrypted.viewingKeyHash identifies which key can decrypt
 * ```
 */
export function encryptForViewing(
  data: TransactionData,
  viewingKey: ViewingKey,
): EncryptedTransaction {
  // Derive encryption key from viewing key
  const key = deriveEncryptionKey(viewingKey)

  // Generate random nonce (24 bytes for XChaCha20)
  const nonce = randomBytes(NONCE_SIZE)

  // Serialize data to JSON
  const plaintext = utf8ToBytes(JSON.stringify(data))

  // Encrypt with XChaCha20-Poly1305
  const cipher = xchacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(plaintext)

  return {
    ciphertext: `0x${bytesToHex(ciphertext)}` as HexString,
    nonce: `0x${bytesToHex(nonce)}` as HexString,
    viewingKeyHash: viewingKey.hash,
  }
}

/**
 * Decrypt transaction data with viewing key
 *
 * Performs authenticated decryption using XChaCha20-Poly1305.
 * The authentication tag is verified before returning data.
 *
 * @param encrypted - Encrypted transaction data
 * @param viewingKey - Viewing key for decryption
 * @returns Decrypted transaction data
 * @throws {Error} If decryption fails (wrong key, tampered data, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   const data = decryptWithViewing(encrypted, viewingKey)
 *   console.log(`Amount: ${data.amount}`)
 * } catch (e) {
 *   console.error('Decryption failed - wrong key or tampered data')
 * }
 * ```
 */
export function decryptWithViewing(
  encrypted: EncryptedTransaction,
  viewingKey: ViewingKey,
): TransactionData {
  // Verify viewing key hash matches (optional but helpful error message)
  if (encrypted.viewingKeyHash !== viewingKey.hash) {
    throw new CryptoError(
      'Viewing key hash mismatch - this key cannot decrypt this transaction',
      ErrorCode.DECRYPTION_FAILED,
      { operation: 'decryptWithViewing' }
    )
  }

  // Derive encryption key from viewing key
  const key = deriveEncryptionKey(viewingKey)

  // Parse nonce and ciphertext
  const nonceHex = encrypted.nonce.startsWith('0x')
    ? encrypted.nonce.slice(2)
    : encrypted.nonce
  const nonce = hexToBytes(nonceHex)

  const ciphertextHex = encrypted.ciphertext.startsWith('0x')
    ? encrypted.ciphertext.slice(2)
    : encrypted.ciphertext
  const ciphertext = hexToBytes(ciphertextHex)

  // Decrypt with XChaCha20-Poly1305
  // This will throw if authentication fails (wrong key or tampered data)
  const cipher = xchacha20poly1305(key, nonce)
  let plaintext: Uint8Array

  try {
    plaintext = cipher.decrypt(ciphertext)
  } catch (e) {
    throw new CryptoError(
      'Decryption failed - authentication tag verification failed. ' +
      'Either the viewing key is incorrect or the data has been tampered with.',
      ErrorCode.DECRYPTION_FAILED,
      {
        cause: e instanceof Error ? e : undefined,
        operation: 'decryptWithViewing',
      }
    )
  }

  // Parse JSON
  const textDecoder = new TextDecoder()
  const jsonString = textDecoder.decode(plaintext)

  try {
    const data = JSON.parse(jsonString) as TransactionData
    // Validate required fields
    if (
      typeof data.sender !== 'string' ||
      typeof data.recipient !== 'string' ||
      typeof data.amount !== 'string' ||
      typeof data.timestamp !== 'number'
    ) {
      throw new ValidationError(
        'invalid transaction data format',
        'transactionData',
        { received: data },
        ErrorCode.INVALID_INPUT
      )
    }
    return data
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new CryptoError(
        'Decryption succeeded but data is malformed JSON',
        ErrorCode.DECRYPTION_FAILED,
        { cause: e, operation: 'decryptWithViewing' }
      )
    }
    throw e
  }
}

/**
 * Validate privacy level string
 */
export function isValidPrivacyLevel(level: string): level is PrivacyLevel {
  return ['transparent', 'shielded', 'compliant'].includes(level)
}

/**
 * Get human-readable description of privacy level
 */
export function getPrivacyDescription(level: PrivacyLevel): string {
  const descriptions: Record<PrivacyLevel, string> = {
    transparent: 'Public transaction - all details visible on-chain',
    shielded: 'Private transaction - sender, amount, and recipient hidden',
    compliant: 'Private with audit - hidden but viewable with key',
  }
  return descriptions[level]
}

// hexToBytes removed - was only needed for mocked XOR encryption
