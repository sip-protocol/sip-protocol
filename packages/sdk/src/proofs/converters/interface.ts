/**
 * Proof Format Converter Interface
 *
 * Defines the interface for converting proofs between native formats
 * (Noir, Halo2, Kimchi) and the unified SIP proof format.
 *
 * @packageDocumentation
 */

import type {
  ProofSystem,
  SingleProof,
  HexString,
} from '@sip-protocol/types'

// ─── Native Proof Formats ────────────────────────────────────────────────────

/**
 * Base interface for native proof formats
 */
export interface NativeProofFormat {
  /** The proof system this format belongs to */
  readonly system: ProofSystem
  /** Raw proof bytes/data */
  proofData: Uint8Array | HexString
  /** Public inputs in native format */
  publicInputs: unknown[]
  /** System-specific verification key */
  verificationKey?: Uint8Array | HexString
  /** Native metadata specific to the proof system */
  nativeMetadata?: Record<string, unknown>
}

/**
 * Noir native proof format
 */
export interface NoirNativeProof extends NativeProofFormat {
  readonly system: 'noir'
  /** Noir proof bytes (Barretenberg format) */
  proofData: Uint8Array
  /** Public inputs as field elements */
  publicInputs: string[]
  /** ACIR circuit artifact hash */
  circuitHash?: string
  /** Noir version that generated this proof */
  noirVersion?: string
  /** Backend version (Barretenberg) */
  backendVersion?: string
}

/**
 * Halo2 native proof format
 */
export interface Halo2NativeProof extends NativeProofFormat {
  readonly system: 'halo2'
  /** Halo2 proof transcript */
  proofData: Uint8Array
  /** Public inputs as field elements */
  publicInputs: string[]
  /** Proving key commitment */
  provingKeyCommitment?: HexString
  /** Circuit degree (k value) */
  k?: number
  /** Halo2 library version */
  halo2Version?: string
}

/**
 * Kimchi native proof format (Mina Protocol)
 */
export interface KimchiNativeProof extends NativeProofFormat {
  readonly system: 'kimchi'
  /** Kimchi proof data */
  proofData: Uint8Array
  /** Public inputs as Pasta field elements */
  publicInputs: string[]
  /** SRS (Structured Reference String) hash */
  srsHash?: HexString
  /** Kimchi/o1js version */
  kimchiVersion?: string
  /** Verifier index commitment */
  verifierIndexCommitment?: HexString
}

// ─── Conversion Types ────────────────────────────────────────────────────────

/**
 * Options for proof conversion
 */
export interface ConversionOptions {
  /** Preserve all native metadata in the output */
  preserveNativeMetadata?: boolean
  /** Validate proof structure before conversion */
  validateBeforeConversion?: boolean
  /** Include verification key in output */
  includeVerificationKey?: boolean
  /** Target chain ID for the converted proof */
  targetChainId?: string
  /** Custom ID generator for the output proof */
  idGenerator?: () => string
}

/**
 * Result of a conversion operation
 */
export interface ConversionResult<T> {
  /** Whether conversion was successful */
  success: boolean
  /** The converted proof (if successful) */
  result?: T
  /** Error message (if failed) */
  error?: string
  /** Detailed error code for programmatic handling */
  errorCode?: ConversionErrorCode
  /** Warnings generated during conversion */
  warnings?: string[]
  /** Whether the conversion was lossless */
  lossless: boolean
  /** Metadata about the conversion process */
  conversionMetadata: ConversionMetadata
}

/**
 * Metadata about the conversion process
 */
export interface ConversionMetadata {
  /** Source format/system */
  sourceSystem: ProofSystem
  /** Target format/system */
  targetSystem: ProofSystem | 'sip'
  /** Conversion timestamp */
  convertedAt: number
  /** Converter version */
  converterVersion: string
  /** Time taken for conversion (ms) */
  conversionTimeMs: number
  /** Original proof size (bytes) */
  originalSize: number
  /** Converted proof size (bytes) */
  convertedSize: number
}

/**
 * Error codes for conversion failures
 */
export type ConversionErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_VERSION'
  | 'MISSING_REQUIRED_FIELD'
  | 'VALIDATION_FAILED'
  | 'ENCODING_ERROR'
  | 'DECODING_ERROR'
  | 'METADATA_ERROR'
  | 'UNKNOWN_ERROR'

// ─── Converter Interface ─────────────────────────────────────────────────────

/**
 * Interface for proof format converters
 *
 * Converters transform proofs between native formats and the unified SIP format.
 * All converters should:
 * - Be pure functions (no side effects)
 * - Preserve proof validity
 * - Handle version differences gracefully
 * - Provide detailed error information
 *
 * @example
 * ```typescript
 * const converter = new NoirProofConverter()
 *
 * // Convert Noir proof to SIP format
 * const result = converter.toSIP(noirProof, {
 *   preserveNativeMetadata: true,
 * })
 *
 * if (result.success) {
 *   const sipProof = result.result!
 *   console.log('Converted proof:', sipProof.id)
 * }
 * ```
 */
