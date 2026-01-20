/**
 * Kimchi Proof Format Converter
 *
 * Converts between Kimchi native proof format (Mina Protocol) and SIP unified format.
 *
 * @packageDocumentation
 */

import type {
  SingleProof,
  ProofMetadata,
  HexString,
} from '@sip-protocol/types'

import {
  type ProofConverter,
  type KimchiNativeProof,
  type ConversionOptions,
  type ConversionResult,
  type ConversionMetadata,
  type ValidationResult,
  type ValidationError,
  DEFAULT_CONVERSION_OPTIONS,
  ProofConversionError,
  InvalidProofError,
  UnsupportedVersionError,
} from './interface'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Converter version */
const CONVERTER_VERSION = '1.0.0'

/** Supported Kimchi/o1js versions */
const SUPPORTED_KIMCHI_VERSIONS = ['0.15', '0.16', '0.17', '0.18', '1.0', '1.1', '1.2']

/** Pasta curve field modulus (Pallas) */
const PALLAS_MODULUS = BigInt('0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001')

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): HexString {
  return ('0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')) as HexString
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: HexString): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Check if a Kimchi version is supported
 */
function isSupportedKimchiVersion(version: string): boolean {
  const majorMinor = version.split('.').slice(0, 2).join('.')
  return SUPPORTED_KIMCHI_VERSIONS.some(v => majorMinor.startsWith(v))
}

/**
 * Validate a Pasta field element (check if < field modulus)
 */
function isValidPastaFieldElement(value: string): boolean {
  try {
    const bigInt = value.startsWith('0x') ? BigInt(value) : BigInt(value)
    return bigInt >= 0n && bigInt < PALLAS_MODULUS
  } catch {
    return false
  }
}

// ─── Kimchi Proof Converter ──────────────────────────────────────────────────

/**
 * Converter for Kimchi proofs (Mina Protocol)
 *
 * Kimchi is the proving system used by Mina Protocol, using Pasta curves
 * (Pallas and Vesta) for efficient recursive composition.
 *
 * @example
 * ```typescript
 * const converter = new KimchiProofConverter()
 *
 * // Convert to SIP format
 * const result = converter.toSIP(kimchiProof)
 * if (result.success) {
 *   console.log('SIP Proof:', result.result)
 * }
 * ```
 */
export class KimchiProofConverter implements ProofConverter<KimchiNativeProof> {
  readonly system = 'kimchi' as const
  readonly version = CONVERTER_VERSION

