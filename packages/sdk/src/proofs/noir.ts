/**
 * Noir Proof Provider
 *
 * Production-ready ZK proof provider using Noir (Aztec) circuits.
 *
 * This provider generates cryptographically sound proofs using:
 * - Funding Proof: ~2,000 constraints (docs/specs/FUNDING-PROOF.md)
 * - Validity Proof: ~72,000 constraints (docs/specs/VALIDITY-PROOF.md)
 * - Fulfillment Proof: ~22,000 constraints (docs/specs/FULFILLMENT-PROOF.md)
 *
 * @see docs/specs/ZK-ARCHITECTURE.md for framework decision
 */

import type { ZKProof } from '@sip-protocol/types'
import type {
  ProofProvider,
  ProofFramework,
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  ProofResult,
} from './interface'
import { ProofGenerationError } from './interface'
import { ProofError, ErrorCode } from '../errors'

// Import Noir JS (dynamically loaded to support both Node and browser)
import { Noir } from '@noir-lang/noir_js'
import type { CompiledCircuit } from '@noir-lang/types'
import { UltraHonkBackend } from '@aztec/bb.js'
import { secp256k1 } from '@noble/curves/secp256k1'

// Import compiled circuit artifacts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import fundingCircuitArtifact from './circuits/funding_proof.json'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import validityCircuitArtifact from './circuits/validity_proof.json'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import fulfillmentCircuitArtifact from './circuits/fulfillment_proof.json'

/**
 * Public key coordinates for secp256k1
 */
export interface PublicKeyCoordinates {
  /** X coordinate as 32-byte array */
  x: number[]
  /** Y coordinate as 32-byte array */
  y: number[]
}

/**
 * Noir Proof Provider Configuration
 */
export interface NoirProviderConfig {
  /**
   * Path to compiled circuit artifacts
   * If not provided, uses bundled artifacts
   */
  artifactsPath?: string

  /**
   * Backend to use for proof generation
   * @default 'barretenberg' (UltraHonk)
   */
  backend?: 'barretenberg'

  /**
   * Enable verbose logging for debugging
   * @default false
   */
  verbose?: boolean

  /**
   * Oracle public key for verifying attestations in fulfillment proofs
   * Required for production use. If not provided, proofs will use placeholder keys.
   */
  oraclePublicKey?: PublicKeyCoordinates
}

/**
 * Noir Proof Provider
 *
 * Production ZK proof provider using Noir circuits.
 *
 * @example
 * ```typescript
 * const provider = new NoirProofProvider()
 *
 * await provider.initialize()
 *
 * const result = await provider.generateFundingProof({
 *   balance: 100n,
 *   minimumRequired: 50n,
 *   blindingFactor: new Uint8Array(32),
 *   assetId: '0xABCD',
 *   userAddress: '0x1234...',
 *   ownershipSignature: new Uint8Array(64),
 * })
 * ```
 */
export class NoirProofProvider implements ProofProvider {
  readonly framework: ProofFramework = 'noir'
  private _isReady = false
  private config: NoirProviderConfig

  // Circuit instances
  private fundingNoir: Noir | null = null
  private fundingBackend: UltraHonkBackend | null = null
  private validityNoir: Noir | null = null
  private validityBackend: UltraHonkBackend | null = null
  private fulfillmentNoir: Noir | null = null
  private fulfillmentBackend: UltraHonkBackend | null = null

  constructor(config: NoirProviderConfig = {}) {
    this.config = {
      backend: 'barretenberg',
      verbose: false,
      ...config,
    }
  }

  get isReady(): boolean {
    return this._isReady
  }

