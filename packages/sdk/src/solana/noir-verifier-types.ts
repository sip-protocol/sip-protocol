/**
 * Solana Noir Verifier Types
 *
 * Type definitions for verifying Noir ZK proofs on Solana.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  NOIR PROOF FLOW ON SOLANA                                  │
 * │                                                             │
 * │  1. Generate proof (BrowserNoirProvider / NoirProofProvider)│
 * │  2. Serialize for Solana (SolanaNoirVerifier)               │
 * │  3. Submit to Solana program (verify instruction)           │
 * │  4. On-chain verification (ZK Token Proof / Custom)         │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module solana/noir-verifier-types
 */

import { SOLANA_RPC_ENDPOINTS as SOLANA_RPC_CONFIG } from '../config/endpoints'

import type { ZKProof } from '@sip-protocol/types'

// ─── Circuit Types ───────────────────────────────────────────────────────────

/**
 * Supported Noir circuit types for Solana verification
 */
export type NoirCircuitType = 'funding' | 'validity' | 'fulfillment'

/**
 * Circuit metadata for verification key generation
 */
export interface CircuitMetadata {
  /** Circuit type identifier */
  type: NoirCircuitType
  /** Number of public inputs */
  publicInputCount: number
  /** Approximate constraint count */
  constraintCount: number
  /** Circuit version hash */
  versionHash: string
}

/**
 * Circuit metadata for all supported circuits
 */
export const CIRCUIT_METADATA: Record<NoirCircuitType, CircuitMetadata> = {
  funding: {
    type: 'funding',
    publicInputCount: 3, // commitment_hash, minimum_required, asset_id
    constraintCount: 2000,
    versionHash: 'v1.0.0-funding',
  },
  validity: {
    type: 'validity',
    publicInputCount: 6, // intent_hash, commitment_x, commitment_y, nullifier, timestamp, expiry
    constraintCount: 72000,
    versionHash: 'v1.0.0-validity',
  },
  fulfillment: {
    type: 'fulfillment',
    publicInputCount: 8, // intent_hash, commitment_x, commitment_y, recipient_stealth, min_output, solver_id, fulfillment_time, expiry
    constraintCount: 22000,
    versionHash: 'v1.0.0-fulfillment',
  },
}

// ─── Verification Key Types ──────────────────────────────────────────────────

/**
 * Verification key for Solana on-chain verification
 *
 * Contains the cryptographic parameters needed to verify proofs on-chain.
 */
export interface SolanaVerificationKey {
  /** Circuit type this key is for */
  circuitType: NoirCircuitType
  /** Serialized verification key bytes */
  keyBytes: Uint8Array
  /** Key hash for integrity check */
  keyHash: string
  /** Number of public inputs expected */
  publicInputCount: number
  /** Solana account address where key is stored (if deployed) */
  accountAddress?: string
}

/**
 * Verification key account data layout for Solana
 */
export interface VerificationKeyAccountData {
  /** Discriminator for account type */
  discriminator: Uint8Array
  /** Circuit type identifier */
  circuitType: number
  /** Verification key data */
  keyData: Uint8Array
  /** Authority that can update */
  authority: Uint8Array
  /** Bump seed for PDA */
  bump: number
}

// ─── Proof Serialization Types ───────────────────────────────────────────────

/**
 * Solana-serialized proof ready for on-chain verification
 */
export interface SolanaSerializedProof {
  /** Original proof type */
  circuitType: NoirCircuitType
  /** Proof bytes in Solana-compatible format */
  proofBytes: Uint8Array
  /** Public inputs as Field elements (32 bytes each) */
  publicInputs: Uint8Array[]
  /** Total serialized size in bytes */
  totalSize: number
}

/**
 * Proof verification result from Solana
 */
export interface SolanaVerificationResult {
  /** Whether the proof is valid */
  valid: boolean
  /** Transaction signature if submitted on-chain */
  signature?: string
  /** Slot number of verification */
  slot?: number
  /** Compute units used */
  computeUnits?: number
  /** Error message if verification failed */
  error?: string
}

// ─── Instruction Types ───────────────────────────────────────────────────────

/**
 * Verify instruction data layout
 */
