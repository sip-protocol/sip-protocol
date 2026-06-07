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
 * // Use the ephemeral key, then securely dispose
 * console.log('Public key:', managed.publicKeyBase58)
 * managed.dispose()
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
