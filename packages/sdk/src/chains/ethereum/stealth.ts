/**
 * Ethereum Stealth Address Implementation (EIP-5564)
 *
 * Ethereum-specific wrapper around secp256k1 stealth addresses.
 * Implements EIP-5564 compliant stealth address generation and resolution.
 *
 * ## EIP-5564 Overview
 *
 * EIP-5564 defines a standard for stealth addresses on Ethereum:
 * - Meta-address format: `st:eth:0x<spendingKey><viewingKey>`
 * - Scheme ID 1: secp256k1 curve
 * - Uses keccak256 for address derivation
 *
 * @see https://eips.ethereum.org/EIPS/eip-5564
 * @packageDocumentation
 */

import type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  HexString,
} from '@sip-protocol/types'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  generateSecp256k1StealthMetaAddress,
  generateSecp256k1StealthAddress,
  deriveSecp256k1StealthPrivateKey,
  checkSecp256k1StealthAddress,
  publicKeyToEthAddress,
} from '../../stealth/secp256k1'
import { sha256, hexToBytes, bytesToHex } from '../../stealth/utils'
import { isValidPrivateKey } from '../../validation'
import { ValidationError } from '../../errors'
import { SECP256K1_SCHEME_ID } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Ethereum stealth meta-address with additional context
 */
export interface EthereumStealthMetaAddress extends StealthMetaAddress {
  /** Always 'ethereum' for this chain */
  chain: 'ethereum'
  /** EIP-5564 scheme ID (1 for secp256k1) */
  schemeId: typeof SECP256K1_SCHEME_ID
}

/**
 * Ethereum stealth address with derived ETH address
 */
export interface EthereumStealthAddress extends StealthAddress {
  /** Ethereum address derived from the stealth public key */
  ethAddress: HexString
}

/**
 * Result of generating an Ethereum stealth meta-address
 */
export interface EthereumStealthMetaAddressResult {
  /** The stealth meta-address */
  metaAddress: EthereumStealthMetaAddress
  /** EIP-5564 encoded string */
  encoded: string
  /** Spending private key (keep secret!) */
  spendingPrivateKey: HexString
  /** Viewing private key (share with auditors) */
  viewingPrivateKey: HexString
}

/**
 * Result of resolving a stealth address for a recipient
 */
