/**
 * NEAR Stealth Address Generation
 *
 * Implements stealth addresses for NEAR Protocol using ed25519 curve.
 * Stealth addresses are indistinguishable from regular NEAR implicit accounts.
 *
 * NEAR uses ed25519 for all cryptographic operations. Implicit accounts are
 * derived directly from ed25519 public keys (32-byte hex string).
 *
 * @example Generate stealth meta-address
 * ```typescript
 * import { generateNEARStealthMetaAddress } from '@sip-protocol/sdk'
 *
 * const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
 *   generateNEARStealthMetaAddress()
 *
 * console.log(metaAddress)
 * // => sip:near:0x<spending_key>:0x<viewing_key>
 * ```
 *
 * @example Generate one-time stealth address
 * ```typescript
 * import { generateNEARStealthAddress } from '@sip-protocol/sdk'
 *
 * const { stealthAddress, sharedSecret } = generateNEARStealthAddress(metaAddress)
 *
 * // stealthAddress.address is an ed25519 public key (0x-prefixed hex)
 * // Convert to NEAR implicit account:
 * const implicitAccount = stealthAddress.address.slice(2) // Remove 0x prefix
 * ```
 *
 * @packageDocumentation
 */

import type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  HexString,
} from '@sip-protocol/types'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
  validateEd25519StealthMetaAddress,
  validateEd25519StealthAddress,
} from '../../stealth/ed25519'
import { ValidationError } from '../../errors'
import { isImplicitAccount } from './constants'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * NEAR-specific stealth address result
 */
export interface NEARStealthAddressResult {
  /** The one-time stealth address (ed25519 public key) */
  stealthAddress: StealthAddress
  /** Shared secret for deriving the stealth private key */
  sharedSecret: HexString
  /** NEAR implicit account ID (64 hex chars, derived from stealth address) */
  implicitAccountId: string
}

/**
 * NEAR stealth meta-address generation result
 */
export interface NEARStealthMetaAddressResult {
  /** The stealth meta-address (contains spending and viewing public keys) */
  metaAddress: StealthMetaAddress
  /** Spending private key (keep secret!) */
  spendingPrivateKey: HexString
  /** Viewing private key (can be shared with auditors) */
  viewingPrivateKey: HexString
}

// ─── Meta-Address Generation ─────────────────────────────────────────────────

/**
 * Generate a new NEAR stealth meta-address keypair
 *
 * The meta-address can be shared publicly. It contains:
 * - spendingKey: Used to derive stealth private keys (keep corresponding private key secret!)
 * - viewingKey: Used to scan for incoming payments (can share private key with auditors)
 *
 * @param label - Optional human-readable label for this meta-address
 * @returns Meta-address and private keys
 *
 * @example
 * ```typescript
 * const result = generateNEARStealthMetaAddress('My NEAR Wallet')
 *
 * // Share metaAddress publicly
 * console.log(result.metaAddress)
 *
 * // Store private keys securely
 * saveSecurely(result.spendingPrivateKey)
 * saveSecurely(result.viewingPrivateKey)
 * ```
 */
export function generateNEARStealthMetaAddress(
  label?: string
): NEARStealthMetaAddressResult {
  return generateEd25519StealthMetaAddress('near', label)
}

// ─── Stealth Address Generation ──────────────────────────────────────────────

/**
 * Generate a one-time stealth address for a NEAR recipient
 *
 * The sender uses this to create a fresh address that only the recipient
 * can detect and spend from.
 *
 * @param recipientMetaAddress - Recipient's stealth meta-address
 * @returns Stealth address, shared secret, and NEAR implicit account ID
 *
 * @example
 * ```typescript
 * // Sender creates stealth address for recipient
 * const { stealthAddress, implicitAccountId } =
 *   generateNEARStealthAddress(recipientMetaAddress)
 *
 * // Send NEAR/tokens to implicitAccountId
 * await nearConnection.sendMoney(implicitAccountId, amount)
 *
 * // Include announcement in memo for recipient to scan
 * ```
 */
