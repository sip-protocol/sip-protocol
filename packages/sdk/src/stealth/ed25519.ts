/**
 * ed25519 Stealth Address Implementation
 *
 * Implements DKSAP (Dual-Key Stealth Address Protocol) for ed25519 curves.
 * Used for Solana, NEAR, Aptos, and Sui chains.
 */

import { ed25519 } from '@noble/curves/ed25519'
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
  isValidEd25519PublicKey,
  isValidPrivateKey,
} from '../validation'
import { secureWipe, secureWipeAll } from '../secure-memory'
import {
  bytesToBigInt,
  bigIntToBytesLE,
  sha256,
  bytesToHex,
  hexToBytes,
  ED25519_ORDER,
  ED25519_CHAINS,
  getEd25519Scalar,
} from './utils'

// ─── Chain Detection ────────────────────────────────────────────────────────

/**
 * Check if a chain uses ed25519 for stealth addresses
 */
export function isEd25519Chain(chain: ChainId): boolean {
  return (ED25519_CHAINS as readonly string[]).includes(chain)
}

/**
 * Curve type used for stealth addresses
 */
export type StealthCurve = 'secp256k1' | 'ed25519'

/**
 * Get the curve type used by a chain for stealth addresses
 *
 * @param chain - Chain identifier
 * @returns 'ed25519' for Solana/NEAR/Aptos/Sui, 'secp256k1' for EVM chains
 */
export function getCurveForChain(chain: ChainId): StealthCurve {
  return isEd25519Chain(chain) ? 'ed25519' : 'secp256k1'
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an ed25519 StealthMetaAddress object
 */
export function validateEd25519StealthMetaAddress(
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

  if (!isEd25519Chain(metaAddress.chain)) {
    throw new ValidationError(
      `chain '${metaAddress.chain}' does not use ed25519, use secp256k1 functions instead`,
      `${field}.chain`
    )
  }

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
}

/**
 * Validate an ed25519 StealthAddress object
 */
export function validateEd25519StealthAddress(
  stealthAddress: StealthAddress,
  field: string = 'stealthAddress'
): void {
  if (!stealthAddress || typeof stealthAddress !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  if (!isValidEd25519PublicKey(stealthAddress.address)) {
    throw new ValidationError(
      'address must be a valid ed25519 public key (32 bytes)',
      `${field}.address`
    )
  }

  if (!isValidEd25519PublicKey(stealthAddress.ephemeralPublicKey)) {
    throw new ValidationError(
      'ephemeralPublicKey must be a valid ed25519 public key (32 bytes)',
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

// ─── Meta-Address Generation ────────────────────────────────────────────────

/**
 * Generate a new ed25519 stealth meta-address keypair
 *
 * @param chain - Target chain (must be ed25519-compatible: solana, near, aptos, sui)
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
  if (!isValidChainId(chain)) {
    throw new ValidationError(
      `invalid chain '${chain}', must be one of: solana, ethereum, near, zcash, polygon, arbitrum, optimism, base, bitcoin, aptos, sui, cosmos, osmosis, injective, celestia, sei, dydx`,
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
 * Generate a one-time ed25519 stealth address for a recipient
 *
 * Algorithm (DKSAP for ed25519):
 * 1. Generate ephemeral keypair (r, R = r*G)
 * 2. Compute shared secret: S = r * P_spend (ephemeral scalar * spending public)
 * 3. Hash shared secret: h = SHA256(S)
 * 4. Derive stealth public key: P_stealth = P_view + h*G
 */
export function generateEd25519StealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): {
  stealthAddress: StealthAddress
  sharedSecret: HexString
} {
  validateEd25519StealthMetaAddress(recipientMetaAddress)

  // Generate ephemeral keypair
  const ephemeralPrivateKey = randomBytes(32)

  try {
    const ephemeralPublicKey = ed25519.getPublicKey(ephemeralPrivateKey)

    // Parse recipient's keys (remove 0x prefix)
    const spendingKeyBytes = hexToBytes(recipientMetaAddress.spendingKey.slice(2))
    const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey.slice(2))

    // Get ephemeral scalar from private key and reduce mod L
    const rawEphemeralScalar = getEd25519Scalar(ephemeralPrivateKey)
    const ephemeralScalar = rawEphemeralScalar % ED25519_ORDER
    if (ephemeralScalar === 0n) {
      throw new Error('CRITICAL: Zero ephemeral scalar after reduction - investigate RNG')
    }

    // S = ephemeral_scalar * P_spend
    const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingKeyBytes)
    const sharedSecretPoint = spendingPoint.multiply(ephemeralScalar)

    // Hash the shared secret point
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // Derive stealth public key: P_stealth = P_view + hash(S)*G
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

    // Compute view tag
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
 * Derive the private key for an ed25519 stealth address
 *
 * **IMPORTANT: Derived Key Format**
 *
 * The returned `privateKey` is a **raw scalar** in little-endian format, NOT a standard
 * ed25519 seed. To compute the public key from the derived private key:
 * ```typescript
 * const scalar = bytesToBigIntLE(hexToBytes(privateKey.slice(2)))
 * const publicKey = ed25519.ExtendedPoint.BASE.multiply(scalar)
 * ```
 */
export function deriveEd25519StealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): StealthAddressRecovery {
  validateEd25519StealthAddress(stealthAddress)

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
    // Get spending scalar and reduce mod L
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

    // Get viewing scalar and reduce mod L
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

    // Convert to bytes (little-endian for ed25519)
    const stealthPrivateKey = bigIntToBytesLE(stealthPrivateScalar, 32)

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
 * Check if an ed25519 stealth address was intended for this recipient
 */
export function checkEd25519StealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): boolean {
  validateEd25519StealthAddress(stealthAddress)

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
    // Get spending scalar and reduce mod L
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

    // View tag check
    if (sharedSecretHash[0] !== stealthAddress.viewTag) {
      return false
    }

    // Full check
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
    secureWipeAll(spendingPrivBytes, viewingPrivBytes)
  }
}
