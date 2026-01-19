/**
 * NEAR Viewing Key Management
 *
 * Provides viewing key generation, export/import, encryption, and storage
 * for selective disclosure and compliance on NEAR.
 *
 * ## Architecture
 *
 * ```
 * Spending Private Key
 *         │
 *         ▼ HMAC-SHA256(context)
 * Viewing Private Key (32 bytes)
 *         │
 *         ▼ ed25519.getPublicKey()
 * Viewing Public Key (32 bytes)
 *         │
 *         ▼ sha256()
 * Viewing Key Hash (32 bytes) ← Used for announcement matching
 * ```
 *
 * ## Security Properties
 *
 * - Viewing keys can decrypt but NOT spend funds
 * - Hash is safe to publish on-chain for announcement matching
 * - XChaCha20-Poly1305 provides authenticated encryption
 *
 * @module chains/near/viewing-key
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { hmac } from '@noble/hashes/hmac'
import { hkdf } from '@noble/hashes/hkdf'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import type { HexString, Hash } from '@sip-protocol/types'
import { ValidationError, CryptoError, ErrorCode } from '../../errors'
import { isValidHex } from '../../validation'
import { secureWipe } from '../../secure-memory'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Domain separation for viewing key derivation from spending key
 */
const VIEWING_KEY_CONTEXT = 'SIP-NEAR-viewing-key-v1'

/**
 * Domain separation for encryption key derivation
 */
const ENCRYPTION_DOMAIN = 'SIP-NEAR-VIEWING-KEY-ENCRYPTION-V1'

/**
 * XChaCha20-Poly1305 nonce size (24 bytes)
 */
const NONCE_SIZE = 24

/**
 * Standard export format version for viewing keys
 */
const EXPORT_VERSION = 1

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A NEAR viewing key with associated metadata
 */
export interface NEARViewingKey {
  /**
   * The viewing private key (32 bytes)
   * Used for decryption and stealth address scanning
   */
  privateKey: HexString

  /**
   * The viewing public key (32 bytes)
   * Can be shared for encryption
   */
  publicKey: HexString

  /**
   * Hash of the viewing public key for announcement matching
   * This is published on-chain to enable efficient scanning
   */
  hash: Hash

  /**
   * Optional label for this viewing key
   */
  label?: string

  /**
   * Timestamp when this key was created
   */
  createdAt: number
}

/**
 * Standard export format for NEAR viewing keys
 */
export interface NEARViewingKeyExport {
  /**
   * Export format version
   */
  version: number

  /**
   * The chain this key is for
   */
  chain: 'near'

  /**
   * The viewing private key (hex encoded)
   */
  privateKey: HexString

  /**
   * The viewing public key (hex encoded)
   */
  publicKey: HexString

  /**
   * Hash for announcement matching
   */
  hash: Hash

  /**
   * Optional label
   */
  label?: string

  /**
   * Creation timestamp
   */
  createdAt: number

  /**
   * Export timestamp
   */
  exportedAt: number
}

/**
 * Encrypted data structure for viewing key operations
 */
export interface NEAREncryptedPayload {
  /**
   * The encrypted ciphertext (hex encoded)
   */
  ciphertext: HexString

  /**
   * The nonce used for encryption (hex encoded, 24 bytes)
   */
  nonce: HexString

  /**
   * Hash of the viewing key that can decrypt this
   */
  viewingKeyHash: Hash
}

/**
 * Transaction data that can be encrypted for viewing
 */
export interface NEARTransactionData {
  /**
   * Sender's account ID
   */
  sender: string

  /**
   * Recipient's stealth address (implicit account)
   */
  recipient: string

  /**
   * Amount in yoctoNEAR (string for bigint serialization)
   */
  amount: string

  /**
   * Token contract address (null for native NEAR)
   */
  tokenContract: string | null

  /**
   * Token decimals (24 for NEAR, 6 for USDC, etc.)
   */
  decimals: number

  /**
   * Transaction timestamp
   */
  timestamp: number

  /**
   * Optional memo
   */
  memo?: string
}

/**
 * Interface for viewing key storage providers
 */
