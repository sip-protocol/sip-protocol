/**
 * Sunspot ZK Proof Verifier Integration
 *
 * Enables verification of Noir ZK proofs on Solana via Groth16.
 *
 * ## Pipeline
 *
 * ```
 * Noir Circuit → ACIR → Groth16 Proof → Solana Verifier Program
 * ```
 *
 * ## Proof Types
 *
 * - `funding` - Prove balance >= minimum without revealing balance
 * - `ownership` - Prove stealth key ownership
 * - `validity` - Prove intent authorization
 *
 * @example
 * ```typescript
 * import { SunspotVerifier, ProofType } from '@sip-protocol/sdk'
 *
 * const verifier = new SunspotVerifier({
 *   fundingVerifierProgram: 'FUNDxxxx...',
 *   ownershipVerifierProgram: 'OWNRxxxx...',
 * })
 *
 * // Verify a proof on-chain
 * const result = await verifier.verify({
 *   connection,
 *   proofType: ProofType.Funding,
 *   proof: proofBytes,
 *   publicInputs: [commitmentHash, minimumRequired, assetId],
 *   payer: wallet.publicKey,
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * console.log('Verified:', result.verified)
 * console.log('CU used:', result.computeUnits)
 * ```
 *
 * @packageDocumentation
 */

import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import { ValidationError } from '../../errors'
import type { HexString } from '@sip-protocol/types'
import { hexToBytes } from '@noble/hashes/utils'

/**
 * Supported proof types
 */
export enum ProofType {
  /** Prove balance >= minimum without revealing balance */
  Funding = 'funding',
  /** Prove stealth key ownership for claiming */
  Ownership = 'ownership',
  /** Prove intent authorization */
  Validity = 'validity',
  /** Prove fulfillment correctness */
  Fulfillment = 'fulfillment',
}

/**
 * Configuration for Sunspot verifier
 */
export interface SunspotVerifierConfig {
  /** Program ID for funding proof verifier */
  fundingVerifierProgram?: PublicKey | string
  /** Program ID for ownership proof verifier */
  ownershipVerifierProgram?: PublicKey | string
  /** Program ID for validity proof verifier */
  validityVerifierProgram?: PublicKey | string
  /** Program ID for fulfillment proof verifier */
  fulfillmentVerifierProgram?: PublicKey | string
  /** Compute units to request (default: 300,000) */
  computeUnits?: number
}

/**
 * Parameters for proof verification
 */
export interface VerifyProofParams {
  /** Solana connection */
  connection: Connection
  /** Type of proof being verified */
  proofType: ProofType
  /** Serialized Groth16 proof bytes */
  proof: Uint8Array | HexString
  /** Public inputs for the proof */
  publicInputs: (Uint8Array | HexString | bigint)[]
  /** Payer for transaction */
  payer: PublicKey
  /** Transaction signer */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
}

/**
 * Result of proof verification
 */
export interface VerifyProofResult {
  /** Whether the proof was verified successfully */
  verified: boolean
  /** Transaction signature */
  signature: string
  /** Compute units used */
  computeUnits: number
  /** Error message if verification failed */
  error?: string
}

/**
 * Groth16 proof structure
 */
export interface Groth16Proof {
  /** Proof A point (G1, 64 bytes uncompressed or 33 compressed) */
  a: Uint8Array
  /** Proof B point (G2, 128 bytes uncompressed or 65 compressed) */
  b: Uint8Array
  /** Proof C point (G1, 64 bytes uncompressed or 33 compressed) */
  c: Uint8Array
}

/**
 * Default compute units for verification
 */
const DEFAULT_COMPUTE_UNITS = 300_000

/**
 * Expected proof sizes
 */
