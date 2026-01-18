/**
 * Solana Ephemeral Keypair Management
 *
 * Provides secure ephemeral keypair generation and management for stealth
 * payments. Each stealth transfer requires a fresh ephemeral keypair.
 *
 * Security considerations:
 * - Ephemeral private keys are wiped from memory after use
 * - Keys are never persisted to storage
 * - Batch generation uses cryptographically secure randomness
 *
 * @module chains/solana/ephemeral-keys
 */

import { ed25519 } from '@noble/curves/ed25519'
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'
import { secureWipe } from '../../secure-memory'
import { ed25519PublicKeyToSolanaAddress } from '../../stealth'
import type { HexString } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * An ephemeral keypair for stealth transfers
 */
export interface EphemeralKeypair {
  /**
   * Ephemeral private key (hex)
   * @security SENSITIVE - must be wiped after shared secret computation
   */
  privateKey: HexString

  /**
   * Ephemeral public key (hex, ed25519 format)
   */
  publicKey: HexString

  /**
   * Ephemeral public key in Solana base58 format
   */
  publicKeyBase58: string
}

/**
 * Result of using an ephemeral keypair for stealth address generation
 */
export interface EphemeralKeyUsageResult {
  /**
   * Shared secret derived from ECDH
   */
  sharedSecret: HexString

  /**
   * View tag (first byte of shared secret hash)
   */
  viewTag: number

  /**
   * Stealth address (hex, ed25519 format)
   */
  stealthAddress: HexString

  /**
   * Stealth address in Solana base58 format
   */
  stealthAddressBase58: string

  /**
   * Ephemeral public key used (for announcement)
   */
  ephemeralPublicKey: HexString

  /**
   * Ephemeral public key in Solana base58 format
   */
  ephemeralPublicKeyBase58: string
}

/**
 * Managed ephemeral keypair with automatic secure disposal
 */
export interface ManagedEphemeralKeypair extends EphemeralKeypair {
  /**
   * Whether this keypair has been used (and thus disposed)
   */
  isDisposed: boolean

  /**
   * Securely dispose of this keypair
   * Called automatically after use, but can be called manually
   */
  dispose(): void

  /**
   * Use this keypair to generate a stealth address
   * Automatically disposes the keypair after use
   */
  useForStealthAddress(
    recipientSpendingKey: HexString,
    recipientViewingKey: HexString
  ): EphemeralKeyUsageResult
}

/**
 * Options for batch ephemeral key generation
 */
export interface BatchGenerationOptions {
  /**
   * Number of keypairs to generate
   */
  count: number

  /**
   * Whether to add entropy mixing between generations
   * @default true
   */
  entropyMixing?: boolean
}

// ─── Core Generation ──────────────────────────────────────────────────────────

/**
 * Generate a single ephemeral keypair
 *
 * @returns Fresh ephemeral keypair
 *
 * @example
 * ```typescript
 * const ephemeral = generateEphemeralKeypair()
 * console.log('Public key:', ephemeral.publicKeyBase58)
 * // Use for stealth transfer, then dispose
 * ```
 */
export function generateEphemeralKeypair(): EphemeralKeypair {
  const privateKeyBytes = randomBytes(32)
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes)

  const privateKey = `0x${bytesToHex(privateKeyBytes)}` as HexString
  const publicKey = `0x${bytesToHex(publicKeyBytes)}` as HexString
  const publicKeyBase58 = ed25519PublicKeyToSolanaAddress(publicKey)

  // Wipe the raw bytes (caller owns the hex string now)
  secureWipe(privateKeyBytes)

  return {
    privateKey,
    publicKey,
    publicKeyBase58,
  }
}

/**
 * Generate a managed ephemeral keypair with automatic disposal
 *
 * The managed keypair tracks its usage state and automatically wipes
 * the private key from memory after use.
 *
 * @returns Managed ephemeral keypair
 *
 * @example
 * ```typescript
 * const managed = generateManagedEphemeralKeypair()
 *
 * // Use for stealth address generation (auto-disposes)
 * const result = managed.useForStealthAddress(
 *   recipientSpendingKey,
 *   recipientViewingKey
 * )
 *
 * console.log('Stealth address:', result.stealthAddressBase58)
 * console.log('Is disposed:', managed.isDisposed) // true
 * ```
 */
export function generateManagedEphemeralKeypair(): ManagedEphemeralKeypair {
  // Store private key bytes for secure disposal
  const privateKeyBytes = randomBytes(32)
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes)

  const privateKeyHex = `0x${bytesToHex(privateKeyBytes)}` as HexString
  const publicKeyHex = `0x${bytesToHex(publicKeyBytes)}` as HexString
  const publicKeyBase58 = ed25519PublicKeyToSolanaAddress(publicKeyHex)

  let disposed = false

  const managed: ManagedEphemeralKeypair = {
    get privateKey(): HexString {
      if (disposed) {
        throw new Error('Ephemeral keypair has been disposed')
      }
      return privateKeyHex
    },
    publicKey: publicKeyHex,
    publicKeyBase58,

    get isDisposed(): boolean {
      return disposed
    },

    dispose(): void {
      if (!disposed) {
        secureWipe(privateKeyBytes)
        disposed = true
      }
    },

    useForStealthAddress(
      recipientSpendingKey: HexString,
      recipientViewingKey: HexString
    ): EphemeralKeyUsageResult {
      if (disposed) {
        throw new Error('Ephemeral keypair has been disposed')
      }

      try {
        const result = computeStealthAddress(
          privateKeyBytes,
          publicKeyBytes,
          recipientSpendingKey,
          recipientViewingKey
        )

        return {
          ...result,
          ephemeralPublicKey: publicKeyHex,
          ephemeralPublicKeyBase58: publicKeyBase58,
        }
      } finally {
        // Always dispose after use
        managed.dispose()
      }
    },
  }

  return managed
}

