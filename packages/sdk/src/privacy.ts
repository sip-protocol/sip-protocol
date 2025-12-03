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
import { sha512 } from '@noble/hashes/sha512'
import { hmac } from '@noble/hashes/hmac'
import { hkdf } from '@noble/hashes/hkdf'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { ValidationError, CryptoError, ErrorCode } from './errors'
import { secureWipe } from './secure-memory'

/**
 * Maximum size for decrypted transaction data (1MB)
 * Prevents DoS attacks via large payloads
 */
const MAX_TRANSACTION_DATA_SIZE = 1024 * 1024

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
 * Get privacy configuration for a given privacy level
 *
 * Returns a configuration object that determines which privacy features
 * to enable for an intent. Used internally by the SDK to configure
 * privacy behavior.
 *
 * **Privacy Levels:**
 * - `'transparent'`: No privacy, fully public on-chain
 * - `'shielded'`: Full privacy, hidden sender/amount/recipient
 * - `'compliant'`: Privacy with viewing key for regulatory compliance
 *
 * @param level - Privacy level to configure
 * @param viewingKey - Required for compliant mode, optional otherwise
 * @returns Configuration object specifying privacy features
 *
 * @throws {ValidationError} If compliant mode specified without viewing key
 *
 * @example
 * ```typescript
 * // Transparent (no privacy)
 * const config = getPrivacyConfig('transparent')
 * // { level: 'transparent', useStealth: false, encryptData: false }
 *
 * // Shielded (full privacy)
 * const config = getPrivacyConfig('shielded')
 * // { level: 'shielded', useStealth: true, encryptData: true }
 *
 * // Compliant (privacy + audit)
 * const viewingKey = generateViewingKey()
 * const config = getPrivacyConfig('compliant', viewingKey)
 * // { level: 'compliant', viewingKey, useStealth: true, encryptData: true }
 * ```
 *
 * @see {@link PrivacyLevel} for available privacy levels
 * @see {@link generateViewingKey} to create viewing keys
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
 * Generate a new viewing key for compliant privacy mode
 *
 * Creates a cryptographically random viewing key that enables selective
 * disclosure of transaction details to auditors or regulators while
 * maintaining on-chain privacy.
 *
 * **Use Cases:**
 * - Regulatory compliance (AML/KYC audits)
 * - Internal accounting and reconciliation
 * - Voluntary disclosure to trusted parties
 * - Hierarchical key management (via derivation paths)
 *
 * **Security:**
 * - Keep viewing keys secret - they decrypt all transaction details
 * - Use hierarchical derivation for key management (BIP32-style paths)
 * - Rotate keys periodically for forward secrecy
 *
 * @param path - Hierarchical derivation path (BIP32-style, e.g., "m/0", "m/44'/0'/0'")
 * @returns Viewing key object with key, path, and hash
 *
 * @example Generate master viewing key
 * ```typescript
 * const masterKey = generateViewingKey('m/0')
 * console.log(masterKey.key)  // "0xabc123..."
 * console.log(masterKey.path) // "m/0"
 * console.log(masterKey.hash) // "0xdef456..." (for identification)
 * ```
 *
 * @example Generate organization-specific keys
 * ```typescript
 * const auditKey = generateViewingKey('m/0/audit')
 * const accountingKey = generateViewingKey('m/0/accounting')
 *
 * // Share different keys with different departments
 * shareWithAuditor(auditKey)
 * shareWithAccounting(accountingKey)
 * ```
 *
 * @example Use in compliant intent
 * ```typescript
 * const viewingKey = generateViewingKey()
 *
 * const intent = await sip.createIntent({
 *   input: { asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 }, amount: 100n },
 *   output: { asset: { chain: 'zcash', symbol: 'ZEC', address: null, decimals: 8 }, minAmount: 0n, maxSlippage: 0.01 },
 *   privacy: PrivacyLevel.COMPLIANT,
 *   viewingKey: viewingKey.key,
 * })
 * ```
 *
 * @see {@link deriveViewingKey} to derive child keys hierarchically
 * @see {@link encryptForViewing} to encrypt data with viewing key
 * @see {@link decryptWithViewing} to decrypt data with viewing key
 */