const PROOF_SIZE = {
  /** Compressed G1 point */
  G1_COMPRESSED: 33,
  /** Uncompressed G1 point */
  G1_UNCOMPRESSED: 64,
  /** Compressed G2 point */
  G2_COMPRESSED: 65,
  /** Uncompressed G2 point */
  G2_UNCOMPRESSED: 128,
  /** Typical Groth16 proof size (uncompressed) */
  GROTH16_UNCOMPRESSED: 256, // a(64) + b(128) + c(64)
  /** Typical Groth16 proof size (compressed) */
  GROTH16_COMPRESSED: 131, // a(33) + b(65) + c(33)
}

/**
 * Sunspot ZK Proof Verifier
 *
 * Provides on-chain verification of Noir ZK proofs via Groth16.
 */
export class SunspotVerifier {
  private config: SunspotVerifierConfig
  private verifierPrograms: Map<ProofType, PublicKey>

  /**
   * Create a new Sunspot verifier
   *
   * @param config - Verifier configuration with program IDs
   */
  constructor(config: SunspotVerifierConfig = {}) {
    this.config = {
      computeUnits: DEFAULT_COMPUTE_UNITS,
      ...config,
    }

    this.verifierPrograms = new Map()

    // Initialize program mappings
    if (config.fundingVerifierProgram) {
      this.verifierPrograms.set(
        ProofType.Funding,
        toPublicKey(config.fundingVerifierProgram)
      )
    }
    if (config.ownershipVerifierProgram) {
      this.verifierPrograms.set(
        ProofType.Ownership,
        toPublicKey(config.ownershipVerifierProgram)
      )
    }
    if (config.validityVerifierProgram) {
      this.verifierPrograms.set(
        ProofType.Validity,
        toPublicKey(config.validityVerifierProgram)
      )
    }
    if (config.fulfillmentVerifierProgram) {
      this.verifierPrograms.set(
        ProofType.Fulfillment,
        toPublicKey(config.fulfillmentVerifierProgram)
      )
    }
  }

  /**
   * Get the verifier program for a proof type
   */
  getVerifierProgram(proofType: ProofType): PublicKey | undefined {
    return this.verifierPrograms.get(proofType)
  }

  /**
   * Check if a proof type is supported
   */
  isSupported(proofType: ProofType): boolean {
    return this.verifierPrograms.has(proofType)
  }

