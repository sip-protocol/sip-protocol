/**
 * Stealth Address Module
 *
 * Implements EIP-5564 style stealth addresses for multiple curves.
 *
 * Flow:
 * 1. Recipient generates stealth meta-address (spending key P, viewing key Q)
 * 2. Sender generates ephemeral keypair (r, R = r*G)
 * 3. Sender computes shared secret: S = r * P
 * 4. Sender derives stealth address: A = Q + hash(S)*G
 * 5. Recipient scans: for each R, compute S = p * R, check if A matches
 *
 * @module stealth
 */

import type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  ChainId,
  HexString,
} from '@sip-protocol/types'
import { ValidationError } from '../errors'
import { isValidChainId } from '../validation'

// Import curve-specific implementations
import {
  isEd25519Chain,
  getCurveForChain,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
} from './ed25519'

import {
  generateSecp256k1StealthMetaAddress,
  generateSecp256k1StealthAddress,
  deriveSecp256k1StealthPrivateKey,
  checkSecp256k1StealthAddress,
  publicKeyToEthAddress,
  validateSecp256k1StealthMetaAddress,
  validateSecp256k1StealthAddress,
} from './secp256k1'

import {
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  validateStealthMetaAddress,
  parseStealthAddress,
} from './meta-address'

import {
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
  isValidSolanaAddress,
  ed25519PublicKeyToNearAddress,
  nearAddressToEd25519PublicKey,
  isValidNearImplicitAddress,
  isValidNearAccountId,
} from './address-derivation'

// Re-export types
export type { StealthCurve } from './ed25519'

// Re-export utility functions for tests and advanced use cases
export {
  bytesToBigInt,
  bigIntToBytes,
  bytesToBigIntLE,
  bigIntToBytesLE,
  bytesToBase58,
  base58ToBytes,
  toChecksumAddress,
  ED25519_ORDER,
  ED25519_CHAINS,
  getEd25519Scalar,
} from './utils'

// ─── Unified API ────────────────────────────────────────────────────────────

/**
 * Generate a new stealth meta-address keypair for receiving private payments
 *
 * Automatically dispatches to the correct curve implementation based on chain.
 * - secp256k1 for: ethereum, polygon, arbitrum, optimism, base, bitcoin, zcash
 * - ed25519 for: solana, near, aptos, sui
 *
 * @param chain - Target blockchain network
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
  if (!isValidChainId(chain)) {
    throw new ValidationError(
      `invalid chain '${chain}', must be one of: solana, ethereum, near, zcash, polygon, arbitrum, optimism, base, bitcoin, aptos, sui, cosmos, osmosis, injective, celestia, sei, dydx`,
      'chain'
    )
  }

  if (isEd25519Chain(chain)) {
    return generateEd25519StealthMetaAddress(chain, label)
  }

  return generateSecp256k1StealthMetaAddress(chain, label)
}

/**
 * Generate a one-time stealth address for sending funds to a recipient
 *
 * Automatically dispatches to the correct curve implementation based on chain.
 *
 * @param recipientMetaAddress - Recipient's public stealth meta-address
 * @returns Stealth address data for publication
 * @throws {ValidationError} If meta-address is invalid
 */
export function generateStealthAddress(
  recipientMetaAddress: StealthMetaAddress,
): {
  stealthAddress: StealthAddress
  sharedSecret: HexString
} {
  validateStealthMetaAddress(recipientMetaAddress)

  if (isEd25519Chain(recipientMetaAddress.chain)) {
    return generateEd25519StealthAddress(recipientMetaAddress)
  }

  return generateSecp256k1StealthAddress(recipientMetaAddress)
}

/**
 * Derive the private key for a stealth address (for recipient to claim funds)
 *
 * Automatically dispatches to the correct curve implementation.
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
  // Try to detect curve from address length
  // ed25519: 32 bytes (64 hex chars), secp256k1: 33 bytes (66 hex chars)
  const addressHex = stealthAddress.address.slice(2)

  if (addressHex.length === 64) {
    // 32 bytes = ed25519
    return deriveEd25519StealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
  }

  // Default to secp256k1
  return deriveSecp256k1StealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
}

/**
 * Check if a stealth address was intended for this recipient
 *
 * Automatically dispatches to the correct curve implementation.
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
  // Try to detect curve from address length
  const addressHex = stealthAddress.address.slice(2)

  if (addressHex.length === 64) {
    // 32 bytes = ed25519
    return checkEd25519StealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
  }

  // Default to secp256k1
  return checkSecp256k1StealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

// Chain detection
export { isEd25519Chain, getCurveForChain }

// ed25519 (Solana, NEAR, Aptos, Sui)
export {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
}

// secp256k1 (Ethereum, Polygon, etc.)
export { publicKeyToEthAddress }

// Meta-address encoding
export {
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  parseStealthAddress,
}

// Solana address derivation
export {
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
  isValidSolanaAddress,
}

// NEAR address derivation
export {
  ed25519PublicKeyToNearAddress,
  nearAddressToEd25519PublicKey,
  isValidNearImplicitAddress,
  isValidNearAccountId,
}
