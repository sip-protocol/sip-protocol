/**
 * Stealth Address Generation for SIP Protocol
 *
 * Implements EIP-5564 style stealth addresses using secp256k1.
 * Provides unlinkable one-time addresses for privacy-preserving transactions.
 *
 * Flow:
 * 1. Recipient generates stealth meta-address (spending key P, viewing key Q)
 * 2. Sender generates ephemeral keypair (r, R = r*G)
 * 3. Sender computes shared secret: S = r * P
 * 4. Sender derives stealth address: A = Q + hash(S)*G
 * 5. Recipient scans: for each R, compute S = p * R, check if A matches
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'
import type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  ChainId,
  HexString,
} from '@sip-protocol/types'
import { ValidationError } from './errors'
import {
  isValidChainId,
  isValidHex,
  isValidCompressedPublicKey,
  isValidPrivateKey,
} from './validation'
import { secureWipe, secureWipeAll } from './secure-memory'

/**
 * Generate a new stealth meta-address keypair
 *
 * @param chain - Target chain for the addresses
 * @param label - Optional human-readable label
 * @returns Stealth meta-address and private keys
 * @throws {ValidationError} If chain is invalid
 */
export function generateStealthMetaAddress(
  chain: ChainId,
  label?: string,
): {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
} {
  // Validate chain
  if (!isValidChainId(chain)) {
    throw new ValidationError(
      `invalid chain '${chain}', must be one of: solana, ethereum, near, zcash, polygon, arbitrum, optimism, base`,
      'chain'
    )
  }

  // Generate random private keys
  const spendingPrivateKey = randomBytes(32)
  const viewingPrivateKey = randomBytes(32)

  try {
    // Derive public keys
    const spendingKey = secp256k1.getPublicKey(spendingPrivateKey, true)
    const viewingKey = secp256k1.getPublicKey(viewingPrivateKey, true)

    // Convert to hex strings before wiping buffers
    const result = {
      metaAddress: {
        spendingKey: `0x${bytesToHex(spendingKey)}` as HexString,
        viewingKey: `0x${bytesToHex(viewingKey)}` as HexString,
        chain,
        label,
      },
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
    }

    return result
  } finally {
    // Securely wipe private key buffers
    // Note: The hex strings returned to caller must be handled securely by them
    secureWipeAll(spendingPrivateKey, viewingPrivateKey)
  }
}

/**
 * Validate a StealthMetaAddress object
 */
function validateStealthMetaAddress(
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

  // Validate spending key
  if (!isValidCompressedPublicKey(metaAddress.spendingKey)) {
    throw new ValidationError(
      'spendingKey must be a valid compressed secp256k1 public key (33 bytes, starting with 02 or 03)',
      `${field}.spendingKey`
    )
  }

  // Validate viewing key
  if (!isValidCompressedPublicKey(metaAddress.viewingKey)) {
    throw new ValidationError(
      'viewingKey must be a valid compressed secp256k1 public key (33 bytes, starting with 02 or 03)',
      `${field}.viewingKey`
    )
  }
}

/**
 * Generate a one-time stealth address for a recipient
 *
 * @param recipientMetaAddress - Recipient's published stealth meta-address
 * @returns Stealth address data (address + ephemeral key for publication)
 * @throws {ValidationError} If recipientMetaAddress is invalid
 */
