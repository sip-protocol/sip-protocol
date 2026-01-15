/**
 * Solana Noir Verifier
 *
 * Verifies Noir ZK proofs on Solana blockchain.
 *
 * ## Overview
 *
 * This module enables verification of SIP Protocol's Noir proofs on Solana:
 * - Funding Proofs: Prove sufficient balance without revealing amount
 * - Validity Proofs: Prove intent authorization without revealing sender
 * - Fulfillment Proofs: Prove correct execution without revealing path
 *
 * ## Usage
 *
 * ```typescript
 * import { SolanaNoirVerifier } from '@sip-protocol/sdk'
 * import { NoirProofProvider } from '@sip-protocol/sdk'
 *
 * // Generate proof
 * const provider = new NoirProofProvider()
 * await provider.initialize()
 * const { proof } = await provider.generateFundingProof(params)
 *
 * // Verify on Solana
 * const verifier = new SolanaNoirVerifier({ network: 'devnet' })
 * await verifier.initialize()
 *
 * // Off-chain verification (fast, no transaction)
 * const isValid = await verifier.verifyOffChain(proof)
 *
 * // On-chain verification (submits transaction)
 * const result = await verifier.verifyOnChain(proof, wallet)
 * ```
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  CLIENT SIDE                                                │
 * │  ┌─────────────┐    ┌──────────────────┐                   │
 * │  │ Noir Proof  │───►│ SolanaNoirVerifier│                  │
 * │  │ Provider    │    │ - serialize()     │                  │
 * │  └─────────────┘    │ - verifyOffChain()│                  │
 * │                     │ - verifyOnChain() │                  │
 * │                     └────────┬─────────┘                   │
 * └──────────────────────────────┼─────────────────────────────┘
 *                                │
 *                                ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  SOLANA BLOCKCHAIN                                          │
 * │  ┌──────────────────────────────────────────────────────┐  │
 * │  │ ZK Proof Verification Program                         │  │
 * │  │ - Deserialize proof                                   │  │
 * │  │ - Load verification key                               │  │
 * │  │ - Execute pairing checks                              │  │
 * │  │ - Return verification result                          │  │
 * │  └──────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module solana/noir-verifier
 */

import type { ZKProof } from '@sip-protocol/types'
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  type NoirCircuitType,
  type SolanaNoirVerifierConfig,
  type SolanaVerificationKey,
  type SolanaSerializedProof,
  type SolanaVerificationResult,
  type SolanaVerifyInstruction,
  type ProofStatistics,
  type BatchVerificationRequest,
  type BatchVerificationResult,
  CIRCUIT_METADATA,
  DEFAULT_RPC_URLS,
  SOLANA_ZK_PROGRAM_IDS,
  SolanaNoirError,
  SolanaNoirErrorCode,
  isNoirCircuitType,
  isValidSolanaProof,
  estimateComputeUnits,
  getSunspotVerifierProgramId,
} from './noir-verifier-types'

// Re-export types for convenience
export * from './noir-verifier-types'

/**
 * Solana Noir Verifier
 *
 * Enables verification of Noir ZK proofs on Solana blockchain.
 *
 * @example
 * ```typescript
 * const verifier = new SolanaNoirVerifier({
 *   network: 'devnet',
 *   verbose: true,
 * })
 *
 * await verifier.initialize()
 *
 * // Verify proof off-chain (no transaction)
 * const valid = await verifier.verifyOffChain(proof)
 *
 * // Or verify on-chain (submits transaction)
 * const result = await verifier.verifyOnChain(proof, wallet)
 * ```
 */
export class SolanaNoirVerifier {
  private config: Required<SolanaNoirVerifierConfig>
  private _isReady = false
  private verificationKeys: Map<NoirCircuitType, SolanaVerificationKey> = new Map()
  private connection: Connection

  constructor(config: SolanaNoirVerifierConfig = {}) {
    const network = config.network ?? 'devnet'

    this.config = {
      network,
      rpcUrl: config.rpcUrl ?? DEFAULT_RPC_URLS[network],
      programId: config.programId ?? SOLANA_ZK_PROGRAM_IDS.SIP_NOIR_VERIFIER,
      verbose: config.verbose ?? false,
      commitment: config.commitment ?? 'confirmed',
      maxComputeUnits: config.maxComputeUnits ?? 400000,
    }

    this.connection = new Connection(this.config.rpcUrl, this.config.commitment)
  }

  /**
   * Get the Solana connection
   */
  getConnection(): Connection {
    return this.connection
  }

