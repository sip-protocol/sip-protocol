/**
 * Noir Proof Format Converter
 *
 * Converts between Noir native proof format (Barretenberg) and SIP unified format.
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
  type NoirNativeProof,
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

/** Supported Noir versions */
const SUPPORTED_NOIR_VERSIONS = ['0.30', '0.31', '0.32', '0.33', '0.34', '0.35', '1.0']

/** Supported Barretenberg versions */
const SUPPORTED_BB_VERSIONS = ['0.47', '0.48', '0.49', '0.50', '0.51', '0.52', '0.53']

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
 * Check if a Noir version is supported
 */
function isSupportedNoirVersion(version: string): boolean {
  const majorMinor = version.split('.').slice(0, 2).join('.')
  return SUPPORTED_NOIR_VERSIONS.some(v => majorMinor.startsWith(v))
}

/**
 * Check if a Barretenberg version is supported
 */
function isSupportedBBVersion(version: string): boolean {
  const majorMinor = version.split('.').slice(0, 2).join('.')
  return SUPPORTED_BB_VERSIONS.some(v => majorMinor.startsWith(v))
}

// ─── Noir Proof Converter ────────────────────────────────────────────────────

/**
 * Converter for Noir proofs (Barretenberg backend)
 *
 * @example
 * ```typescript
 * const converter = new NoirProofConverter()
 *
 * // Convert to SIP format
 * const result = converter.toSIP(noirProof)
 * if (result.success) {
 *   console.log('SIP Proof:', result.result)
 * }
 *
 * // Convert back to Noir format
 * const nativeResult = converter.fromSIP(sipProof)
 * if (nativeResult.success) {
 *   console.log('Noir Proof:', nativeResult.result)
 * }
 * ```
 */
export class NoirProofConverter implements ProofConverter<NoirNativeProof> {
  readonly system = 'noir' as const
  readonly version = CONVERTER_VERSION

  /**
   * Convert Noir native proof to SIP unified format
   */
  toSIP(
    nativeProof: NoirNativeProof,
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
            new InvalidProofError('noir', 'sip', validation.errors),
            startTime,
            nativeProof.proofData.length,
          )
        }
      }

      // Check version support
      if (nativeProof.noirVersion && !isSupportedNoirVersion(nativeProof.noirVersion)) {
        return this._createErrorResult(
          new UnsupportedVersionError('noir', nativeProof.noirVersion, SUPPORTED_NOIR_VERSIONS),
          startTime,
          nativeProof.proofData.length,
        )
      }

      // Convert proof data to hex
      const proofHex = bytesToHex(nativeProof.proofData)

      // Convert public inputs to hex format
      const publicInputsHex = nativeProof.publicInputs.map(input => {
        // If already hex, ensure proper format
        if (input.startsWith('0x')) {
          return input as HexString
        }
        // Convert decimal/field element to hex
        const bigInt = BigInt(input)
        return ('0x' + bigInt.toString(16).padStart(64, '0')) as HexString
      })

      // Convert verification key if present
      const verificationKey = opts.includeVerificationKey && nativeProof.verificationKey
        ? (typeof nativeProof.verificationKey === 'string'
          ? nativeProof.verificationKey as HexString
          : bytesToHex(nativeProof.verificationKey))
        : undefined

      // Build metadata
      const metadata: ProofMetadata = {
        system: 'noir',
        systemVersion: nativeProof.noirVersion || 'unknown',
        circuitId: nativeProof.circuitHash || 'unknown',
        circuitVersion: nativeProof.backendVersion || 'unknown',
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

      // Calculate output size
      const outputSize = proofHex.length / 2 - 1 // Hex chars / 2 minus 0x

      return {
        success: true,
        result: sipProof,
        lossless: true,
        warnings: this._collectWarnings(nativeProof),
        conversionMetadata: this._createConversionMetadata(
          'noir',
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
            'noir',
            'sip',
            error instanceof Error ? error : undefined,
          ),
        startTime,
        nativeProof.proofData.length,
      )
    }
  }

  /**
   * Convert SIP unified format to Noir native proof
   */
  fromSIP(
    sipProof: SingleProof,
    options: ConversionOptions = {},
  ): ConversionResult<NoirNativeProof> {
    const opts = { ...DEFAULT_CONVERSION_OPTIONS, ...options }
    const startTime = Date.now()
    const inputSize = sipProof.proof.length / 2 - 1

    try {
      // Check if this is a Noir proof
      if (!this.canConvertFromSIP(sipProof)) {
        return this._createErrorResult(
          new ProofConversionError(
            'INVALID_INPUT',
            `Cannot convert proof from system: ${sipProof.metadata.system}`,
            sipProof.metadata.system,
            'noir',
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

      // Build native proof
      const nativeProof: NoirNativeProof = {
        system: 'noir',
        proofData,
        publicInputs,
        verificationKey,
        circuitHash: sipProof.metadata.circuitId,
        noirVersion: sipProof.metadata.systemVersion,
        backendVersion: sipProof.metadata.circuitVersion,
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
          'noir',
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
            'noir',
            'sip',
            error instanceof Error ? error : undefined,
          ),
        startTime,
        inputSize,
      )
    }
  }

  /**
   * Validate a Noir native proof structure
   */
  validateNative(nativeProof: NoirNativeProof): ValidationResult {
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

    // Validate proof data format (basic structure check)
    if (nativeProof.proofData && nativeProof.proofData.length < 32) {
      errors.push({
        field: 'proofData',
        message: 'Proof data is too short (minimum 32 bytes)',
        code: 'INVALID_FORMAT',
      })
    }

    // Validate public inputs format
    if (nativeProof.publicInputs) {
      for (let i = 0; i < nativeProof.publicInputs.length; i++) {
        const input = nativeProof.publicInputs[i]
        try {
          // Try to parse as BigInt (hex or decimal)
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
    if (nativeProof.noirVersion && !isSupportedNoirVersion(nativeProof.noirVersion)) {
      warnings.push(`Noir version ${nativeProof.noirVersion} may not be fully supported`)
    }

    if (nativeProof.backendVersion && !isSupportedBBVersion(nativeProof.backendVersion)) {
      warnings.push(`Barretenberg version ${nativeProof.backendVersion} may not be fully supported`)
    }

    // Missing optional field warnings
    if (!nativeProof.circuitHash) {
      warnings.push('No circuit hash provided - proof may not be fully traceable')
    }

    if (!nativeProof.verificationKey) {
      warnings.push('No verification key included - may need external key for verification')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Check if a SIP proof can be converted to Noir format
   */
  canConvertFromSIP(sipProof: SingleProof): boolean {
    return sipProof.metadata.system === 'noir'
  }

  /**
   * Get supported Noir versions
   */
  getSupportedVersions(): string[] {
    return [...SUPPORTED_NOIR_VERSIONS]
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private _createConversionMetadata(
    sourceSystem: 'noir' | 'sip',
    targetSystem: 'noir' | 'sip',
    startTime: number,
    originalSize: number,
    convertedSize: number,
  ): ConversionMetadata {
    return {
      sourceSystem: sourceSystem === 'sip' ? 'noir' : sourceSystem,
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

  private _collectWarnings(nativeProof: NoirNativeProof): string[] {
    const warnings: string[] = []

    if (!nativeProof.noirVersion) {
      warnings.push('No Noir version specified - using unknown')
    }

    if (!nativeProof.circuitHash) {
      warnings.push('No circuit hash - traceability limited')
    }

    return warnings
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a new Noir proof converter instance
 */
export function createNoirConverter(): NoirProofConverter {
  return new NoirProofConverter()
}