export interface EthereumStealthAddressResult {
  /** The stealth address */
  stealthAddress: EthereumStealthAddress
  /** Shared secret (for debugging, should be discarded) */
  sharedSecret: HexString
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * EIP-5564 meta-address prefix for Ethereum
 */
export const EIP5564_PREFIX = 'st:eth:0x'

/**
 * Scheme ID for secp256k1 (EIP-5564)
 */
export const SCHEME_ID = SECP256K1_SCHEME_ID

// ─── Meta-Address Generation ────────────────────────────────────────────────

/**
 * Generate a new Ethereum stealth meta-address
 *
 * Creates a new keypair suitable for receiving stealth payments on Ethereum.
 *
 * @param label - Optional label for the meta-address
 * @returns Generated meta-address and private keys
 *
 * @example
 * ```typescript
 * const result = generateEthereumStealthMetaAddress('My Wallet')
 *
 * // Share the encoded meta-address with senders
 * console.log(result.encoded)
 * // => 'st:eth:0x02abc...123def...456'
 *
 * // Store private keys securely
 * console.log(result.spendingPrivateKey) // For claiming funds
 * console.log(result.viewingPrivateKey)  // For scanning & auditors
 * ```
 */
export function generateEthereumStealthMetaAddress(
  label?: string
): EthereumStealthMetaAddressResult {
  const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
    generateSecp256k1StealthMetaAddress('ethereum', label)

  const ethereumMetaAddress: EthereumStealthMetaAddress = {
    ...metaAddress,
    chain: 'ethereum',
    schemeId: SCHEME_ID,
  }

  return {
    metaAddress: ethereumMetaAddress,
    encoded: encodeEthereumStealthMetaAddress(ethereumMetaAddress),
    spendingPrivateKey,
    viewingPrivateKey,
  }
}

// ─── Meta-Address Encoding ──────────────────────────────────────────────────

/**
 * Encode an Ethereum stealth meta-address to EIP-5564 string format
 *
 * Format: `st:eth:0x<spendingKey><viewingKey>`
 * - spendingKey: 33 bytes compressed secp256k1 (66 hex chars)
 * - viewingKey: 33 bytes compressed secp256k1 (66 hex chars)
 *
 * @param metaAddress - The meta-address to encode
 * @returns EIP-5564 encoded string
 *
 * @example
 * ```typescript
 * const encoded = encodeEthereumStealthMetaAddress(metaAddress)
 * // => 'st:eth:0x02abc...123def...456'
 * ```
 */
export function encodeEthereumStealthMetaAddress(
  metaAddress: StealthMetaAddress
): string {
  // Remove 0x prefixes
  const spendingKey = metaAddress.spendingKey.slice(2)
  const viewingKey = metaAddress.viewingKey.slice(2)

  // Validate lengths (33 bytes = 66 hex chars)
  if (spendingKey.length !== 66) {
    throw new ValidationError(
      `spendingKey must be 33 bytes (66 hex chars), got ${spendingKey.length / 2} bytes`,
      'metaAddress.spendingKey'
    )
  }

  if (viewingKey.length !== 66) {
    throw new ValidationError(
      `viewingKey must be 33 bytes (66 hex chars), got ${viewingKey.length / 2} bytes`,
      'metaAddress.viewingKey'
    )
  }

  return `${EIP5564_PREFIX}${spendingKey}${viewingKey}`
}

/**
 * Parse an EIP-5564 encoded meta-address string
 *
 * @param encoded - The encoded meta-address string
 * @returns Parsed meta-address
 *
 * @example
 * ```typescript
 * const metaAddress = parseEthereumStealthMetaAddress('st:eth:0x02abc...123def...456')
 * console.log(metaAddress.spendingKey) // '0x02abc...123'
 * console.log(metaAddress.viewingKey)  // '0x03def...456'
 * ```
 */
export function parseEthereumStealthMetaAddress(
  encoded: string
): EthereumStealthMetaAddress {
  if (!encoded || typeof encoded !== 'string') {
    throw new ValidationError('must be a non-empty string', 'encoded')
  }

  // Check prefix
  if (!encoded.startsWith(EIP5564_PREFIX)) {
    throw new ValidationError(
      `must start with '${EIP5564_PREFIX}', got '${encoded.slice(0, 10)}...'`,
      'encoded'
    )
  }

  // Extract keys (after 'st:eth:0x')
  const keysHex = encoded.slice(EIP5564_PREFIX.length)

  // Should be 132 hex chars (66 + 66 for two 33-byte keys)
  if (keysHex.length !== 132) {
    throw new ValidationError(
      `expected 132 hex characters for keys, got ${keysHex.length}`,
      'encoded'
    )
  }

  // Validate hex
  if (!/^[0-9a-fA-F]+$/.test(keysHex)) {
    throw new ValidationError('contains invalid hex characters', 'encoded')
  }

  const spendingKey = `0x${keysHex.slice(0, 66)}` as HexString
  const viewingKey = `0x${keysHex.slice(66)}` as HexString

  return {
    spendingKey,
    viewingKey,
    chain: 'ethereum',
    schemeId: SCHEME_ID,
  }
}

/**
 * Validate an EIP-5564 encoded meta-address string
 *
 * @param encoded - The string to validate
 * @returns True if valid
 */
export function isValidEthereumStealthMetaAddress(encoded: string): boolean {
  try {
    parseEthereumStealthMetaAddress(encoded)
    return true
  } catch {
    return false
  }
}

// ─── Stealth Address Generation ─────────────────────────────────────────────

/**
 * Generate a one-time stealth address for an Ethereum recipient
 *
 * Creates a stealth address that only the recipient can derive the private key for.
 *
 * @param recipientMetaAddress - Recipient's meta-address (object or encoded string)
 * @returns Stealth address with Ethereum address
 *
 * @example
 * ```typescript
 * // Generate stealth address for recipient
 * const result = generateEthereumStealthAddress(recipientMetaAddress)
 *
 * // Send ETH to this address
 * console.log(result.stealthAddress.ethAddress)
 * // => '0x1234...abcd'
 *
 * // Include ephemeral key in announcement
 * console.log(result.stealthAddress.ephemeralPublicKey)
 * ```
 */
export function generateEthereumStealthAddress(
  recipientMetaAddress: StealthMetaAddress | string
): EthereumStealthAddressResult {
  // Parse if string
  const metaAddress =
    typeof recipientMetaAddress === 'string'
      ? parseEthereumStealthMetaAddress(recipientMetaAddress)
      : recipientMetaAddress

  // Generate stealth address
  const { stealthAddress, sharedSecret } =
    generateSecp256k1StealthAddress(metaAddress)

  // Derive Ethereum address from stealth public key
  const ethAddress = publicKeyToEthAddress(stealthAddress.address)

  const ethereumStealthAddress: EthereumStealthAddress = {
    ...stealthAddress,
    ethAddress,
  }

  return {
    stealthAddress: ethereumStealthAddress,
    sharedSecret,
  }
}

// ─── Private Key Derivation ─────────────────────────────────────────────────

/**
 * Derive the private key for an Ethereum stealth address
 *
 * Used by the recipient to claim funds sent to a stealth address.
 *
 * @param stealthAddress - The stealth address to derive key for
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns Recovery information including private key
 *
 * @example
 * ```typescript
 * // Recipient derives private key to claim funds
 * const recovery = deriveEthereumStealthPrivateKey(
 *   announcement.stealthAddress,
 *   mySpendingPrivateKey,
 *   myViewingPrivateKey
 * )
 *
 * // Use private key to sign claim transaction
 * console.log(recovery.privateKey)
 * ```
 */
export function deriveEthereumStealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString
): StealthAddressRecovery & { ethAddress: HexString } {
  const recovery = deriveSecp256k1StealthPrivateKey(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )

  // Derive Ethereum address
  const ethAddress = publicKeyToEthAddress(stealthAddress.address)

  return {
    ...recovery,
    ethAddress,
  }
}

