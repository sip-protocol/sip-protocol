/**
 * Halo2 Proof Format Converter
 *
 * Converts between Halo2 native proof format and SIP unified format.
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
  type Halo2NativeProof,
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

/** Supported Halo2 versions */
const SUPPORTED_HALO2_VERSIONS = ['0.2', '0.3', '1.0']

/** Minimum k value for valid Halo2 proofs */
const MIN_K_VALUE = 4

/** Maximum k value for valid Halo2 proofs */
const MAX_K_VALUE = 28

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
 * Check if a Halo2 version is supported
 */
function isSupportedHalo2Version(version: string): boolean {
  const majorMinor = version.split('.').slice(0, 2).join('.')
  return SUPPORTED_HALO2_VERSIONS.some(v => majorMinor.startsWith(v))
}

// ─── Halo2 Proof Converter ───────────────────────────────────────────────────

/**
 * Converter for Halo2 proofs
 *
 * Halo2 is a zkSNARK proving system used by Zcash and other projects.
 * It uses the PLONK arithmetization with custom gates.
 *
 * @example
 * ```typescript
 * const converter = new Halo2ProofConverter()
 *
 * // Convert to SIP format
 * const result = converter.toSIP(halo2Proof)
 * if (result.success) {
 *   console.log('SIP Proof:', result.result)
 * }
 * ```
 */
export class Halo2ProofConverter implements ProofConverter<Halo2NativeProof> {
  readonly system = 'halo2' as const
  readonly version = CONVERTER_VERSION