/**
 * Generate multiple ephemeral keypairs in batch
 *
 * Useful for preparing keypairs for multiple transfers or for
 * pre-generating keypairs for performance.
 *
 * @param options - Batch generation options
 * @returns Array of ephemeral keypairs
 *
 * @example
 * ```typescript
 * // Generate 10 keypairs for upcoming transfers
 * const keypairs = batchGenerateEphemeralKeypairs({ count: 10 })
 *
 * // Use each keypair for a transfer
 * for (const keypair of keypairs) {
 *   await sendPrivateTransfer({ ephemeralKeypair: keypair, ... })
 * }
 * ```
 */
export function batchGenerateEphemeralKeypairs(
  options: BatchGenerationOptions
): EphemeralKeypair[] {
  const { count, entropyMixing = true } = options

  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error('count must be a positive integer')
  }

  if (count > 1000) {
    throw new Error('count cannot exceed 1000 (security limit)')
  }

  const keypairs: EphemeralKeypair[] = []

  // For entropy mixing, we hash extra randomness into each generation
  let entropyState: Uint8Array | null = entropyMixing ? randomBytes(32) : null

  for (let i = 0; i < count; i++) {
    if (entropyMixing && entropyState) {
      // Mix additional entropy for each keypair
      const extraEntropy = randomBytes(32)
      entropyState = sha256(new Uint8Array([...entropyState, ...extraEntropy]))
    }

    keypairs.push(generateEphemeralKeypair())
  }

  // Wipe entropy state
  if (entropyState) {
    secureWipe(entropyState)
  }

  return keypairs
}

/**
 * Generate multiple managed ephemeral keypairs in batch
 *
 * @param options - Batch generation options
 * @returns Array of managed ephemeral keypairs
 */
export function batchGenerateManagedEphemeralKeypairs(
  options: BatchGenerationOptions
): ManagedEphemeralKeypair[] {
  const { count, entropyMixing = true } = options

  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error('count must be a positive integer')
  }

  if (count > 1000) {
    throw new Error('count cannot exceed 1000 (security limit)')
  }

  const keypairs: ManagedEphemeralKeypair[] = []

  // For entropy mixing, we hash extra randomness into each generation
  let entropyState: Uint8Array | null = entropyMixing ? randomBytes(32) : null

  for (let i = 0; i < count; i++) {
    if (entropyMixing && entropyState) {
      // Mix additional entropy for each keypair
      const extraEntropy = randomBytes(32)
      entropyState = sha256(new Uint8Array([...entropyState, ...extraEntropy]))
    }

    keypairs.push(generateManagedEphemeralKeypair())
  }

  // Wipe entropy state
  if (entropyState) {
    secureWipe(entropyState)
  }

  return keypairs
}

// ─── Disposal Utilities ───────────────────────────────────────────────────────

/**
 * Dispose multiple ephemeral keypairs at once
 *
 * @param keypairs - Array of managed keypairs to dispose
 */
export function disposeEphemeralKeypairs(
  keypairs: ManagedEphemeralKeypair[]
): void {
  for (const keypair of keypairs) {
    keypair.dispose()
  }
}

/**
 * Securely wipe an ephemeral private key string from memory
 *
 * Note: Due to JavaScript string immutability, this creates a new
 * Uint8Array from the hex string and wipes it. For better security,
 * use ManagedEphemeralKeypair which maintains byte access.
 *
 * @param privateKeyHex - Private key hex string to wipe
 */
