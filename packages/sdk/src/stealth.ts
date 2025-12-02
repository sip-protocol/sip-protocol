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
import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
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
  isValidEd25519PublicKey,
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

// ═══════════════════════════════════════════════════════════════════════════════
// ED25519 STEALTH ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════════
//
// ed25519 stealth address implementation for Solana and NEAR chains.
// Uses DKSAP (Dual-Key Stealth Address Protocol) pattern adapted for ed25519.
//
// Key differences from secp256k1:
// - Public keys are 32 bytes (not 33 compressed)
// - Uses SHA-512 for key derivation (matches ed25519 spec)
// - Scalar arithmetic modulo ed25519 curve order (L)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ed25519 curve order (L) - the order of the base point
 */
const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

/**
 * Chains that use ed25519 for stealth addresses
 */
const ED25519_CHAINS: ChainId[] = ['solana', 'near']

/**
 * Check if a chain uses ed25519 for stealth addresses
 */
export function isEd25519Chain(chain: ChainId): boolean {
  return ED25519_CHAINS.includes(chain)
}

/**
 * Curve type used for stealth addresses
 */
export type StealthCurve = 'secp256k1' | 'ed25519'

/**
 * Get the curve type used by a chain for stealth addresses
 *
 * @param chain - Chain identifier
 * @returns 'ed25519' for Solana/NEAR, 'secp256k1' for EVM chains
 */
export function getCurveForChain(chain: ChainId): StealthCurve {
  return isEd25519Chain(chain) ? 'ed25519' : 'secp256k1'
}

/**
 * Validate an ed25519 StealthMetaAddress object
 */