export function generateViewingKey(path: string = 'm/0'): ViewingKey {
  const keyBytes = randomBytes(32)

  try {
    const key = `0x${bytesToHex(keyBytes)}` as HexString
    const hashBytes = sha256(keyBytes)

    return {
      key,
      path,
      hash: `0x${bytesToHex(hashBytes)}` as Hash,
    }
  } finally {
    // Securely wipe key bytes after converting to hex
    secureWipe(keyBytes)
  }
}

/**
 * Derive a child viewing key using BIP32-style hierarchical derivation
 *
 * Uses HMAC-SHA512 for proper key derivation:
 * - childKey = HMAC-SHA512(masterKey, childPath)
 * - Takes first 32 bytes as the derived key
 *
 * This provides:
 * - Cryptographic standard compliance (similar to BIP32)
 * - One-way derivation (cannot derive parent from child)
 * - Non-correlatable keys (different paths produce unrelated keys)
 */
export function deriveViewingKey(
  masterKey: ViewingKey,
  childPath: string,
): ViewingKey {
  // Extract raw master key bytes (remove 0x prefix if present)
  const masterKeyHex = masterKey.key.startsWith('0x')
    ? masterKey.key.slice(2)
    : masterKey.key
  const masterKeyBytes = hexToBytes(masterKeyHex)

  // Encode child path as bytes
  const childPathBytes = utf8ToBytes(childPath)

  // HMAC-SHA512(key=masterKey, data=childPath)
  // This follows BIP32-style hierarchical derivation
  const derivedFull = hmac(sha512, masterKeyBytes, childPathBytes)

  try {
    // Take first 32 bytes as the derived key (standard practice)
    const derivedBytes = derivedFull.slice(0, 32)
    const derived = `0x${bytesToHex(derivedBytes)}` as HexString

    // Compute hash of the derived key for identification
    const hashBytes = sha256(derivedBytes)

    const result = {
      key: derived,
      path: `${masterKey.path}/${childPath}`,
      hash: `0x${bytesToHex(hashBytes)}` as Hash,
    }

    // Wipe derived bytes after conversion to hex
    secureWipe(derivedBytes)

    return result
  } finally {
    // Securely wipe master key bytes and full derivation output
    secureWipe(masterKeyBytes)
    secureWipe(derivedFull)
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
 * @returns 32-byte encryption key (caller must wipe after use)
 */
function deriveEncryptionKey(viewingKey: ViewingKey): Uint8Array {
  // Extract the raw key bytes (remove 0x prefix)
  const keyHex = viewingKey.key.startsWith('0x')
    ? viewingKey.key.slice(2)
    : viewingKey.key
  const keyBytes = hexToBytes(keyHex)

  try {
    // Use HKDF to derive a proper encryption key
    // HKDF(SHA256, ikm=viewingKey, salt=domain, info=path, length=32)
    const salt = utf8ToBytes(ENCRYPTION_DOMAIN)
    const info = utf8ToBytes(viewingKey.path)

    return hkdf(sha256, keyBytes, salt, info, 32)
  } finally {
    // Securely wipe source key bytes
    secureWipe(keyBytes)
  }
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

  try {
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
  } finally {
    // Securely wipe encryption key after use
    secureWipe(key)
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

  try {
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

    // Validate size before parsing to prevent DoS
    if (jsonString.length > MAX_TRANSACTION_DATA_SIZE) {
      throw new ValidationError(
        `decrypted data exceeds maximum size limit (${MAX_TRANSACTION_DATA_SIZE} bytes)`,
        'transactionData',
        { received: jsonString.length, max: MAX_TRANSACTION_DATA_SIZE },
        ErrorCode.INVALID_INPUT
      )
    }

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
  } finally {
    // Securely wipe encryption key after use
    secureWipe(key)
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
