/**
 * Chain-Specific Address Derivation
 *
 * Functions for converting stealth addresses to chain-specific formats.
 */

import type { HexString } from '@sip-protocol/types'
import { ValidationError } from '../errors'
import { isValidHex, isValidEd25519PublicKey } from '../validation'
import { bytesToBase58, base58ToBytes, bytesToHex, hexToBytes } from './utils'

// ─── Solana Address Derivation ──────────────────────────────────────────────

/**
 * Convert an ed25519 public key (hex) to a Solana address (base58)
 *
 * Solana addresses are base58-encoded 32-byte ed25519 public keys.
 *
 * @param publicKey - 32-byte ed25519 public key as hex string (with 0x prefix)
 * @returns Base58-encoded Solana address
 * @throws {ValidationError} If public key is invalid
 *
 * @example
 * ```typescript
 * const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
 * const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
 * // Returns: "7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPBJCyqLqzQPvN" (example)
 * ```
 */
export function ed25519PublicKeyToSolanaAddress(publicKey: HexString): string {
  if (!isValidHex(publicKey)) {
    throw new ValidationError(
      'publicKey must be a valid hex string with 0x prefix',
      'publicKey'
    )
  }

  if (!isValidEd25519PublicKey(publicKey)) {
    throw new ValidationError(
      'publicKey must be 32 bytes (64 hex characters)',
      'publicKey'
    )
  }

  // Convert hex to bytes (remove 0x prefix)
  const publicKeyBytes = hexToBytes(publicKey.slice(2))

  // Encode as base58
  return bytesToBase58(publicKeyBytes)
}

/**
 * Validate a Solana address format
 *
 * Checks that the address:
 * - Is a valid base58 string
 * - Decodes to exactly 32 bytes (ed25519 public key size)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (typeof address !== 'string' || address.length === 0) {
    return false
  }

  // Solana addresses are typically 32-44 characters
  if (address.length < 32 || address.length > 44) {
    return false
  }

  try {
    const decoded = base58ToBytes(address)
    // Valid Solana address is exactly 32 bytes
    return decoded.length === 32
  } catch {
    return false
  }
}

/**
 * Convert a Solana address (base58) back to ed25519 public key (hex)
 */
export function solanaAddressToEd25519PublicKey(address: string): HexString {
  if (!isValidSolanaAddress(address)) {
    throw new ValidationError(
      'Invalid Solana address format',
      'address'
    )
  }

  const decoded = base58ToBytes(address)
  return `0x${bytesToHex(decoded)}` as HexString
}

// ─── NEAR Address Derivation ────────────────────────────────────────────────

/**
 * Convert ed25519 public key to NEAR implicit account address
 *
 * NEAR implicit accounts are lowercase hex-encoded ed25519 public keys (64 characters).
 * No prefix, just raw 32 bytes as lowercase hex.
 */
export function ed25519PublicKeyToNearAddress(publicKey: HexString): string {
  if (!isValidHex(publicKey)) {
    throw new ValidationError(
      'publicKey must be a valid hex string with 0x prefix',
      'publicKey'
    )
  }

  if (!isValidEd25519PublicKey(publicKey)) {
    throw new ValidationError(
      'publicKey must be 32 bytes (64 hex characters)',
      'publicKey'
    )
  }

  // NEAR implicit accounts are lowercase hex without 0x prefix
  return publicKey.slice(2).toLowerCase()
}

/**
 * Convert NEAR implicit account address back to ed25519 public key
 */
export function nearAddressToEd25519PublicKey(address: string): HexString {
  if (!isValidNearImplicitAddress(address)) {
    throw new ValidationError(
      'Invalid NEAR implicit address format',
      'address'
    )
  }

  return `0x${address.toLowerCase()}` as HexString
}

/**
 * Validate a NEAR implicit account address
 *
 * NEAR implicit accounts are:
 * - Exactly 64 lowercase hex characters
 * - No prefix (no "0x")
 * - Represent a 32-byte ed25519 public key
 */
export function isValidNearImplicitAddress(address: string): boolean {
  // Must be a string
  if (typeof address !== 'string' || address.length === 0) {
    return false
  }

  // Must be exactly 64 characters (32 bytes as hex)
  if (address.length !== 64) {
    return false
  }

  // Must be lowercase hex only (no 0x prefix)
  return /^[0-9a-f]{64}$/.test(address)
}

/**
 * Check if a string is a valid NEAR account ID (named or implicit)
 *
 * Supports both:
 * - Named accounts: alice.near, bob.testnet
 * - Implicit accounts: 64 hex characters
 */
export function isValidNearAccountId(accountId: string): boolean {
  // Must be a string
  if (typeof accountId !== 'string' || accountId.length === 0) {
    return false
  }

  // Check if it's a valid implicit account (64 hex chars)
  if (isValidNearImplicitAddress(accountId)) {
    return true
  }

  // Named accounts: 2-64 characters, lowercase alphanumeric with . _ -
  // Must start and end with alphanumeric
  if (accountId.length < 2 || accountId.length > 64) {
    return false
  }

  // NEAR account ID pattern
  const nearAccountPattern = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/
  if (!nearAccountPattern.test(accountId)) {
    return false
  }

  // Cannot have consecutive dots
  if (accountId.includes('..')) {
    return false
  }

  return true
}