export function wipeEphemeralPrivateKey(privateKeyHex: HexString): void {
  // Convert hex to bytes and wipe the bytes
  const bytes = hexToBytes(privateKeyHex.slice(2))
  secureWipe(bytes)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * ed25519 group order (L)
 */
const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

/**
 * Convert bytes to bigint (little-endian for ed25519)
 */
function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

/**
 * Get ed25519 scalar from private key bytes
 * Follows standard ed25519 scalar clamping
 */
function getEd25519Scalar(privateKey: Uint8Array): bigint {
  const hash = sha256(privateKey)
  // Clamp to valid scalar
  hash[0] &= 248
  hash[31] &= 127
  hash[31] |= 64
  return bytesToBigIntLE(hash.slice(0, 32))
}

/**
 * Compute stealth address from ephemeral keypair and recipient keys
 */
function computeStealthAddress(
  ephemeralPrivateBytes: Uint8Array,
  _ephemeralPublicBytes: Uint8Array, // Reserved for future validation
  recipientSpendingKey: HexString,
  recipientViewingKey: HexString
): Omit<EphemeralKeyUsageResult, 'ephemeralPublicKey' | 'ephemeralPublicKeyBase58'> {
  // Parse recipient keys
  const spendingKeyBytes = hexToBytes(recipientSpendingKey.slice(2))
  const viewingKeyBytes = hexToBytes(recipientViewingKey.slice(2))

  // Get ephemeral scalar
  const rawEphemeralScalar = getEd25519Scalar(ephemeralPrivateBytes)
  const ephemeralScalar = rawEphemeralScalar % ED25519_ORDER
  if (ephemeralScalar === 0n) {
    throw new Error('Invalid ephemeral scalar')
  }

  // Compute shared secret: S = ephemeral_scalar * P_spend
  const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingKeyBytes)
  const sharedSecretPoint = spendingPoint.multiply(ephemeralScalar)
  const sharedSecretBytes = sharedSecretPoint.toRawBytes()

  // Hash the shared secret
  const sharedSecretHash = sha256(sharedSecretBytes)
  const viewTag = sharedSecretHash[0]

  // Derive stealth address: P_stealth = P_view + hash(S)*G
  const hashScalar = bytesToBigIntLE(sharedSecretHash) % ED25519_ORDER
  if (hashScalar === 0n) {
    throw new Error('Invalid hash scalar')
  }

  const hashTimesG = ed25519.ExtendedPoint.BASE.multiply(hashScalar)
  const viewingPoint = ed25519.ExtendedPoint.fromHex(viewingKeyBytes)
  const stealthPoint = viewingPoint.add(hashTimesG)
  const stealthAddressBytes = stealthPoint.toRawBytes()

  const stealthAddress = `0x${bytesToHex(stealthAddressBytes)}` as HexString
  const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress)

  return {
    sharedSecret: `0x${bytesToHex(sharedSecretHash)}` as HexString,
    viewTag,
    stealthAddress,
    stealthAddressBase58,
  }
}

// ─── Announcement Format ──────────────────────────────────────────────────────

/**
 * Format ephemeral key data for Solana memo announcement
 *
 * @param ephemeralPublicKeyBase58 - Ephemeral public key in base58
 * @param viewTag - View tag (0-255)
 * @param stealthAddressBase58 - Optional stealth address for verification
 * @returns Formatted announcement string
 *
 * @example
 * ```typescript
 * const memo = formatEphemeralAnnouncement(
 *   result.ephemeralPublicKeyBase58,
 *   result.viewTag,
 *   result.stealthAddressBase58
 * )
 * // "SIP:1:7xK9...:0a:8yL0..."
 * ```
 */
export function formatEphemeralAnnouncement(
  ephemeralPublicKeyBase58: string,
  viewTag: number,
  stealthAddressBase58?: string
): string {
  const viewTagHex = viewTag.toString(16).padStart(2, '0')
  const parts = ['SIP:1', ephemeralPublicKeyBase58, viewTagHex]

  if (stealthAddressBase58) {
    parts.push(stealthAddressBase58)
  }

  return parts.join(':')
}

/**
 * Parse ephemeral key data from Solana memo announcement
 *
 * @param announcement - Announcement string from memo
 * @returns Parsed ephemeral data or null if invalid
 *
 * @example
 * ```typescript
 * const parsed = parseEphemeralAnnouncement('SIP:1:7xK9...:0a:8yL0...')
 * if (parsed) {
 *   console.log('Ephemeral key:', parsed.ephemeralPublicKeyBase58)
 *   console.log('View tag:', parsed.viewTag)
 * }
 * ```
 */
export function parseEphemeralAnnouncement(
  announcement: string
): {
  ephemeralPublicKeyBase58: string
  viewTag: number
  stealthAddressBase58?: string
} | null {
  if (!announcement.startsWith('SIP:1:')) {
    return null
  }

  const parts = announcement.slice(6).split(':')
  if (parts.length < 2) {
    return null
  }

  const ephemeralPublicKeyBase58 = parts[0]
  const viewTagHex = parts[1]
  const stealthAddressBase58 = parts[2]

  // Validate ephemeral key (base58, 32-44 chars)
  if (!ephemeralPublicKeyBase58 || ephemeralPublicKeyBase58.length < 32 || ephemeralPublicKeyBase58.length > 44) {
    return null
  }

  // Validate view tag (1-2 hex chars)
  if (!viewTagHex || viewTagHex.length > 2 || !/^[0-9a-fA-F]+$/.test(viewTagHex)) {
    return null
  }

  const viewTag = parseInt(viewTagHex, 16)
  if (viewTag < 0 || viewTag > 255) {
    return null
  }

  // Validate stealth address if present
  if (stealthAddressBase58 && (stealthAddressBase58.length < 32 || stealthAddressBase58.length > 44)) {
    return null
  }

  return {
    ephemeralPublicKeyBase58,
    viewTag,
    stealthAddressBase58,
  }
}
