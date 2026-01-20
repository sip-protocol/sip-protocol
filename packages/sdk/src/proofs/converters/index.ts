/**
 * Proof Format Converters
 *
 * Module for converting proofs between native formats (Noir, Halo2, Kimchi)
 * and the unified SIP proof format.
 *
 * @packageDocumentation
 * @module converters
 */

// ─── Interface and Types ─────────────────────────────────────────────────────

export type {
  NativeProofFormat,
  NoirNativeProof,
  Halo2NativeProof,
  KimchiNativeProof,
  ConversionOptions,
  ConversionResult,
  ConversionMetadata,
  ConversionErrorCode,
  ProofConverter,
  ValidationResult,
  ValidationError,
  AnyNativeProof,
  ProofSystemToNativeMap,
} from './interface'

export {
  ProofConversionError,
  InvalidProofError,
  UnsupportedVersionError,
  DEFAULT_CONVERSION_OPTIONS,
} from './interface'

// ─── Noir Converter ──────────────────────────────────────────────────────────

export { NoirProofConverter, createNoirConverter } from './noir'

// ─── Halo2 Converter ─────────────────────────────────────────────────────────

export { Halo2ProofConverter, createHalo2Converter } from './halo2'

// ─── Kimchi Converter ────────────────────────────────────────────────────────

export { KimchiProofConverter, createKimchiConverter } from './kimchi'

// ─── Unified Converter Factory ───────────────────────────────────────────────

import type { ProofSystem, SingleProof } from '@sip-protocol/types'
import type {
  ProofConverter,
  AnyNativeProof,
  ConversionResult,
  ConversionOptions,
} from './interface'
import { NoirProofConverter } from './noir'
import { Halo2ProofConverter } from './halo2'
import { KimchiProofConverter } from './kimchi'

/**
 * Unified converter that routes to the appropriate system-specific converter
 *
 * @example
 * ```typescript
 * const converter = new UnifiedProofConverter()
 *
 * // Convert any native proof to SIP format
 * const noirResult = converter.toSIP(noirProof)
 * const halo2Result = converter.toSIP(halo2Proof)
 * const kimchiResult = converter.toSIP(kimchiProof)
 *
 * // Convert SIP proof back to native format
 * const nativeResult = converter.fromSIP(sipProof)
 * ```
 */
export class UnifiedProofConverter {
  private _converters: Map<ProofSystem, ProofConverter<AnyNativeProof>>

  constructor() {
    this._converters = new Map()
    this._converters.set('noir', new NoirProofConverter() as ProofConverter<AnyNativeProof>)
    this._converters.set('halo2', new Halo2ProofConverter() as ProofConverter<AnyNativeProof>)
    this._converters.set('kimchi', new KimchiProofConverter() as ProofConverter<AnyNativeProof>)
  }

  /**
   * Convert a native proof to SIP unified format
   */
  toSIP(
    nativeProof: AnyNativeProof,
    options?: ConversionOptions,
  ): ConversionResult<SingleProof> {
    const converter = this._converters.get(nativeProof.system)
    if (!converter) {
      return {
        success: false,
        error: `Unsupported proof system: ${nativeProof.system}`,
        errorCode: 'INVALID_INPUT',
        lossless: false,
        conversionMetadata: {
          sourceSystem: nativeProof.system,
          targetSystem: 'sip',
          convertedAt: Date.now(),
          converterVersion: '1.0.0',
          conversionTimeMs: 0,
          originalSize: 0,
          convertedSize: 0,
        },
      }
    }

    return converter.toSIP(nativeProof, options)
  }

  /**
   * Convert a SIP proof to native format
   */
  fromSIP(
    sipProof: SingleProof,
    options?: ConversionOptions,
  ): ConversionResult<AnyNativeProof> {
    const system = sipProof.metadata.system
    const converter = this._converters.get(system)

    if (!converter) {
      return {
        success: false,
        error: `Unsupported proof system: ${system}`,
        errorCode: 'INVALID_INPUT',
        lossless: false,
        conversionMetadata: {
          sourceSystem: system,
          targetSystem: system,
          convertedAt: Date.now(),
          converterVersion: '1.0.0',
          conversionTimeMs: 0,
          originalSize: 0,
          convertedSize: 0,
        },
      }
    }

    return converter.fromSIP(sipProof, options)
  }

  /**
   * Get converter for a specific proof system
   */
  getConverter(system: ProofSystem): ProofConverter<AnyNativeProof> | undefined {
    return this._converters.get(system)
  }

  /**
   * Get all supported proof systems
   */
  getSupportedSystems(): ProofSystem[] {
    return Array.from(this._converters.keys())
  }

  /**
   * Check if a proof system is supported
   */
  isSystemSupported(system: ProofSystem): boolean {
    return this._converters.has(system)
  }

  /**
   * Register a custom converter for a proof system
   */
  registerConverter(
    system: ProofSystem,
    converter: ProofConverter<AnyNativeProof>,
  ): void {
    this._converters.set(system, converter)
  }
}

/**
 * Create a unified proof converter
 */
export function createUnifiedConverter(): UnifiedProofConverter {
  return new UnifiedProofConverter()
}

// ─── Convenience Functions ───────────────────────────────────────────────────

/**
 * Convert a native proof to SIP format (convenience function)
 */
export function convertToSIP(
  nativeProof: AnyNativeProof,
  options?: ConversionOptions,
): ConversionResult<SingleProof> {
  const converter = createUnifiedConverter()
  return converter.toSIP(nativeProof, options)
}

/**
 * Convert a SIP proof to native format (convenience function)
 */
export function convertFromSIP(
  sipProof: SingleProof,
  options?: ConversionOptions,
): ConversionResult<AnyNativeProof> {
  const converter = createUnifiedConverter()
  return converter.fromSIP(sipProof, options)
}