export function generateNEARStealthAddress(
  recipientMetaAddress: StealthMetaAddress | string
): NEARStealthAddressResult {
  // Parse if string format
  const metaAddr =
    typeof recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(recipientMetaAddress)
      : recipientMetaAddress

  // Validate it's a NEAR meta-address
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'recipientMetaAddress.chain'
    )
  }

  // Generate stealth address using ed25519
  const { stealthAddress, sharedSecret } =
    generateEd25519StealthAddress(metaAddr)

  // Convert to NEAR implicit account ID
  const implicitAccountId = ed25519PublicKeyToImplicitAccount(
    stealthAddress.address
  )

  return {
    stealthAddress,
    sharedSecret,
    implicitAccountId,
  }
}

// ─── Private Key Derivation ──────────────────────────────────────────────────

/**
 * Derive the private key for a NEAR stealth address
 *
 * The recipient uses this to derive the private key that controls
 * the funds sent to a stealth address.
 *
 * @param stealthAddress - The one-time stealth address
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns Recovery data including the derived private key
 *
 * @example
 * ```typescript
 * // Recipient derives private key to spend funds
 * const recovery = deriveNEARStealthPrivateKey(
 *   detectedPayment.stealthAddress,
 *   mySpendingPrivateKey,
 *   myViewingPrivateKey
 * )
 *
 * // Use privateKey to sign NEAR transactions
 * const keypair = nearKeyFromPrivateKey(recovery.privateKey)
 * ```
 */
export function deriveNEARStealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString
): StealthAddressRecovery {
  return deriveEd25519StealthPrivateKey(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )
}

// ─── Address Checking ────────────────────────────────────────────────────────

/**
 * Check if a NEAR stealth address was intended for this recipient
 *
 * Efficiently checks if a stealth address belongs to the owner of
 * the given spending/viewing keys.
 *
 * @param stealthAddress - The stealth address to check
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns True if the address belongs to this recipient
 *
 * @example
 * ```typescript
 * // Check if a detected address is for us
 * const isForMe = checkNEARStealthAddress(
 *   announcement.stealthAddress,
 *   mySpendingPrivateKey,
 *   myViewingPrivateKey
 * )
 *
 * if (isForMe) {
 *   // Derive private key and claim funds
 * }
 * ```
 */
export function checkNEARStealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString
): boolean {
  return checkEd25519StealthAddress(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )
}

// ─── Address Format Conversion ───────────────────────────────────────────────

/**
 * Convert ed25519 public key to NEAR implicit account ID
 *
 * NEAR implicit accounts are the 64-character lowercase hex representation
 * of the ed25519 public key (without 0x prefix).
 *
 * @param publicKey - Ed25519 public key (0x-prefixed hex)
 * @returns NEAR implicit account ID (64 hex chars)
 *
 * @example
 * ```typescript
 * const accountId = ed25519PublicKeyToImplicitAccount(
 *   '0x1234567890abcdef...'
 * )
 * // => '1234567890abcdef...' (64 chars)
 * ```
 */
export function ed25519PublicKeyToImplicitAccount(publicKey: HexString): string {
  // Remove 0x prefix and ensure lowercase
  const hex = publicKey.slice(2).toLowerCase()

  // Validate length (32 bytes = 64 hex chars)
  if (hex.length !== 64) {
    throw new ValidationError(
      `Invalid ed25519 public key length: expected 64 hex chars, got ${hex.length}`,
      'publicKey'
    )
  }

  // Validate hex characters
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new ValidationError(
      'Invalid ed25519 public key: must contain only hex characters',
      'publicKey'
    )
  }

  return hex
}

