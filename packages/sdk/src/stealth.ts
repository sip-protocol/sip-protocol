/**
 * Stealth Address Generation for SIP Protocol
 *
 * This file re-exports from the modular stealth/ directory.
 * For implementation details, see:
 * - stealth/secp256k1.ts - EVM chains (Ethereum, Polygon, etc.)
 * - stealth/ed25519.ts - Solana/NEAR/Aptos/Sui
 * - stealth/address-derivation.ts - Chain-specific address formats
 * - stealth/meta-address.ts - Encoding/decoding utilities
 *
 * @module stealth
 */

// Re-export everything from the modular implementation
export {
  // Unified API (auto-dispatch to correct curve)
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  deriveStealthPrivateKeyV1,
  checkStealthAddress,

  // Chain detection
  isEd25519Chain,
  getCurveForChain,

  // ed25519 (Solana, NEAR, Aptos, Sui)
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  deriveEd25519StealthPrivateKeyV1,
  checkEd25519StealthAddress,
  checkEd25519StealthAddressV1,

  // secp256k1 (Ethereum, Polygon, etc.)
  publicKeyToEthAddress,

  // Legacy SIP:1 back-compat (claim/scan of pre-flip announcements)
  deriveSecp256k1StealthPrivateKeyV1,
  checkSecp256k1StealthAddressV1,

  // Meta-address encoding
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  parseStealthAddress,

  // Solana address derivation
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
  isValidSolanaAddress,

  // NEAR address derivation
  ed25519PublicKeyToNearAddress,
  nearAddressToEd25519PublicKey,
  isValidNearImplicitAddress,
  isValidNearAccountId,
} from './stealth/index'

// Re-export types
export type { StealthCurve } from './stealth/index'
