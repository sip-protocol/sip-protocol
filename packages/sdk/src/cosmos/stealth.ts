/**
 * Cosmos Stealth Address Implementation
 *
 * Implements stealth addresses for Cosmos chains (secp256k1-based chains like
 * Cosmos Hub, Osmosis, Injective, Celestia, Sei, dYdX).
 *
 * Key features:
 * - Reuses core secp256k1 stealth logic from ../stealth.ts
 * - Adds Cosmos-specific bech32 address encoding
 * - Supports multiple chain prefixes (cosmos, osmo, inj, celestia, sei, dydx)
 *
 * Address Format:
 * - Cosmos addresses use bech32 encoding with chain-specific prefixes
 * - Address derivation: bech32(prefix, ripemd160(sha256(compressed_pubkey)))
 *
 * @see https://docs.cosmos.network/main/learn/beginner/accounts
 * @see https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki (bech32)
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { bech32 } from '@scure/base'
import {
  generateStealthMetaAddress,
  generateStealthAddress as generateSecp256k1StealthAddress,
  deriveStealthPrivateKey as deriveSecp256k1StealthPrivateKey,
} from '../stealth'
import type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  HexString,
  ChainId,
} from '@sip-protocol/types'
import { ValidationError } from '../errors'

/**
 * Supported Cosmos chain identifiers
 */
export type CosmosChainId =
  | 'cosmos'
  | 'osmosis'
  | 'injective'
  | 'celestia'
  | 'sei'
  | 'dydx'

/**
 * Bech32 address prefixes for Cosmos chains
 */
export const CHAIN_PREFIXES: Record<CosmosChainId, string> = {
  cosmos: 'cosmos',
  osmosis: 'osmo',
  injective: 'inj',
  celestia: 'celestia',
  sei: 'sei',
  dydx: 'dydx',
}

/**
 * Result of Cosmos stealth address generation
 */
export interface CosmosStealthResult {
  /** Bech32-encoded Cosmos address */
  stealthAddress: string
  /** Raw stealth public key (33-byte compressed secp256k1) */
  stealthPublicKey: HexString
  /** Ephemeral public key for recipient to derive private key */
  ephemeralPublicKey: HexString
  /** View tag for efficient scanning (0-255) */
  viewTag: number
  /** View key hash for compliance */
  viewKeyHash: string
}

/**
 * Cosmos Stealth Address Service
 *
 * Provides stealth address generation and key derivation for Cosmos chains.
 * Reuses secp256k1 logic from core stealth module, adding Cosmos-specific
 * address formatting.
 */
export class CosmosStealthService {
  /**
   * Generate a stealth meta-address for a Cosmos chain
   *
   * @param chain - Cosmos chain identifier
   * @param label - Optional human-readable label
   * @returns Stealth meta-address and private keys
   * @throws {ValidationError} If chain is invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
   *   service.generateStealthMetaAddress('cosmos', 'My Cosmos Wallet')
   * ```
   */
  generateStealthMetaAddress(
    chain: CosmosChainId,
    label?: string,
  ): {
    metaAddress: StealthMetaAddress
    spendingPrivateKey: HexString
    viewingPrivateKey: HexString
  } {
    // Validate chain
    if (!this.isValidCosmosChain(chain)) {
      throw new ValidationError(
        `invalid Cosmos chain '${chain}', must be one of: ${Object.keys(CHAIN_PREFIXES).join(', ')}`,
        'chain'
      )
    }

    // Use core secp256k1 stealth generation (Cosmos uses secp256k1, not 'cosmos' as ChainId)
    // We'll use 'ethereum' as the underlying chain for secp256k1 generation
    const result = generateStealthMetaAddress('ethereum', label)

    // Override chain with actual Cosmos chain ID
    return {
      ...result,
      metaAddress: {
        ...result.metaAddress,
        chain: chain as ChainId,
      },
    }
  }

