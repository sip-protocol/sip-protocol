/**
 * Sui stealth address implementation
 *
 * Sui uses ed25519 for signatures, similar to Aptos, Solana, and NEAR.
 * This module provides stealth address generation and address format conversion for Sui.
 *
 * Key differences from Aptos:
 * - Sui addresses are derived via BLAKE2b-256(0x00 || pubkey)
 * - 32-byte addresses encoded as hex with 0x prefix
 * - Signature scheme flag byte (0x00) comes BEFORE public key
 *
 * @see https://docs.sui.io/concepts/cryptography/transaction-auth/signatures
 */

import { ed25519 } from '@noble/curves/ed25519'
import { BLAKE2b } from '@noble/hashes/blake2b'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString, StealthMetaAddress, StealthAddress } from '@sip-protocol/types'
import { ValidationError } from '../errors'
import { isValidHex, isValidEd25519PublicKey } from '../validation'
import {
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
} from '../stealth'

/**
 * Result of Sui stealth address generation
 */
export interface SuiStealthResult {
  /** Sui address in 0x-prefixed 64-character hex format */
  stealthAddress: string
  /** Raw 32-byte ed25519 stealth public key (hex) */
  stealthPublicKey: HexString
  /** Ephemeral public key for recipient scanning (hex) */
  ephemeralPublicKey: HexString
  /** View tag for efficient scanning (0-255) */
  viewTag: number
  /** Shared secret hash (for verification) */
  sharedSecret: HexString
}

/**
 * Sui signature scheme flag
 * 0x00 = ED25519 signature
 */
const SUI_ED25519_SCHEME = 0x00

/**
 * Convert an ed25519 public key to a Sui address
 *
 * Sui address derivation:
 * 1. Take the 32-byte ed25519 public key
 * 2. Prepend the scheme byte (0x00 for ED25519)
 * 3. Hash with BLAKE2b-256: address = blake2b_256(0x00 || pubkey)
 * 4. Encode as 0x-prefixed hex string (64 characters)
 *
 * @param publicKey - 32-byte ed25519 public key as hex string (with 0x prefix)
 * @returns Sui address (0x-prefixed, 64 hex characters)
 * @throws {ValidationError} If public key is invalid
 *
 * @example
 * ```typescript
 * const suiAddress = ed25519PublicKeyToSuiAddress('0xabc123...')
 * // Returns: "0x1234...abcd" (64 hex chars)
 * ```
 */
export function ed25519PublicKeyToSuiAddress(publicKey: HexString): string {
  // Validate input
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

  // Prepend signature scheme byte (0x00 for ED25519)
  const addressInput = new Uint8Array(publicKeyBytes.length + 1)
  addressInput[0] = SUI_ED25519_SCHEME
  addressInput.set(publicKeyBytes, 1)

  // Hash with BLAKE2b-256 to get the address
  const hasher = new BLAKE2b({ dkLen: 32 })
  hasher.update(addressInput)
  const addressHash = hasher.digest()

  // Return as 0x-prefixed hex string
  return `0x${bytesToHex(addressHash)}`
}

/**
 * Validate a Sui address format
 *
 * Checks that the address:
 * - Is a valid hex string with 0x prefix
 * - Is exactly 32 bytes (64 hex characters)
 * - Contains only valid hex characters
 *
 * Note: This does NOT verify if the address exists on-chain or is derived correctly.
 * It only validates the format.
 *
 * @param address - Sui address to validate
 * @returns true if format is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidSuiAddress('0x1234...abcd') // true (64 hex chars)
 * isValidSuiAddress('0x123')         // false (too short)
 * isValidSuiAddress('1234abcd...')   // false (no 0x prefix)
 * ```
 */
export function isValidSuiAddress(address: string): boolean {
  if (typeof address !== 'string' || address.length === 0) {
    return false
  }

  // Must start with 0x
  if (!address.startsWith('0x')) {
    return false
  }

  // Must be exactly 64 hex characters after 0x (32 bytes)
  const hexPart = address.slice(2)
  if (hexPart.length !== 64) {
    return false
  }

  // Must be valid hex
  return /^[0-9a-fA-F]{64}$/.test(hexPart)
}

/**
 * Normalize a Sui address to lowercase
 *
 * @param address - Sui address (0x-prefixed hex string)
 * @returns Normalized address as HexString
 * @throws {ValidationError} If address format is invalid
 *
 * @example
 * ```typescript
 * const normalized = normalizeSuiAddress('0x1234...ABCD')
 * // Returns: "0x1234...abcd" (lowercase)
 * ```
 */
export function normalizeSuiAddress(address: string): HexString {
  if (!isValidSuiAddress(address)) {
    throw new ValidationError(
      'Invalid Sui address format (must be 0x-prefixed 64 hex characters)',
      'address'
    )
  }

  // Normalize to lowercase
  return address.toLowerCase() as HexString
}