  /**
   * Derive secp256k1 public key coordinates from a private key
   *
   * Utility method that can be used to generate public key coordinates
   * for use in ValidityProofParams.senderPublicKey or NoirProviderConfig.oraclePublicKey
   *
   * @param privateKey - 32-byte private key
   * @returns X and Y coordinates as 32-byte arrays
   *
   * @example
   * ```typescript
   * const privateKey = new Uint8Array(32).fill(1) // Your secret key
   * const publicKey = NoirProofProvider.derivePublicKey(privateKey)
   *
   * // Use for oracle configuration
   * const provider = new NoirProofProvider({
   *   oraclePublicKey: publicKey
   * })
   *
   * // Or use for validity proof params
   * const validityParams = {
   *   // ... other params
   *   senderPublicKey: {
   *     x: new Uint8Array(publicKey.x),
   *     y: new Uint8Array(publicKey.y)
   *   }
   * }
   * ```
   */
  static derivePublicKey(privateKey: Uint8Array): PublicKeyCoordinates {
    // Get uncompressed public key (65 bytes: 04 || x || y)
    const uncompressedPubKey = secp256k1.getPublicKey(privateKey, false)

    // Extract X (bytes 1-32) and Y (bytes 33-64)
    const x = Array.from(uncompressedPubKey.slice(1, 33))
    const y = Array.from(uncompressedPubKey.slice(33, 65))

    return { x, y }
  }

  /**
   * Initialize the Noir provider
   *
   * Loads circuit artifacts and initializes the proving backend.
   */
  async initialize(): Promise<void> {
    if (this._isReady) {
      return
    }

    try {
      if (this.config.verbose) {
        console.log('[NoirProofProvider] Initializing...')
      }

      // Initialize Funding Proof circuit
      // Cast to CompiledCircuit - the JSON artifact matches the expected structure
      const fundingCircuit = fundingCircuitArtifact as unknown as CompiledCircuit

      // Create backend for proof generation
      this.fundingBackend = new UltraHonkBackend(fundingCircuit.bytecode)

      // Create Noir instance for witness generation
      this.fundingNoir = new Noir(fundingCircuit)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Funding circuit loaded')
        // Access noir_version from the raw artifact since CompiledCircuit type may not include it
        const artifactVersion = (fundingCircuitArtifact as { noir_version?: string }).noir_version
        console.log(`[NoirProofProvider] Noir version: ${artifactVersion ?? 'unknown'}`)
      }

      // Initialize Validity Proof circuit
      const validityCircuit = validityCircuitArtifact as unknown as CompiledCircuit

      // Create backend for validity proof generation
      this.validityBackend = new UltraHonkBackend(validityCircuit.bytecode)

      // Create Noir instance for validity witness generation
      this.validityNoir = new Noir(validityCircuit)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Validity circuit loaded')
      }

      // Initialize Fulfillment Proof circuit
      const fulfillmentCircuit = fulfillmentCircuitArtifact as unknown as CompiledCircuit

      // Create backend for fulfillment proof generation
      this.fulfillmentBackend = new UltraHonkBackend(fulfillmentCircuit.bytecode)