  /**
   * Generate a one-time stealth address for a Cosmos chain
   *
   * @param spendingPubKey - Recipient's spending public key (33-byte compressed)
   * @param viewingPubKey - Recipient's viewing public key (33-byte compressed)
   * @param chain - Cosmos chain identifier
   * @returns Cosmos stealth address with bech32 encoding
   * @throws {ValidationError} If keys or chain are invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * const result = service.generateStealthAddress(
   *   spendingKey,
   *   viewingKey,
   *   'osmosis'
   * )
   * console.log(result.stealthAddress) // "osmo1..."
   * ```
   */
  generateStealthAddress(
    spendingPubKey: Uint8Array,
    viewingPubKey: Uint8Array,
    chain: CosmosChainId,
  ): CosmosStealthResult {
    // Validate chain
    if (!this.isValidCosmosChain(chain)) {
      throw new ValidationError(
        `invalid Cosmos chain '${chain}', must be one of: ${Object.keys(CHAIN_PREFIXES).join(', ')}`,
        'chain'
      )
    }

    // Validate keys (33-byte compressed secp256k1)
    if (spendingPubKey.length !== 33) {
      throw new ValidationError(
        'spendingPubKey must be 33 bytes (compressed secp256k1)',
        'spendingPubKey'
      )
    }

    if (viewingPubKey.length !== 33) {
      throw new ValidationError(
        'viewingPubKey must be 33 bytes (compressed secp256k1)',
        'viewingPubKey'
      )
    }

    // Create meta-address for core stealth generation
    const metaAddress: StealthMetaAddress = {
      spendingKey: `0x${bytesToHex(spendingPubKey)}` as HexString,
      viewingKey: `0x${bytesToHex(viewingPubKey)}` as HexString,
      chain: 'ethereum', // Use ethereum for secp256k1 generation
    }

    // Generate stealth address using core secp256k1 logic
    const { stealthAddress, sharedSecret } = generateSecp256k1StealthAddress(metaAddress)

    // Convert stealth public key to Cosmos bech32 address
    const cosmosAddress = this.stealthKeyToCosmosAddress(
      hexToBytes(stealthAddress.address.slice(2)),
      CHAIN_PREFIXES[chain]
    )

    return {
      stealthAddress: cosmosAddress,
      stealthPublicKey: stealthAddress.address,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      viewTag: stealthAddress.viewTag,
      viewKeyHash: sharedSecret,
    }
  }

  /**
   * Generate stealth address from StealthMetaAddress
   *
   * Convenience method that accepts a StealthMetaAddress directly.
   *
   * @param recipientMetaAddress - Recipient's stealth meta-address
   * @param chain - Cosmos chain identifier
   * @returns Cosmos stealth address with bech32 encoding
   * @throws {ValidationError} If meta-address or chain are invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * const result = service.generateStealthAddressFromMeta(metaAddress, 'cosmos')
   * ```
   */
  generateStealthAddressFromMeta(
    recipientMetaAddress: StealthMetaAddress,
    chain: CosmosChainId,
  ): CosmosStealthResult {
    const spendingPubKey = hexToBytes(recipientMetaAddress.spendingKey.slice(2))
    const viewingPubKey = hexToBytes(recipientMetaAddress.viewingKey.slice(2))

    return this.generateStealthAddress(spendingPubKey, viewingPubKey, chain)
  }

  /**
   * Convert stealth public key to Cosmos bech32 address
   *
   * Algorithm:
   * 1. SHA256 hash of compressed public key
   * 2. RIPEMD160 hash of SHA256 hash
   * 3. Bech32 encode with chain prefix
   *
   * @param publicKey - Compressed secp256k1 public key (33 bytes)
   * @param prefix - Bech32 address prefix (e.g., "cosmos", "osmo")
   * @returns Bech32-encoded address
   * @throws {ValidationError} If public key is invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * const address = service.stealthKeyToCosmosAddress(pubKey, 'cosmos')
   * // Returns: "cosmos1abc..."
   * ```
   */
  stealthKeyToCosmosAddress(publicKey: Uint8Array, prefix: string): string {
    // Validate public key
    if (publicKey.length !== 33) {
      throw new ValidationError(
        'public key must be 33 bytes (compressed secp256k1)',
        'publicKey'
      )
    }

    // Cosmos address derivation: bech32(prefix, ripemd160(sha256(pubkey)))
    const sha256Hash = sha256(publicKey)
    const hash160 = ripemd160(sha256Hash)

    // Bech32 encode
    const words = bech32.toWords(hash160)
    return bech32.encode(prefix, words)
  }

  /**
   * Derive stealth private key for recipient to claim funds
   *
   * @param stealthAddress - The stealth address to recover (as StealthAddress)
   * @param spendingPrivateKey - Recipient's spending private key
   * @param viewingPrivateKey - Recipient's viewing private key
   * @returns Recovery data with derived private key
   * @throws {ValidationError} If any input is invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * const recovery = service.deriveStealthPrivateKey(
   *   stealthAddress,
   *   spendingPrivKey,
   *   viewingPrivKey
   * )
   * // Use recovery.privateKey to spend funds
   * ```
   */
  deriveStealthPrivateKey(
    stealthAddress: StealthAddress,
    spendingPrivateKey: HexString,
    viewingPrivateKey: HexString,
  ): StealthAddressRecovery {
    // Use core secp256k1 derivation logic
    return deriveSecp256k1StealthPrivateKey(
      stealthAddress,
      spendingPrivateKey,
      viewingPrivateKey
    )
  }

  /**
   * Check if a string is a valid Cosmos chain identifier
   */
  private isValidCosmosChain(chain: string): chain is CosmosChainId {
    return chain in CHAIN_PREFIXES
  }