export function generateStealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): {
  stealthAddress: StealthAddress
  sharedSecret: HexString
} {
  // Validate input
  validateStealthMetaAddress(recipientMetaAddress)

  // Generate ephemeral keypair
  const ephemeralPrivateKey = randomBytes(32)

  try {
    const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)

    // Parse recipient's keys (remove 0x prefix)
    const spendingKeyBytes = hexToBytes(recipientMetaAddress.spendingKey.slice(2))
    const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey.slice(2))

    // Compute shared secret: S = r * P (ephemeral private * spending public)
    const sharedSecretPoint = secp256k1.getSharedSecret(
      ephemeralPrivateKey,
      spendingKeyBytes,
    )

    // Hash the shared secret for use as a scalar
    const sharedSecretHash = sha256(sharedSecretPoint)

    // Compute stealth address: A = Q + hash(S)*G
    // First get hash(S)*G
    const hashTimesG = secp256k1.getPublicKey(sharedSecretHash, true)

    // Then add to viewing key Q
    const viewingKeyPoint = secp256k1.ProjectivePoint.fromHex(viewingKeyBytes)
    const hashTimesGPoint = secp256k1.ProjectivePoint.fromHex(hashTimesG)
    const stealthPoint = viewingKeyPoint.add(hashTimesGPoint)
    const stealthAddressBytes = stealthPoint.toRawBytes(true)

    // Compute view tag (first byte of hash for efficient scanning)
    const viewTag = sharedSecretHash[0]

    return {
      stealthAddress: {
        address: `0x${bytesToHex(stealthAddressBytes)}` as HexString,
        ephemeralPublicKey: `0x${bytesToHex(ephemeralPublicKey)}` as HexString,
        viewTag,
      },
      sharedSecret: `0x${bytesToHex(sharedSecretHash)}` as HexString,
    }
  } finally {
    // Securely wipe ephemeral private key
    secureWipe(ephemeralPrivateKey)
  }
}

/**
 * Validate a StealthAddress object
 */
function validateStealthAddress(
  stealthAddress: StealthAddress,
  field: string = 'stealthAddress'
): void {
  if (!stealthAddress || typeof stealthAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  // Validate address (compressed public key)
  if (!isValidCompressedPublicKey(stealthAddress.address)) {
    throw new ValidationError(
      'address must be a valid compressed secp256k1 public key',
      `${field}.address`
    )
  }

  // Validate ephemeral public key
  if (!isValidCompressedPublicKey(stealthAddress.ephemeralPublicKey)) {
    throw new ValidationError(
      'ephemeralPublicKey must be a valid compressed secp256k1 public key',
      `${field}.ephemeralPublicKey`
    )
  }

  // Validate view tag (0-255)
  if (typeof stealthAddress.viewTag !== 'number' ||
      !Number.isInteger(stealthAddress.viewTag) ||
      stealthAddress.viewTag < 0 ||
      stealthAddress.viewTag > 255) {
    throw new ValidationError(
      'viewTag must be an integer between 0 and 255',
      `${field}.viewTag`
    )
  }
}

/**
 * Derive the private key for a stealth address (for recipient to claim funds)
 *
 * @param stealthAddress - The stealth address to recover
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns Recovery data including derived private key
 * @throws {ValidationError} If any input is invalid
 */
export function deriveStealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): StealthAddressRecovery {
  // Validate stealth address
  validateStealthAddress(stealthAddress)

  // Validate private keys
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

  // Parse keys
  const spendingPrivBytes = hexToBytes(spendingPrivateKey.slice(2))
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey.slice(2))

  try {
    // Compute shared secret: S = p * R (spending private * ephemeral public)
    const sharedSecretPoint = secp256k1.getSharedSecret(
      spendingPrivBytes,
      ephemeralPubBytes,
    )

    // Hash the shared secret
    const sharedSecretHash = sha256(sharedSecretPoint)

    // Derive stealth private key: q + hash(S) mod n
    // Where q is the viewing private key
    const viewingScalar = bytesToBigInt(viewingPrivBytes)
    const hashScalar = bytesToBigInt(sharedSecretHash)
    const stealthPrivateScalar = (viewingScalar + hashScalar) % secp256k1.CURVE.n

    // Convert back to bytes
    const stealthPrivateKey = bigIntToBytes(stealthPrivateScalar, 32)

    const result = {
      stealthAddress: stealthAddress.address,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      privateKey: `0x${bytesToHex(stealthPrivateKey)}` as HexString,
    }

    // Wipe derived key buffer after converting to hex
    secureWipe(stealthPrivateKey)

    return result
  } finally {
    // Securely wipe input private key buffers
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}

