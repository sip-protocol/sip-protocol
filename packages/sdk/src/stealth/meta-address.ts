/**
 * Stealth Meta-Address Encoding/Decoding
 *
 * Functions for encoding and decoding stealth meta-addresses.
 */

import type { StealthMetaAddress, StealthAddress, ChainId, HexString } from '@sip-protocol/types'
import { ValidationError } from '../errors'
import {
  isValidChainId,
  isValidCompressedPublicKey,
  isValidEd25519PublicKey,
} from '../validation'
import { isEd25519Chain } from './ed25519'

// ─── Meta-Address Encoding ──────────────────────────────────────────────────

/**
 * Encode a stealth meta-address as a string
 * Format: sip:{chain}:{spendingKey}:{viewingKey}
 */
export function encodeStealthMetaAddress(metaAddress: StealthMetaAddress): string {
  return `sip:${metaAddress.chain}:${metaAddress.spendingKey}:${metaAddress.viewingKey}`
}

/**
 * Decode a stealth meta-address from a string
 *
 * @param encoded - Encoded stealth meta-address (format: sip:<chain>:<spendingKey>:<viewingKey>)
 * @returns Decoded StealthMetaAddress
 * @throws {ValidationError} If format is invalid or keys are malformed
 */
export function decodeStealthMetaAddress(encoded: string): StealthMetaAddress {
  if (typeof encoded !== 'string') {
    throw new ValidationError('must be a string', 'encoded')
  }

  const parts = encoded.split(':')
  if (parts.length < 4 || parts[0] !== 'sip') {
    throw new ValidationError(
      'invalid format, expected: sip:<chain>:<spendingKey>:<viewingKey>',
      'encoded'
    )
  }

  const [, chain, spendingKey, viewingKey] = parts

  // Validate chain
  if (!isValidChainId(chain)) {
    throw new ValidationError(
      `invalid chain '${chain}'`,
      'encoded.chain'
    )
  }

  // Validate keys based on chain's curve type
  const chainId = chain as ChainId
  if (isEd25519Chain(chainId)) {
    // Ed25519 chains (Solana, NEAR) use 32-byte public keys
    if (!isValidEd25519PublicKey(spendingKey)) {
      throw new ValidationError(
        'spendingKey must be a valid 32-byte ed25519 public key',
        'encoded.spendingKey'
      )
    }

    if (!isValidEd25519PublicKey(viewingKey)) {
      throw new ValidationError(
        'viewingKey must be a valid 32-byte ed25519 public key',
        'encoded.viewingKey'
      )
    }
  } else {
    // secp256k1 chains (Ethereum, etc.) use 33-byte compressed public keys
    if (!isValidCompressedPublicKey(spendingKey)) {
      throw new ValidationError(
        'spendingKey must be a valid compressed secp256k1 public key',
        'encoded.spendingKey'
      )
    }

    if (!isValidCompressedPublicKey(viewingKey)) {
      throw new ValidationError(
        'viewingKey must be a valid compressed secp256k1 public key',
        'encoded.viewingKey'
      )
    }
  }

  return {
    chain: chain as ChainId,
    spendingKey: spendingKey as HexString,
    viewingKey: viewingKey as HexString,
  }
}

// ─── Multi-Curve Meta-Address Validation ────────────────────────────────────

/**
 * Validate a StealthMetaAddress object
 * Supports both secp256k1 (EVM chains) and ed25519 (Solana, NEAR, etc.) key formats
 */
export function validateStealthMetaAddress(
  metaAddress: StealthMetaAddress,
  field: string = 'recipientMetaAddress'
): void {
  if (!metaAddress || typeof metaAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  // Validate chain
  if (!isValidChainId(metaAddress.chain)) {
    throw new ValidationError(
      `invalid chain '${metaAddress.chain}'`,
      `${field}.chain`
    )
  }

  // Determine key type based on chain (ed25519 vs secp256k1)
  const isEd25519 = isEd25519Chain(metaAddress.chain)

  if (isEd25519) {
    // Ed25519 chains (Solana, NEAR, Aptos, Sui) use 32-byte public keys
    if (!isValidEd25519PublicKey(metaAddress.spendingKey)) {
      throw new ValidationError(
        'spendingKey must be a valid ed25519 public key (32 bytes)',
        `${field}.spendingKey`
      )
    }
    if (!isValidEd25519PublicKey(metaAddress.viewingKey)) {
      throw new ValidationError(
        'viewingKey must be a valid ed25519 public key (32 bytes)',
        `${field}.viewingKey`
      )
    }
  } else {
    // Secp256k1 chains (Ethereum, etc.) use 33-byte compressed public keys
    if (!isValidCompressedPublicKey(metaAddress.spendingKey)) {
      throw new ValidationError(
        'spendingKey must be a valid compressed secp256k1 public key (33 bytes, starting with 02 or 03)',
        `${field}.spendingKey`
      )
    }
    if (!isValidCompressedPublicKey(metaAddress.viewingKey)) {
      throw new ValidationError(
        'viewingKey must be a valid compressed secp256k1 public key (33 bytes, starting with 02 or 03)',
        `${field}.viewingKey`
      )
    }
  }
}

// ─── Stealth Address Parsing ────────────────────────────────────────────────

/**
 * Parse a stealth address string into its components
 *
 * Format: `<stealthAddress>:<ephemeralPublicKey>:<viewTag>`
 */
export function parseStealthAddress(input: string): StealthAddress {
  if (!input || typeof input !== 'string') {
    throw new ValidationError(
      'stealth address input must be a non-empty string',
      'input'
    )
  }

  const parts = input.split(':')
  if (parts.length !== 3) {
    throw new ValidationError(
      'invalid stealth address format. Expected: <address>:<ephemeralPublicKey>:<viewTag>',
      'input'
    )
  }

  const [address, ephemeralPublicKey, viewTagHex] = parts

  // Validate address (basic check - hex or base58)
  if (!address || address.length < 20) {
    throw new ValidationError(
      'invalid stealth address: too short',
      'address'
    )
  }

  // Validate ephemeral public key (hex or base58)
  if (!ephemeralPublicKey || ephemeralPublicKey.length < 20) {
    throw new ValidationError(
      'invalid ephemeral public key: too short',
      'ephemeralPublicKey'
    )
  }

  // Validate view tag (1-2 hex chars, 0-255)
  if (!viewTagHex || viewTagHex.length > 2 || !/^[0-9a-fA-F]+$/.test(viewTagHex)) {
    throw new ValidationError(
      'invalid view tag: must be 1-2 hex characters (0-255)',
      'viewTag'
    )
  }

  const viewTag = parseInt(viewTagHex, 16)
  if (viewTag < 0 || viewTag > 255) {
    throw new ValidationError(
      'view tag must be in range 0-255',
      'viewTag'
    )
  }

  // Normalize address to hex format if needed
  const normalizedAddress = address.startsWith('0x') ? address : `0x${address}`
  const normalizedEphemeral = ephemeralPublicKey.startsWith('0x')
    ? ephemeralPublicKey
    : `0x${ephemeralPublicKey}`

  return {
    address: normalizedAddress as HexString,
    ephemeralPublicKey: normalizedEphemeral as HexString,
    viewTag,
  }
}