  /**
   * Decode a Cosmos bech32 address to raw hash
   *
   * @param address - Bech32-encoded address
   * @returns Decoded address hash (20 bytes)
   * @throws {ValidationError} If address is invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * const { prefix, hash } = service.decodeBech32Address('cosmos1abc...')
   * ```
   */
  decodeBech32Address(address: string): { prefix: string; hash: Uint8Array } {
    try {
      const decoded = bech32.decode(address as `${string}1${string}`)
      const hash = bech32.fromWords(decoded.words)

      if (hash.length !== 20) {
        throw new ValidationError(
          `invalid address hash length: ${hash.length}, expected 20`,
          'address'
        )
      }

      return {
        prefix: decoded.prefix,
        hash: new Uint8Array(hash),
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError(
        `invalid bech32 address: ${error instanceof Error ? error.message : 'unknown error'}`,
        'address'
      )
    }
  }

  /**
   * Validate a Cosmos bech32 address format
   *
   * @param address - Address to validate
   * @param expectedChain - Optional chain to validate prefix against
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * service.isValidCosmosAddress('cosmos1abc...', 'cosmos') // true
   * service.isValidCosmosAddress('osmo1xyz...', 'cosmos')   // false (wrong prefix)
   * ```
   */
  isValidCosmosAddress(address: string, expectedChain?: CosmosChainId): boolean {
    try {
      const { prefix, hash } = this.decodeBech32Address(address)

      // Check hash is correct length (20 bytes for Cosmos)
      if (hash.length !== 20) {
        return false
      }

      // If expected chain provided, validate prefix matches
      if (expectedChain) {
        return prefix === CHAIN_PREFIXES[expectedChain]
      }

      // Otherwise, check if prefix is any known Cosmos chain
      return Object.values(CHAIN_PREFIXES).includes(prefix)
    } catch {
      return false
    }
  }

  /**
   * Get the chain ID from a bech32 address prefix
   *
   * @param address - Bech32-encoded address
   * @returns Chain ID or null if unknown prefix
   *
   * @example
   * ```typescript
   * const service = new CosmosStealthService()
   * service.getChainFromAddress('cosmos1abc...') // 'cosmos'
   * service.getChainFromAddress('osmo1xyz...')   // 'osmosis'
   * ```
   */
  getChainFromAddress(address: string): CosmosChainId | null {
    try {
      const { prefix } = this.decodeBech32Address(address)

      for (const [chain, chainPrefix] of Object.entries(CHAIN_PREFIXES)) {
        if (chainPrefix === prefix) {
          return chain as CosmosChainId
        }
      }

      return null
    } catch {
      return null
    }
  }
}

// ─── Standalone Functions ──────────────────────────────────────────────────

/**
 * Generate a stealth meta-address for a Cosmos chain
 *
 * Convenience function that creates a CosmosStealthService instance.
 *
 * @param chain - Cosmos chain identifier
 * @param label - Optional human-readable label
 * @returns Stealth meta-address and private keys
 */
export function generateCosmosStealthMetaAddress(
  chain: CosmosChainId,
  label?: string,
): {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
} {
  const service = new CosmosStealthService()
  return service.generateStealthMetaAddress(chain, label)
}

/**
 * Generate a one-time stealth address for a Cosmos chain
 *
 * Convenience function that creates a CosmosStealthService instance.
 *
 * @param spendingPubKey - Recipient's spending public key
 * @param viewingPubKey - Recipient's viewing public key
 * @param chain - Cosmos chain identifier
 * @returns Cosmos stealth address with bech32 encoding
 */
export function generateCosmosStealthAddress(
  spendingPubKey: Uint8Array,
  viewingPubKey: Uint8Array,
  chain: CosmosChainId,
): CosmosStealthResult {
  const service = new CosmosStealthService()
  return service.generateStealthAddress(spendingPubKey, viewingPubKey, chain)
}

/**
 * Convert stealth public key to Cosmos bech32 address
 *
 * Convenience function that creates a CosmosStealthService instance.
 *
 * @param publicKey - Compressed secp256k1 public key (33 bytes)
 * @param prefix - Bech32 address prefix
 * @returns Bech32-encoded address
 */
export function stealthKeyToCosmosAddress(
  publicKey: Uint8Array,
  prefix: string,
): string {
  const service = new CosmosStealthService()
  return service.stealthKeyToCosmosAddress(publicKey, prefix)
}

/**
 * Validate a Cosmos bech32 address
 *
 * Convenience function that creates a CosmosStealthService instance.
 *
 * @param address - Address to validate
 * @param expectedChain - Optional chain to validate prefix against
 * @returns true if valid, false otherwise
 */
export function isValidCosmosAddress(
  address: string,
  expectedChain?: CosmosChainId,
): boolean {
  const service = new CosmosStealthService()
  return service.isValidCosmosAddress(address, expectedChain)
}
