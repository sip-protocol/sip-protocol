/**
 * Stealth address types for SIP Protocol
 *
 * Stealth addresses prevent address reuse and linkability.
 * Each transaction uses a unique one-time address.
 */

import type { HexString, Hash } from './crypto'

/**
 * Stealth meta-address published by recipient
 * Contains two public keys: spending key (P) and viewing key (Q)
 */
export interface StealthMetaAddress {
  /** Spending public key (P) - used to derive stealth addresses */
  spendingKey: HexString
  /** Viewing public key (Q) - used to derive stealth addresses */
  viewingKey: HexString
  /** Chain identifier */
  chain: ChainId
  /** Human-readable label (optional) */
  label?: string
}

/**
 * One-time stealth address for receiving funds
 */
export interface StealthAddress {
  /** The stealth address (hex encoded) */
  address: HexString
  /** Ephemeral public key (R) - published alongside transaction */
  ephemeralPublicKey: HexString
  /** View tag for efficient scanning (first byte of shared secret) */
  viewTag: number
}

/**
 * Data needed for recipient to claim funds sent to a stealth address
 */
export interface StealthAddressRecovery {
  /** The stealth address */
  stealthAddress: HexString
  /** Ephemeral public key from sender */
  ephemeralPublicKey: HexString
  /** Derived private key for spending */
  privateKey: HexString
}

/**
 * Supported chain identifiers
 */
export type ChainId =
  | 'solana'
  | 'ethereum'
  | 'near'
  | 'zcash'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'base'

/**
 * Registry entry for a stealth meta-address
 */
export interface StealthRegistryEntry {
  /** Owner's main address */
  owner: string
  /** The stealth meta-address */
  metaAddress: StealthMetaAddress
  /** Registration timestamp */
  registeredAt: number
  /** Signature proving ownership */
  signature: HexString
}