export interface ProofConverter<TNative extends NativeProofFormat> {
  /** The proof system this converter handles */
  readonly system: ProofSystem

  /** Converter version for tracking */
  readonly version: string

  /**
   * Convert from native format to SIP unified format
   *
   * @param nativeProof - The native proof to convert
   * @param options - Conversion options
   * @returns Conversion result with SIP proof
   */
  toSIP(
    nativeProof: TNative,
    options?: ConversionOptions,
  ): ConversionResult<SingleProof>

  /**
   * Convert from SIP unified format to native format
   *
   * @param sipProof - The SIP proof to convert
   * @param options - Conversion options
   * @returns Conversion result with native proof
   */
  fromSIP(
    sipProof: SingleProof,
    options?: ConversionOptions,
  ): ConversionResult<TNative>

  /**
   * Validate a native proof structure without converting
   *
   * @param nativeProof - The native proof to validate
   * @returns Validation result
   */
  validateNative(nativeProof: TNative): ValidationResult

  /**
   * Check if a SIP proof can be converted to this native format
   *
   * @param sipProof - The SIP proof to check
   * @returns Whether conversion is possible
   */
  canConvertFromSIP(sipProof: SingleProof): boolean

  /**
   * Get supported versions for this converter
   *
   * @returns List of supported system versions
   */
  getSupportedVersions(): string[]
}

/**
 * Validation result for proof structure
 */
export interface ValidationResult {
  /** Whether the proof is valid */
  valid: boolean
  /** Validation errors (if any) */
  errors: ValidationError[]
  /** Validation warnings */
  warnings: string[]
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string
  /** Error message */
  message: string
  /** Error code */
  code: string
}

// ─── Error Classes ───────────────────────────────────────────────────────────

/**
 * Base error class for conversion errors
 */
export class ProofConversionError extends Error {
  readonly code: ConversionErrorCode
  readonly sourceSystem: ProofSystem
  readonly targetSystem: ProofSystem | 'sip'
  readonly cause?: Error

  constructor(
    code: ConversionErrorCode,
    message: string,
    sourceSystem: ProofSystem,
    targetSystem: ProofSystem | 'sip',
    cause?: Error,
  ) {
    super(message)
    this.name = 'ProofConversionError'
    this.code = code
    this.sourceSystem = sourceSystem
    this.targetSystem = targetSystem
    this.cause = cause
  }
}

/**
 * Error for invalid input proofs
 */
export class InvalidProofError extends ProofConversionError {
  readonly validationErrors: ValidationError[]

  constructor(
    sourceSystem: ProofSystem,
    targetSystem: ProofSystem | 'sip',
    validationErrors: ValidationError[],
  ) {
    const errorSummary = validationErrors.map(e => `${e.field}: ${e.message}`).join('; ')
    super(
      'INVALID_INPUT',
      `Invalid proof structure: ${errorSummary}`,
      sourceSystem,
      targetSystem,
    )
    this.name = 'InvalidProofError'
    this.validationErrors = validationErrors
  }
}

/**
 * Error for unsupported proof system versions
 */
export class UnsupportedVersionError extends ProofConversionError {
  readonly providedVersion: string
  readonly supportedVersions: string[]

  constructor(
    sourceSystem: ProofSystem,
    providedVersion: string,
    supportedVersions: string[],
  ) {
    super(
      'UNSUPPORTED_VERSION',
      `Version ${providedVersion} is not supported. Supported: ${supportedVersions.join(', ')}`,
      sourceSystem,
      'sip',
    )
    this.name = 'UnsupportedVersionError'
    this.providedVersion = providedVersion
    this.supportedVersions = supportedVersions
  }
}

// ─── Utility Types ───────────────────────────────────────────────────────────

/**
 * Union type of all native proof formats
 */
export type AnyNativeProof = NoirNativeProof | Halo2NativeProof | KimchiNativeProof

/**
 * Map of proof systems to their native proof types
 */
export interface ProofSystemToNativeMap {
  noir: NoirNativeProof
  halo2: Halo2NativeProof
  kimchi: KimchiNativeProof
  groth16: NativeProofFormat
  plonk: NativeProofFormat
}

/**
 * Default conversion options
 */
export const DEFAULT_CONVERSION_OPTIONS: Required<ConversionOptions> = {
  preserveNativeMetadata: true,
  validateBeforeConversion: true,
  includeVerificationKey: true,
  targetChainId: '',
  idGenerator: () => `proof-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
}