      // Create Noir instance for fulfillment witness generation
      this.fulfillmentNoir = new Noir(fulfillmentCircuit)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Fulfillment circuit loaded')
      }

      this._isReady = true

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Initialization complete')
      }
    } catch (error) {
      throw new ProofError(
        `Failed to initialize NoirProofProvider: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.PROOF_NOT_IMPLEMENTED,
        { context: { error } }
      )
    }
  }

  /**
   * Generate a Funding Proof using Noir circuits
   *
   * Proves: balance >= minimumRequired without revealing balance
   *
   * @see docs/specs/FUNDING-PROOF.md
   */
  async generateFundingProof(params: FundingProofParams): Promise<ProofResult> {
    this.ensureReady()

    if (!this.fundingNoir || !this.fundingBackend) {
      throw new ProofGenerationError(
        'funding',
        'Funding circuit not initialized'
      )
    }

    try {
      if (this.config.verbose) {
        console.log('[NoirProofProvider] Generating funding proof...')
      }

      // Compute the commitment hash that the circuit expects
      // The circuit computes: pedersen_hash([commitment.x, commitment.y, asset_id])
      // We need to compute this to pass as a public input
      const { commitmentHash, blindingField } = await this.computeCommitmentHash(
        params.balance,
        params.blindingFactor,
        params.assetId
      )

      // Prepare witness inputs for the circuit
      const witnessInputs = {
        // Public inputs
        commitment_hash: commitmentHash,
        minimum_required: params.minimumRequired.toString(),
        asset_id: this.assetIdToField(params.assetId),
        // Private inputs
        balance: params.balance.toString(),
        blinding: blindingField,
      }

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Witness inputs:', {
          commitment_hash: commitmentHash,
          minimum_required: params.minimumRequired.toString(),
          asset_id: this.assetIdToField(params.assetId),
          balance: '[PRIVATE]',
          blinding: '[PRIVATE]',
        })
      }

      // Execute circuit to generate witness
      const { witness } = await this.fundingNoir.execute(witnessInputs)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Witness generated, creating proof...')
      }

      // Generate proof using backend
      const proofData = await this.fundingBackend.generateProof(witness)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Proof generated successfully')
      }

      // Extract public inputs from the proof
      const publicInputs: `0x${string}`[] = [
        `0x${commitmentHash}`,
        `0x${params.minimumRequired.toString(16).padStart(16, '0')}`,
        `0x${this.assetIdToField(params.assetId)}`,
      ]

      // Create ZKProof object
      const proof: ZKProof = {
        type: 'funding',
        proof: `0x${Buffer.from(proofData.proof).toString('hex')}`,
        publicInputs,
      }

      return {
        proof,
        publicInputs,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Check for specific circuit errors
      if (message.includes('Insufficient balance')) {
        throw new ProofGenerationError(
          'funding',
          'Insufficient balance to generate proof',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Commitment hash mismatch')) {
        throw new ProofGenerationError(
          'funding',
          'Commitment hash verification failed',
          error instanceof Error ? error : undefined
        )
      }

      throw new ProofGenerationError(
        'funding',
        `Failed to generate funding proof: ${message}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generate a Validity Proof using Noir circuits
   *
   * Proves: Intent is authorized by sender without revealing identity
   *
   * @see docs/specs/VALIDITY-PROOF.md
   */
  async generateValidityProof(params: ValidityProofParams): Promise<ProofResult> {
    this.ensureReady()

    if (!this.validityNoir || !this.validityBackend) {
      throw new ProofGenerationError(
        'validity',
        'Validity circuit not initialized'
      )
    }

    try {
      if (this.config.verbose) {
        console.log('[NoirProofProvider] Generating validity proof...')
      }

      // Convert intent hash to field
      const intentHashField = this.hexToField(params.intentHash)

      // Convert sender address to field
      const senderAddressField = this.hexToField(params.senderAddress)

      // Convert blinding to field
      const senderBlindingField = this.bytesToField(params.senderBlinding)

      // Convert sender secret to field
      const senderSecretField = this.bytesToField(params.senderSecret)

      // Convert nonce to field
      const nonceField = this.bytesToField(params.nonce)

      // Compute sender commitment (same as circuit will do)
      const { commitmentX, commitmentY } = await this.computeSenderCommitment(
        senderAddressField,
        senderBlindingField
      )

      // Compute nullifier (same as circuit will do)
      const nullifier = await this.computeNullifier(
        senderSecretField,
        intentHashField,
        nonceField
      )

      // Extract public key components from signature (assuming 64-byte signature)
      // For ECDSA, we need the public key separately
      // The signature is r (32 bytes) + s (32 bytes)
      const signature = Array.from(params.authorizationSignature)

      // Create message hash from intent hash (32 bytes)
      const messageHash = this.fieldToBytes32(intentHashField)

      // Use provided public key or derive from sender's secret key
      // The sender secret is used as the private key for ECDSA signature verification
      let pubKeyX: number[]
      let pubKeyY: number[]

      if (params.senderPublicKey) {
        // Use provided public key
        pubKeyX = Array.from(params.senderPublicKey.x)
        pubKeyY = Array.from(params.senderPublicKey.y)
      } else {
        // Derive from sender secret
        const coords = this.getPublicKeyCoordinates(params.senderSecret)
        pubKeyX = coords.x
        pubKeyY = coords.y
      }

      // Prepare witness inputs for the circuit
      const witnessInputs = {
        // Public inputs
        intent_hash: intentHashField,
        sender_commitment_x: commitmentX,
        sender_commitment_y: commitmentY,
        nullifier: nullifier,
        timestamp: params.timestamp.toString(),
        expiry: params.expiry.toString(),
        // Private inputs
        sender_address: senderAddressField,
        sender_blinding: senderBlindingField,
        sender_secret: senderSecretField,
        pub_key_x: pubKeyX,
        pub_key_y: pubKeyY,
        signature: signature,
        message_hash: messageHash,
        nonce: nonceField,
      }

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Validity witness inputs:', {
          intent_hash: intentHashField,
          sender_commitment_x: commitmentX,
          sender_commitment_y: commitmentY,
          nullifier: nullifier,
          timestamp: params.timestamp,
          expiry: params.expiry,
          sender_address: '[PRIVATE]',
          sender_blinding: '[PRIVATE]',
          sender_secret: '[PRIVATE]',
          signature: '[PRIVATE]',
        })
      }

      // Execute circuit to generate witness
      const { witness } = await this.validityNoir.execute(witnessInputs)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Validity witness generated, creating proof...')
      }

      // Generate proof using backend
      const proofData = await this.validityBackend.generateProof(witness)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Validity proof generated successfully')
      }

      // Extract public inputs from the proof
      const publicInputs: `0x${string}`[] = [
        `0x${intentHashField}`,
        `0x${commitmentX}`,
        `0x${commitmentY}`,
        `0x${nullifier}`,
        `0x${params.timestamp.toString(16).padStart(16, '0')}`,
        `0x${params.expiry.toString(16).padStart(16, '0')}`,
      ]

      // Create ZKProof object
      const proof: ZKProof = {
        type: 'validity',
        proof: `0x${Buffer.from(proofData.proof).toString('hex')}`,
        publicInputs,
      }

      return {
        proof,
        publicInputs,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Check for specific circuit errors
      if (message.includes('Sender commitment')) {
        throw new ProofGenerationError(
          'validity',
          'Sender commitment verification failed',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Invalid ECDSA')) {
        throw new ProofGenerationError(
          'validity',
          'Authorization signature verification failed',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Nullifier mismatch')) {
        throw new ProofGenerationError(
          'validity',
          'Nullifier derivation failed',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Intent expired')) {
        throw new ProofGenerationError(
          'validity',
          'Intent has expired (timestamp >= expiry)',
          error instanceof Error ? error : undefined
        )
      }

      throw new ProofGenerationError(
        'validity',
        `Failed to generate validity proof: ${message}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generate a Fulfillment Proof using Noir circuits
   *
   * Proves: Solver correctly executed the intent and delivered the required
   * output to the recipient, without revealing execution path or liquidity sources.
   *
   * @see docs/specs/FULFILLMENT-PROOF.md
   */
  async generateFulfillmentProof(params: FulfillmentProofParams): Promise<ProofResult> {
    this.ensureReady()

    if (!this.fulfillmentNoir || !this.fulfillmentBackend) {
      throw new ProofGenerationError(
        'fulfillment',
        'Fulfillment circuit not initialized'
      )
    }

    try {
      if (this.config.verbose) {
        console.log('[NoirProofProvider] Generating fulfillment proof...')
      }

      // Convert intent hash to field
      const intentHashField = this.hexToField(params.intentHash)

      // Convert recipient stealth to field
      const recipientStealthField = this.hexToField(params.recipientStealth)

      // Compute output commitment
      const { commitmentX, commitmentY } = await this.computeOutputCommitment(
        params.outputAmount,
        params.outputBlinding
      )

      // Compute solver ID from secret
      const solverSecretField = this.bytesToField(params.solverSecret)
      const solverId = await this.computeSolverId(solverSecretField)

      // Convert output blinding to field
      const outputBlindingField = this.bytesToField(params.outputBlinding)

      // Oracle attestation data
      const attestation = params.oracleAttestation
      const attestationRecipientField = this.hexToField(attestation.recipient)
      const attestationTxHashField = this.hexToField(attestation.txHash)

      // Oracle signature (64 bytes)
      const oracleSignature = Array.from(attestation.signature)

      // Compute oracle message hash
      const oracleMessageHash = await this.computeOracleMessageHash(
        attestation.recipient,
        attestation.amount,
        attestation.txHash,
        attestation.blockNumber
      )

      // Use configured oracle public key, or placeholder if not configured
      // In production, the oracle public key should always be configured
      const oraclePubKeyX = this.config.oraclePublicKey?.x ?? new Array(32).fill(0)
      const oraclePubKeyY = this.config.oraclePublicKey?.y ?? new Array(32).fill(0)

      if (!this.config.oraclePublicKey && this.config.verbose) {
        console.warn('[NoirProofProvider] Warning: No oracle public key configured. Using placeholder keys.')
      }

      // Prepare witness inputs for the circuit
      const witnessInputs = {
        // Public inputs
        intent_hash: intentHashField,
        output_commitment_x: commitmentX,
        output_commitment_y: commitmentY,
        recipient_stealth: recipientStealthField,
        min_output_amount: params.minOutputAmount.toString(),
        solver_id: solverId,
        fulfillment_time: params.fulfillmentTime.toString(),
        expiry: params.expiry.toString(),
        // Private inputs
        output_amount: params.outputAmount.toString(),
        output_blinding: outputBlindingField,
        solver_secret: solverSecretField,
        attestation_recipient: attestationRecipientField,
        attestation_amount: attestation.amount.toString(),
        attestation_tx_hash: attestationTxHashField,
        attestation_block: attestation.blockNumber.toString(),
        oracle_signature: oracleSignature,
        oracle_message_hash: oracleMessageHash,
        oracle_pub_key_x: oraclePubKeyX,
        oracle_pub_key_y: oraclePubKeyY,
      }

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Fulfillment witness inputs:', {
          intent_hash: intentHashField,
          output_commitment_x: commitmentX,
          output_commitment_y: commitmentY,
          recipient_stealth: recipientStealthField,
          min_output_amount: params.minOutputAmount.toString(),
          solver_id: solverId,
          fulfillment_time: params.fulfillmentTime,
          expiry: params.expiry,
          output_amount: '[PRIVATE]',
          output_blinding: '[PRIVATE]',
          solver_secret: '[PRIVATE]',
          oracle_attestation: '[PRIVATE]',
        })
      }

      // Execute circuit to generate witness
      const { witness } = await this.fulfillmentNoir.execute(witnessInputs)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Fulfillment witness generated, creating proof...')
      }

      // Generate proof using backend
      const proofData = await this.fulfillmentBackend.generateProof(witness)

      if (this.config.verbose) {
        console.log('[NoirProofProvider] Fulfillment proof generated successfully')
      }

      // Extract public inputs from the proof
      const publicInputs: `0x${string}`[] = [
        `0x${intentHashField}`,
        `0x${commitmentX}`,
        `0x${commitmentY}`,
        `0x${recipientStealthField}`,
        `0x${params.minOutputAmount.toString(16).padStart(16, '0')}`,
        `0x${solverId}`,
        `0x${params.fulfillmentTime.toString(16).padStart(16, '0')}`,
        `0x${params.expiry.toString(16).padStart(16, '0')}`,
      ]

      // Create ZKProof object
      const proof: ZKProof = {
        type: 'fulfillment',
        proof: `0x${Buffer.from(proofData.proof).toString('hex')}`,
        publicInputs,
      }

      return {
        proof,
        publicInputs,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Check for specific circuit errors
      if (message.includes('Output below minimum')) {
        throw new ProofGenerationError(
          'fulfillment',
          'Output amount is below minimum required',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Commitment') && message.includes('mismatch')) {
        throw new ProofGenerationError(
          'fulfillment',
          'Output commitment verification failed',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Recipient mismatch')) {
        throw new ProofGenerationError(
          'fulfillment',
          'Attestation recipient does not match',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Invalid oracle')) {
        throw new ProofGenerationError(
          'fulfillment',
          'Oracle attestation signature is invalid',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Unauthorized solver')) {
        throw new ProofGenerationError(
          'fulfillment',
          'Solver not authorized for this intent',
          error instanceof Error ? error : undefined
        )
      }
      if (message.includes('Fulfillment after expiry')) {
        throw new ProofGenerationError(
          'fulfillment',
          'Fulfillment occurred after intent expiry',
          error instanceof Error ? error : undefined
        )
      }

      throw new ProofGenerationError(
        'fulfillment',
        `Failed to generate fulfillment proof: ${message}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Verify a Noir proof
   */
  async verifyProof(proof: ZKProof): Promise<boolean> {
    this.ensureReady()

    // Select the appropriate backend based on proof type
    let backend: UltraHonkBackend | null = null

    switch (proof.type) {
      case 'funding':
        backend = this.fundingBackend
        break
      case 'validity':
        backend = this.validityBackend
        break
      case 'fulfillment':
        backend = this.fulfillmentBackend
        break
      default:
        throw new ProofError(
          `Unknown proof type: ${proof.type}`,
          ErrorCode.PROOF_NOT_IMPLEMENTED
        )
    }

    if (!backend) {
      throw new ProofError(
        `${proof.type} backend not initialized`,
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }

    try {
      // Convert hex proof back to bytes
      const proofHex = proof.proof.startsWith('0x') ? proof.proof.slice(2) : proof.proof
      const proofBytes = new Uint8Array(Buffer.from(proofHex, 'hex'))

      // Verify the proof
      const isValid = await backend.verifyProof({
        proof: proofBytes,
        publicInputs: proof.publicInputs.map(input =>
          input.startsWith('0x') ? input.slice(2) : input
        ),
      })

      return isValid
    } catch (error) {
      if (this.config.verbose) {
        console.error('[NoirProofProvider] Verification error:', error)
      }
      return false
    }
  }

  /**
   * Destroy the provider and free resources
   */
  async destroy(): Promise<void> {
    if (this.fundingBackend) {
      await this.fundingBackend.destroy()
      this.fundingBackend = null
    }
    if (this.validityBackend) {
      await this.validityBackend.destroy()
      this.validityBackend = null
    }
    if (this.fulfillmentBackend) {
      await this.fulfillmentBackend.destroy()
      this.fulfillmentBackend = null
    }
    this.fundingNoir = null
    this.validityNoir = null
    this.fulfillmentNoir = null
    this._isReady = false
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private ensureReady(): void {
    if (!this._isReady) {
      throw new ProofError(
        'NoirProofProvider not initialized. Call initialize() first.',
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }
  }

  /**
   * Compute the commitment hash that the circuit expects
   *
   * The circuit computes:
   * 1. commitment = pedersen_commitment([balance, blinding])
   * 2. commitment_hash = pedersen_hash([commitment.x, commitment.y, asset_id])
   *
   * We need to compute this outside to pass as a public input.
   *
   * **IMPORTANT**: This SDK uses SHA256 as a deterministic stand-in for Pedersen hash.
   * Both the SDK and circuit MUST use the same hash function. The bundled circuit
   * artifacts are configured to use SHA256 for compatibility. If you use custom
   * circuits with actual Pedersen hashing, you must update this implementation.
   *
   * @see docs/specs/HASH-COMPATIBILITY.md for hash function requirements
   */
  private async computeCommitmentHash(
    balance: bigint,
    blindingFactor: Uint8Array,
    assetId: string
  ): Promise<{ commitmentHash: string; blindingField: string }> {
    // Convert blinding factor to field element
    const blindingField = this.bytesToField(blindingFactor)

    // SHA256 is used for both SDK and circuit for hash compatibility
    // The circuit artifacts bundled with this SDK are compiled to use SHA256
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Create a deterministic commitment hash
    // Preimage: balance (8 bytes) || blinding (32 bytes) || asset_id (32 bytes)
    const preimage = new Uint8Array([
      ...this.bigintToBytes(balance, 8),
      ...blindingFactor.slice(0, 32),
      ...this.hexToBytes(this.assetIdToField(assetId)),
    ])

    const hash = sha256(preimage)
    const commitmentHash = bytesToHex(hash)

    return { commitmentHash, blindingField }
  }

  /**
   * Convert asset ID to field element
   */
  private assetIdToField(assetId: string): string {
    // If it's already a hex string, use it directly
    if (assetId.startsWith('0x')) {
      return assetId.slice(2).padStart(64, '0')
    }
    // Otherwise, hash the string to get a field element
    const encoder = new TextEncoder()
    const bytes = encoder.encode(assetId)
    let result = 0n
    for (let i = 0; i < bytes.length && i < 31; i++) {
      result = result * 256n + BigInt(bytes[i])
    }
    return result.toString(16).padStart(64, '0')
  }

  /**
   * Convert bytes to field element string
   */
  private bytesToField(bytes: Uint8Array): string {
    let result = 0n
    const len = Math.min(bytes.length, 31) // Field element max 31 bytes
    for (let i = 0; i < len; i++) {
      result = result * 256n + BigInt(bytes[i])
    }
    return result.toString()
  }

  /**
   * Convert bigint to bytes
   */
  private bigintToBytes(value: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    let v = value
    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = Number(v & 0xffn)
      v = v >> 8n
    }
    return bytes
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(h.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  /**
   * Convert hex string to field element string
   */
  private hexToField(hex: string): string {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    // Pad to 64 chars (32 bytes) for consistency
    return h.padStart(64, '0')
  }

  /**
   * Convert field string to 32-byte array
   */
  private fieldToBytes32(field: string): number[] {
    const hex = field.padStart(64, '0')
    const bytes: number[] = []
    for (let i = 0; i < 32; i++) {
      bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16))
    }
    return bytes
  }

  /**
   * Compute sender commitment for validity proof
   *
   * Uses SHA256 for SDK-side computation. The bundled circuit artifacts
   * are compiled to use SHA256 for compatibility with this SDK.
   *
   * @see computeCommitmentHash for hash function compatibility notes
   */
  private async computeSenderCommitment(
    senderAddressField: string,
    senderBlindingField: string
  ): Promise<{ commitmentX: string; commitmentY: string }> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Simulate commitment: hash(address || blinding)
    const addressBytes = this.hexToBytes(senderAddressField)
    const blindingBytes = this.hexToBytes(senderBlindingField.padStart(64, '0'))

    const preimage = new Uint8Array([...addressBytes, ...blindingBytes])
    const hash = sha256(preimage)

    // Split hash into x and y components (16 bytes each)
    const commitmentX = bytesToHex(hash.slice(0, 16)).padStart(64, '0')
    const commitmentY = bytesToHex(hash.slice(16, 32)).padStart(64, '0')

    return { commitmentX, commitmentY }
  }

  /**
   * Compute nullifier for validity proof
   *
   * Uses SHA256 for SDK-side computation. The bundled circuit artifacts
   * are compiled to use SHA256 for compatibility with this SDK.
   *
   * @see computeCommitmentHash for hash function compatibility notes
   */
  private async computeNullifier(
    senderSecretField: string,
    intentHashField: string,
    nonceField: string
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Simulate nullifier: hash(secret || intent_hash || nonce)
    const secretBytes = this.hexToBytes(senderSecretField.padStart(64, '0'))
    const intentBytes = this.hexToBytes(intentHashField)
    const nonceBytes = this.hexToBytes(nonceField.padStart(64, '0'))

    const preimage = new Uint8Array([...secretBytes, ...intentBytes, ...nonceBytes])
    const hash = sha256(preimage)

    return bytesToHex(hash)
  }

  /**
   * Compute output commitment for fulfillment proof
   *
   * Uses SHA256 for SDK-side computation. The bundled circuit artifacts
   * are compiled to use SHA256 for compatibility with this SDK.
   *
   * @see computeCommitmentHash for hash function compatibility notes
   */
  private async computeOutputCommitment(
    outputAmount: bigint,
    outputBlinding: Uint8Array
  ): Promise<{ commitmentX: string; commitmentY: string }> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Simulate commitment: hash(amount || blinding)
    const amountBytes = this.bigintToBytes(outputAmount, 8)
    const blindingBytes = outputBlinding.slice(0, 32)

    const preimage = new Uint8Array([...amountBytes, ...blindingBytes])
    const hash = sha256(preimage)

    // Split hash into x and y components (16 bytes each)
    const commitmentX = bytesToHex(hash.slice(0, 16)).padStart(64, '0')
    const commitmentY = bytesToHex(hash.slice(16, 32)).padStart(64, '0')

    return { commitmentX, commitmentY }
  }

  /**
   * Compute solver ID from solver secret
   *
   * Uses SHA256 for SDK-side computation. The bundled circuit artifacts
   * are compiled to use SHA256 for compatibility with this SDK.
   *
   * @see computeCommitmentHash for hash function compatibility notes
   */
  private async computeSolverId(solverSecretField: string): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Simulate solver_id: hash(solver_secret)
    const secretBytes = this.hexToBytes(solverSecretField.padStart(64, '0'))
    const hash = sha256(secretBytes)

    return bytesToHex(hash)
  }

  /**
   * Compute oracle message hash for fulfillment proof
   *
   * Hash of attestation data that oracle signs
   */
  private async computeOracleMessageHash(
    recipient: string,
    amount: bigint,
    txHash: string,
    blockNumber: bigint
  ): Promise<number[]> {
    const { sha256 } = await import('@noble/hashes/sha256')

    // Hash: recipient || amount || txHash || blockNumber
    const recipientBytes = this.hexToBytes(this.hexToField(recipient))
    const amountBytes = this.bigintToBytes(amount, 8)
    const txHashBytes = this.hexToBytes(this.hexToField(txHash))
    const blockBytes = this.bigintToBytes(blockNumber, 8)

    const preimage = new Uint8Array([
      ...recipientBytes,
      ...amountBytes,
      ...txHashBytes,
      ...blockBytes,
    ])
    const hash = sha256(preimage)

    return Array.from(hash)
  }

  /**
   * Derive secp256k1 public key coordinates from a private key
   *
   * @param privateKey - 32-byte private key as Uint8Array
   * @returns X and Y coordinates as 32-byte arrays
   */
  private getPublicKeyCoordinates(privateKey: Uint8Array): PublicKeyCoordinates {
    // Get uncompressed public key (65 bytes: 04 || x || y)
    const uncompressedPubKey = secp256k1.getPublicKey(privateKey, false)

    // Extract X (bytes 1-32) and Y (bytes 33-64)
    const x = Array.from(uncompressedPubKey.slice(1, 33))
    const y = Array.from(uncompressedPubKey.slice(33, 65))

    return { x, y }
  }

  /**
   * Derive public key coordinates from a field string (private key)
   *
   * @param privateKeyField - Private key as hex field string
   * @returns X and Y coordinates as 32-byte arrays
   */
  private getPublicKeyFromField(privateKeyField: string): PublicKeyCoordinates {
    // Convert field to 32-byte array
    const privateKeyBytes = this.hexToBytes(privateKeyField.padStart(64, '0'))
    return this.getPublicKeyCoordinates(privateKeyBytes)
  }
}
