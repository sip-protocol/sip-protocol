/**
 * secp256k1 Stealth Address Implementation
 *
 * Implements EIP-5564 style stealth addresses using secp256k1.
 * Used for Ethereum, Polygon, Arbitrum, Optimism, Base, Bitcoin, Zcash.
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { randomBytes } from '@noble/hashes/utils'
import type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  ChainId,
  HexString,
} from '@sip-protocol/types'
import { ValidationError } from '../errors'
import {
  isValidChainId,
  isValidCompressedPublicKey,
  isValidPrivateKey,
} from '../validation'
import { secureWipe, secureWipeAll } from '../secure-memory'
import {
  bytesToBigInt,
  bigIntToBytes,
  sha256,
  bytesToHex,
  hexToBytes,
  toChecksumAddress,
  keccak_256,
} from './utils'
// Note: isEd25519Chain is imported in the main index.ts for dispatch logic

// ─── Meta-Address Generation ────────────────────────────────────────────────

/**
 * Generate a new secp256k1 stealth meta-address keypair
 *
 * @internal Use generateStealthMetaAddress() which dispatches to this
 */
export function generateSecp256k1StealthMetaAddress(
  chain: ChainId,
  label?: string,
): {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
} {
  const spendingPrivateKey = randomBytes(32)
  const viewingPrivateKey = randomBytes(32)

  try {
    // Derive public keys
    const spendingKey = secp256k1.getPublicKey(spendingPrivateKey, true)
    const viewingKey = secp256k1.getPublicKey(viewingPrivateKey, true)

    return {
      metaAddress: {
        spendingKey: `0x${bytesToHex(spendingKey)}` as HexString,
        viewingKey: `0x${bytesToHex(viewingKey)}` as HexString,
        chain,
        label,
      },
      spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as HexString,
      viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
    }
  } finally {
    secureWipeAll(spendingPrivateKey, viewingPrivateKey)
  }
}

// ─── Stealth Address Generation ─────────────────────────────────────────────

/**
 * Validate a secp256k1 StealthMetaAddress
 */
export function validateSecp256k1StealthMetaAddress(
  metaAddress: StealthMetaAddress,
  field: string = 'recipientMetaAddress'
): void {
  if (!metaAddress || typeof metaAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  if (!isValidChainId(metaAddress.chain)) {
    throw new ValidationError(
      `invalid chain '${metaAddress.chain}'`,
      `${field}.chain`
    )
  }

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

/**
 * Validate a secp256k1 StealthAddress
 */
export function validateSecp256k1StealthAddress(
  stealthAddress: StealthAddress,
  field: string = 'stealthAddress'
): void {
  if (!stealthAddress || typeof stealthAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  if (!isValidCompressedPublicKey(stealthAddress.address)) {
    throw new ValidationError(
      'address must be a valid compressed secp256k1 public key',
      `${field}.address`
    )
  }

  if (!isValidCompressedPublicKey(stealthAddress.ephemeralPublicKey)) {
    throw new ValidationError(
      'ephemeralPublicKey must be a valid compressed secp256k1 public key',
      `${field}.ephemeralPublicKey`
    )
  }

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
 * Generate a one-time secp256k1 stealth address
 *
 * @internal Use generateStealthAddress() which dispatches to this
 */
export function generateSecp256k1StealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): {
  stealthAddress: StealthAddress
  sharedSecret: HexString
} {
  validateSecp256k1StealthMetaAddress(recipientMetaAddress)

  const ephemeralPrivateKey = randomBytes(32)

  try {
    const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)

    // Parse recipient's keys (remove 0x prefix)
    const spendingKeyBytes = hexToBytes(recipientMetaAddress.spendingKey.slice(2))
    const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey.slice(2))

    // Compute shared secret: S = r * K_view (ephemeral private * viewing public)
    // Canonical EIP-5564: ECDH is on the VIEWING key.
    const sharedSecretPoint = secp256k1.getSharedSecret(
      ephemeralPrivateKey,
      viewingKeyBytes,
    )

    // Hash the shared secret for use as a scalar
    const sharedSecretHash = sha256(sharedSecretPoint)

    // Compute stealth address: A = K_spend + hash(S)*G.
    // Reduce hash(S) to a scalar in [1, n-1] before deriving the point: secp256k1.getPublicKey
    // throws for a scalar >= n or == 0 (~3.7e-39 for a random SHA-256 digest). Reducing mod n
    // mirrors the ed25519 path and keeps generate symmetric with derive (k_spend + hash(S) mod n).
    const hashScalar = bytesToBigInt(sharedSecretHash) % secp256k1.CURVE.n
    if (hashScalar === 0n) {
      throw new Error('CRITICAL: zero hash scalar after reduction - investigate hash computation')
    }

    const spendingKeyPoint = secp256k1.ProjectivePoint.fromHex(spendingKeyBytes)
    const hashTimesGPoint = secp256k1.ProjectivePoint.BASE.multiply(hashScalar)
    const stealthPoint = spendingKeyPoint.add(hashTimesGPoint)
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
    secureWipe(ephemeralPrivateKey)
  }
}

// ─── Private Key Derivation ─────────────────────────────────────────────────

/**
 * Derive the private key for a secp256k1 stealth address (canonical EIP-5564)
 *
 * Requires BOTH the spending and viewing private keys (spending authority).
 */
export function deriveSecp256k1StealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): StealthAddressRecovery {
  validateSecp256k1StealthAddress(stealthAddress)

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
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey.slice(2))

  try {
    // Compute shared secret: S = k_view * R (viewing private * ephemeral public)
    const sharedSecretPoint = secp256k1.getSharedSecret(
      viewingPrivBytes,
      ephemeralPubBytes,
    )

    // Hash the shared secret
    const sharedSecretHash = sha256(sharedSecretPoint)

    // Derive stealth private key: k_spend + hash(S) mod n  (canonical)
    const spendingScalar = bytesToBigInt(spendingPrivBytes)
    const hashScalar = bytesToBigInt(sharedSecretHash)
    const stealthPrivateScalar = (spendingScalar + hashScalar) % secp256k1.CURVE.n

    // Convert back to bytes
    const stealthPrivateKey = bigIntToBytes(stealthPrivateScalar, 32)

    const result = {
      stealthAddress: stealthAddress.address,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      privateKey: `0x${bytesToHex(stealthPrivateKey)}` as HexString,
    }

    secureWipe(stealthPrivateKey)

    return result
  } finally {
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}