  /**
   * Convert Kimchi native proof to SIP unified format
   */
  toSIP(
    nativeProof: KimchiNativeProof,
    options: ConversionOptions = {},
  ): ConversionResult<SingleProof> {
    const opts = { ...DEFAULT_CONVERSION_OPTIONS, ...options }
    const startTime = Date.now()

    try {
      // Validate if requested
      if (opts.validateBeforeConversion) {
        const validation = this.validateNative(nativeProof)
        if (!validation.valid) {
          return this._createErrorResult(
            new InvalidProofError('kimchi', 'sip', validation.errors),
            startTime,
            nativeProof.proofData.length,
          )
        }
      }

      // Check version support
      if (nativeProof.kimchiVersion && !isSupportedKimchiVersion(nativeProof.kimchiVersion)) {
        return this._createErrorResult(
          new UnsupportedVersionError('kimchi', nativeProof.kimchiVersion, SUPPORTED_KIMCHI_VERSIONS),
          startTime,
          nativeProof.proofData.length,
        )
      }

      // Convert proof data to hex
      const proofHex = bytesToHex(nativeProof.proofData)

      // Convert public inputs to hex format
      // Kimchi uses Pasta field elements, ensure proper encoding
      const publicInputsHex = nativeProof.publicInputs.map(input => {
        if (input.startsWith('0x')) {
          return input as HexString
        }
        const bigInt = BigInt(input)
        // Pad to 64 chars (32 bytes) for consistency
        return ('0x' + bigInt.toString(16).padStart(64, '0')) as HexString
      })

      // Convert verification key if present
      const verificationKey = opts.includeVerificationKey && nativeProof.verificationKey
        ? (typeof nativeProof.verificationKey === 'string'
          ? nativeProof.verificationKey as HexString
          : bytesToHex(nativeProof.verificationKey))
        : undefined

      // Build circuit identifier
      const circuitId = nativeProof.verifierIndexCommitment
        ? `kimchi-${nativeProof.verifierIndexCommitment.slice(0, 16)}`
        : 'kimchi-unknown'

      // Build metadata
      const metadata: ProofMetadata = {
        system: 'kimchi',
        systemVersion: nativeProof.kimchiVersion || 'unknown',
        circuitId,
        circuitVersion: nativeProof.srsHash || 'unknown',
        generatedAt: Date.now(),
        proofSizeBytes: nativeProof.proofData.length,
        targetChainId: opts.targetChainId || undefined,
      }

      // Build SIP proof
      const sipProof: SingleProof = {
        id: opts.idGenerator(),
        proof: proofHex,
        publicInputs: publicInputsHex,
        verificationKey,
        metadata,
      }

      const outputSize = proofHex.length / 2 - 1

      return {
        success: true,
        result: sipProof,
        lossless: true,
        warnings: this._collectWarnings(nativeProof),
        conversionMetadata: this._createConversionMetadata(
          'kimchi',
          'sip',
          startTime,
          nativeProof.proofData.length,
          outputSize,
        ),
      }
    } catch (error) {
      return this._createErrorResult(
        error instanceof ProofConversionError
          ? error
          : new ProofConversionError(
            'UNKNOWN_ERROR',
            error instanceof Error ? error.message : 'Unknown conversion error',
            'kimchi',
            'sip',
            error instanceof Error ? error : undefined,
          ),
        startTime,
        nativeProof.proofData.length,
      )
    }
  }

  /**
   * Convert SIP unified format to Kimchi native proof
   */
  fromSIP(
    sipProof: SingleProof,
    options: ConversionOptions = {},
  ): ConversionResult<KimchiNativeProof> {
    const opts = { ...DEFAULT_CONVERSION_OPTIONS, ...options }
    const startTime = Date.now()
    const inputSize = sipProof.proof.length / 2 - 1

    try {
      // Check if this is a Kimchi proof
      if (!this.canConvertFromSIP(sipProof)) {
        return this._createErrorResult(
          new ProofConversionError(
            'INVALID_INPUT',
            `Cannot convert proof from system: ${sipProof.metadata.system}`,
            sipProof.metadata.system,
            'kimchi',
          ),
          startTime,
          inputSize,
        )
      }

      // Convert proof hex to bytes
      const proofData = hexToBytes(sipProof.proof)

      // Convert public inputs from hex to field element strings
      const publicInputs = sipProof.publicInputs.map(hex => {
        const bigInt = BigInt(hex)
        return bigInt.toString()
      })

      // Convert verification key if present
      const verificationKey = sipProof.verificationKey
        ? hexToBytes(sipProof.verificationKey)
        : undefined

      // Extract verifier index from circuit ID if present
      const verifierMatch = sipProof.metadata.circuitId.match(/kimchi-(.+)/)
      const verifierIndexCommitment = verifierMatch && verifierMatch[1] !== 'unknown'
        ? ('0x' + verifierMatch[1]) as HexString
        : undefined

      // Build native proof
      const nativeProof: KimchiNativeProof = {
        system: 'kimchi',
        proofData,
        publicInputs,
        verificationKey,
        srsHash: sipProof.metadata.circuitVersion !== 'unknown'
          ? sipProof.metadata.circuitVersion as HexString
          : undefined,
        kimchiVersion: sipProof.metadata.systemVersion,
        verifierIndexCommitment,
        nativeMetadata: opts.preserveNativeMetadata ? {
          sipProofId: sipProof.id,
          originalMetadata: sipProof.metadata,
        } : undefined,
      }

      return {
        success: true,
        result: nativeProof,
        lossless: true,
        warnings: [],
        conversionMetadata: this._createConversionMetadata(
          'sip' as any,
          'kimchi',
          startTime,
          inputSize,
          proofData.length,
        ),
      }
    } catch (error) {
      return this._createErrorResult(
        error instanceof ProofConversionError
          ? error
          : new ProofConversionError(
            'UNKNOWN_ERROR',
            error instanceof Error ? error.message : 'Unknown conversion error',
            'kimchi',
            'sip',
            error instanceof Error ? error : undefined,
          ),
        startTime,
        inputSize,
      )
    }
  }