  /**
   * Check if verifier is initialized
   */
  get isReady(): boolean {
    return this._isReady
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<SolanaNoirVerifierConfig> {
    return { ...this.config }
  }

  /**
   * Get RPC URL being used
   */
  getRpcUrl(): string {
    return this.config.rpcUrl
  }

  /**
   * Initialize the verifier
   *
   * Loads verification keys for all circuit types.
   */
  async initialize(): Promise<void> {
    if (this._isReady) {
      return
    }

    if (this.config.verbose) {
      console.log('[SolanaNoirVerifier] Initializing...')
      console.log(`[SolanaNoirVerifier] Network: ${this.config.network}`)
      console.log(`[SolanaNoirVerifier] RPC: ${this.config.rpcUrl}`)
    }

    try {
      // Generate verification keys for each circuit type
      for (const circuitType of ['funding', 'validity', 'fulfillment'] as NoirCircuitType[]) {
        const vkey = await this.generateVerificationKey(circuitType)
        this.verificationKeys.set(circuitType, vkey)

        if (this.config.verbose) {
          console.log(`[SolanaNoirVerifier] Loaded ${circuitType} verification key`)
        }
      }

      this._isReady = true

      if (this.config.verbose) {
        console.log('[SolanaNoirVerifier] Initialization complete')
      }
    } catch (error) {
      throw new SolanaNoirError(
        `Failed to initialize verifier: ${error instanceof Error ? error.message : String(error)}`,
        SolanaNoirErrorCode.NETWORK_ERROR,
        { error }
      )
    }
  }

  /**
   * Generate verification key for a circuit type
   *
   * Creates the cryptographic verification key needed to verify proofs.
   */
  async generateVerificationKey(circuitType: NoirCircuitType): Promise<SolanaVerificationKey> {
    if (!isNoirCircuitType(circuitType)) {
      throw new SolanaNoirError(
        `Unsupported circuit type: ${circuitType}`,
        SolanaNoirErrorCode.UNSUPPORTED_CIRCUIT
      )
    }

    const metadata = CIRCUIT_METADATA[circuitType]

    // In production, this would load the actual verification key from
    // the compiled circuit artifacts. For now, we generate a deterministic
    // placeholder that matches the circuit structure.
    const keyBytes = this.generateVKeyBytes(circuitType)
    const keyHash = await this.hashBytes(keyBytes)

    return {
      circuitType,
      keyBytes,
      keyHash,
      publicInputCount: metadata.publicInputCount,
    }
  }

  /**
   * Serialize a proof for Solana
   *
   * Converts a Noir proof into a format suitable for Solana transaction.
   */
  serializeProof(proof: ZKProof): SolanaSerializedProof {
    if (!isValidSolanaProof(proof)) {
      throw new SolanaNoirError(
        'Invalid proof structure',
        SolanaNoirErrorCode.INVALID_PROOF_FORMAT,
        { proof }
      )
    }

    const circuitType = proof.type as NoirCircuitType

    // Convert hex proof to bytes
    const proofHex = proof.proof.startsWith('0x') ? proof.proof.slice(2) : proof.proof
    const proofBytes = this.hexToBytes(proofHex)

    // Convert public inputs to bytes
    const publicInputs = proof.publicInputs.map((input) => {
      const inputHex = input.startsWith('0x') ? input.slice(2) : input
      return this.hexToBytes(inputHex.padStart(64, '0'))
    })

    const totalSize = proofBytes.length + publicInputs.reduce((sum, pi) => sum + pi.length, 0)

    return {
      circuitType,
      proofBytes,
      publicInputs,
      totalSize,
    }
  }

  /**
   * Verify a proof off-chain
   *
   * Fast verification without submitting a transaction.
   * Uses the local Noir backend for verification if @aztec/bb.js is available,
   * otherwise falls back to mock verification.
   *
   * @param proof - The proof to verify
   * @returns true if valid, false otherwise
   *
   * @remarks
   * For production use, install @aztec/bb.js as a dependency:
   * ```bash
   * npm install @aztec/bb.js
   * ```
   */
  async verifyOffChain(proof: ZKProof): Promise<boolean> {
    this.ensureReady()

    if (!isValidSolanaProof(proof)) {
      return false
    }

    const circuitType = proof.type as NoirCircuitType
    const vkey = this.verificationKeys.get(circuitType)

    if (!vkey) {
      throw new SolanaNoirError(
        `Verification key not found for circuit: ${circuitType}`,
        SolanaNoirErrorCode.VKEY_NOT_FOUND
      )
    }

    try {
      // Try to import the Noir backend for real verification
      const bbjs = await this.tryImportBBJS()

      if (bbjs) {
        return await this.verifyWithBackend(bbjs, proof, circuitType)
      }

      // Fallback to mock verification if @aztec/bb.js not available
      if (this.config.verbose) {
        console.log('[SolanaNoirVerifier] @aztec/bb.js not available, using mock verification')
      }
      return this.mockVerify(proof)
    } catch (error) {
      if (this.config.verbose) {
        console.error('[SolanaNoirVerifier] Off-chain verification error:', error)
      }
      return false
    }
  }

  /**
   * Try to import @aztec/bb.js dynamically
   * Returns null if not available (allows graceful fallback)
   */
  private async tryImportBBJS(): Promise<{ UltraHonkBackend: unknown } | null> {
    try {
      // Dynamic import - will fail if package not installed
      const bbjs = await import('@aztec/bb.js')
      return bbjs
    } catch {
      // Package not installed - this is expected in many environments
      return null
    }
  }

  /**
   * Verify proof using the real Noir backend
   */
  private async verifyWithBackend(
    bbjs: { UltraHonkBackend: unknown },
    proof: ZKProof,
    circuitType: NoirCircuitType
  ): Promise<boolean> {
    // Load the appropriate circuit artifact
    const circuit = await this.loadCircuitArtifact(circuitType)

    // Create backend and verify
    // Cast required: bbjs is dynamically imported with unknown types
    const Backend = bbjs.UltraHonkBackend as new (bytecode: string) => {
      verifyProof(args: { proof: Uint8Array; publicInputs: string[] }): Promise<boolean>
      destroy(): Promise<void>
    }
    const backend = new Backend(circuit.bytecode)

    try {
      // Convert proof to bytes
      const proofHex = proof.proof.startsWith('0x') ? proof.proof.slice(2) : proof.proof
      const proofBytes = this.hexToBytes(proofHex)

      // Strip 0x prefix from public inputs
      const publicInputs = proof.publicInputs.map((input) =>
        input.startsWith('0x') ? input.slice(2) : input
      )

      const isValid = await backend.verifyProof({
        proof: proofBytes,
        publicInputs,
      })

      if (this.config.verbose) {
        console.log(`[SolanaNoirVerifier] Off-chain verification: ${isValid ? 'VALID' : 'INVALID'}`)
      }

      return isValid
    } finally {
      await backend.destroy()
    }
  }

  /**
   * Mock verification for testing and development
   *
   * WARNING: This does NOT provide cryptographic security.
   * Only used when @aztec/bb.js is not available.
   */
  private mockVerify(proof: ZKProof): boolean {
    // Basic structural validation only
    const proofHex = proof.proof.startsWith('0x') ? proof.proof.slice(2) : proof.proof

    // Check proof has reasonable size (real proofs are ~2KB)
    if (proofHex.length < 128) {
      return false
    }

    // Check public inputs exist
    if (proof.publicInputs.length === 0) {
      return false
    }

    if (this.config.verbose) {
      console.log('[SolanaNoirVerifier] Mock verification: VALID (not cryptographically verified)')
    }

    return true
  }

  /**
   * Verify a proof on-chain
   *
   * Submits a transaction to Solana to verify the proof using the Sunspot verifier.
   *
   * @param proof - The proof to verify
   * @param wallet - Wallet interface with signTransaction method
   * @returns Verification result with transaction signature
   */
  async verifyOnChain(
    proof: ZKProof,
    wallet: {
      publicKey: { toBase58(): string }
      signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    }
  ): Promise<SolanaVerificationResult> {
    this.ensureReady()

    if (!isValidSolanaProof(proof)) {
      return {
        valid: false,
        error: 'Invalid proof structure',
      }
    }

    const circuitType = proof.type as NoirCircuitType

    // Get the Sunspot verifier program ID for this circuit type
    const verifierProgramId = getSunspotVerifierProgramId(circuitType, this.config.network)
    if (!verifierProgramId) {
      return {
        valid: false,
        error: `No Sunspot verifier deployed for circuit type: ${circuitType} on ${this.config.network}`,
      }
    }

    try {
      // First verify off-chain (fast fail for invalid proofs)
      const offChainValid = await this.verifyOffChain(proof)
      if (!offChainValid) {
        return {
          valid: false,
          error: 'Proof failed off-chain verification',
        }
      }

      // Create Sunspot verify instruction
      const instruction = this.createSunspotVerifyInstruction(proof, verifierProgramId)

      // Estimate compute units
      const computeUnits = estimateComputeUnits(circuitType)

      if (computeUnits > this.config.maxComputeUnits) {
        return {
          valid: false,
          error: `Proof requires ${computeUnits} CU, max is ${this.config.maxComputeUnits}`,
        }
      }

      // Create transaction with compute budget
      const transaction = new Transaction()

      // Add compute budget instruction
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: this.config.maxComputeUnits })
      )

