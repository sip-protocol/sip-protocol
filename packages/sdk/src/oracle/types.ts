/**
 * Oracle Attestation Types
 *
 * Type definitions for the oracle attestation protocol.
 *
 * @see docs/specs/ORACLE-ATTESTATION.md
 */

import type { HexString, ChainId } from '@sip-protocol/types'

// ─── Oracle Identity ──────────────────────────────────────────────────────────

/**
 * Oracle identifier (SHA256 hash of public key)
 */
export type OracleId = HexString

/**
 * Oracle status in the registry
 */
export type OracleStatus = 'active' | 'suspended' | 'removed'

/**
 * Oracle information stored in registry
 */
export interface OracleInfo {
  /** Unique oracle identifier (hash of public key) */
  id: OracleId

  /** Oracle's Ed25519 public key (32 bytes) */
  publicKey: HexString

  /** Human-readable name */
  name: string

  /** Supported destination chains */
  supportedChains: ChainId[]

  /** Oracle endpoint URL */
  endpoint: string

  /** Registration timestamp (Unix seconds) */
  registeredAt: number

  /** Current status */
  status: OracleStatus

  /** Reputation score (0-100) */
  reputation: number

  /** Staked amount in smallest unit */
  stake: bigint
}

// ─── Attestation Message ──────────────────────────────────────────────────────

/**
 * The canonical message format that oracles sign
 *
 * This structure is serialized deterministically for signing.
 * Total serialized size: 197 bytes
 */
export interface OracleAttestationMessage {
  /** Protocol version (current: 1) */
  version: number

  /** Destination chain numeric ID */
  chainId: number

  /** Hash of original intent (32 bytes) */
  intentHash: HexString

  /** Recipient address, normalized to 32 bytes */
  recipient: HexString

  /** Amount delivered in smallest unit */
  amount: bigint

  /** Asset identifier hash (32 bytes) */
  assetId: HexString

  /** Transaction hash on destination chain (32 bytes) */
  txHash: HexString

  /** Block number containing transaction */
  blockNumber: bigint

  /** Block hash for finality verification (32 bytes) */
  blockHash: HexString

  /** Unix timestamp of attestation creation */
  timestamp: number
}

// ─── Signatures ───────────────────────────────────────────────────────────────

/**
 * A single oracle's signature on an attestation
 */
export interface OracleSignature {
  /** Oracle that produced this signature */
  oracleId: OracleId

  /** Ed25519 signature (64 bytes) */
  signature: HexString
}

/**
 * Complete attestation with message and signatures
 */
export interface SignedOracleAttestation {
  /** The attested message */
  message: OracleAttestationMessage

  /** Signatures from k-of-n oracles */
  signatures: OracleSignature[]
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Oracle registry containing all registered oracles
 */
export interface OracleRegistry {
  /** Registered oracles indexed by ID */
  oracles: Map<OracleId, OracleInfo>

  /** Required signature threshold (k in k-of-n) */
  threshold: number

  /** Total number of oracles (n in k-of-n) */
  totalOracles: number

  /** Registry version for upgrades */
  version: number

  /** Last update timestamp */
  lastUpdated: number
}

/**
 * Oracle registry configuration
 */
export interface OracleRegistryConfig {
  /** Minimum required signatures (default: 3) */
  threshold?: number

  /** Oracle endpoint timeout in ms (default: 30000) */
  timeout?: number

  /** Custom registry data (for testing) */
  customOracles?: OracleInfo[]
}

// ─── Attestation Request ──────────────────────────────────────────────────────

/**
 * Request for oracle attestation
 */
export interface AttestationRequest {
  /** Intent hash to attest */
  intentHash: HexString

  /** Destination chain */
  destinationChain: ChainId

  /** Expected recipient address */
  expectedRecipient: HexString

  /** Expected asset identifier */
  expectedAsset: HexString

  /** Minimum amount expected */
  minAmount: bigint

  /** Deadline for fulfillment (Unix timestamp) */
  deadline: number
}

/**
 * Result of attestation request
 */
export interface AttestationResult {
  /** Whether attestation was successful */
  success: boolean

  /** The signed attestation (if successful) */
  attestation?: SignedOracleAttestation

  /** Error message (if failed) */
  error?: string

  /** Number of oracles that responded */
  oracleResponses: number

  /** Number of valid signatures collected */
  validSignatures: number
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Result of attestation verification
 */
export interface VerificationResult {
  /** Whether verification passed */
  valid: boolean

  /** Number of valid signatures found */
  validSignatures: number

  /** Required threshold */
  threshold: number

  /** List of oracle IDs with valid signatures */
  validOracles: OracleId[]

  /** Error details (if invalid) */
  errors?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Domain separator for attestation signing
 */
export const ORACLE_DOMAIN = 'SIP-ORACLE-ATTESTATION-V1'

/**
 * Current attestation protocol version
 */
export const ATTESTATION_VERSION = 1

/**
 * Default signature threshold
 */
export const DEFAULT_THRESHOLD = 3

/**
 * Default total oracles
 */
export const DEFAULT_TOTAL_ORACLES = 5

/**
 * Chain numeric IDs for attestation message
 */
export const CHAIN_NUMERIC_IDS: Record<ChainId, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  bitcoin: 0, // Non-standard, SIP-specific (Bitcoin mainnet)
  solana: 501, // Non-standard, SIP-specific
  near: 502, // Non-standard, SIP-specific
  zcash: 503, // Non-standard, SIP-specific
  aptos: 504, // Non-standard, SIP-specific
  sui: 505, // Non-standard, SIP-specific
  cosmos: 506, // Non-standard, SIP-specific (Cosmos Hub)
  osmosis: 507, // Non-standard, SIP-specific
  injective: 508, // Non-standard, SIP-specific
  celestia: 509, // Non-standard, SIP-specific
  sei: 510, // Non-standard, SIP-specific
  dydx: 511, // Non-standard, SIP-specific
}