/**
 * Check if a stealth address was intended for this recipient
 * Uses view tag for efficient filtering before full computation
 *
 * @param stealthAddress - Stealth address to check
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns true if this address belongs to the recipient
 * @throws {ValidationError} If any input is invalid
 */
export function checkStealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): boolean {
  // Validate stealth address
  validateStealthAddress(stealthAddress)

  // Validate private keys
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

  // Parse keys
  const spendingPrivBytes = hexToBytes(spendingPrivateKey.slice(2))
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey.slice(2))

  try {
    // Quick check: compute shared secret and verify view tag first
    const sharedSecretPoint = secp256k1.getSharedSecret(
      spendingPrivBytes,
      ephemeralPubBytes,
    )
    const sharedSecretHash = sha256(sharedSecretPoint)

    // View tag check (optimization - reject quickly if doesn't match)
    if (sharedSecretHash[0] !== stealthAddress.viewTag) {
      return false
    }

    // Full check: derive the expected stealth address
    const viewingScalar = bytesToBigInt(viewingPrivBytes)
    const hashScalar = bytesToBigInt(sharedSecretHash)
    const stealthPrivateScalar = (viewingScalar + hashScalar) % secp256k1.CURVE.n

    // Compute expected public key from derived private key
    const derivedKeyBytes = bigIntToBytes(stealthPrivateScalar, 32)
    const expectedPubKey = secp256k1.getPublicKey(derivedKeyBytes, true)

    // Wipe derived key immediately after use
    secureWipe(derivedKeyBytes)

    // Compare with provided stealth address
    const providedAddress = hexToBytes(stealthAddress.address.slice(2))

    return bytesToHex(expectedPubKey) === bytesToHex(providedAddress)
  } finally {
    // Securely wipe input private key buffers
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}

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

  // Validate keys
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

  return {
    chain: chain as ChainId,
    spendingKey: spendingKey as HexString,
    viewingKey: viewingKey as HexString,
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte)
  }
  return result
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}

/**
 * Convert a secp256k1 public key to an Ethereum address
 *
 * Algorithm (EIP-5564 style):
 * 1. Decompress the public key to uncompressed form (65 bytes)
 * 2. Remove the 0x04 prefix (take last 64 bytes)
 * 3. keccak256 hash of the 64 bytes
 * 4. Take the last 20 bytes as the address
 *
 * @param publicKey - Compressed (33 bytes) or uncompressed (65 bytes) public key
 * @returns Ethereum address (20 bytes, checksummed)
 */
export function publicKeyToEthAddress(publicKey: HexString): HexString {
  // Remove 0x prefix if present
  const keyHex = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey
  const keyBytes = hexToBytes(keyHex)

  let uncompressedBytes: Uint8Array

  // Check if compressed (33 bytes) or uncompressed (65 bytes)
  if (keyBytes.length === 33) {
    // Decompress using secp256k1
    const point = secp256k1.ProjectivePoint.fromHex(keyBytes)
    uncompressedBytes = point.toRawBytes(false) // false = uncompressed
  } else if (keyBytes.length === 65) {
    uncompressedBytes = keyBytes
  } else {
    throw new ValidationError(
      `invalid public key length: ${keyBytes.length}, expected 33 (compressed) or 65 (uncompressed)`,
      'publicKey'
    )
  }

  // Remove the 0x04 prefix (first byte of uncompressed key)
  const pubKeyWithoutPrefix = uncompressedBytes.slice(1)

  // keccak256 hash
  const hash = keccak_256(pubKeyWithoutPrefix)

  // Take last 20 bytes
  const addressBytes = hash.slice(-20)

  // Convert to checksummed address
  return toChecksumAddress(`0x${bytesToHex(addressBytes)}`)
}

/**
 * Convert address to EIP-55 checksummed format
 */
function toChecksumAddress(address: string): HexString {
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
