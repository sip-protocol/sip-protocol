/**
 * Solana Integration Module
 *
 * Provides Solana-specific functionality for SIP Protocol:
 * - Noir proof verification on Solana
 * - Solana wallet adapters
 * - Transaction building utilities
 *
 * @module solana
 */

// Noir Verifier
export {
  SolanaNoirVerifier,
  createDevnetVerifier,
  createMainnetVerifier,
} from './noir-verifier'

// Types
export type {
  NoirCircuitType,
  CircuitMetadata,
  SolanaVerificationKey,
  VerificationKeyAccountData,
  SolanaSerializedProof,
  SolanaVerificationResult,
  VerifyInstructionData,
  SolanaVerifyInstruction,
  SolanaAccountMeta,
  SolanaNetwork,
  SolanaNoirVerifierConfig,
  ProofStatistics,
  BatchVerificationRequest,
  BatchVerificationResult,
} from './noir-verifier-types'

// Constants and utilities
export {
  CIRCUIT_METADATA,
  DEFAULT_RPC_URLS,
  SOLANA_ZK_PROGRAM_IDS,
  MAX_PROOF_SIZE_BYTES,
  MAX_PUBLIC_INPUTS,
  SolanaNoirError,
  SolanaNoirErrorCode,
  isNoirCircuitType,
  isValidSolanaProof,
  estimateComputeUnits,
} from './noir-verifier-types'