/**
 * Convert NEAR implicit account ID to ed25519 public key
 *
 * @param accountId - NEAR implicit account ID (64 hex chars)
 * @returns Ed25519 public key (0x-prefixed hex)
 *
 * @example
 * ```typescript
 * const publicKey = implicitAccountToEd25519PublicKey(
 *   '1234567890abcdef...'
 * )
 * // => '0x1234567890abcdef...'
 * ```
 */
export function implicitAccountToEd25519PublicKey(accountId: string): HexString {
  if (!isImplicitAccount(accountId)) {
    throw new ValidationError(
      'Invalid NEAR implicit account ID: must be 64 lowercase hex characters',
      'accountId'
    )
  }

  return `0x${accountId.toLowerCase()}` as HexString
}

// ─── Meta-Address Encoding/Decoding ──────────────────────────────────────────

/**
 * Encode a NEAR stealth meta-address to string format
 *
 * Format: sip:near:<spendingKey>:<viewingKey>
 *
 * @param metaAddress - The stealth meta-address object
 * @returns Encoded string format
 *
 * @example
 * ```typescript
 * const encoded = encodeNEARStealthMetaAddress(metaAddress)
 * // => 'sip:near:0x1234...5678:0xabcd...ef01'
 * ```
 */
export function encodeNEARStealthMetaAddress(
  metaAddress: StealthMetaAddress
): string {
  validateEd25519StealthMetaAddress(metaAddress)

  if (metaAddress.chain !== 'near') {
    throw new ValidationError(
      `Expected chain 'near', got '${metaAddress.chain}'`,
      'metaAddress.chain'
    )
  }

  return `sip:near:${metaAddress.spendingKey}:${metaAddress.viewingKey}`
}

/**
 * Decode a NEAR stealth meta-address from string format
 *
 * @param encoded - Encoded string (sip:near:<spendingKey>:<viewingKey>)
 * @returns Parsed stealth meta-address
 *
 * @example
 * ```typescript
 * const metaAddress = parseNEARStealthMetaAddress(
 *   'sip:near:0x1234...5678:0xabcd...ef01'
 * )
 * ```
 */
export function parseNEARStealthMetaAddress(encoded: string): StealthMetaAddress {
  const parts = encoded.split(':')

  if (parts.length < 4) {
    throw new ValidationError(
      "Invalid meta-address format: expected 'sip:near:<spendingKey>:<viewingKey>'",
      'encoded'
    )
  }

  const [prefix, chain, spendingKey, viewingKey] = parts

  if (prefix !== 'sip') {
    throw new ValidationError(
      `Invalid meta-address prefix: expected 'sip', got '${prefix}'`,
      'encoded'
    )
  }

  if (chain !== 'near') {
    throw new ValidationError(
      `Invalid chain: expected 'near', got '${chain}'`,
      'encoded'
    )
  }

  const metaAddress: StealthMetaAddress = {
    spendingKey: spendingKey as HexString,
    viewingKey: viewingKey as HexString,
    chain: 'near',
  }

  // Validate the parsed address
  validateEd25519StealthMetaAddress(metaAddress)

  return metaAddress
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Validate a NEAR stealth meta-address
 *
 * @param metaAddress - The meta-address to validate
 * @throws {ValidationError} If the meta-address is invalid
 */
export function validateNEARStealthMetaAddress(
  metaAddress: StealthMetaAddress
): void {
  validateEd25519StealthMetaAddress(metaAddress, 'metaAddress')

  if (metaAddress.chain !== 'near') {
    throw new ValidationError(
      `Expected chain 'near', got '${metaAddress.chain}'`,
      'metaAddress.chain'
    )
  }
}

/**
 * Validate a NEAR stealth address
 *
 * @param stealthAddress - The stealth address to validate
 * @throws {ValidationError} If the stealth address is invalid
 */
export function validateNEARStealthAddress(stealthAddress: StealthAddress): void {
  validateEd25519StealthAddress(stealthAddress, 'stealthAddress')
}