// ─── Address Checking ───────────────────────────────────────────────────────

/**
 * Check if an Ethereum stealth address belongs to this recipient
 *
 * Used during scanning to quickly filter announcements.
 *
 * @param stealthAddress - The stealth address to check
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns True if the address belongs to this recipient
 *
 * @example
 * ```typescript
 * // During scanning, check each announcement
 * for (const announcement of announcements) {
 *   const isMine = checkEthereumStealthAddress(
 *     announcement.stealthAddress,
 *     mySpendingPrivateKey,
 *     myViewingPrivateKey
 *   )
 *   if (isMine) {
 *     console.log('Found incoming payment!')
 *   }
 * }
 * ```
 */
export function checkEthereumStealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString
): boolean {
  return checkSecp256k1StealthAddress(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )
}

/**
 * Check if an Ethereum stealth address matches by ETH address comparison
 *
 * Used when the announcement only contains the 20-byte ETH address (not the
 * full 33-byte compressed public key). Derives the expected stealth public key,
 * converts it to an ETH address, and compares.
 *
 * @param ethAddress - The ETH address from the announcement (20 bytes)
 * @param ephemeralPublicKey - Ephemeral public key from the announcement
 * @param viewTag - View tag from the announcement
 * @param spendingPublicKey - Recipient's spending public key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns True if the address belongs to this recipient
 */
