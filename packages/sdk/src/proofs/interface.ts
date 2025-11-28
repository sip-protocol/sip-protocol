/**
 * Proof Provider Interface
 *
 * Defines a pluggable interface for ZK proof generation and verification.
 * This allows different backends (Noir, mock for testing) to be swapped.
 *
 * @see docs/specs/ZK-ARCHITECTURE.md for framework decision (Noir)
 */

import type { ZKProof, Commitment, HexString } from '@sip-protocol/types'

/**
 * Supported proof framework types
 */
export type ProofFramework = 'noir' | 'mock'

/**
 * Parameters for generating a Funding Proof
 *
 * Proves: balance >= minimumRequired without revealing balance
 *
 * @see docs/specs/FUNDING-PROOF.md
 */
export interface FundingProofParams {
  /** User's actual balance (private) */
  balance: bigint
  /** Minimum amount required for the intent (public) */
  minimumRequired: bigint
  /** Blinding factor for the commitment (private) */
  blindingFactor: Uint8Array
  /** Asset identifier (public) */
  assetId: string
  /** User's address for ownership proof (private) */
  userAddress: string
  /** Signature proving ownership of the address (private) */
  ownershipSignature: Uint8Array
}

/**
 * Public key coordinates for secp256k1 (X and Y as byte arrays)
 */
export interface PublicKeyXY {
  /** X coordinate as 32-byte array */
  x: Uint8Array
  /** Y coordinate as 32-byte array */
  y: Uint8Array
}

/**
 * Parameters for generating a Validity Proof
 *
 * Proves: intent is authorized by sender without revealing sender
 *
 * @see docs/specs/VALIDITY-PROOF.md
 */
export interface ValidityProofParams {
  /** Hash of the intent (public) */
  intentHash: HexString
  /** Sender's address (private) */
  senderAddress: string
  /** Blinding factor for sender commitment (private) */
  senderBlinding: Uint8Array
  /** Sender's secret key (private) - used to derive public key if senderPublicKey not provided */
  senderSecret: Uint8Array
  /** Signature authorizing the intent (private) */
  authorizationSignature: Uint8Array
  /** Nonce for nullifier generation (private) */
  nonce: Uint8Array
  /** Intent timestamp (public) */
  timestamp: number
  /** Intent expiry (public) */
  expiry: number
  /** Optional: Sender's public key. If not provided, derived from senderSecret */
  senderPublicKey?: PublicKeyXY
}

/**
 * Parameters for generating a Fulfillment Proof
 *
 * Proves: solver delivered output >= minimum to correct recipient
 *
 * @see docs/specs/FULFILLMENT-PROOF.md
 */
export interface FulfillmentProofParams {
  /** Hash of the original intent (public) */
  intentHash: HexString
  /** Actual output amount delivered (private) */
  outputAmount: bigint
  /** Blinding factor for output commitment (private) */
  outputBlinding: Uint8Array
  /** Minimum required output from intent (public) */
  minOutputAmount: bigint
  /** Recipient's stealth address (public) */
  recipientStealth: HexString
  /** Solver's identifier (public) */
  solverId: string
  /** Solver's secret for authorization (private) */
  solverSecret: Uint8Array
  /** Oracle attestation of delivery (private) */
  oracleAttestation: OracleAttestation
  /** Time of fulfillment (public) */
  fulfillmentTime: number
  /** Intent expiry (public) */
  expiry: number
}

/**
 * Oracle attestation for cross-chain verification
 */
export interface OracleAttestation {
  /** Recipient who received funds */
  recipient: HexString
  /** Amount received */
  amount: bigint
  /** Transaction hash on destination chain */
  txHash: HexString
  /** Block number containing the transaction */
  blockNumber: bigint
  /** Oracle signature (threshold signature for multi-oracle) */
  signature: Uint8Array
}

/**
 * Result of proof generation
 */
export interface ProofResult {
  /** The generated proof */
  proof: ZKProof
  /** Public inputs used in the proof */
  publicInputs: HexString[]
  /** Commitment (if generated as part of proof) */
  commitment?: Commitment
}

/**
 * Proof Provider Interface
 *
 * Implementations of this interface provide ZK proof generation and verification.
 * The SDK uses this interface to remain agnostic to the underlying ZK framework.
 *
 * @example
 * ```typescript
 * // Use mock provider for testing
 * const mockProvider = new MockProofProvider()
 *
 * // Use Noir provider for production
 * const noirProvider = new NoirProofProvider()
 *
 * // Configure SIP client with provider
 * const sip = new SIP({
 *   network: 'testnet',
 *   proofProvider: noirProvider,
 * })
 * ```
 */
export interface ProofProvider {
  /**
   * The ZK framework this provider uses
   */
  readonly framework: ProofFramework

  /**
   * Whether the provider is ready to generate proofs
   * (e.g., circuits compiled, keys loaded)
   */
  readonly isReady: boolean

  /**
   * Initialize the provider (compile circuits, load keys, etc.)
   *
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>

  /**
   * Generate a Funding Proof
   *
   * Proves that the user has sufficient balance without revealing the exact amount.
   *
   * @param params - Funding proof parameters
   * @returns The generated proof with public inputs
   * @throws ProofGenerationError if proof generation fails
   *
   * @see docs/specs/FUNDING-PROOF.md (~22,000 constraints)
   */
  generateFundingProof(params: FundingProofParams): Promise<ProofResult>

  /**
   * Generate a Validity Proof
   *
   * Proves that the intent is authorized without revealing the sender.
   *
   * @param params - Validity proof parameters
   * @returns The generated proof with public inputs
   * @throws ProofGenerationError if proof generation fails
   *
   * @see docs/specs/VALIDITY-PROOF.md (~72,000 constraints)
   */
  generateValidityProof(params: ValidityProofParams): Promise<ProofResult>

  /**
   * Generate a Fulfillment Proof
   *
   * Proves that the solver correctly delivered the output.
   *
   * @param params - Fulfillment proof parameters
   * @returns The generated proof with public inputs
   * @throws ProofGenerationError if proof generation fails
   *
   * @see docs/specs/FULFILLMENT-PROOF.md (~22,000 constraints)
   */
  generateFulfillmentProof(params: FulfillmentProofParams): Promise<ProofResult>

  /**
   * Verify a proof
   *
   * @param proof - The proof to verify
   * @returns true if the proof is valid, false otherwise
   */
  verifyProof(proof: ZKProof): Promise<boolean>
}

/**
 * Error thrown when proof generation fails
 */
export class ProofGenerationError extends Error {
  readonly proofType: 'funding' | 'validity' | 'fulfillment'
  readonly cause?: Error

  constructor(
    proofType: 'funding' | 'validity' | 'fulfillment',
    message: string,
    cause?: Error,
  ) {
    super(`${proofType} proof generation failed: ${message}`)
    this.name = 'ProofGenerationError'
    this.proofType = proofType
    this.cause = cause
  }
}
