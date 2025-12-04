/**
 * Aptos stealth address implementation
 *
 * Aptos uses ed25519 for signatures, similar to Solana and NEAR.
 * This module provides stealth address generation and address format conversion for Aptos.
 *
 * Key differences from Solana/NEAR:
 * - Aptos addresses are derived via SHA3-256(pubkey || 0x00)
 * - 32-byte addresses encoded as hex with 0x prefix
 * - Single-signature scheme indicator: 0x00 suffix
 *
 * @see https://aptos.dev/concepts/accounts/
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha3_256 } from '@noble/hashes/sha3'
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
 * Result of Aptos stealth address generation
 */
export interface AptosStealthResult {
  /** Aptos address in 0x-prefixed 64-character hex format */
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
 * Aptos address authentication key scheme
 * 0x00 = Single Ed25519 signature
 * 0x01 = MultiEd25519 signature
 */
const APTOS_SINGLE_ED25519_SCHEME = 0x00

/**
 * Convert an ed25519 public key to an Aptos address
 *
 * Aptos address derivation:
 * 1. Take the 32-byte ed25519 public key
 * 2. Append the scheme byte (0x00 for single signature)
 * 3. Hash with SHA3-256: address = sha3_256(pubkey || 0x00)
 * 4. Encode as 0x-prefixed hex string (64 characters)
 *
 * @param publicKey - 32-byte ed25519 public key as hex string (with 0x prefix)
 * @returns Aptos address (0x-prefixed, 64 hex characters)
 * @throws {ValidationError} If public key is invalid
 *
 * @example
 * ```typescript
 * const aptosAddress = ed25519PublicKeyToAptosAddress('0xabc123...')
 * // Returns: "0x1234...abcd" (64 hex chars)
 * ```
 */
export function ed25519PublicKeyToAptosAddress(publicKey: HexString): string {
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

  // Append single-signature scheme byte
  const authKeyInput = new Uint8Array(publicKeyBytes.length + 1)
  authKeyInput.set(publicKeyBytes, 0)
  authKeyInput[publicKeyBytes.length] = APTOS_SINGLE_ED25519_SCHEME

  // Hash with SHA3-256 to get the address
  const addressHash = sha3_256(authKeyInput)

  // Return as 0x-prefixed hex string
  return `0x${bytesToHex(addressHash)}`
}

/**
 * Validate an Aptos address format
 *
 * Checks that the address:
 * - Is a valid hex string with 0x prefix
 * - Is exactly 32 bytes (64 hex characters)
 * - Contains only valid hex characters
 *
 * Note: This does NOT verify if the address exists on-chain or is derived correctly.
 * It only validates the format.
 *
 * @param address - Aptos address to validate
 * @returns true if format is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidAptosAddress('0x1234...abcd') // true (64 hex chars)
 * isValidAptosAddress('0x123')         // false (too short)
 * isValidAptosAddress('1234abcd...')   // false (no 0x prefix)
 * ```
 */
export function isValidAptosAddress(address: string): boolean {
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
 * Convert an Aptos address back to its authentication key
 *
 * Note: This returns the SHA3-256 hash, not the original public key.
 * The original public key cannot be recovered from the address alone.
 *
 * @param address - Aptos address (0x-prefixed hex string)
 * @returns Authentication key as HexString
 * @throws {ValidationError} If address format is invalid
 *
 * @example
 * ```typescript
 * const authKey = aptosAddressToAuthKey('0x1234...abcd')
 * // Returns: "0x1234...abcd" (same as input, normalized)
 * ```
 */
export function aptosAddressToAuthKey(address: string): HexString {
  if (!isValidAptosAddress(address)) {
    throw new ValidationError(
      'Invalid Aptos address format (must be 0x-prefixed 64 hex characters)',
      'address'
    )
  }

  // Normalize to lowercase
  return address.toLowerCase() as HexString
}

/**
 * Generate a stealth address for Aptos
 *
 * Uses the existing ed25519 stealth address generation logic and converts
 * the resulting ed25519 public key to Aptos address format.
 *
 * @param recipientMetaAddress - Recipient's stealth meta-address (must be chain: 'aptos')
 * @returns Aptos stealth address result with all necessary data
 * @throws {ValidationError} If meta-address is invalid or not for Aptos
 *
 * @example
 * ```typescript
 * const metaAddress = {
 *   spendingKey: '0x...',
 *   viewingKey: '0x...',
 *   chain: 'aptos'
 * }
 * const result = generateAptosStealthAddress(metaAddress)
 * console.log(result.stealthAddress) // "0x1234...abcd"
 * console.log(result.viewTag)        // 42
 * ```
 */
export function generateAptosStealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): AptosStealthResult {
  // Validate chain
  if (recipientMetaAddress.chain !== 'aptos') {
    throw new ValidationError(
      `Expected chain 'aptos', got '${recipientMetaAddress.chain}'`,
      'recipientMetaAddress.chain'
    )
  }

  // Generate ed25519 stealth address using existing logic
  const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(recipientMetaAddress)

  // Convert the ed25519 public key to Aptos address format
  const aptosAddress = ed25519PublicKeyToAptosAddress(stealthAddress.address)

  return {
    stealthAddress: aptosAddress,
    stealthPublicKey: stealthAddress.address,
    ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    viewTag: stealthAddress.viewTag,
    sharedSecret,
  }
}

/**
 * Derive the private key for an Aptos stealth address
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
 * const recovery = deriveAptosStealthPrivateKey(
 *   stealthAddress,
 *   spendingPrivKey,
 *   viewingPrivKey
 * )
 * // Use recovery.privateKey to sign transactions
 * ```
 */
export function deriveAptosStealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  privateKey: HexString
  aptosAddress: string
} {
  // Use standard ed25519 derivation
  const recovery = deriveEd25519StealthPrivateKey(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )

  // Convert the stealth public key to Aptos address
  const aptosAddress = ed25519PublicKeyToAptosAddress(recovery.stealthAddress)

  return {
    ...recovery,
    aptosAddress,
  }
}

/**
 * Check if a stealth address belongs to this recipient
 *
 * Uses view tag for efficient filtering before full computation.
 * This is the same as the standard ed25519 check since Aptos stealth
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
 * const isMine = checkAptosStealthAddress(
 *   stealthAddress,
 *   mySpendingPrivKey,
 *   myViewingPrivKey
 * )
 * ```
 */
export function checkAptosStealthAddress(
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
 * Aptos Stealth Service
 *
 * Provides a convenient class-based interface for Aptos stealth address operations.
 * This is useful when you need to perform multiple operations or want to encapsulate
 * the logic in a service object.
 */
export class AptosStealthService {
  /**
   * Generate a stealth address for an Aptos recipient
   *
   * @param recipientMetaAddress - Recipient's stealth meta-address
   * @returns Complete stealth address result
   */
  generateStealthAddress(recipientMetaAddress: StealthMetaAddress): AptosStealthResult {
    return generateAptosStealthAddress(recipientMetaAddress)
  }

  /**
   * Convert an ed25519 public key to Aptos address format
   *
   * @param publicKey - 32-byte ed25519 public key
   * @returns Aptos address string
   */
  stealthKeyToAptosAddress(publicKey: HexString): string {
    return ed25519PublicKeyToAptosAddress(publicKey)
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
    return deriveAptosStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
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
    return checkAptosStealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
  }

  /**
   * Validate an Aptos address format
   *
   * @param address - Address to validate
   * @returns true if valid format
   */
  isValidAddress(address: string): boolean {
    return isValidAptosAddress(address)
  }
}
