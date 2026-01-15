/**
 * Stealth Address Utilities
 *
 * Shared utility functions for stealth address operations.
 */

import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError } from '../errors'

// ─── Byte/BigInt Conversion ─────────────────────────────────────────────────

/**
 * Convert bytes to bigint (big-endian)
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte)
  }
  return result
}

/**
 * Convert bigint to bytes (big-endian)
 */
export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}

/**
 * Convert bytes to bigint (little-endian, used by ed25519)
 */
export function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) + BigInt(bytes[i])
  }
  return result
}

/**
 * Convert bigint to bytes (little-endian, used by ed25519)
 */
export function bigIntToBytesLE(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}

// ─── Base58 Encoding ────────────────────────────────────────────────────────

/** Base58 alphabet (Bitcoin/Solana standard) */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * Encode bytes to base58 string
 * Used for Solana address encoding
 */
export function bytesToBase58(bytes: Uint8Array): string {
  // Count leading zeros
  let leadingZeros = 0
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    leadingZeros++
  }

  // Convert bytes to bigint
  let value = 0n
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte)
  }

  // Convert to base58
  let result = ''
  while (value > 0n) {
    const remainder = value % 58n
    value = value / 58n
    result = BASE58_ALPHABET[Number(remainder)] + result
  }

  // Add leading '1's for each leading zero byte
  return '1'.repeat(leadingZeros) + result
}

/**
 * Decode base58 string to bytes
 * Used for Solana address validation
 */
export function base58ToBytes(str: string): Uint8Array {
  // Count leading '1's (they represent leading zero bytes)
  let leadingOnes = 0
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    leadingOnes++
  }

  // Convert from base58 to bigint
  let value = 0n
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new ValidationError(`Invalid base58 character: ${char}`, 'address')
    }
    value = value * 58n + BigInt(index)
  }

  // Convert bigint to bytes
  const bytes: number[] = []
  while (value > 0n) {
    bytes.unshift(Number(value % 256n))
    value = value / 256n
  }

  // Add leading zeros
  const result = new Uint8Array(leadingOnes + bytes.length)
  for (let i = 0; i < leadingOnes; i++) {
    result[i] = 0
  }
  for (let i = 0; i < bytes.length; i++) {
    result[leadingOnes + i] = bytes[i]
  }

  return result
}

// ─── EIP-55 Checksum Address ────────────────────────────────────────────────

/**
 * Convert address to EIP-55 checksummed format
 */
export function toChecksumAddress(address: string): HexString {
  const addr = address.toLowerCase().replace('0x', '')
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)))

  let checksummed = '0x'
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase()
    } else {
      checksummed += addr[i]
    }
  }

  return checksummed as HexString
}

// ─── ed25519 Scalar Derivation ──────────────────────────────────────────────

/**
 * ed25519 curve order (L) - the order of the base point
 */
export const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

/**
 * Chains that use ed25519 for stealth addresses
 */
export const ED25519_CHAINS = ['solana', 'near', 'aptos', 'sui'] as const

/**
 * Get the scalar from an ed25519 private key
 *
 * ed25519 key derivation:
 * 1. Hash the 32-byte seed with SHA-512 to get 64 bytes
 * 2. First 32 bytes are the scalar (after clamping)
 * 3. Last 32 bytes are used for nonce generation (not needed here)
 */
export function getEd25519Scalar(privateKey: Uint8Array): bigint {
  // Hash the private key seed with SHA-512
  const hash = sha512(privateKey)

  // Take first 32 bytes and clamp as per ed25519 spec
  const scalar = hash.slice(0, 32)

  // Clamp: clear lowest 3 bits, clear highest bit, set second highest bit
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64

  // Convert to bigint (little-endian for ed25519)
  return bytesToBigIntLE(scalar)
}

// Re-export for convenience
export { sha256, sha512, keccak_256, bytesToHex, hexToBytes }