function validateEd25519StealthMetaAddress(
  metaAddress: StealthMetaAddress,
  field: string = 'recipientMetaAddress'
): void {
  if (!metaAddress || typeof metaAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  // Validate chain is ed25519-compatible
  if (!isValidChainId(metaAddress.chain)) {
    throw new ValidationError(
      `invalid chain '${metaAddress.chain}'`,
      `${field}.chain`
    )
  }

  if (!isEd25519Chain(metaAddress.chain)) {
    throw new ValidationError(
      `chain '${metaAddress.chain}' does not use ed25519, use secp256k1 functions instead`,
      `${field}.chain`
    )
  }

  // Validate spending key (32 bytes for ed25519)
  if (!isValidEd25519PublicKey(metaAddress.spendingKey)) {
    throw new ValidationError(
      'spendingKey must be a valid ed25519 public key (32 bytes)',
      `${field}.spendingKey`
    )
  }

  // Validate viewing key (32 bytes for ed25519)
  if (!isValidEd25519PublicKey(metaAddress.viewingKey)) {
    throw new ValidationError(
      'viewingKey must be a valid ed25519 public key (32 bytes)',
      `${field}.viewingKey`
    )
  }
}

/**
 * Validate an ed25519 StealthAddress object
 */
function validateEd25519StealthAddress(
  stealthAddress: StealthAddress,
  field: string = 'stealthAddress'
): void {
  if (!stealthAddress || typeof stealthAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  // Validate address (32-byte ed25519 public key)
  if (!isValidEd25519PublicKey(stealthAddress.address)) {
    throw new ValidationError(
      'address must be a valid ed25519 public key (32 bytes)',
      `${field}.address`
    )
  }

  // Validate ephemeral public key (32 bytes for ed25519)
  if (!isValidEd25519PublicKey(stealthAddress.ephemeralPublicKey)) {
    throw new ValidationError(
      'ephemeralPublicKey must be a valid ed25519 public key (32 bytes)',
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
 * Get the scalar from an ed25519 private key
 *
 * ed25519 key derivation:
 * 1. Hash the 32-byte seed with SHA-512 to get 64 bytes
 * 2. First 32 bytes are the scalar (after clamping)
 * 3. Last 32 bytes are used for nonce generation (not needed here)
 */
function getEd25519Scalar(privateKey: Uint8Array): bigint {
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

/**
 * Convert bytes to bigint (little-endian, used by ed25519)
 */
function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) + BigInt(bytes[i])
  }
  return result
}

/**
 * Convert bigint to bytes (little-endian, used by ed25519)
 */
function bigIntToBytesLE(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}

/**
 * Generate a new ed25519 stealth meta-address keypair
 *
 * @param chain - Target chain (must be ed25519-compatible: solana, near)
 * @param label - Optional human-readable label
 * @returns Stealth meta-address and private keys
 * @throws {ValidationError} If chain is invalid or not ed25519-compatible
 */
export function generateEd25519StealthMetaAddress(
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

  if (!isEd25519Chain(chain)) {
    throw new ValidationError(
      `chain '${chain}' does not use ed25519, use generateStealthMetaAddress() for secp256k1 chains`,
      'chain'
    )
  }

  // Generate random private keys (32-byte seeds)
  const spendingPrivateKey = randomBytes(32)
  const viewingPrivateKey = randomBytes(32)

  try {
    // Derive public keys using ed25519
    const spendingKey = ed25519.getPublicKey(spendingPrivateKey)
    const viewingKey = ed25519.getPublicKey(viewingPrivateKey)

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
    secureWipeAll(spendingPrivateKey, viewingPrivateKey)
  }
}

/**
 * Generate a one-time ed25519 stealth address for a recipient
 *
 * Algorithm (DKSAP for ed25519):
 * 1. Generate ephemeral keypair (r, R = r*G)
 * 2. Compute shared secret: S = r * P_spend (ephemeral scalar * spending public)
 * 3. Hash shared secret: h = SHA256(S)
 * 4. Derive stealth public key: P_stealth = P_view + h*G
 *
 * @param recipientMetaAddress - Recipient's published stealth meta-address
 * @returns Stealth address data (address + ephemeral key for publication)
 * @throws {ValidationError} If recipientMetaAddress is invalid
 */
export function generateEd25519StealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): {
  stealthAddress: StealthAddress
  sharedSecret: HexString
} {
  // Validate input
  validateEd25519StealthMetaAddress(recipientMetaAddress)

  // Generate ephemeral keypair
  const ephemeralPrivateKey = randomBytes(32)

  try {
    const ephemeralPublicKey = ed25519.getPublicKey(ephemeralPrivateKey)

    // Parse recipient's keys (remove 0x prefix)
    const spendingKeyBytes = hexToBytes(recipientMetaAddress.spendingKey.slice(2))
    const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey.slice(2))

    // Get ephemeral scalar from private key and reduce mod L
    // ed25519 clamping produces values that may exceed L, so we reduce
    const rawEphemeralScalar = getEd25519Scalar(ephemeralPrivateKey)
    const ephemeralScalar = rawEphemeralScalar % ED25519_ORDER
    if (ephemeralScalar === 0n) {
      throw new Error('CRITICAL: Zero ephemeral scalar after reduction - investigate RNG')
    }

    // Convert spending public key to extended point and multiply by ephemeral scalar
    // S = ephemeral_scalar * P_spend
    const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingKeyBytes)
    const sharedSecretPoint = spendingPoint.multiply(ephemeralScalar)

    // Hash the shared secret point (compress to bytes first)
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // Derive stealth public key: P_stealth = P_view + hash(S)*G
    // Convert hash to scalar (mod L to ensure it's valid and non-zero)
    const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
    if (hashScalar === 0n) {
      throw new Error('CRITICAL: Zero hash scalar after reduction - investigate hash computation')
    }

    // Compute hash(S) * G
    const hashTimesG = ed25519.ExtendedPoint.BASE.multiply(hashScalar)

    // Add to viewing key: P_stealth = P_view + hash(S)*G
    const viewingPoint = ed25519.ExtendedPoint.fromHex(viewingKeyBytes)
    const stealthPoint = viewingPoint.add(hashTimesG)
    const stealthAddressBytes = stealthPoint.toRawBytes()

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
 * Derive the private key for an ed25519 stealth address (for recipient to claim funds)
 *
 * Algorithm:
 * 1. Compute shared secret: S = spend_scalar * R (spending scalar * ephemeral public)
 * 2. Hash shared secret: h = SHA256(S)
 * 3. Derive stealth private key: s_stealth = s_view + h (mod L)
 *
 * **IMPORTANT: Derived Key Format**
 *
 * The returned `privateKey` is a **raw scalar** in little-endian format, NOT a standard
 * ed25519 seed. This is because the stealth private key is derived mathematically
 * (s_view + hash), not generated from a seed.
 *
 * To compute the public key from the derived private key:
 * ```typescript
 * // CORRECT: Direct scalar multiplication
 * const scalar = bytesToBigIntLE(hexToBytes(privateKey.slice(2)))
 * const publicKey = ed25519.ExtendedPoint.BASE.multiply(scalar)
 *
 * // WRONG: Do NOT use ed25519.getPublicKey() - it will hash and clamp the input,
 * // producing a different (incorrect) public key
 * ```
 *
 * @param stealthAddress - The stealth address to recover
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns Recovery data including derived private key (raw scalar, little-endian)
 * @throws {ValidationError} If any input is invalid
 */
export function deriveEd25519StealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): StealthAddressRecovery {
  // Validate stealth address
  validateEd25519StealthAddress(stealthAddress)

  // Validate private keys (32 bytes)
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
    // Get spending scalar from private key and reduce mod L
    const rawSpendingScalar = getEd25519Scalar(spendingPrivBytes)
    const spendingScalar = rawSpendingScalar % ED25519_ORDER
    if (spendingScalar === 0n) {
      throw new Error('CRITICAL: Zero spending scalar after reduction - investigate key derivation')
    }

    // Compute shared secret: S = spending_scalar * R
    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
    const sharedSecretPoint = ephemeralPoint.multiply(spendingScalar)

    // Hash the shared secret
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // Get viewing scalar from private key and reduce mod L
    const rawViewingScalar = getEd25519Scalar(viewingPrivBytes)
    const viewingScalar = rawViewingScalar % ED25519_ORDER
    if (viewingScalar === 0n) {
      throw new Error('CRITICAL: Zero viewing scalar after reduction - investigate key derivation')
    }

    // Derive stealth private key: s_stealth = s_view + hash(S) mod L
    const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
    if (hashScalar === 0n) {
      throw new Error('CRITICAL: Zero hash scalar after reduction - investigate hash computation')
    }
    const stealthPrivateScalar = (viewingScalar + hashScalar) % ED25519_ORDER
    if (stealthPrivateScalar === 0n) {
      throw new Error('CRITICAL: Zero stealth scalar after reduction - investigate key derivation')
    }

    // Convert back to bytes (little-endian for ed25519)
    // Note: We need to store this as a seed that will produce this scalar
    // For simplicity, we store the scalar directly (32 bytes, little-endian)
    const stealthPrivateKey = bigIntToBytesLE(stealthPrivateScalar, 32)

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
 * Check if an ed25519 stealth address was intended for this recipient
 * Uses view tag for efficient filtering before full computation
 *
 * @param stealthAddress - Stealth address to check
 * @param spendingPrivateKey - Recipient's spending private key
 * @param viewingPrivateKey - Recipient's viewing private key
 * @returns true if this address belongs to the recipient
 * @throws {ValidationError} If any input is invalid
 */
export function checkEd25519StealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): boolean {
  // Validate stealth address
  validateEd25519StealthAddress(stealthAddress)

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
    // Get spending scalar from private key and reduce mod L
    const rawSpendingScalar = getEd25519Scalar(spendingPrivBytes)
    const spendingScalar = rawSpendingScalar % ED25519_ORDER
    if (spendingScalar === 0n) {
      throw new Error('CRITICAL: Zero spending scalar after reduction - investigate key derivation')
    }

    // Compute shared secret: S = spending_scalar * R
    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
    const sharedSecretPoint = ephemeralPoint.multiply(spendingScalar)

    // Hash the shared secret
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // View tag check (optimization - reject quickly if doesn't match)
    if (sharedSecretHash[0] !== stealthAddress.viewTag) {
      return false
    }

    // Full check: derive the expected stealth address
    const rawViewingScalar = getEd25519Scalar(viewingPrivBytes)
    const viewingScalar = rawViewingScalar % ED25519_ORDER
    if (viewingScalar === 0n) {
      throw new Error('CRITICAL: Zero viewing scalar after reduction - investigate key derivation')
    }

    const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
    if (hashScalar === 0n) {
      throw new Error('CRITICAL: Zero hash scalar after reduction - investigate hash computation')
    }
    const stealthPrivateScalar = (viewingScalar + hashScalar) % ED25519_ORDER
    if (stealthPrivateScalar === 0n) {
      throw new Error('CRITICAL: Zero stealth scalar after reduction - investigate key derivation')
    }

    // Compute expected public key from derived scalar
    const expectedPubKey = ed25519.ExtendedPoint.BASE.multiply(stealthPrivateScalar)
    const expectedPubKeyBytes = expectedPubKey.toRawBytes()

    // Compare with provided stealth address
    const providedAddress = hexToBytes(stealthAddress.address.slice(2))

    return bytesToHex(expectedPubKeyBytes) === bytesToHex(providedAddress)
  } finally {
    // Securely wipe input private key buffers
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}

// ─── Base58 Encoding for Solana ────────────────────────────────────────────────

/** Base58 alphabet (Bitcoin/Solana standard) */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * Encode bytes to base58 string
 * Used for Solana address encoding
 */
function bytesToBase58(bytes: Uint8Array): string {
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
function base58ToBytes(str: string): Uint8Array {
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

// ─── Solana Address Derivation ─────────────────────────────────────────────────

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

  // Encode as base58
  return bytesToBase58(publicKeyBytes)
}

/**
 * Validate a Solana address format
 *
 * Checks that the address:
 * - Is a valid base58 string
 * - Decodes to exactly 32 bytes (ed25519 public key size)
 *
 * @param address - Base58-encoded Solana address
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidSolanaAddress('7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPBJCyqLqzQPvN') // true
 * isValidSolanaAddress('invalid') // false
 * ```
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
 *
 * @param address - Base58-encoded Solana address
 * @returns 32-byte ed25519 public key as hex string (with 0x prefix)
 * @throws {ValidationError} If address is invalid
 *
 * @example
 * ```typescript
 * const publicKey = solanaAddressToEd25519PublicKey('7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPBJCyqLqzQPvN')
 * // Returns: "0x..." (64 hex characters)
 * ```
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

// ─── NEAR Address Derivation ────────────────────────────────────────────────────

/**
 * Convert ed25519 public key to NEAR implicit account address
 *
 * NEAR implicit accounts are lowercase hex-encoded ed25519 public keys (64 characters).
 * No prefix, just raw 32 bytes as lowercase hex.
 *
 * @param publicKey - 32-byte ed25519 public key as hex string (with 0x prefix)
 * @returns NEAR implicit account address (64 lowercase hex characters, no prefix)
 * @throws {ValidationError} If public key is invalid
 *
 * @example
 * ```typescript
 * const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
 * const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
 * // Returns: "ab12cd34..." (64 hex chars)
 * ```
 */
export function ed25519PublicKeyToNearAddress(publicKey: HexString): string {
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

  // NEAR implicit accounts are lowercase hex without 0x prefix
  return publicKey.slice(2).toLowerCase()
}

/**
 * Convert NEAR implicit account address back to ed25519 public key
 *
 * @param address - NEAR implicit account address (64 hex characters)
 * @returns ed25519 public key as HexString (with 0x prefix)
 * @throws {ValidationError} If address is invalid
 *
 * @example
 * ```typescript
 * const publicKey = nearAddressToEd25519PublicKey("ab12cd34...")
 * // Returns: "0xab12cd34..."
 * ```
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
 *
 * @param address - Address to validate
 * @returns true if valid NEAR implicit account address
 *
 * @example
 * ```typescript
 * isValidNearImplicitAddress("ab12cd34ef...") // true (64 hex chars)
 * isValidNearImplicitAddress("0xab12...")     // false (has prefix)
 * isValidNearImplicitAddress("alice.near")   // false (named account)
 * isValidNearImplicitAddress("AB12CD...")    // false (uppercase)
 * ```
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
 *
 * @param accountId - Account ID to validate
 * @returns true if valid NEAR account ID
 *
 * @example
 * ```typescript
 * isValidNearAccountId("alice.near")     // true
 * isValidNearAccountId("bob.testnet")    // true
 * isValidNearAccountId("ab12cd34...")    // true (64 hex chars)
 * isValidNearAccountId("ALICE.near")     // false (uppercase)
 * isValidNearAccountId("a")              // false (too short)
 * ```
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