  /**
   * Convert Halo2 native proof to SIP unified format
   */
  toSIP(
    nativeProof: Halo2NativeProof,
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
            new InvalidProofError('halo2', 'sip', validation.errors),
            startTime,
            nativeProof.proofData.length,
          )
        }
      }

      // Check version support
      if (nativeProof.halo2Version && !isSupportedHalo2Version(nativeProof.halo2Version)) {
        return this._createErrorResult(
          new UnsupportedVersionError('halo2', nativeProof.halo2Version, SUPPORTED_HALO2_VERSIONS),
          startTime,
          nativeProof.proofData.length,
        )
      }

      // Convert proof data to hex
      const proofHex = bytesToHex(nativeProof.proofData)

      // Convert public inputs to hex format
      const publicInputsHex = nativeProof.publicInputs.map(input => {
        if (input.startsWith('0x')) {
          return input as HexString
        }
        const bigInt = BigInt(input)
        return ('0x' + bigInt.toString(16).padStart(64, '0')) as HexString
      })

      // Convert verification key if present
      const verificationKey = opts.includeVerificationKey && nativeProof.verificationKey
        ? (typeof nativeProof.verificationKey === 'string'
          ? nativeProof.verificationKey as HexString
          : bytesToHex(nativeProof.verificationKey))
        : undefined

      // Build circuit identifier from k value and commitment
      const circuitId = nativeProof.provingKeyCommitment
        ? `halo2-k${nativeProof.k || 'unknown'}-${nativeProof.provingKeyCommitment.slice(0, 16)}`
        : `halo2-k${nativeProof.k || 'unknown'}`

      // Build metadata
      const metadata: ProofMetadata = {
        system: 'halo2',
        systemVersion: nativeProof.halo2Version || 'unknown',
        circuitId,
        circuitVersion: nativeProof.provingKeyCommitment || 'unknown',
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
          'halo2',
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
            'halo2',
            'sip',
            error instanceof Error ? error : undefined,
          ),
        startTime,
        nativeProof.proofData.length,
      )
    }
  }

  /**
   * Convert SIP unified format to Halo2 native proof
   */
  fromSIP(
    sipProof: SingleProof,
    options: ConversionOptions = {},
  ): ConversionResult<Halo2NativeProof> {
    const opts = { ...DEFAULT_CONVERSION_OPTIONS, ...options }
    const startTime = Date.now()
    const inputSize = sipProof.proof.length / 2 - 1

    try {
      // Check if this is a Halo2 proof
      if (!this.canConvertFromSIP(sipProof)) {
        return this._createErrorResult(
          new ProofConversionError(
            'INVALID_INPUT',
            `Cannot convert proof from system: ${sipProof.metadata.system}`,
            sipProof.metadata.system,
            'halo2',
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

      // Extract k value from circuit ID if present
      const kMatch = sipProof.metadata.circuitId.match(/k(\d+)/)
      const k = kMatch ? parseInt(kMatch[1], 10) : undefined

      // Build native proof
      const nativeProof: Halo2NativeProof = {
        system: 'halo2',
        proofData,
        publicInputs,
        verificationKey,
        provingKeyCommitment: sipProof.metadata.circuitVersion !== 'unknown'
          ? sipProof.metadata.circuitVersion as HexString
          : undefined,
        k,
        halo2Version: sipProof.metadata.systemVersion,
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
          'halo2',
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
            'halo2',
            'sip',
            error instanceof Error ? error : undefined,
          ),
        startTime,
        inputSize,
      )
    }
  }

  /**
   * Validate a Halo2 native proof structure
   */
  validateNative(nativeProof: Halo2NativeProof): ValidationResult {
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

    // Validate k value if present
    if (nativeProof.k !== undefined) {
      if (nativeProof.k < MIN_K_VALUE || nativeProof.k > MAX_K_VALUE) {
        errors.push({
          field: 'k',
          message: `k value must be between ${MIN_K_VALUE} and ${MAX_K_VALUE}, got ${nativeProof.k}`,
          code: 'INVALID_VALUE',
        })
      }
    }

    // Validate public inputs format
    if (nativeProof.publicInputs) {
      for (let i = 0; i < nativeProof.publicInputs.length; i++) {
        const input = nativeProof.publicInputs[i]
        try {
          if (input.startsWith('0x')) {
            BigInt(input)
          } else {
            BigInt(input)
          }
        } catch {
          errors.push({
            field: `publicInputs[${i}]`,
            message: `Invalid field element format: ${input}`,
            code: 'INVALID_FORMAT',
          })
        }
      }
    }

    // Version warnings
    if (nativeProof.halo2Version && !isSupportedHalo2Version(nativeProof.halo2Version)) {
      warnings.push(`Halo2 version ${nativeProof.halo2Version} may not be fully supported`)
    }

    // Missing optional field warnings
    if (!nativeProof.k) {
      warnings.push('No k value specified - circuit parameters unknown')
    }

    if (!nativeProof.provingKeyCommitment) {
      warnings.push('No proving key commitment - proof may not be fully traceable')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Check if a SIP proof can be converted to Halo2 format
   */
  canConvertFromSIP(sipProof: SingleProof): boolean {
    return sipProof.metadata.system === 'halo2'
  }

  /**
   * Get supported Halo2 versions
   */
  getSupportedVersions(): string[] {
    return [...SUPPORTED_HALO2_VERSIONS]
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private _createConversionMetadata(
    sourceSystem: 'halo2' | 'sip',
    targetSystem: 'halo2' | 'sip',
    startTime: number,
    originalSize: number,
    convertedSize: number,
  ): ConversionMetadata {
    return {
      sourceSystem: sourceSystem === 'sip' ? 'halo2' : sourceSystem,
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

  private _collectWarnings(nativeProof: Halo2NativeProof): string[] {
    const warnings: string[] = []

    if (!nativeProof.halo2Version) {
      warnings.push('No Halo2 version specified - using unknown')
    }

    if (!nativeProof.k) {
      warnings.push('No k value - circuit degree unknown')
    }

    if (!nativeProof.provingKeyCommitment) {
      warnings.push('No proving key commitment - traceability limited')
    }

    return warnings
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a new Halo2 proof converter instance
 */
export function createHalo2Converter(): Halo2ProofConverter {
  return new Halo2ProofConverter()
}
