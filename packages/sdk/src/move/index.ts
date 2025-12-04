/**
 * Move blockchain stealth address support
 *
 * This module provides stealth address implementations for Move-based chains:
 * - Aptos: ed25519 with SHA3-256 address derivation
 * - Sui: ed25519 with BLAKE2b-256 address derivation
 */

export {
  // Aptos stealth addresses
  AptosStealthService,
  generateAptosStealthAddress,
  deriveAptosStealthPrivateKey,
  checkAptosStealthAddress,
  // Aptos address utilities
  ed25519PublicKeyToAptosAddress,
  aptosAddressToAuthKey,
  isValidAptosAddress,
} from './aptos'

export type { AptosStealthResult } from './aptos'

export {
  // Sui stealth addresses
  SuiStealthService,
  generateSuiStealthAddress,
  deriveSuiStealthPrivateKey,
  checkSuiStealthAddress,
  // Sui address utilities
  ed25519PublicKeyToSuiAddress,
  normalizeSuiAddress,
  isValidSuiAddress,
} from './sui'

export type { SuiStealthResult } from './sui'