      // Add verify instruction
      transaction.add(instruction)

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(
        this.config.commitment
      )
      transaction.recentBlockhash = blockhash
      transaction.feePayer = new PublicKey(wallet.publicKey.toBase58())

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction)

      // Send transaction
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        this.config.commitment
      )

      if (confirmation.value.err) {
        return {
          valid: false,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          signature,
        }
      }

      if (this.config.verbose) {
        console.log(`[SolanaNoirVerifier] On-chain verification: VALID`)
        console.log(`[SolanaNoirVerifier] Signature: ${signature}`)
        console.log(`[SolanaNoirVerifier] Compute units: ${computeUnits}`)
      }

      return {
        valid: true,
        signature,
        computeUnits,
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Create a Sunspot verifier instruction
   *
   * Sunspot verifiers expect instruction data in format: proof_bytes || public_witness_bytes
   */
  createSunspotVerifyInstruction(proof: ZKProof, programId: string): TransactionInstruction {
    const serialized = this.serializeProofForSunspot(proof)

    return new TransactionInstruction({
      programId: new PublicKey(programId),
      keys: [], // Sunspot verifiers don't require any accounts
      data: serialized,
    })
  }

  /**
   * Serialize proof for Sunspot verifier
   *
   * Sunspot expects: proof_bytes || public_witness_bytes
   * where public_witness contains the number of public inputs followed by the values
   */
  serializeProofForSunspot(proof: ZKProof): Buffer {
    // Convert hex proof to bytes
    const proofHex = proof.proof.startsWith('0x') ? proof.proof.slice(2) : proof.proof
    const proofBytes = Buffer.from(proofHex, 'hex')

    // Convert public inputs to public witness format
    // Format: [num_inputs (4 bytes LE)] [input_1 (32 bytes)] [input_2 (32 bytes)] ...
    const numInputs = proof.publicInputs.length
    const publicWitnessSize = 4 + numInputs * 32

    const publicWitness = Buffer.alloc(publicWitnessSize)
    publicWitness.writeUInt32LE(numInputs, 0)

    for (let i = 0; i < numInputs; i++) {
      const inputHex = proof.publicInputs[i].startsWith('0x')
        ? proof.publicInputs[i].slice(2)
        : proof.publicInputs[i]
      const inputBytes = Buffer.from(inputHex.padStart(64, '0'), 'hex')
      inputBytes.copy(publicWitness, 4 + i * 32)
    }

    // Concatenate proof and public witness
    return Buffer.concat([proofBytes, publicWitness])
  }

  /**
   * Create a verify instruction for Solana
   *
   * Builds the instruction data and account metas needed for verification.
   */
  createVerifyInstruction(proof: ZKProof): SolanaVerifyInstruction {
    const serialized = this.serializeProof(proof)
    const circuitType = proof.type as NoirCircuitType

    // Build instruction data
    // Format: [discriminator (1 byte)] [circuit_type (1 byte)] [proof_len (4 bytes)] [proof] [inputs]
    const discriminator = 0x01 // Verify instruction
    const circuitTypeId = this.circuitTypeToId(circuitType)

    const proofLen = serialized.proofBytes.length
    const data = new Uint8Array(
      1 + 1 + 4 + proofLen + serialized.publicInputs.length * 32
    )

    let offset = 0
    data[offset++] = discriminator
    data[offset++] = circuitTypeId

    // Write proof length (little-endian u32)
    data[offset++] = proofLen & 0xff
    data[offset++] = (proofLen >> 8) & 0xff
    data[offset++] = (proofLen >> 16) & 0xff
    data[offset++] = (proofLen >> 24) & 0xff

    // Write proof bytes
    data.set(serialized.proofBytes, offset)
    offset += proofLen

    // Write public inputs (each 32 bytes)
    for (const input of serialized.publicInputs) {
      data.set(input, offset)
      offset += 32
    }

    return {
      programId: this.config.programId,
      data,
      keys: [
        {
          pubkey: this.config.programId, // Verification key account (PDA)
          isSigner: false,
          isWritable: false,
        },
      ],
    }
  }

  /**
   * Get proof statistics
   *
   * Returns size and compute unit estimates for a proof.
   */
  getProofStatistics(proof: ZKProof): ProofStatistics {
    const serialized = this.serializeProof(proof)
    const circuitType = proof.type as NoirCircuitType

    return {
      circuitType,
      proofSize: serialized.proofBytes.length,
      publicInputsSize: serialized.publicInputs.length * 32,
      totalSize: serialized.totalSize,
      estimatedComputeUnits: estimateComputeUnits(circuitType),
    }
  }

  /**
   * Batch verify multiple proofs
   *
   * Verifies multiple proofs, optionally failing fast on first invalid.
   */
  async batchVerify(request: BatchVerificationRequest): Promise<BatchVerificationResult> {
    this.ensureReady()

    const results: SolanaVerificationResult[] = []
    let validCount = 0
    let totalComputeUnits = 0

    for (const proof of request.proofs) {
      const valid = await this.verifyOffChain(proof)
      const computeUnits = isValidSolanaProof(proof)
        ? estimateComputeUnits(proof.type as NoirCircuitType)
        : 0

      results.push({
        valid,
        computeUnits,
      })

      if (valid) {
        validCount++
      }
      totalComputeUnits += computeUnits

      // Fail fast if requested and we found an invalid proof
      if (request.failFast && !valid) {
        break
      }
    }

    return {
      success: validCount === request.proofs.length,
      results,
      totalVerified: results.length,
      validCount,
      totalComputeUnits,
    }
  }

  /**
   * Get verification key for a circuit type
   */
  getVerificationKey(circuitType: NoirCircuitType): SolanaVerificationKey | undefined {
    return this.verificationKeys.get(circuitType)
  }

  /**
   * Destroy the verifier and free resources
   */
  async destroy(): Promise<void> {
    this.verificationKeys.clear()
    this._isReady = false
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private ensureReady(): void {
    if (!this._isReady) {
      throw new SolanaNoirError(
        'Verifier not initialized. Call initialize() first.',
        SolanaNoirErrorCode.NETWORK_ERROR
      )
    }
  }

  private async loadCircuitArtifact(circuitType: NoirCircuitType): Promise<{ bytecode: string }> {
    try {
      // Dynamically import circuit artifacts
      switch (circuitType) {
        case 'funding':
          return await import('../proofs/circuits/funding_proof.json') as { bytecode: string }
        case 'validity':
          return await import('../proofs/circuits/validity_proof.json') as { bytecode: string }
        case 'fulfillment':
          return await import('../proofs/circuits/fulfillment_proof.json') as { bytecode: string }
        default:
          throw new SolanaNoirError(
            `Unknown circuit type: ${circuitType}`,
            SolanaNoirErrorCode.UNSUPPORTED_CIRCUIT
          )
      }
    } catch (error) {
      // Circuit artifacts may not be compiled yet
      if (error instanceof SolanaNoirError) {
        throw error
      }
      throw new SolanaNoirError(
        `Circuit artifact not found for ${circuitType}. ` +
          `Ensure circuit is compiled: cd circuits && nargo compile`,
        SolanaNoirErrorCode.VKEY_NOT_FOUND,
        { circuitType, originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  private generateVKeyBytes(circuitType: NoirCircuitType): Uint8Array {
    // Generate deterministic verification key bytes
    // In production, these would come from the compiled circuit
    const metadata = CIRCUIT_METADATA[circuitType]
    const seed = `sip-noir-vkey-${circuitType}-${metadata.versionHash}`

    // Create deterministic bytes from seed
    const encoder = new TextEncoder()
    const seedBytes = encoder.encode(seed)

    // Pad to 256 bytes (typical vkey size)
    const vkeyBytes = new Uint8Array(256)
    vkeyBytes.set(seedBytes.slice(0, Math.min(seedBytes.length, 256)))

    return vkeyBytes
  }

  private async hashBytes(bytes: Uint8Array): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')
    return bytesToHex(sha256(bytes))
  }

  private hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(h.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  private circuitTypeToId(circuitType: NoirCircuitType): number {
    switch (circuitType) {
      case 'funding':
        return 0
      case 'validity':
        return 1
      case 'fulfillment':
        return 2
      default:
        return 255
    }
  }

}

/**
 * Create a Solana Noir Verifier with default devnet configuration
 */
export function createDevnetVerifier(
  config: Omit<SolanaNoirVerifierConfig, 'network'> = {}
): SolanaNoirVerifier {
  return new SolanaNoirVerifier({
    ...config,
    network: 'devnet',
  })
}

/**
 * Create a Solana Noir Verifier with mainnet configuration
 */
export function createMainnetVerifier(
  config: Omit<SolanaNoirVerifierConfig, 'network'> = {}
): SolanaNoirVerifier {
  return new SolanaNoirVerifier({
    ...config,
    network: 'mainnet-beta',
  })
}