export function checkEthereumStealthByEthAddress(
  ethAddress: HexString,
  ephemeralPublicKey: HexString,
  viewTag: number,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): HexString | null {
  if (!isValidPrivateKey(spendingPrivateKey)) {
    throw new ValidationError(
      'must be a valid 32-byte hex string',
      'spendingPrivateKey'
    )
  }
  if (!isValidPrivateKey(viewingPrivateKey)) {
    throw new ValidationError(
      'must be a valid 32-byte hex string',
      'viewingPrivateKey'
    )
  }

  const spendingPrivBytes = hexToBytes(spendingPrivateKey.slice(2))
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))
  const ephemeralPubBytes = hexToBytes(ephemeralPublicKey.slice(2))

  try {
    // Compute shared secret: S = spendingPrivateKey * ephemeralPublicKey
    // Mirrors generation: S = ephemeralPrivate * spendingPublic
    const sharedSecretPoint = secp256k1.getSharedSecret(
      spendingPrivBytes,
      ephemeralPubBytes,
    )
    const sharedSecretHash = sha256(sharedSecretPoint)

    // Quick view tag check
    if (sharedSecretHash[0] !== viewTag) {
      return null
    }

    // Derive stealth private key: viewingPriv + hash(S) mod n
    // Mirrors generation: stealth = viewingPub + hash(S)*G
    const viewingScalar = BigInt('0x' + bytesToHex(viewingPrivBytes))
    const hashScalar = BigInt('0x' + bytesToHex(sharedSecretHash))
    const stealthPrivScalar = (viewingScalar + hashScalar) % secp256k1.CURVE.n

    // Compute expected public key from derived private key
    const stealthPrivHex = stealthPrivScalar.toString(16).padStart(64, '0')
    const stealthPrivKeyBytes = hexToBytes(stealthPrivHex)
    const expectedPubKey = secp256k1.getPublicKey(stealthPrivKeyBytes, true)

    // Convert to ETH address
    const expectedPubKeyHex = ('0x' + bytesToHex(expectedPubKey)) as HexString
    const expectedEthAddress = publicKeyToEthAddress(expectedPubKeyHex)

    // Compare addresses (case-insensitive)
    if (expectedEthAddress.toLowerCase() === ethAddress.toLowerCase()) {
      return ('0x' + stealthPrivHex) as HexString
    }
    return null
  } catch {
    return null
  }
}

// ─── Address Conversion ─────────────────────────────────────────────────────

/**
 * Convert a secp256k1 public key to an Ethereum address
 *
 * @param publicKey - Compressed or uncompressed public key
 * @returns Checksummed Ethereum address
 */
export function stealthPublicKeyToEthAddress(publicKey: HexString): HexString {
  return publicKeyToEthAddress(publicKey)
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Extract public keys from a meta-address for sharing
 *
 * @param metaAddress - The meta-address
 * @returns Object with spending and viewing public keys
 */
export function extractPublicKeys(metaAddress: StealthMetaAddress): {
  spendingPublicKey: HexString
  viewingPublicKey: HexString
} {
  return {
    spendingPublicKey: metaAddress.spendingKey,
    viewingPublicKey: metaAddress.viewingKey,
  }
}

/**
 * Create a meta-address from public keys
 *
 * @param spendingPublicKey - Spending public key (33 bytes compressed)
 * @param viewingPublicKey - Viewing public key (33 bytes compressed)
 * @param label - Optional label
 * @returns Ethereum stealth meta-address
 */
export function createMetaAddressFromPublicKeys(
  spendingPublicKey: HexString,
  viewingPublicKey: HexString,
  label?: string
): EthereumStealthMetaAddress {
  // Validate public keys
  const spendingHex = spendingPublicKey.startsWith('0x')
    ? spendingPublicKey.slice(2)
    : spendingPublicKey

  const viewingHex = viewingPublicKey.startsWith('0x')
    ? viewingPublicKey.slice(2)
    : viewingPublicKey

  if (spendingHex.length !== 66) {
    throw new ValidationError(
      'spendingPublicKey must be 33 bytes (66 hex chars)',
      'spendingPublicKey'
    )
  }

  if (viewingHex.length !== 66) {
    throw new ValidationError(
      'viewingPublicKey must be 33 bytes (66 hex chars)',
      'viewingPublicKey'
    )
  }

  return {
    spendingKey: `0x${spendingHex}` as HexString,
    viewingKey: `0x${viewingHex}` as HexString,
    chain: 'ethereum',
    schemeId: SCHEME_ID,
    label,
  }
}

/**
 * Get the scheme ID for Ethereum stealth addresses
 *
 * @returns EIP-5564 scheme ID (1 for secp256k1)
 */
export function getSchemeId(): number {
  return SCHEME_ID
}
