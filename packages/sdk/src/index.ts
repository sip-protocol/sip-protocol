/**
 * @sip-protocol/sdk
 *
 * Core SDK for Shielded Intents Protocol (SIP)
 *
 * @example
 * ```typescript
 * import { SIP, PrivacyLevel } from '@sip-protocol/sdk'
 *
 * const sip = new SIP({ network: 'testnet' })
 *
 * const intent = await sip.createIntent({
 *   input: { chain: 'solana', token: 'SOL', amount: 10n },
 *   output: { chain: 'ethereum', token: 'ETH' },
 *   privacy: PrivacyLevel.SHIELDED,
 * })
 *
 * const quotes = await sip.getQuotes(intent)
 * const result = await sip.execute(intent, quotes[0])
 * ```
 */

// Errors
export {
  SIPError,
  ProofNotImplementedError,
  EncryptionNotImplementedError,
} from './errors'

// Main client
export { SIP, createSIP } from './sip'
export type { SIPConfig, WalletAdapter } from './sip'

// Intent creation
export {
  IntentBuilder,
  createShieldedIntent,
  attachProofs,
  hasRequiredProofs,
  trackIntent,
  isExpired,
  getTimeRemaining,
  serializeIntent,
  deserializeIntent,
  getIntentSummary,
} from './intent'

// Stealth addresses
export {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from './stealth'

// Privacy utilities
export {
  getPrivacyConfig,
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
  isValidPrivacyLevel,
  getPrivacyDescription,
} from './privacy'
export type { PrivacyConfig } from './privacy'

// Crypto utilities (legacy - use commitment module for new code)
// For ZK proofs, use ProofProvider from './proofs'
export {
  createCommitment,
  verifyCommitment,
  generateIntentId,
  hash,
  generateRandomBytes,
} from './crypto'

// Pedersen Commitments (recommended for new code)
export {
  commit,
  verifyOpening,
  commitZero,
  addCommitments,
  subtractCommitments,
  addBlindings,
  subtractBlindings,
  getGenerators,
  generateBlinding,
} from './commitment'

export type {
  PedersenCommitment,
  CommitmentPoint,
} from './commitment'

// Proof providers
export {
  MockProofProvider,
  NoirProofProvider,
  ProofGenerationError,
} from './proofs'

export type {
  ProofProvider,
  ProofFramework,
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  OracleAttestation,
  ProofResult,
  NoirProviderConfig,
} from './proofs'

// Re-export types for convenience
export {
  PrivacyLevel,
  IntentStatus,
  SIP_VERSION,
  NATIVE_TOKENS,
  isPrivate,
  supportsViewingKey,
} from '@sip-protocol/types'

export type {
  ShieldedIntent,
  CreateIntentParams,
  TrackedIntent,
  Quote,
  FulfillmentResult,
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  Commitment,
  ZKProof,
  ViewingKey,
  Asset,
  ChainId,
  HexString,
  Hash,
} from '@sip-protocol/types'