export interface VerifyInstructionData {
  /** Instruction discriminator */
  discriminator: number
  /** Proof bytes */
  proof: Uint8Array
  /** Public inputs */
  publicInputs: Uint8Array[]
}

/**
 * Solana instruction for proof verification
 */
export interface SolanaVerifyInstruction {
  /** Program ID to call */
  programId: string
  /** Instruction data */
  data: Uint8Array
  /** Account keys required */
  keys: SolanaAccountMeta[]
}

/**
 * Account metadata for Solana instruction
 */
export interface SolanaAccountMeta {
  /** Account public key */
  pubkey: string
  /** Is signer */
  isSigner: boolean
  /** Is writable */
  isWritable: boolean
}

// ─── Configuration Types ─────────────────────────────────────────────────────

/**
 * Network configuration for Solana
 */
export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet'

/**
 * Solana Noir Verifier configuration
 */
export interface SolanaNoirVerifierConfig {
  /**
   * Solana network to use
   * @default 'devnet'
   */
  network?: SolanaNetwork

  /**
   * Custom RPC endpoint URL
   * If not provided, uses default for network
   */
  rpcUrl?: string

  /**
   * Verification program ID
   * Uses native ZK Token Proof program by default
   */
  programId?: string

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean

  /**
   * Commitment level for transactions
   * @default 'confirmed'
   */
  commitment?: 'processed' | 'confirmed' | 'finalized'

  /**
   * Maximum compute units for verification
   * @default 400000
   */
  maxComputeUnits?: number
}

/**
 * Default RPC URLs for each network
 * Localnet is configurable via SOLANA_LOCALNET_RPC environment variable
 */
export const DEFAULT_RPC_URLS: Record<SolanaNetwork, string> = {
  'mainnet-beta': SOLANA_RPC_CONFIG.mainnet,
  devnet: SOLANA_RPC_CONFIG.devnet,
  testnet: SOLANA_RPC_CONFIG.testnet,
  localnet: SOLANA_RPC_CONFIG.localnet,
}

/**
 * Native Solana ZK proof program IDs
 *
 * Note: These are the native Solana programs for ZK proof verification.
 * For custom Noir circuits, a dedicated verifier program would be needed.
 */
export const SOLANA_ZK_PROGRAM_IDS = {
  /** ZK Token Proof Program (native) */
  ZK_TOKEN_PROOF: 'ZkTokenProof1111111111111111111111111111111',
  /** ZK ElGamal Proof Program (native) */
  ZK_ELGAMAL_PROOF: 'ZkE1Gama1Proof11111111111111111111111111111',
  /** Custom SIP Noir Verifier (TBD - to be deployed) */
  SIP_NOIR_VERIFIER: 'SIPNoirVerifier1111111111111111111111111',
} as const

/**
 * Sunspot-deployed verifier program IDs for each circuit type
 *
 * These are Groth16 verifiers built with Sunspot and deployed to Solana.
 * Each circuit type has its own dedicated verifier program.
 */
export const SUNSPOT_VERIFIER_PROGRAM_IDS = {
  /** Funding proof verifier (devnet) - proves sufficient balance */
  FUNDING_PROOF_DEVNET: '3nqQEuio4AVJo8H9pZJoERNFERWD5JNSqYan4UnsHhim',
  /** Validity proof verifier (devnet) - proves intent authorization */
  VALIDITY_PROOF_DEVNET: '', // TBD
  /** Fulfillment proof verifier (devnet) - proves correct execution */
  FULFILLMENT_PROOF_DEVNET: '', // TBD
  /** Funding proof verifier (mainnet) */
  FUNDING_PROOF_MAINNET: '', // TBD
  /** Validity proof verifier (mainnet) */
  VALIDITY_PROOF_MAINNET: '', // TBD
  /** Fulfillment proof verifier (mainnet) */
  FULFILLMENT_PROOF_MAINNET: '', // TBD
} as const

/**
 * Get the verifier program ID for a circuit type and network
 */