  /**
   * Validate a Kimchi native proof structure
   */
  validateNative(nativeProof: KimchiNativeProof): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Check required fields
    if (!nativeProof.proofData || nativeProof.proofData.length === 0) {
      errors.push({
        field: 'proofData',
        message: 'Proof data is required and must not be empty',
        code: 'REQUIRED_FIELD',
      })
    }

    if (!nativeProof.publicInputs) {
      errors.push({
        field: 'publicInputs',
        message: 'Public inputs array is required',
        code: 'REQUIRED_FIELD',
      })
    }

    // Validate public inputs are valid Pasta field elements
    if (nativeProof.publicInputs) {
      for (let i = 0; i < nativeProof.publicInputs.length; i++) {
        const input = nativeProof.publicInputs[i]
        if (!isValidPastaFieldElement(input)) {
          errors.push({
            field: `publicInputs[${i}]`,
            message: `Invalid Pasta field element: ${input}`,
            code: 'INVALID_FIELD_ELEMENT',
          })
        }
      }
    }

    // Validate SRS hash format if present
    if (nativeProof.srsHash) {
      const cleanHash = nativeProof.srsHash.startsWith('0x')
        ? nativeProof.srsHash.slice(2)
        : nativeProof.srsHash
      if (!/^[0-9a-fA-F]+$/.test(cleanHash)) {
        errors.push({
          field: 'srsHash',
          message: 'SRS hash must be a valid hex string',
          code: 'INVALID_FORMAT',
        })
      }
    }

    // Version warnings
    if (nativeProof.kimchiVersion && !isSupportedKimchiVersion(nativeProof.kimchiVersion)) {
      warnings.push(`Kimchi version ${nativeProof.kimchiVersion} may not be fully supported`)
    }

    // Missing optional field warnings
    if (!nativeProof.srsHash) {
      warnings.push('No SRS hash provided - proof may not be verifiable without matching SRS')
    }

    if (!nativeProof.verifierIndexCommitment) {
      warnings.push('No verifier index commitment - proof traceability limited')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Check if a SIP proof can be converted to Kimchi format
   */
  canConvertFromSIP(sipProof: SingleProof): boolean {
    return sipProof.metadata.system === 'kimchi'
  }

  /**
   * Get supported Kimchi versions
   */
  getSupportedVersions(): string[] {
    return [...SUPPORTED_KIMCHI_VERSIONS]
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private _createConversionMetadata(
    sourceSystem: 'kimchi' | 'sip',
    targetSystem: 'kimchi' | 'sip',
    startTime: number,
    originalSize: number,
    convertedSize: number,
  ): ConversionMetadata {
    return {
      sourceSystem: sourceSystem === 'sip' ? 'kimchi' : sourceSystem,
      targetSystem,
      convertedAt: Date.now(),
      converterVersion: this.version,
      conversionTimeMs: Date.now() - startTime,
      originalSize,
      convertedSize,
    }
  }

  private _createErrorResult<T>(
    error: ProofConversionError,
    startTime: number,
    inputSize: number,
  ): ConversionResult<T> {
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      lossless: false,
      conversionMetadata: this._createConversionMetadata(
        error.sourceSystem as any,
        error.targetSystem as any,
        startTime,
        inputSize,
        0,
      ),
    }
  }

  private _collectWarnings(nativeProof: KimchiNativeProof): string[] {
    const warnings: string[] = []

    if (!nativeProof.kimchiVersion) {
      warnings.push('No Kimchi version specified - using unknown')
    }

    if (!nativeProof.srsHash) {
      warnings.push('No SRS hash - verification may require external SRS')
    }

    if (!nativeProof.verifierIndexCommitment) {
      warnings.push('No verifier index commitment - traceability limited')
    }

    return warnings
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a new Kimchi proof converter instance
 */
export function createKimchiConverter(): KimchiProofConverter {
  return new KimchiProofConverter()
}
