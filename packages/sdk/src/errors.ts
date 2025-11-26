/**
 * Custom errors for SIP Protocol SDK
 *
 * Provides clear error messages for unimplemented cryptographic functions.
 */

/**
 * Base error class for SIP Protocol
 */
export class SIPError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SIPError'
  }
}

/**
 * Error thrown when a proof function is called but not yet implemented.
 *
 * This error indicates that real ZK proof generation is required but not available.
 * The SDK intentionally throws this error instead of using mocked proofs that
 * provide no cryptographic guarantees.
 *
 * @example
 * ```typescript
 * // Use ProofProvider for proof generation
 * const provider = new NoirProofProvider(config)
 * await provider.initialize()
 * const result = await provider.generateFundingProof(params)
 * ```
 */
export class ProofNotImplementedError extends SIPError {
  /** The type of proof that is not implemented */
  readonly proofType: 'funding' | 'validity' | 'fulfillment' | 'viewing'

  /** Reference to the specification document */
  readonly specReference: string

  constructor(
    proofType: 'funding' | 'validity' | 'fulfillment' | 'viewing',
    specReference: string,
  ) {
    const message = `${proofType.charAt(0).toUpperCase() + proofType.slice(1)} proof generation is not implemented. ` +
      `Real ZK proofs are required for production use. ` +
      `See specification: ${specReference}`
    super(message)
    this.name = 'ProofNotImplementedError'
    this.proofType = proofType
    this.specReference = specReference
  }
}

/**
 * Error thrown when encryption functions are called but not yet implemented.
 *
 * This error indicates that real authenticated encryption (ChaCha20-Poly1305)
 * is required but not available.
 */
export class EncryptionNotImplementedError extends SIPError {
  /** The type of encryption operation */
  readonly operation: 'encrypt' | 'decrypt'

  /** Reference to the specification document */
  readonly specReference: string

  constructor(
    operation: 'encrypt' | 'decrypt',
    specReference: string,
  ) {
    const message = `${operation.charAt(0).toUpperCase() + operation.slice(1)}ion is not implemented. ` +
      `Real authenticated encryption (ChaCha20-Poly1305) is required. ` +
      `See specification: ${specReference}`
    super(message)
    this.name = 'EncryptionNotImplementedError'
    this.operation = operation
    this.specReference = specReference
  }
}