export function getSunspotVerifierProgramId(
  circuitType: NoirCircuitType,
  network: SolanaNetwork
): string | null {
  const isMainnet = network === 'mainnet-beta'

  switch (circuitType) {
    case 'funding':
      return isMainnet
        ? SUNSPOT_VERIFIER_PROGRAM_IDS.FUNDING_PROOF_MAINNET || null
        : SUNSPOT_VERIFIER_PROGRAM_IDS.FUNDING_PROOF_DEVNET || null
    case 'validity':
      return isMainnet
        ? SUNSPOT_VERIFIER_PROGRAM_IDS.VALIDITY_PROOF_MAINNET || null
        : SUNSPOT_VERIFIER_PROGRAM_IDS.VALIDITY_PROOF_DEVNET || null
    case 'fulfillment':
      return isMainnet
        ? SUNSPOT_VERIFIER_PROGRAM_IDS.FULFILLMENT_PROOF_MAINNET || null
        : SUNSPOT_VERIFIER_PROGRAM_IDS.FULFILLMENT_PROOF_DEVNET || null
    default:
      return null
  }
}

// ─── Error Types ─────────────────────────────────────────────────────────────

/**
 * Error codes for Solana Noir verification
 */
export enum SolanaNoirErrorCode {
  /** Invalid proof format */
  INVALID_PROOF_FORMAT = 'INVALID_PROOF_FORMAT',
  /** Invalid public inputs */
  INVALID_PUBLIC_INPUTS = 'INVALID_PUBLIC_INPUTS',
  /** Verification failed on-chain */
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Insufficient compute units */
  INSUFFICIENT_COMPUTE = 'INSUFFICIENT_COMPUTE',
  /** Verification key not found */
  VKEY_NOT_FOUND = 'VKEY_NOT_FOUND',
  /** Unsupported circuit type */
  UNSUPPORTED_CIRCUIT = 'UNSUPPORTED_CIRCUIT',
  /** Transaction failed */
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
}

/**
 * Solana Noir verification error
 */
export class SolanaNoirError extends Error {
  constructor(
    message: string,
    public readonly code: SolanaNoirErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SolanaNoirError'
  }
}

// ─── Size Limits ─────────────────────────────────────────────────────────────

/**
 * Maximum proof size in bytes
 *
 * UltraHonk proofs are typically ~2KB, but we allow up to 4KB for safety.
 */
export const MAX_PROOF_SIZE_BYTES = 4096

/**
 * Maximum number of public inputs
 *
 * Based on Solana transaction size limits and our circuit designs.
 */
export const MAX_PUBLIC_INPUTS = 32

// ─── Utility Types ───────────────────────────────────────────────────────────

/**
 * Proof statistics for monitoring
 */
export interface ProofStatistics {
  /** Circuit type */
  circuitType: NoirCircuitType
  /** Proof size in bytes */
  proofSize: number
  /** Public inputs size in bytes */
  publicInputsSize: number
  /** Total serialized size */
  totalSize: number
  /** Estimated compute units */
  estimatedComputeUnits: number
}

/**
 * Batch verification request
 */
export interface BatchVerificationRequest {
  /** Proofs to verify */
  proofs: ZKProof[]
  /** Whether to fail fast on first invalid proof */
  failFast?: boolean
}

/**
 * Batch verification result
 */
export interface BatchVerificationResult {
  /** Overall success */
  success: boolean
  /** Results for each proof */
  results: SolanaVerificationResult[]
  /** Total proofs verified */
  totalVerified: number
  /** Number of valid proofs */
  validCount: number
  /** Total compute units used */
  totalComputeUnits: number
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid circuit type
 */
export function isNoirCircuitType(value: string): value is NoirCircuitType {
  return value === 'funding' || value === 'validity' || value === 'fulfillment'
}

/**
 * Check if a proof has the expected structure for Solana verification
 */
export function isValidSolanaProof(proof: unknown): proof is ZKProof {
  if (!proof || typeof proof !== 'object') return false
  const p = proof as Record<string, unknown>
  return (
    typeof p.type === 'string' &&
    isNoirCircuitType(p.type) &&
    typeof p.proof === 'string' &&
    Array.isArray(p.publicInputs)
  )
}

/**
 * Estimate compute units for verification
 *
 * Based on circuit complexity and proof size
 */
export function estimateComputeUnits(circuitType: NoirCircuitType): number {
  const baseUnits = 50000
  const constraintFactor = 0.005 // CU per constraint
  const metadata = CIRCUIT_METADATA[circuitType]
  return Math.ceil(baseUnits + metadata.constraintCount * constraintFactor)
}