  /**
   * Verify a ZK proof on-chain
   *
   * @param params - Verification parameters
   * @returns Verification result
   */
  async verify(params: VerifyProofParams): Promise<VerifyProofResult> {
    const {
      connection,
      proofType,
      proof,
      publicInputs,
      payer,
      signTransaction,
    } = params

    // Get verifier program
    const verifierProgram = this.verifierPrograms.get(proofType)
    if (!verifierProgram) {
      throw new ValidationError(
        `No verifier program configured for ${proofType}`,
        'proofType'
      )
    }

    // Convert proof to bytes
    const proofBytes = toBytes(proof)

    // Validate proof size
    if (
      proofBytes.length !== PROOF_SIZE.GROTH16_UNCOMPRESSED &&
      proofBytes.length !== PROOF_SIZE.GROTH16_COMPRESSED
    ) {
      throw new ValidationError(
        `Invalid proof size: ${proofBytes.length} bytes. Expected ${PROOF_SIZE.GROTH16_COMPRESSED} or ${PROOF_SIZE.GROTH16_UNCOMPRESSED}`,
        'proof'
      )
    }

    // Convert public inputs to bytes
    const publicInputBytes = publicInputs.map((input) => {
      if (typeof input === 'bigint') {
        return bigintToBytes32(input)
      }
      return toBytes(input)
    })

    // Build instruction data: [proof_bytes][public_inputs]
    const instructionData = Buffer.concat([
      proofBytes,
      ...publicInputBytes.map((b) => Buffer.from(b)),
    ])

    // Build transaction
    const transaction = new Transaction()

    // Add compute budget
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: this.config.computeUnits!,
      })
    )

    // Add verify instruction
    transaction.add(
      new TransactionInstruction({
        keys: [], // Verifier programs typically don't need accounts
        programId: verifierProgram,
        data: instructionData,
      })
    )

    // Get blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payer

    try {
      // Sign and send
      const signedTx = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTx.serialize())

      // Confirm and get logs
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      })

      if (confirmation.value.err) {
        return {
          verified: false,
          signature,
          computeUnits: this.config.computeUnits!,
          error: `Verification failed: ${JSON.stringify(confirmation.value.err)}`,
        }
      }

      // Get transaction details for CU usage
      const txDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })

      const computeUnits = txDetails?.meta?.computeUnitsConsumed ?? this.config.computeUnits!

      return {
        verified: true,
        signature,
        computeUnits: Number(computeUnits),
      }
    } catch (error) {
      return {
        verified: false,
        signature: '',
        computeUnits: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Estimate compute units for verification
   *
   * @param proofType - Type of proof
   * @returns Estimated compute units
   */
  estimateComputeUnits(proofType: ProofType): number {
    // Groth16 verification is roughly constant across proof types
    // ~200K for the actual verification + overhead
    switch (proofType) {
      case ProofType.Funding:
        return 220_000
      case ProofType.Ownership:
        return 200_000
      case ProofType.Validity:
        return 250_000
      case ProofType.Fulfillment:
        return 230_000
      default:
        return DEFAULT_COMPUTE_UNITS
    }
  }

  /**
   * Parse a Groth16 proof from bytes
   */
  static parseProof(proofBytes: Uint8Array): Groth16Proof {
    if (proofBytes.length === PROOF_SIZE.GROTH16_UNCOMPRESSED) {
      return {
        a: proofBytes.slice(0, 64),
        b: proofBytes.slice(64, 192),
        c: proofBytes.slice(192, 256),
      }
    } else if (proofBytes.length === PROOF_SIZE.GROTH16_COMPRESSED) {
      return {
        a: proofBytes.slice(0, 33),
        b: proofBytes.slice(33, 98),
        c: proofBytes.slice(98, 131),
      }
    } else {
      throw new ValidationError(
        `Invalid proof size: ${proofBytes.length}`,
        'proofBytes'
      )
    }
  }

  /**
   * Serialize a Groth16 proof to bytes
   */
  static serializeProof(proof: Groth16Proof): Uint8Array {
    return new Uint8Array([...proof.a, ...proof.b, ...proof.c])
  }
}

/**
 * Create instruction data for verifier call
 */
export function createVerifyInstructionData(
  proof: Uint8Array,
  publicInputs: Uint8Array[]
): Buffer {
  return Buffer.concat([proof, ...publicInputs.map((p) => Buffer.from(p))])
}

/**
 * Format public inputs for funding proof
 */
export function formatFundingInputs(params: {
  commitmentHash: HexString
  minimumRequired: bigint
  assetId: HexString
}): Uint8Array[] {
  return [
    hexToBytes(params.commitmentHash.slice(2)),
    bigintToBytes32(params.minimumRequired),
    hexToBytes(params.assetId.slice(2)),
  ]
}

/**
 * Format public inputs for ownership proof
 */
export function formatOwnershipInputs(params: {
  stealthPubkey: HexString
  ephemeralPubkey: HexString
  nullifier: HexString
}): Uint8Array[] {
  return [
    hexToBytes(params.stealthPubkey.slice(2)),
    hexToBytes(params.ephemeralPubkey.slice(2)),
    hexToBytes(params.nullifier.slice(2)),
  ]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPublicKey(input: PublicKey | string): PublicKey {
  return typeof input === 'string' ? new PublicKey(input) : input
}

function toBytes(input: Uint8Array | HexString): Uint8Array {
  if (typeof input === 'string') {
    return hexToBytes(input.startsWith('0x') ? input.slice(2) : input)
  }
  return input
}

function bigintToBytes32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32)
  let v = value
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return bytes
}