export interface NEARViewingKeyStorage {
  /**
   * Store a viewing key
   * @param key - The viewing key to store
   * @returns Promise resolving to the key's hash (for identification)
   */
  save(key: NEARViewingKey): Promise<Hash>

  /**
   * Retrieve a viewing key by its hash
   * @param hash - The viewing key hash
   * @returns Promise resolving to the key or null if not found
   */
  load(hash: Hash): Promise<NEARViewingKey | null>

  /**
   * List all stored viewing keys
   * @returns Promise resolving to array of keys
   */
  list(): Promise<NEARViewingKey[]>

  /**
   * Delete a viewing key by its hash
   * @param hash - The viewing key hash
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(hash: Hash): Promise<boolean>
}

// ─── Viewing Key Generation ───────────────────────────────────────────────────

/**
 * Generate a viewing key from a spending private key
 *
 * The viewing key is derived deterministically using HMAC-SHA256 with domain
 * separation, ensuring it cannot be used to derive the spending key.
 *
 * @param spendingPrivateKey - The spending private key (32 bytes, hex)
 * @param label - Optional label for the viewing key
 * @returns The generated viewing key with public key and hash
 *
 * @example
 * ```typescript
 * const viewingKey = generateNEARViewingKeyFromSpending(
 *   spendingPrivateKey,
 *   'My NEAR Wallet'
 * )
 *
 * // Share the public key for encryption
 * console.log('Public key:', viewingKey.publicKey)
 *
 * // Use hash for on-chain announcement matching
 * console.log('Hash:', viewingKey.hash)
 * ```
 */
export function generateNEARViewingKeyFromSpending(
  spendingPrivateKey: HexString,
  label?: string
): NEARViewingKey {
  // Validate input
  if (!spendingPrivateKey || !spendingPrivateKey.startsWith('0x')) {
    throw new ValidationError(
      'spendingPrivateKey must be a hex string with 0x prefix',
      'spendingPrivateKey'
    )
  }

  const spendingBytes = hexToBytes(spendingPrivateKey.slice(2))

  if (spendingBytes.length !== 32) {
    throw new ValidationError(
      'spendingPrivateKey must be 32 bytes',
      'spendingPrivateKey'
    )
  }

  let viewingPrivateBytes: Uint8Array | null = null

  try {
    // Derive viewing key using HMAC-SHA256 with domain separation
    viewingPrivateBytes = hmac(
      sha256,
      utf8ToBytes(VIEWING_KEY_CONTEXT),
      spendingBytes
    )

    // Derive public key
    const viewingPublicBytes = ed25519.getPublicKey(viewingPrivateBytes)

    // Compute hash for announcement matching
    const hashBytes = sha256(viewingPublicBytes)

    return {
      privateKey: `0x${bytesToHex(viewingPrivateBytes)}` as HexString,
      publicKey: `0x${bytesToHex(viewingPublicBytes)}` as HexString,
      hash: `0x${bytesToHex(hashBytes)}` as Hash,
      label,
      createdAt: Date.now(),
    }
  } finally {
    // Secure wipe sensitive data
    secureWipe(spendingBytes)
    if (viewingPrivateBytes) secureWipe(viewingPrivateBytes)
  }
}

/**
 * Generate a new random viewing key
 *
 * Creates a cryptographically random viewing key that is NOT derived from
 * a spending key. Use this for standalone viewing keys or testing.
 *
 * @param label - Optional label for the viewing key
 * @returns The generated viewing key
 *
 * @example
 * ```typescript
 * const viewingKey = generateRandomNEARViewingKey('Audit Key')
 * ```
 */
export function generateRandomNEARViewingKey(label?: string): NEARViewingKey {
  const privateBytes = randomBytes(32)

  try {
    const publicBytes = ed25519.getPublicKey(privateBytes)
    const hashBytes = sha256(publicBytes)

    return {
      privateKey: `0x${bytesToHex(privateBytes)}` as HexString,
      publicKey: `0x${bytesToHex(publicBytes)}` as HexString,
      hash: `0x${bytesToHex(hashBytes)}` as Hash,
      label,
      createdAt: Date.now(),
    }
  } finally {
    secureWipe(privateBytes)
  }
}

// ─── Viewing Key Hash ─────────────────────────────────────────────────────────

/**
 * Compute the viewing key hash from a public key
 *
 * The hash is used for announcement matching on-chain. Recipients publish
 * their viewing key hash, and senders include it in transaction announcements.
 *
 * @param viewingPublicKey - The viewing public key (32 bytes, hex)
 * @returns The hash for announcement matching
 *
 * @example
 * ```typescript
 * const hash = computeNEARViewingKeyHash(viewingKey.publicKey)
 * // Use hash in transaction announcements
 * ```
 */
export function computeNEARViewingKeyHash(viewingPublicKey: HexString): Hash {
  if (!viewingPublicKey || !viewingPublicKey.startsWith('0x')) {
    throw new ValidationError(
      'viewingPublicKey must be a hex string with 0x prefix',
      'viewingPublicKey'
    )
  }

  const publicBytes = hexToBytes(viewingPublicKey.slice(2))

  if (publicBytes.length !== 32) {
    throw new ValidationError(
      'viewingPublicKey must be 32 bytes',
      'viewingPublicKey'
    )
  }

  const hashBytes = sha256(publicBytes)
  return `0x${bytesToHex(hashBytes)}` as Hash
}

/**
 * Compute viewing key hash from a private key
 *
 * Derives the public key and computes its hash.
 *
 * @param viewingPrivateKey - The viewing private key (32 bytes, hex)
 * @returns The hash for announcement matching
 */
export function computeNEARViewingKeyHashFromPrivate(
  viewingPrivateKey: HexString
): Hash {
  if (!viewingPrivateKey || !viewingPrivateKey.startsWith('0x')) {
    throw new ValidationError(
      'viewingPrivateKey must be a hex string with 0x prefix',
      'viewingPrivateKey'
    )
  }

  const privateBytes = hexToBytes(viewingPrivateKey.slice(2))

  if (privateBytes.length !== 32) {
    throw new ValidationError(
      'viewingPrivateKey must be 32 bytes',
      'viewingPrivateKey'
    )
  }

  try {
    const publicBytes = ed25519.getPublicKey(privateBytes)
    const hashBytes = sha256(publicBytes)
    return `0x${bytesToHex(hashBytes)}` as Hash
  } finally {
    secureWipe(privateBytes)
  }
}

// ─── Export/Import ────────────────────────────────────────────────────────────

/**
 * Export a viewing key in standard JSON format
 *
 * The export format includes version information for forward compatibility
 * and can be safely serialized to JSON.
 *
 * @param viewingKey - The viewing key to export
 * @returns The export object (serialize with JSON.stringify)
 *
 * @example
 * ```typescript
 * const exported = exportNEARViewingKey(viewingKey)
 * const json = JSON.stringify(exported)
 *
 * // Save to file or send to auditor
 * ```
 */
export function exportNEARViewingKey(viewingKey: NEARViewingKey): NEARViewingKeyExport {
  return {
    version: EXPORT_VERSION,
    chain: 'near',
    privateKey: viewingKey.privateKey,
    publicKey: viewingKey.publicKey,
    hash: viewingKey.hash,
    label: viewingKey.label,
    createdAt: viewingKey.createdAt,
    exportedAt: Date.now(),
  }
}

/**
 * Import a viewing key from standard JSON format
 *
 * Validates the export format and reconstructs the viewing key object.
 *
 * @param exported - The exported viewing key data
 * @returns The imported viewing key
 * @throws {ValidationError} If the export format is invalid
 *
 * @example
 * ```typescript
 * const json = await readFile('near-viewing-key.json')
 * const exported = JSON.parse(json)
 * const viewingKey = importNEARViewingKey(exported)
 * ```
 */
export function importNEARViewingKey(exported: NEARViewingKeyExport): NEARViewingKey {
  // Validate version
  if (exported.version !== EXPORT_VERSION) {
    throw new ValidationError(
      `Unsupported export version: ${exported.version}. Expected: ${EXPORT_VERSION}`,
      'version'
    )
  }

  // Validate chain
  if (exported.chain !== 'near') {
    throw new ValidationError(
      `Invalid chain: ${exported.chain}. Expected: near`,
      'chain'
    )
  }

  // Validate keys
  if (!isValidHex(exported.privateKey) || exported.privateKey.length !== 66) {
    throw new ValidationError('Invalid private key format', 'privateKey')
  }

  if (!isValidHex(exported.publicKey) || exported.publicKey.length !== 66) {
    throw new ValidationError('Invalid public key format', 'publicKey')
  }

  if (!isValidHex(exported.hash) || exported.hash.length !== 66) {
    throw new ValidationError('Invalid hash format', 'hash')
  }

  // Verify the hash matches the public key
  const computedHash = computeNEARViewingKeyHash(exported.publicKey)
  if (computedHash !== exported.hash) {
    throw new ValidationError(
      'Hash does not match public key',
      'hash',
      { expected: computedHash, received: exported.hash }
    )
  }

  // Verify public key matches private key
  const privateBytes = hexToBytes(exported.privateKey.slice(2))
  try {
    const derivedPublic = `0x${bytesToHex(ed25519.getPublicKey(privateBytes))}` as HexString
    if (derivedPublic !== exported.publicKey) {
      throw new ValidationError(
        'Public key does not match private key',
        'publicKey'
      )
    }
  } finally {
    secureWipe(privateBytes)
  }

  return {
    privateKey: exported.privateKey,
    publicKey: exported.publicKey,
    hash: exported.hash,
    label: exported.label,
    createdAt: exported.createdAt,
  }
}

// ─── Encryption/Decryption ────────────────────────────────────────────────────

/**
 * Derive an encryption key from a viewing key using HKDF
 *
 * @param key - The viewing key (private or public depending on operation)
 * @param salt - Optional salt for HKDF
 * @returns 32-byte encryption key (caller must wipe after use)
 */
function deriveEncryptionKey(key: HexString, salt?: Uint8Array): Uint8Array {
  const keyBytes = hexToBytes(key.slice(2))

  try {
    // Use HKDF to derive a proper encryption key
    const hkdfSalt = salt ?? utf8ToBytes(ENCRYPTION_DOMAIN)
    return hkdf(sha256, keyBytes, hkdfSalt, utf8ToBytes('encryption'), 32)
  } finally {
    secureWipe(keyBytes)
  }
}

/**
 * Encrypt transaction data for viewing key holders
 *
 * Uses XChaCha20-Poly1305 authenticated encryption with a random nonce.
 * The encryption key is derived from the viewing private key using HKDF.
 *
 * @param data - Transaction data to encrypt
 * @param viewingKey - The viewing key for encryption
 * @returns Encrypted payload with nonce and key hash
 *
 * @example
 * ```typescript
 * const encrypted = encryptForNEARViewing({
 *   sender: 'alice.near',
 *   recipient: stealthAccountId,
 *   amount: '1000000000000000000000000', // 1 NEAR
 *   tokenContract: null, // native NEAR
 *   decimals: 24,
 *   timestamp: Date.now(),
 * }, viewingKey)
 *
 * // Store encrypted.ciphertext on-chain or off-chain
 * ```
 */
export function encryptForNEARViewing(
  data: NEARTransactionData,
  viewingKey: NEARViewingKey
): NEAREncryptedPayload {
  // Derive encryption key from viewing private key
  const encKey = deriveEncryptionKey(viewingKey.privateKey)

  try {
    // Generate random nonce
    const nonce = randomBytes(NONCE_SIZE)

    // Serialize data to JSON
    const plaintext = utf8ToBytes(JSON.stringify(data))

    // Encrypt with XChaCha20-Poly1305
    const cipher = xchacha20poly1305(encKey, nonce)
    const ciphertext = cipher.encrypt(plaintext)

    return {
      ciphertext: `0x${bytesToHex(ciphertext)}` as HexString,
      nonce: `0x${bytesToHex(nonce)}` as HexString,
      viewingKeyHash: viewingKey.hash,
    }
  } finally {
    secureWipe(encKey)
  }
}

/**
 * Decrypt transaction data with a viewing key
 *
 * @param encrypted - The encrypted payload
 * @param viewingKey - The viewing key for decryption
 * @returns The decrypted transaction data
 * @throws {CryptoError} If decryption fails (wrong key or tampered data)
 *
 * @example
 * ```typescript
 * const data = decryptWithNEARViewing(encrypted, viewingKey)
 * console.log('Amount:', data.amount)
 * console.log('Sender:', data.sender)
 * ```
 */
export function decryptWithNEARViewing(
  encrypted: NEAREncryptedPayload,
  viewingKey: NEARViewingKey
): NEARTransactionData {
  // Verify the viewing key can decrypt this
  if (encrypted.viewingKeyHash !== viewingKey.hash) {
    throw new CryptoError(
      'Viewing key hash does not match encrypted payload',
      ErrorCode.DECRYPTION_FAILED,
      { context: { expected: encrypted.viewingKeyHash, received: viewingKey.hash } }
    )
  }

  // Derive encryption key
  const encKey = deriveEncryptionKey(viewingKey.privateKey)

  try {
    // Parse ciphertext and nonce
    const ciphertext = hexToBytes(encrypted.ciphertext.slice(2))
    const nonce = hexToBytes(encrypted.nonce.slice(2))

    if (nonce.length !== NONCE_SIZE) {
      throw new ValidationError(
        `Invalid nonce length: ${nonce.length}. Expected: ${NONCE_SIZE}`,
        'nonce'
      )
    }

    // Decrypt with XChaCha20-Poly1305
    const cipher = xchacha20poly1305(encKey, nonce)
    const plaintext = cipher.decrypt(ciphertext)

    // Parse JSON
    const json = new TextDecoder().decode(plaintext)
    return JSON.parse(json) as NEARTransactionData
  } catch (error) {
    if (error instanceof ValidationError || error instanceof CryptoError) {
      throw error
    }
    throw new CryptoError(
      'Failed to decrypt: authentication failed or data corrupted',
      ErrorCode.DECRYPTION_FAILED,
      { cause: error instanceof Error ? error : undefined }
    )
  } finally {
    secureWipe(encKey)
  }
}

// ─── In-Memory Storage ────────────────────────────────────────────────────────

/**
 * Simple in-memory viewing key storage
 *
 * Useful for testing and temporary storage. For production use,
 * implement a persistent storage provider.
 *
 * @example
 * ```typescript
 * const storage = createNEARMemoryStorage()
 *
 * // Store a key
 * await storage.save(viewingKey)
 *
 * // List all keys
 * const keys = await storage.list()
 *
 * // Load a specific key
 * const key = await storage.load(hash)
 * ```
 */
export function createNEARMemoryStorage(): NEARViewingKeyStorage {
  const keys = new Map<Hash, NEARViewingKey>()

  return {
    async save(key: NEARViewingKey): Promise<Hash> {
      keys.set(key.hash, { ...key })
      return key.hash
    },

    async load(hash: Hash): Promise<NEARViewingKey | null> {
      const key = keys.get(hash)
      return key ? { ...key } : null
    },

    async list(): Promise<NEARViewingKey[]> {
      return Array.from(keys.values()).map(k => ({ ...k }))
    },

    async delete(hash: Hash): Promise<boolean> {
      return keys.delete(hash)
    },
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Check if an announcement hash matches a viewing key
 *
 * Used during scanning to efficiently filter announcements that belong
 * to this viewing key.
 *
 * @param announcementHash - Hash from the on-chain announcement
 * @param viewingKey - The viewing key to check against
 * @returns true if the announcement is for this viewing key
 */
export function isNEARAnnouncementForViewingKey(
  announcementHash: Hash,
  viewingKey: NEARViewingKey
): boolean {
  return announcementHash === viewingKey.hash
}

/**
 * Derive a child viewing key for hierarchical key management
 *
 * Uses HMAC-SHA256 with the parent key and child path to derive
 * a new independent viewing key.
 *
 * @param parentKey - The parent viewing key
 * @param childPath - A path string for derivation (e.g., "audit/2024")
 * @param label - Optional label for the child key
 * @returns The derived child viewing key
 *
 * @example
 * ```typescript
 * const auditKey = deriveNEARChildViewingKey(masterKey, 'audit/2024', 'Audit 2024')
 * const accountingKey = deriveNEARChildViewingKey(masterKey, 'accounting', 'Accounting')
 * ```
 */
export function deriveNEARChildViewingKey(
  parentKey: NEARViewingKey,
  childPath: string,
  label?: string
): NEARViewingKey {
  if (!childPath || typeof childPath !== 'string') {
    throw new ValidationError('childPath must be a non-empty string', 'childPath')
  }

  const parentBytes = hexToBytes(parentKey.privateKey.slice(2))

  try {
    // Derive child key using HMAC-SHA256
    const childBytes = hmac(sha256, utf8ToBytes(childPath), parentBytes)
    const publicBytes = ed25519.getPublicKey(childBytes)
    const hashBytes = sha256(publicBytes)

    const result: NEARViewingKey = {
      privateKey: `0x${bytesToHex(childBytes)}` as HexString,
      publicKey: `0x${bytesToHex(publicBytes)}` as HexString,
      hash: `0x${bytesToHex(hashBytes)}` as Hash,
      label: label ?? `${parentKey.label ?? 'Key'}/${childPath}`,
      createdAt: Date.now(),
    }

    // Wipe child bytes after creating hex
    secureWipe(childBytes)

    return result
  } finally {
    secureWipe(parentBytes)
  }
}

/**
 * Get the public key from a viewing private key
 *
 * @param viewingPrivateKey - The viewing private key
 * @returns The corresponding public key
 */
export function getNEARViewingPublicKey(viewingPrivateKey: HexString): HexString {
  if (!viewingPrivateKey || !viewingPrivateKey.startsWith('0x')) {
    throw new ValidationError(
      'viewingPrivateKey must be a hex string with 0x prefix',
      'viewingPrivateKey'
    )
  }

  const privateBytes = hexToBytes(viewingPrivateKey.slice(2))

  if (privateBytes.length !== 32) {
    throw new ValidationError(
      'viewingPrivateKey must be 32 bytes',
      'viewingPrivateKey'
    )
  }

  try {
    const publicBytes = ed25519.getPublicKey(privateBytes)
    return `0x${bytesToHex(publicBytes)}` as HexString
  } finally {
    secureWipe(privateBytes)
  }
}

/**
 * Validate a NEAR viewing key object
 *
 * @param viewingKey - The viewing key to validate
 * @returns true if the viewing key is valid
 * @throws {ValidationError} If the viewing key is invalid
 */
export function validateNEARViewingKey(viewingKey: NEARViewingKey): boolean {
  if (!viewingKey) {
    throw new ValidationError('viewingKey is required', 'viewingKey')
  }

  // Check privateKey
  if (!viewingKey.privateKey || !viewingKey.privateKey.startsWith('0x')) {
    throw new ValidationError('privateKey must be a hex string with 0x prefix', 'privateKey')
  }
  if (viewingKey.privateKey.length !== 66) {
    throw new ValidationError('privateKey must be 32 bytes (66 chars with 0x)', 'privateKey')
  }

  // Check publicKey
  if (!viewingKey.publicKey || !viewingKey.publicKey.startsWith('0x')) {
    throw new ValidationError('publicKey must be a hex string with 0x prefix', 'publicKey')
  }
  if (viewingKey.publicKey.length !== 66) {
    throw new ValidationError('publicKey must be 32 bytes (66 chars with 0x)', 'publicKey')
  }

  // Check hash
  if (!viewingKey.hash || !viewingKey.hash.startsWith('0x')) {
    throw new ValidationError('hash must be a hex string with 0x prefix', 'hash')
  }
  if (viewingKey.hash.length !== 66) {
    throw new ValidationError('hash must be 32 bytes (66 chars with 0x)', 'hash')
  }

  // Verify hash matches public key
  const computedHash = computeNEARViewingKeyHash(viewingKey.publicKey)
  if (computedHash !== viewingKey.hash) {
    throw new ValidationError(
      'hash does not match publicKey',
      'hash',
      { expected: computedHash, received: viewingKey.hash }
    )
  }

  // Verify public key matches private key
  const privateBytes = hexToBytes(viewingKey.privateKey.slice(2))
  try {
    const derivedPublic = `0x${bytesToHex(ed25519.getPublicKey(privateBytes))}` as HexString
    if (derivedPublic !== viewingKey.publicKey) {
      throw new ValidationError(
        'publicKey does not match privateKey',
        'publicKey'
      )
    }
  } finally {
    secureWipe(privateBytes)
  }

  return true
}