/**
 * @deprecated Legacy SIP:1 swapped-scheme derivation — claim-side back-compat ONLY.
 *
 * Recovers funds sent to secp256k1 stealth addresses generated before the
 * canonical EIP-5564 flip (legacy scheme: `S = k_spend * R`, `p = k_view + H(S)`).
 * Used only when claiming a `SIP:1` announcement. New (SIP:2) sends use
 * {@link deriveSecp256k1StealthPrivateKey}.
 */
export function deriveSecp256k1StealthPrivateKeyV1(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): StealthAddressRecovery {
  validateSecp256k1StealthAddress(stealthAddress)

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

    secureWipe(stealthPrivateKey)

    return result
  } finally {
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}

// ─── Address Checking ───────────────────────────────────────────────────────

/**
 * Check if a secp256k1 stealth address is ours — canonical EIP-5564 view-only.
 *
 * Requires only the viewing PRIVATE key + the spending PUBLIC key, so a viewing
 * key can be delegated for scanning without granting spend authority. Never
 * touches the spending private key.
 *
 * @param stealthAddress - Stealth address to check
 * @param viewingPrivateKey - Recipient's viewing private key
 * @param spendingPublicKey - Recipient's compressed spending PUBLIC key (meta-address spendingKey)
 * @returns true if this address belongs to the recipient
 */
export function checkSecp256k1StealthAddress(
  stealthAddress: StealthAddress,
  viewingPrivateKey: HexString,
  spendingPublicKey: HexString,
): boolean {
  validateSecp256k1StealthAddress(stealthAddress)

  if (!isValidPrivateKey(viewingPrivateKey)) {
    throw new ValidationError(
      'must be a valid 32-byte hex string',
      'viewingPrivateKey'
    )
  }

  if (!isValidCompressedPublicKey(spendingPublicKey)) {
    throw new ValidationError(
      'must be a valid compressed secp256k1 public key (33 bytes, starting with 02 or 03)',
      'spendingPublicKey'
    )
  }

  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))
  const spendingPubBytes = hexToBytes(spendingPublicKey.slice(2))
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey.slice(2))

  try {
    // Compute shared secret: S = k_view * R  (canonical: ECDH on the viewing key)
    const sharedSecretPoint = secp256k1.getSharedSecret(
      viewingPrivBytes,
      ephemeralPubBytes,
    )
    const sharedSecretHash = sha256(sharedSecretPoint)

    // View tag check (fast reject)
    if (sharedSecretHash[0] !== stealthAddress.viewTag) {
      return false
    }

    // Expected address: A = K_spend + hash(S)*G  (no spending private key needed).
    // Reduce hash(S) mod n (symmetric with generate); a zero scalar can't correspond to a
    // real stealth payment, so treat it as a non-match.
    const hashScalar = bytesToBigInt(sharedSecretHash) % secp256k1.CURVE.n
    if (hashScalar === 0n) {
      return false
    }
    const expectedPoint = secp256k1.ProjectivePoint.fromHex(spendingPubBytes).add(
      secp256k1.ProjectivePoint.BASE.multiply(hashScalar),
    )

    // Compare with provided stealth address
    const providedAddress = hexToBytes(stealthAddress.address.slice(2))

    return bytesToHex(expectedPoint.toRawBytes(true)) === bytesToHex(providedAddress)
  } finally {
    secureWipe(viewingPrivBytes)
  }
}

/**
 * @deprecated Legacy SIP:1 full-wallet check — requires BOTH private keys.
 *
 * For detecting/claiming pre-flip (SIP:1) announcements only (legacy swapped
 * scheme: `S = k_spend * R`, address built on the viewing key). New code should
 * use the view-only {@link checkSecp256k1StealthAddress}.
 */
export function checkSecp256k1StealthAddressV1(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): boolean {
  validateSecp256k1StealthAddress(stealthAddress)

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
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}

// ─── Ethereum Address Derivation ────────────────────────────────────────────

/**
 * Convert a secp256k1 public key to an Ethereum address
 *
 * Algorithm (EIP-5564 style):
 * 1. Decompress the public key to uncompressed form (65 bytes)
 * 2. Remove the 0x04 prefix (take last 64 bytes)
 * 3. keccak256 hash of the 64 bytes
 * 4. Take the last 20 bytes as the address
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