/**
 * Generate a stealth address for Sui
 *
 * Uses the existing ed25519 stealth address generation logic and converts
 * the resulting ed25519 public key to Sui address format.
 *
 * @param recipientMetaAddress - Recipient's stealth meta-address (must be chain: 'sui')
 * @returns Sui stealth address result with all necessary data
 * @throws {ValidationError} If meta-address is invalid or not for Sui
 *
 * @example
 * ```typescript
 * const metaAddress = {
 *   spendingKey: '0x...',
 *   viewingKey: '0x...',
 *   chain: 'sui'
 * }
 * const result = generateSuiStealthAddress(metaAddress)
 * console.log(result.stealthAddress) // "0x1234...abcd"
 * console.log(result.viewTag)        // 42
 * ```
 */
export function generateSuiStealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): SuiStealthResult {
  // Validate chain
  if (recipientMetaAddress.chain !== 'sui') {
    throw new ValidationError(
      `Expected chain 'sui', got '${recipientMetaAddress.chain}'`,
      'recipientMetaAddress.chain'
    )
  }

  // Generate ed25519 stealth address using existing logic
  const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(recipientMetaAddress)

  // Convert the ed25519 public key to Sui address format
  const suiAddress = ed25519PublicKeyToSuiAddress(stealthAddress.address)

  return {
    stealthAddress: suiAddress,
    stealthPublicKey: stealthAddress.address,
    ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    viewTag: stealthAddress.viewTag,
    sharedSecret,
  }
}

/**
 * Derive the private key for a Sui stealth address
 *
 * This allows the recipient to claim funds sent to a stealth address.
 * Uses the standard ed25519 stealth key derivation.
 *
 * @param stealthAddress - The stealth address data (from announcement)
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns Derived private key (raw scalar, little-endian format)
 * @throws {ValidationError} If any input is invalid
 *
 * @example
 * ```typescript
 * const recovery = deriveSuiStealthPrivateKey(
 *   stealthAddress,
 *   spendingPrivKey,
 *   viewingPrivKey
 * )
 * // Use recovery.privateKey to sign transactions
 * ```
 */
export function deriveSuiStealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  privateKey: HexString
  suiAddress: string
} {
  // Use standard ed25519 derivation
  const recovery = deriveEd25519StealthPrivateKey(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )

  // Convert the stealth public key to Sui address
  const suiAddress = ed25519PublicKeyToSuiAddress(recovery.stealthAddress)

  return {
    ...recovery,
    suiAddress,
  }
}

/**
 * Check if a stealth address belongs to this recipient
 *
 * Uses view tag for efficient filtering before full computation.
 * This is the same as the standard ed25519 check since Sui stealth
 * addresses use ed25519 stealth public keys.
 *
 * @param stealthAddress - Stealth address to check
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns true if this address belongs to the recipient
 * @throws {ValidationError} If any input is invalid
 *
 * @example
 * ```typescript
 * const isMine = checkSuiStealthAddress(
 *   stealthAddress,
 *   mySpendingPrivKey,
 *   myViewingPrivKey
 * )
 * ```
 */
export function checkSuiStealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): boolean {
  // Use standard ed25519 check
  return checkEd25519StealthAddress(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )
}

/**
 * Sui Stealth Service
 *
 * Provides a convenient class-based interface for Sui stealth address operations.
 * This is useful when you need to perform multiple operations or want to encapsulate
 * the logic in a service object.
 */
export class SuiStealthService {
  /**
   * Generate a stealth address for a Sui recipient
   *
   * @param recipientMetaAddress - Recipient's stealth meta-address
   * @returns Complete stealth address result
   */
  generateStealthAddress(recipientMetaAddress: StealthMetaAddress): SuiStealthResult {
    return generateSuiStealthAddress(recipientMetaAddress)
  }

  /**
   * Convert an ed25519 public key to Sui address format
   *
   * @param publicKey - 32-byte ed25519 public key
   * @returns Sui address string
   */
  stealthKeyToSuiAddress(publicKey: HexString): string {
    return ed25519PublicKeyToSuiAddress(publicKey)
  }

  /**
   * Derive the private key for a stealth address
   *
   * @param stealthAddress - Stealth address data
   * @param spendingPrivateKey - Recipient's spending private key
   * @param viewingPrivateKey - Recipient's viewing private key
   * @returns Recovery data with derived private key
   */
  deriveStealthPrivateKey(
    stealthAddress: StealthAddress,
    spendingPrivateKey: HexString,
    viewingPrivateKey: HexString,
  ) {
    return deriveSuiStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
  }

  /**
   * Check if a stealth address belongs to this recipient
   *
   * @param stealthAddress - Stealth address to check
   * @param spendingPrivateKey - Recipient's spending private key
   * @param viewingPrivateKey - Recipient's viewing private key
   * @returns true if the address belongs to this recipient
   */
  checkStealthAddress(
    stealthAddress: StealthAddress,
    spendingPrivateKey: HexString,
    viewingPrivateKey: HexString,
  ): boolean {
    return checkSuiStealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
  }

  /**
   * Validate a Sui address format
   *
   * @param address - Address to validate
   * @returns true if valid format
   */
  isValidAddress(address: string): boolean {
    return isValidSuiAddress(address)
  }
}
